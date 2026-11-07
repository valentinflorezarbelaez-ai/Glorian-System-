/**
 * EOS SYSTEM — EVENT SOURCING ENGINE (Layer 0)
 * Governed by SPEC-160 (Apache Kafka / Databricks append-only log pattern)
 *
 * Implements:
 * - Append-only immutable event log (events never mutated, only added)
 * - Deterministic per-stream sequence numbers + global offset
 * - Snapshot + replay recovery (rebuild state from log)
 * - Pluggable projections (reduce events → read models)
 * - Optimistic concurrency via expected-version guard
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface DomainEvent<T = unknown> {
  readonly streamId: string;
  readonly version: number; // Per-stream monotonic version
  readonly globalOffset: number; // Global append position
  readonly type: string;
  readonly payload: T;
  readonly timestampMs: number;
  readonly eventHash: string; // Deterministic integrity digest
}

export interface Snapshot<S = unknown> {
  readonly streamId: string;
  readonly version: number;
  readonly state: S;
  readonly snapshotHash: string;
}

export type Reducer<S, E> = (state: S, event: DomainEvent<E>) => S;

export class EosEventSourcingEngine {
  private readonly log: DomainEvent[] = [];
  private readonly streamVersions: Map<string, number> = new Map();
  private readonly snapshots: Map<string, Snapshot> = new Map();

  /**
   * Appends an event to a stream with optimistic concurrency control.
   * If expectedVersion is provided, it must equal the current stream version.
   */
  append(streamId: string, type: string, payload: unknown, expectedVersion?: number): DomainEvent {
    assertPrecondition(streamId.length > 0, "streamId must be non-empty");
    assertPrecondition(type.length > 0, "event type must be non-empty");

    const currentVersion = this.streamVersions.get(streamId) ?? 0;
    if (expectedVersion !== undefined) {
      assertPrecondition(
        expectedVersion === currentVersion,
        `Concurrency conflict: expected version ${expectedVersion}, actual ${currentVersion}`,
      );
    }

    const version = currentVersion + 1;
    const globalOffset = this.log.length;
    const timestampMs = Date.now();
    const eventHash = pureSha256(JSON.stringify({ streamId, version, globalOffset, type, payload, timestampMs }));

    const event: DomainEvent = deepFreeze({
      streamId,
      version,
      globalOffset,
      type,
      payload,
      timestampMs,
      eventHash,
    });

    this.log.push(event);
    this.streamVersions.set(streamId, version);
    return event;
  }

  /**
   * Returns all events for a stream, ordered by version.
   */
  readStream(streamId: string, fromVersion = 0): readonly DomainEvent[] {
    return this.log.filter((e) => e.streamId === streamId && e.version > fromVersion);
  }

  /**
   * Rebuilds current stream state by replaying events through a reducer,
   * starting from the latest snapshot when available.
   */
  rebuild<S>(streamId: string, initialState: S, reducer: Reducer<S, unknown>): S {
    const snapshot = this.snapshots.get(streamId);
    let state: S = snapshot ? (snapshot.state as S) : initialState;
    const fromVersion = snapshot ? snapshot.version : 0;
    for (const event of this.readStream(streamId, fromVersion)) {
      state = reducer(state, event);
    }
    return state;
  }

  /**
   * Persists a snapshot for a stream to accelerate future rebuilds.
   */
  snapshot<S>(streamId: string, state: S): Snapshot<S> {
    const version = this.streamVersions.get(streamId) ?? 0;
    const snapshotHash = pureSha256(JSON.stringify({ streamId, version, state }));
    const snap: Snapshot<S> = deepFreeze({ streamId, version, state, snapshotHash });
    this.snapshots.set(streamId, snap as Snapshot);
    return snap;
  }

  /**
   * Verifies the log integrity chain — recomputes each event hash.
   * Returns the first tampered offset, or -1 if the log is intact.
   */
  verifyIntegrity(): number {
    for (const event of this.log) {
      const recomputed = pureSha256(
        JSON.stringify({
          streamId: event.streamId,
          version: event.version,
          globalOffset: event.globalOffset,
          type: event.type,
          payload: event.payload,
          timestampMs: event.timestampMs,
        }),
      );
      if (recomputed !== event.eventHash) {
        return event.globalOffset;
      }
    }
    return -1;
  }

  /**
   * Total number of appended events across all streams.
   */
  get eventCount(): number {
    return this.log.length;
  }

  /**
   * Deterministic fingerprint of the full log state.
   */
  logFingerprint(): string {
    return pureSha256(this.log.map((e) => e.eventHash).join("|"));
  }
}
