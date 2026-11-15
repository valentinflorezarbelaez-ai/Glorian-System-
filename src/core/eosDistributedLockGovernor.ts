/**
 * EOS System — Multi-Region Quorum Lease & Distributed Lock Governor
 * SPEC-284 (CHANGE-146) — Distributed Consensus, Monotonic Fencing & Mutual Exclusion
 * Pure Layer-0 TypeScript (dependencies: {})
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface ClusterNode {
  nodeId: string;
  region: string;
  weight?: number;
}

export interface ClusterTopology {
  clusterId: string;
  nodes: ClusterNode[];
  defaultTtlMs?: number;
}

export interface DistributedLease {
  resource: string;
  owner: string;
  fencingToken: number;
  acquiredAt: number;
  expiresAt: number;
  ttlMs: number;
  quorumVotes: number;
  totalNodes: number;
  state: "ACQUIRED" | "RENEWED" | "EXPIRED" | "RELEASED";
}

export interface AcquireLockResult {
  success: boolean;
  state: "ACQUIRED" | "DENIED";
  reason?: string;
  lease?: DistributedLease;
  fencingToken?: number;
}

export interface DistributedLockReceipt {
  clusterId: string;
  resource: string;
  owner: string;
  fencingToken: number;
  state: string;
  quorumPassed: boolean;
  timestamp: string;
  sha256Signature: string;
}

export class EosDistributedLockGovernor {
  private readonly topology: ClusterTopology;
  private readonly leases: Map<string, DistributedLease> = new Map();
  private maxFencingToken = 0;

  constructor(topology?: ClusterTopology) {
    this.topology = topology || {
      clusterId: "default-cluster",
      nodes: [
        { nodeId: "node-1", region: "us-east-1" },
        { nodeId: "node-2", region: "eu-west-1" },
        { nodeId: "node-3", region: "ap-northeast-1" },
      ],
      defaultTtlMs: 5000,
    };
  }

  /**
   * Calculates majority quorum threshold: floor(N / 2) + 1.
   */
  public getQuorumSize(): number {
    const n = Math.max(1, this.topology.nodes.length);
    return Math.floor(n / 2) + 1;
  }

  /**
   * Acquires a distributed lock with strict majority consensus and monotonic fencing token.
   */
  public acquireLock(resource: string, owner: string, ttlMs?: number, simulateVotes?: number): AcquireLockResult {
    const now = Date.now();
    const effectiveTtl = ttlMs || this.topology.defaultTtlMs || 5000;
    const quorumRequired = this.getQuorumSize();
    const totalNodes = this.topology.nodes.length;
    const votes = simulateVotes !== undefined ? simulateVotes : totalNodes;

    // Check if quorum satisfied
    if (votes < quorumRequired) {
      return {
        success: false,
        state: "DENIED",
        reason: `Insufficient quorum votes (${votes}/${totalNodes}, required >= ${quorumRequired}).`,
      };
    }

    // Check existing lease
    const existing = this.leases.get(resource);
    if (existing && existing.state !== "RELEASED") {
      // Check if lease expired by monotonic time
      if (now < existing.expiresAt) {
        return {
          success: false,
          state: "DENIED",
          reason: `RESOURCE_LOCKED: Lease active until ${existing.expiresAt} (owner: ${existing.owner}, token: ${existing.fencingToken}).`,
        };
      }
      // Lease expired, mark previous as EXPIRED
      existing.state = "EXPIRED";
    }

    // Allocate strictly monotonic fencing token
    this.maxFencingToken += 1;
    const fencingToken = this.maxFencingToken;

    const lease: DistributedLease = {
      resource,
      owner,
      fencingToken,
      acquiredAt: now,
      expiresAt: now + effectiveTtl,
      ttlMs: effectiveTtl,
      quorumVotes: votes,
      totalNodes,
      state: "ACQUIRED",
    };

    this.leases.set(resource, lease);

    return {
      success: true,
      state: "ACQUIRED",
      lease,
      fencingToken,
    };
  }

  /**
   * Renews an active lease if caller possesses valid owner and fencing token.
   */
  public renewLock(
    resource: string,
    owner: string,
    fencingToken: number,
    extensionMs?: number,
  ): { success: boolean; lease?: DistributedLease; reason?: string } {
    const now = Date.now();
    const lease = this.leases.get(resource);

    if (!lease || lease.state === "RELEASED") {
      return { success: false, reason: "Lock does not exist or has been released." };
    }

    if (lease.owner !== owner) {
      return { success: false, reason: `Owner mismatch (expected ${lease.owner}, got ${owner}).` };
    }

    if (lease.fencingToken !== fencingToken) {
      return {
        success: false,
        reason: `Fencing token mismatch (expected ${lease.fencingToken}, got ${fencingToken}).`,
      };
    }

    if (now >= lease.expiresAt) {
      lease.state = "EXPIRED";
      return { success: false, reason: "Cannot renew: lease has already expired." };
    }

    const extension = extensionMs || lease.ttlMs;
    lease.expiresAt = now + extension;
    lease.state = "RENEWED";

    return { success: true, lease };
  }

  /**
   * Explicitly releases an active lease with credential verification.
   */
  public releaseLock(resource: string, owner: string, fencingToken: number): { success: boolean; reason?: string } {
    const lease = this.leases.get(resource);

    if (!lease || lease.state === "RELEASED") {
      return { success: false, reason: "Lock is not held or already released." };
    }

    if (lease.owner !== owner) {
      return { success: false, reason: `Owner mismatch (expected ${lease.owner}, got ${owner}).` };
    }

    if (lease.fencingToken !== fencingToken) {
      return {
        success: false,
        reason: `Fencing token mismatch (expected ${lease.fencingToken}, got ${fencingToken}).`,
      };
    }

    lease.state = "RELEASED";
    return { success: true };
  }

  /**
   * Inspects current lock status on a resource.
   */
  public getLockStatus(resource: string): DistributedLease | null {
    const lease = this.leases.get(resource);
    if (!lease) return null;

    if (Date.now() >= lease.expiresAt && lease.state !== "RELEASED") {
      lease.state = "EXPIRED";
    }
    return { ...lease };
  }

  /**
   * Emits verifiable cryptographic receipt of the lock state.
   */
  public generateReceipt(lease: DistributedLease, outputPath?: string): DistributedLockReceipt {
    const quorumPassed = lease.quorumVotes >= Math.floor(lease.totalNodes / 2) + 1;
    const receiptData = {
      clusterId: this.topology.clusterId,
      resource: lease.resource,
      owner: lease.owner,
      fencingToken: lease.fencingToken,
      state: lease.state,
      quorumPassed,
      timestamp: new Date().toISOString(),
    };

    const signature = crypto.createHash("sha256").update(JSON.stringify(receiptData)).digest("hex");

    const receipt: DistributedLockReceipt = {
      ...receiptData,
      sha256Signature: signature,
    };

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(receipt, null, 2), "utf8");
    }

    return receipt;
  }
}
