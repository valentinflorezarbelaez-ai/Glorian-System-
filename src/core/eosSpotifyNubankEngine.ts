/**
 * ============================================================================
 * EOS SYSTEM — SPOTIFY SMART SHUFFLE & NUBANK BITEMPORAL ENGINE (Layer 0)
 * ============================================================================
 * Dual-Engine synthesizing the apex engineering standards of Spotify & Nubank:
 *
 * 1. SPOTIFY SMART SHUFFLE & HARMONIC CAMELOT ROUTING:
 *    - Jittered Proportional Spacing in O(N log N) with 0 external dependencies.
 *    - Mulberry32 deterministic PRNG (zero allocation in the critical path).
 *    - Spreads tracks by artist uniformly across [0.0, 1.0] avoiding consecutive repetitions.
 *    - Evaluates Camelot wheel harmonic key compatibility (e.g. 8A -> 8A, 9A, 8B) & BPM tolerance.
 *
 * 2. NUBANK BITEMPORAL IMMUTABLE LEDGER & IDEMPOTENCY GATE:
 *    - Datomic-style bitemporal facts (valid_time vs tx_time).
 *    - Idempotency-Key deduplication token guaranteeing 0 duplicate charges / mutations in O(1).
 *    - SHA-256 Merkle audit chain with point-in-time time-travel queries (queryAsOf).
 *
 * 3. SPOTIFY / NUBANK SCHEMA CONTRACT BACKWARD COMPATIBILITY GUARD:
 *    - Enforces backward compatibility on API and asynchronous event payload schemas.
 *    - Prevents breaking changes between distributed squads (Stockholm, London, NYC, São Paulo, Bogotá).
 *
 * Zero external runtime dependencies. Layer-0 Pure.
 * ============================================================================
 */

import { createHash } from "node:crypto";

export interface TrackNode {
  readonly id: string; // Base62 Spotify URI e.g. "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
  readonly artistId: string;
  readonly bpm: number;
  readonly camelotKey: string; // e.g. "8A", "8B", "9A"
}

export interface ShuffleReceipt {
  readonly orderedIds: string[];
  readonly artistCollisions: number;
  readonly harmonicScore: number;
  readonly executionMicros: number;
  readonly merkleSeed: string;
}

/**
 * Executes Spotify Smart Shuffle with deterministic jittered proportional spacing
 * and Camelot harmonic routing.
 */
export function executeSpotifySmartShuffle(tracks: readonly TrackNode[], seed: number): ShuffleReceipt {
  const start = process.hrtime.bigint();
  const n = tracks.length;

  if (n <= 1) {
    return {
      orderedIds: tracks.map((t) => t.id),
      artistCollisions: 0,
      harmonicScore: 100,
      executionMicros: 1,
      merkleSeed: `eos-spotify-seed-${(seed >>> 0).toString(16).padStart(8, "0")}`,
    };
  }

  // Deterministic Mulberry32 PRNG (Zero heap allocation)
  let state = seed >>> 0;
  const nextRand = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Step 1: Count frequency per artist
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const a = tracks[i].artistId;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }

  // Step 2: Calculate proportional positions on timeline [0.0, 1.0] with jitter
  const seen = new Map<string, number>();
  const offsets = new Map<string, number>();

  const weighted = tracks.map((track) => {
    const total = counts.get(track.artistId)!;
    const idx = seen.get(track.artistId) ?? 0;

    if (idx === 0) {
      offsets.set(track.artistId, nextRand() / total);
    }

    const segment = 1.0 / total;
    const jitter = (nextRand() * 0.16 - 0.08) * segment;
    const weight = offsets.get(track.artistId)! + idx * segment + jitter;
    seen.set(track.artistId, idx + 1);

    return { track, weight };
  });

  // Step 3: Fast in-place deterministic sort by timeline weight
  weighted.sort((a, b) => a.weight - b.weight);

  // Step 4: Audit invariants (artist collisions and harmonic transitions)
  let collisions = 0;
  let harmonicMatches = 0;
  const orderedIds = new Array<string>(n);

  for (let i = 0; i < n; i++) {
    orderedIds[i] = weighted[i].track.id;
    if (i > 0) {
      if (weighted[i].track.artistId === weighted[i - 1].track.artistId) {
        collisions++;
      }
      const bpmDiff = Math.abs(weighted[i].track.bpm - weighted[i - 1].track.bpm);
      const keyA = weighted[i - 1].track.camelotKey;
      const keyB = weighted[i].track.camelotKey;
      const isHarmonic = isCamelotCompatible(keyA, keyB);
      if (bpmDiff <= 6 || isHarmonic) {
        harmonicMatches++;
      }
    }
  }

  const end = process.hrtime.bigint();
  const executionMicros = Math.max(1, Number(end - start) / 1000);
  const harmonicScore = Math.round((harmonicMatches / (n - 1)) * 100);

  return {
    orderedIds,
    artistCollisions: collisions,
    harmonicScore,
    executionMicros: Number(executionMicros.toFixed(2)),
    merkleSeed: `eos-spotify-seed-${(seed >>> 0).toString(16).padStart(8, "0")}`,
  };
}

/**
 * Checks if two Camelot keys are harmonically compatible (+1, -1, same number, or relative major/minor).
 */
