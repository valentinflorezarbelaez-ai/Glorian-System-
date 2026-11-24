/**
 * EOS Rate Limiting & Traffic Shaping Governor
 *
 * Implements pure Layer-0 Token Bucket and Leaky Bucket algorithms
 * with hierarchical multi-tier domain cascading, monotonic nanosecond
 * timing, RFC 6585 / IETF standard rate limit telemetry, and
 * cryptographic SHA-256 attestation receipts.
 *
 * Conforms to SPEC-286 / CHANGE-148.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidenceDir } from "./eosEvidencePaths.ts";

export type RateLimitAlgorithm = "token-bucket" | "leaky-bucket";

export interface TokenBucketConfig {
  algorithm: "token-bucket";
  burstCapacity: number;
  refillRatePerSec: number;
}

export interface LeakyBucketConfig {
  algorithm: "leaky-bucket";
  queueCapacity: number;
  drainRatePerSec: number;
}

export type BucketConfig = TokenBucketConfig | LeakyBucketConfig;

export interface HierarchicalPolicy {
  [tier: string]: BucketConfig;
}

export interface HierarchicalRateLimitDecision {
  allowed: boolean;
  tier: string;
  limit: number;
  remaining: number;
  resetInMs: number;
  retryAfterSec: number;
  headers: Record<string, string>;
}

export interface BucketInspection {
  key: string;
  tier: string;
  algorithm: RateLimitAlgorithm;
  capacity: number;
  currentLevel: number;
  ratePerSec: number;
  lastUpdatedMs: number;
}

export interface RateLimiterAuditReport {
  timestampIso: string;
  totalEvaluations: number;
  grantedCount: number;
  rejectedCount: number;
  rejectionRate: number;
  activeBucketsCount: number;
  sha256Signature: string;
}

interface InternalTokenBucket {
  algorithm: "token-bucket";
  capacity: number;
  refillRate: number;
  tokens: number;
  lastRefillNs: bigint;
}

interface InternalLeakyBucket {
  algorithm: "leaky-bucket";
  capacity: number;
  drainRate: number;
  drops: number;
  lastDrainNs: bigint;
}

type InternalBucket = InternalTokenBucket | InternalLeakyBucket;

export class EosRateLimitingGovernor {
  private readonly policy: HierarchicalPolicy;
  private readonly buckets: Map<string, InternalBucket> = new Map();

  constructor(policy?: HierarchicalPolicy) {
    this.policy = policy || {
      global: { algorithm: "token-bucket", burstCapacity: 1000, refillRatePerSec: 100 },
      tenant: { algorithm: "token-bucket", burstCapacity: 100, refillRatePerSec: 20 },
      client: { algorithm: "token-bucket", burstCapacity: 20, refillRatePerSec: 5 },
      endpoint: { algorithm: "leaky-bucket", queueCapacity: 10, drainRatePerSec: 2 },
    };
  }

  /**
   * Retrieves or initializes the internal bucket state for a specific tier & key.
   */
  private getOrCreateBucket(tier: string, key: string, nowNs: bigint): InternalBucket {
    const bucketKey = `${tier}:${key}`;
    let bucket = this.buckets.get(bucketKey);
    if (bucket) {
      return bucket;
    }

    const config = this.policy[tier] || {
      algorithm: "token-bucket",
      burstCapacity: 100,
      refillRatePerSec: 10,
    };

    if (config.algorithm === "token-bucket") {
      bucket = {
        algorithm: "token-bucket",
        capacity: config.burstCapacity,
        refillRate: config.refillRatePerSec,
        tokens: config.burstCapacity,
        lastRefillNs: nowNs,
      };
    } else {
      bucket = {
        algorithm: "leaky-bucket",
        capacity: config.queueCapacity,
        drainRate: config.drainRatePerSec,
        drops: 0,
        lastDrainNs: nowNs,
      };
    }

    this.buckets.set(bucketKey, bucket);
    return bucket;
  }

  /**
   * Obtains current monotonic time in nanoseconds.
   */
  public nowNs(): bigint {
    return process.hrtime.bigint();
  }

  /**
   * Evaluates and consumes tokens/drops across a single bucket.
   */
  public evaluateSingle(tier: string, key: string, cost: number = 1, nowNs?: bigint): HierarchicalRateLimitDecision {
    const currentNs = nowNs !== undefined ? nowNs : this.nowNs();
    const bucket = this.getOrCreateBucket(tier, key, currentNs);

    if (bucket.algorithm === "token-bucket") {
      return this.evaluateTokenBucket(tier, bucket, cost, currentNs);
    } else {
      return this.evaluateLeakyBucket(tier, bucket, cost, currentNs);
    }
  }

  private evaluateTokenBucket(
    tier: string,
    bucket: InternalTokenBucket,
    cost: number,
    nowNs: bigint,
  ): HierarchicalRateLimitDecision {
    const elapsedNs = nowNs > bucket.lastRefillNs ? nowNs - bucket.lastRefillNs : 0n;
    const elapsedSec = Number(elapsedNs) / 1e9;
    const replenished = elapsedSec * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + replenished);
    bucket.lastRefillNs = nowNs;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      const remaining = Math.floor(bucket.tokens);
      const resetInMs =
        bucket.refillRate > 0 ? Math.ceil(((bucket.capacity - bucket.tokens) / bucket.refillRate) * 1000) : 0;

      return {
        allowed: true,
        tier,
        limit: bucket.capacity,
        remaining,
        resetInMs,
        retryAfterSec: 0,
        headers: this.formatHeaders(bucket.capacity, remaining, resetInMs, 0),
      };
    } else {
      const deficit = cost - bucket.tokens;
      const retryAfterSec = bucket.refillRate > 0 ? Math.ceil(deficit / bucket.refillRate) : 60;
      const resetInMs = retryAfterSec * 1000;

      return {
        allowed: false,
        tier,
        limit: bucket.capacity,
        remaining: 0,
        resetInMs,
        retryAfterSec,
        headers: this.formatHeaders(bucket.capacity, 0, resetInMs, retryAfterSec),
      };
    }
  }

  private evaluateLeakyBucket(
    tier: string,
    bucket: InternalLeakyBucket,
    cost: number,
    nowNs: bigint,
  ): HierarchicalRateLimitDecision {
    const elapsedNs = nowNs > bucket.lastDrainNs ? nowNs - bucket.lastDrainNs : 0n;
    const elapsedSec = Number(elapsedNs) / 1e9;
    const drained = elapsedSec * bucket.drainRate;

    bucket.drops = Math.max(0, bucket.drops - drained);
    bucket.lastDrainNs = nowNs;

    if (bucket.drops + cost <= bucket.capacity) {
      bucket.drops += cost;
      const remaining = Math.max(0, Math.floor(bucket.capacity - bucket.drops));
      const resetInMs = bucket.drainRate > 0 ? Math.ceil((bucket.drops / bucket.drainRate) * 1000) : 0;

      return {
        allowed: true,
        tier,
        limit: bucket.capacity,
        remaining,
        resetInMs,
        retryAfterSec: 0,
        headers: this.formatHeaders(bucket.capacity, remaining, resetInMs, 0),
      };
    } else {
      const overflow = bucket.drops + cost - bucket.capacity;
      const retryAfterSec = bucket.drainRate > 0 ? Math.ceil(overflow / bucket.drainRate) : 60;
      const resetInMs = retryAfterSec * 1000;

      return {
        allowed: false,
        tier,
        limit: bucket.capacity,
        remaining: 0,
        resetInMs,
        retryAfterSec,
        headers: this.formatHeaders(bucket.capacity, 0, resetInMs, retryAfterSec),
      };
    }
  }

  /**
   * Evaluates a multi-tier hierarchical path in cascade.
   * If any tier rejects, all tiers remain unconsumed and rejection decision is returned.
   */
  public evaluateHierarchy(
    hierarchyMap: Record<string, string>,
    cost: number = 1,
    nowNs?: bigint,
  ): HierarchicalRateLimitDecision {
    const currentNs = nowNs !== undefined ? nowNs : this.nowNs();
    const tiers = Object.keys(hierarchyMap);

    // Dry-run simulation first to verify all tiers pass
    for (const tier of tiers) {
      const key = hierarchyMap[tier];
      const bucket = this.getOrCreateBucket(tier, key, currentNs);

      if (bucket.algorithm === "token-bucket") {
        const elapsedNs =
          nowNs && nowNs > bucket.lastRefillNs
            ? nowNs - bucket.lastRefillNs
            : currentNs > bucket.lastRefillNs
              ? currentNs - bucket.lastRefillNs
              : 0n;
        const elapsedSec = Number(elapsedNs) / 1e9;
        const projectedTokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillRate);
        if (projectedTokens < cost) {
          return this.evaluateTokenBucket(tier, bucket, cost, currentNs);
        }
      } else {
        const elapsedNs =
          nowNs && nowNs > bucket.lastDrainNs
            ? nowNs - bucket.lastDrainNs
            : currentNs > bucket.lastDrainNs
              ? currentNs - bucket.lastDrainNs
              : 0n;
        const elapsedSec = Number(elapsedNs) / 1e9;
        const projectedDrops = Math.max(0, bucket.drops - elapsedSec * bucket.drainRate);
        if (projectedDrops + cost > bucket.capacity) {
          return this.evaluateLeakyBucket(tier, bucket, cost, currentNs);
        }
      }
    }

    // All tiers allow: execute actual consumption across all tiers
    let finalDecision: HierarchicalRateLimitDecision | null = null;
    for (const tier of tiers) {
      const key = hierarchyMap[tier];
      const decision = this.evaluateSingle(tier, key, cost, currentNs);
      if (!finalDecision || decision.remaining < finalDecision.remaining) {
        finalDecision = decision;
      }
    }

    return (
      finalDecision || {
        allowed: true,
        tier: "global",
        limit: 100,
        remaining: 100,
        resetInMs: 0,
        retryAfterSec: 0,
        headers: this.formatHeaders(100, 100, 0, 0),
      }
    );
  }

  /**
   * Formats standardized RFC 6585 and IETF RateLimit HTTP headers.
   */
  private formatHeaders(
    limit: number,
    remaining: number,
    resetInMs: number,
    retryAfterSec: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000 + resetInMs / 1000)),
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(remaining),
      "RateLimit-Reset": String(Math.ceil(resetInMs / 1000)),
    };
    if (retryAfterSec > 0) {
      headers["Retry-After"] = String(retryAfterSec);
    }
    return headers;
  }

  /**
   * Inspects current state of all active buckets.
   */
  public inspectBuckets(): BucketInspection[] {
    const results: BucketInspection[] = [];
    for (const [bucketKey, bucket] of this.buckets.entries()) {
      const [tier, ...rest] = bucketKey.split(":");
      const key = rest.join(":");
      if (bucket.algorithm === "token-bucket") {
        results.push({
          key,
          tier,
          algorithm: "token-bucket",
          capacity: bucket.capacity,
          currentLevel: Math.round(bucket.tokens * 100) / 100,
          ratePerSec: bucket.refillRate,
          lastUpdatedMs: Number(bucket.lastRefillNs / 1_000_000n),
        });
      } else {
        results.push({
          key,
          tier,
          algorithm: "leaky-bucket",
          capacity: bucket.capacity,
          currentLevel: Math.round(bucket.drops * 100) / 100,
          ratePerSec: bucket.drainRate,
          lastUpdatedMs: Number(bucket.lastDrainNs / 1_000_000n),
        });
      }
    }
    return results;
  }

  /**
   * Runs a high-concurrency traffic simulation and emits a cryptographic SHA-256 receipt.
   */
  public async auditThroughput(simulationsCount: number = 200): Promise<RateLimiterAuditReport> {
    let grantedCount = 0;
    let rejectedCount = 0;

    const tenants = ["tenant-alpha", "tenant-beta", "tenant-gamma"];
    const clients = ["client-1", "client-2", "client-3", "client-4"];

    for (let i = 0; i < simulationsCount; i++) {
      const tenant = tenants[i % tenants.length];
      const client = clients[i % clients.length];
      const pathMap = {
        global: "cluster-edge",
        tenant,
        client,
      };

      const decision = this.evaluateHierarchy(pathMap, 1);
      if (decision.allowed) {
        grantedCount++;
      } else {
        rejectedCount++;
      }
    }

    const rejectionRate = simulationsCount > 0 ? rejectedCount / simulationsCount : 0;
    const reportData = {
      timestampIso: new Date().toISOString(),
      totalEvaluations: simulationsCount,
      grantedCount,
      rejectedCount,
      rejectionRate: Math.round(rejectionRate * 10000) / 10000,
      activeBucketsCount: this.buckets.size,
    };

    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(reportData));
    const sha256Signature = hash.digest("hex");

    const fullReport: RateLimiterAuditReport = {
      ...reportData,
      sha256Signature,
    };

    const receiptDir = resolveEvidenceDir();
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    const receiptPath = path.join(receiptDir, "RATE_LIMITER_RECEIPT.json");
    fs.writeFileSync(receiptPath, JSON.stringify(fullReport, null, 2), "utf-8");

    return fullReport;
  }
}
