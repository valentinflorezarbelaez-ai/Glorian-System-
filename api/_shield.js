/**
 * Glorian System — DevSecOps Kernel Interceptor & Golden Path Shield (Layer 1)
 * Governed by SPEC-271 / CHANGE-133 / ADR-133-001
 *
 * Enforces in-process platform engineering controls:
 * 1. Event Loop Saturation Governor (Load shedding during CPU delay > 50ms)
 * 2. Adaptive Rate Limiter (AIMD token bucket & sliding window rate defense)
 * 3. Idempotency Key Store (Replay defense & duplicate transaction prevention)
 *
 * Invariant: Zero external npm dependencies. Private internal module (prefixed with _).
 */

import { EosAdaptiveRateLimiter } from "../src/core/eosAdaptiveRateLimiter.ts";
import { EosEventLoopSaturationGovernor } from "../src/core/eosEventLoopSaturationGovernor.ts";
import { EosIdempotencyKeyStore } from "../src/core/eosIdempotencyKeyStore.ts";

// Shared in-process singleton instances
const rateLimiter = new EosAdaptiveRateLimiter({
  bucketCapacity: 120,
  refillRatePerSec: 30,
  windowSizeMs: 60000,
  maxPerWindow: 150,
  adaptive: true,
});

const saturationGovernor = new EosEventLoopSaturationGovernor(50.0, 3, 5);
saturationGovernor.start();

const idempotencyStore = new EosIdempotencyKeyStore();

/**
 * Extracts idempotency key from standard headers.
 */
export function extractIdempotencyKey(req) {
  if (!req || !req.headers) return null;
  const key = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (typeof key === "string" && key.trim().length > 0) {
    return key.trim().slice(0, 128);
  }
  return null;
}

/**
 * Applies in-process platform shielding to kernel requests.
 * Returns true if request should continue, or false if already responded to.
 */
export function applyKernelShield(req, res) {
  // 1. Backpressure: Event loop saturation governor
  if (saturationGovernor.shouldShedLoad("NORMAL")) {
    res.setHeader("Retry-After", "1");
    res.setHeader("X-Load-Shedding", "EVENT_LOOP_SATURATION");
    res.status(503).json({
      status: "SERVICE_UNAVAILABLE",
      reason: "Event loop saturation detected; shedding load to preserve system stability.",
      retryAfterSeconds: 1,
    });
    return false;
  }

  // 2. Adaptive Rate Limiter
  const decision = rateLimiter.tryAcquire();
  res.setHeader("X-RateLimit-Remaining", String(decision.remainingTokens));
  res.setHeader("X-RateLimit-Capacity", String(decision.currentCapacity));

  if (!decision.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(decision.retryAfterMs / 1000)));
    res.status(429).json({
      status: "TOO_MANY_REQUESTS",
      retryAfterMs: decision.retryAfterMs,
      remainingTokens: 0,
    });
    return false;
  }

  // 3. Transactional Idempotency Replay Defense
  const idempKey = extractIdempotencyKey(req);
  if (idempKey) {
    const outcome = idempotencyStore.begin(idempKey, req.url || "", 300000);
    if (outcome.kind === "REPLAY") {
      res.setHeader("X-Idempotency", "REPLAYED");
      res.status(200).json(outcome.response);
      return false;
    }
    if (outcome.kind === "REPLAY_ATTACK") {
      res.setHeader("X-Idempotency", "REPLAY_ATTACK_DETECTED");
      res.status(409).json({
        status: "CONFLICT",
        error: "Idempotency key reuse with mismatched request parameters.",
      });
      return false;
    }
    res.setHeader("X-Idempotency", "STORED");
    req._idempotencyKey = idempKey;
  }

  return true;
}

/**
 * Completes an idempotent record with its generated response.
 */
export function recordIdempotentResponse(req, payload) {
  if (req && req._idempotencyKey) {
    try {
      idempotencyStore.complete(req._idempotencyKey, payload);
    } catch {
      // Safe fail-soft on completion
    }
  }
}

/**
 * Accessor for health check diagnostics.
 */
export function getShieldDiagnostics() {
  const satReport = saturationGovernor.sample();
  return {
    rateLimiterActive: true,
    eventLoopLagMs: satReport.p99Ms,
    warmupActive: satReport.warmupActive,
    sheddingActive: satReport.sheddingActive,
    governorState: satReport.state,
  };
}