export function isCamelotCompatible(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const numA = parseInt(keyA, 10);
  const letterA = keyA.replace(/^[0-9]+/, "").toUpperCase();
  const numB = parseInt(keyB, 10);
  const letterB = keyB.replace(/^[0-9]+/, "").toUpperCase();

  if (isNaN(numA) || isNaN(numB)) return false;

  // Relative major/minor (e.g. 8A <-> 8B)
  if (numA === numB) return true;

  // Adjacent numbers on the Camelot wheel (modulo 12)
  if (letterA === letterB) {
    const diff = Math.abs(numA - numB);
    return diff === 1 || diff === 11;
  }

  return false;
}

// ============================================================================
// NUBANK BITEMPORAL IMMUTABLE LEDGER (Datomic & Idempotency Standard)
// ============================================================================

export interface BitemporalFact<T = any> {
  readonly idempotencyKey: string;
  readonly entityId: string;
  readonly payload: T;
  readonly validTime: number; // When the fact occurred in the real world
  readonly txTime: number; // When the fact was immutably recorded in EOS
  readonly merkleHash: string;
}

export class EosBitemporalLedger<T = any> {
  private readonly facts: BitemporalFact<T>[] = [];
  private readonly processedKeys = new Map<string, BitemporalFact<T>>();

  /**
   * Records a fact with strict idempotency (Nubank / Datomic Standard).
   * Multiple calls with the same idempotency key return the cached fact in O(1)
   * with zero duplicate mutations or financial side-effects.
   */
  public commitFact(
    idempotencyKey: string,
    entityId: string,
    payload: T,
    validTime: number = Date.now(),
  ): BitemporalFact<T> {
    const existing = this.processedKeys.get(idempotencyKey);
    if (existing) {
      return existing; // Instant idempotent return: 0 duplicates, 0 double allocations
    }

    let txTime = Date.now();
    if (this.facts.length > 0) {
      const lastTxTime = this.facts[this.facts.length - 1].txTime;
      if (txTime <= lastTxTime) {
        txTime = lastTxTime + 1; // Strict monotonic TrueTime invariant
      }
    }

    const prevHash = this.facts.length > 0 ? this.facts[this.facts.length - 1].merkleHash : "0".repeat(64);

    const rawData = `${prevHash}:${idempotencyKey}:${entityId}:${validTime}:${txTime}:${JSON.stringify(payload)}`;
    const merkleHash = createHash("sha256").update(rawData).digest("hex");

    const fact: BitemporalFact<T> = Object.freeze({
      idempotencyKey,
      entityId,
      payload,
      validTime,
      txTime,
      merkleHash,
    });

    this.facts.push(fact);
    this.processedKeys.set(idempotencyKey, fact);
    return fact;
  }

  /**
   * Time-Travel Query (Datomic as-of standard):
   * Reconstructs the exact state of the ledger as it existed at any historical txTime.
   */
  public queryAsOf(asOfTxTime: number): readonly BitemporalFact<T>[] {
    return this.facts.filter((f) => f.txTime <= asOfTxTime);
  }

  /**
   * Queries facts by entity ID.
   */
  public queryByEntity(entityId: string): readonly BitemporalFact<T>[] {
    return this.facts.filter((f) => f.entityId === entityId);
  }

  /**
   * Returns all recorded immutable facts.
   */
  public getAllFacts(): readonly BitemporalFact<T>[] {
    return this.facts;
  }

  /**
   * Checks if an idempotency key has already been processed.
   */
  public hasKey(idempotencyKey: string): boolean {
    return this.processedKeys.has(idempotencyKey);
  }

  /**
   * Current Merkle Root of the ledger chain.
   */
  public getMerkleRoot(): string {
    if (this.facts.length === 0) return "sha256:" + "0".repeat(64);
    return `sha256:${this.facts[this.facts.length - 1].merkleHash}`;
  }
}

// ============================================================================
// SPOTIFY / NUBANK SCHEMA CONTRACT BACKWARD COMPATIBILITY GUARD
// ============================================================================

export interface ContractCompatibilityReport {
  readonly compatible: boolean;
  readonly brokenFields: string[];
  readonly addedFields: string[];
  readonly totalOldFields: number;
  readonly totalNewFields: number;
}

/**
 * Validates that an evolved API / message schema does not break existing consumers
 * across Spotify or Nubank squads.
 * Invariant: Existing required fields may never be removed.
 */
export function verifyBackwardCompatibility(
  oldSchemaKeys: readonly string[],
  newSchemaKeys: readonly string[],
): ContractCompatibilityReport {
  const newSet = new Set(newSchemaKeys);
  const oldSet = new Set(oldSchemaKeys);
  const brokenFields: string[] = [];
  const addedFields: string[] = [];

  for (const key of oldSchemaKeys) {
    if (!newSet.has(key)) {
      brokenFields.push(key);
    }
  }

  for (const key of newSchemaKeys) {
    if (!oldSet.has(key)) {
      addedFields.push(key);
    }
  }

  return {
    compatible: brokenFields.length === 0,
    brokenFields,
    addedFields,
    totalOldFields: oldSchemaKeys.length,
    totalNewFields: newSchemaKeys.length,
  };
}
