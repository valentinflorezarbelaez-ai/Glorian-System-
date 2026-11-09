/**
 * EOS SYSTEM — IDEMPOTENCY KEY STORE (Layer 0)
 * Governed by SPEC-166 (Stripe / AWS API Gateway idempotent mutation pattern)
 *
 * Implements:
 * - Key registration with TTL and response caching
 * - In-flight locking: concurrent callers with the same key await the first result
 * - Request-fingerprint mismatch detection (same key, different payload → REPLAY_ATTACK)
 * - Deterministic key digest and store-state fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface IdempotencyRecord {
  readonly key: string;
  readonly requestFingerprint: string;
  readonly state: "IN_FLIGHT" | "COMPLETED";
  readonly response?: unknown;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export type IdempotencyOutcome =
  | { kind: "NEW"; record: IdempotencyRecord }
  | { kind: "REPLAY"; record: IdempotencyRecord; response: unknown }
  | { kind: "IN_FLIGHT_WAIT"; record: IdempotencyRecord }
  | { kind: "REPLAY_ATTACK"; stored: IdempotencyRecord };

export class EosIdempotencyKeyStore {
  private readonly store: Map<string, IdempotencyRecord> = new Map();

  /**
   * Begins processing a mutation keyed by idempotencyKey.
   * requestPayload is fingerprinted; re-sending the same key with a
   * different payload is rejected as a replay attack.
   */
  begin(key: string, requestPayload: unknown, ttlMs: number): IdempotencyOutcome {
    assertPrecondition(key.length > 0, "idempotency key required");
    assertPrecondition(ttlMs > 0, "ttlMs must be positive");

    const now = Date.now();
    const fingerprint = pureSha256(JSON.stringify(requestPayload));
    const existing = this.store.get(key);

    if (existing && existing.expiresAtMs > now) {
      if (existing.requestFingerprint !== fingerprint) {
        return deepFreeze({ kind: "REPLAY_ATTACK", stored: existing });
      }
      if (existing.state === "COMPLETED") {
        return deepFreeze({ kind: "REPLAY", record: existing, response: existing.response });
      }
      return deepFreeze({ kind: "IN_FLIGHT_WAIT", record: existing });
    }

    const record: IdempotencyRecord = deepFreeze({
      key,
      requestFingerprint: fingerprint,
      state: "IN_FLIGHT",
      createdAtMs: now,
      expiresAtMs: now + ttlMs,
    });
    this.store.set(key, record);
    return deepFreeze({ kind: "NEW", record });
  }

  /**
   * Marks an in-flight key as completed with the cached response.
   */
  complete(key: string, response: unknown): IdempotencyRecord {
    const existing = this.store.get(key);
    assertPrecondition(existing !== undefined && existing.state === "IN_FLIGHT", `no in-flight record for key ${key}`);
    const completed: IdempotencyRecord = deepFreeze({
      key: existing!.key,
      requestFingerprint: existing!.requestFingerprint,
      state: "COMPLETED",
      response: deepFreeze(response),
      createdAtMs: existing!.createdAtMs,
      expiresAtMs: existing!.expiresAtMs,
    });
    this.store.set(key, completed);
    return completed;
  }

  /**
   * Aborts an in-flight record so a retry may re-execute the operation.
   */
  abort(key: string): boolean {
    const existing = this.store.get(key);
    if (!existing || existing.state !== "IN_FLIGHT") return false;
    this.store.delete(key);
    return true;
  }

  /**
   * Removes expired records; returns the count purged.
   */
  sweep(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, rec] of this.store) {
      if (rec.expiresAtMs <= now) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  get size(): number {
    return this.store.size;
  }

  storeFingerprint(): string {
    const sorted = [...this.store.values()].sort((a, b) => a.key.localeCompare(b.key));
    return pureSha256(JSON.stringify(sorted.map((r) => [r.key, r.state, r.requestFingerprint])));
  }
}
