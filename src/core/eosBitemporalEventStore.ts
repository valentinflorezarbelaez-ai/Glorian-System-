/**
 * EOS Sovereign Architecture - Layer 0
 * Bitemporal Event Store & Change Data Capture (CDC) Governor
 * SPEC-281 / CHANGE-143
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface BitemporalEvent {
  streamId: string;
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
  validTime: string; // ISO 8601 (Real-world domain time)
  transactionTime: string; // ISO 8601 (Monotonic system recording time)
  idempotencyKey?: string;
  previousEventHash: string;
  eventHash: string;
}

export interface AppendEventInput {
  streamId: string;
  eventType: string;
  payload: Record<string, unknown>;
  validTime?: string;
  idempotencyKey?: string;
}

export interface ReplayOptions<T = Record<string, unknown>> {
  asOfValidTime?: string;
  asOfTransactionTime?: string;
  initialState?: T;
  reducer?: (state: T, event: BitemporalEvent) => T;
}

export type CdcOperation = "CREATE" | "UPDATE" | "DELETE";

export interface CdcEnvelope {
  operation: CdcOperation;
  streamId: string;
  sequenceNumber: number;
  eventType: string;
  timestamp: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }>;
}

export interface EventStoreReceipt {
  schemaVersion: "1.0.0";
  timestamp: string;
  totalStreams: number;
  totalEvents: number;
  evidenceSha256: string;
}

function computeEventHash(
  streamId: string,
  seq: number,
  type: string,
  payload: Record<string, unknown>,
  validTime: string,
  txTime: string,
  prevHash: string,
): string {
  const content = JSON.stringify({
    streamId,
    seq,
    type,
    payload,
    validTime,
    txTime,
    prevHash,
  });
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class EosBitemporalEventStore {
  private streams: Map<string, BitemporalEvent[]> = new Map();
  private idempotencyIndex: Map<string, BitemporalEvent> = new Map();
  private evidencePath: string;

  constructor(evidencePath?: string) {
    this.evidencePath = evidencePath ?? path.resolve("docs/evidence/EVENTSTORE_RECEIPT.json");
  }

  public appendEvent(input: AppendEventInput): BitemporalEvent {
    if (!input.streamId || !input.eventType) {
      throw new Error("Invalid event: missing streamId or eventType");
    }

    if (input.idempotencyKey && this.idempotencyIndex.has(input.idempotencyKey)) {
      return this.idempotencyIndex.get(input.idempotencyKey)!;
    }

    const stream = this.streams.get(input.streamId) ?? [];
    const sequenceNumber = stream.length + 1;
    const previousEventHash = stream.length > 0 ? stream[stream.length - 1].eventHash : "0".repeat(64);

    const validTime = input.validTime ?? new Date().toISOString();
    const transactionTime = new Date().toISOString();
    const payload = input.payload ?? {};

    const eventHash = computeEventHash(
      input.streamId,
      sequenceNumber,
      input.eventType,
      payload,
      validTime,
      transactionTime,
      previousEventHash,
    );

    const event: BitemporalEvent = {
      streamId: input.streamId,
      sequenceNumber,
      eventType: input.eventType,
      payload,
      validTime,
      transactionTime,
      idempotencyKey: input.idempotencyKey,
      previousEventHash,
      eventHash,
    };

    stream.push(event);
    this.streams.set(input.streamId, stream);

    if (input.idempotencyKey) {
      this.idempotencyIndex.set(input.idempotencyKey, event);
    }

    return event;
  }

  public getEvents(streamId: string): BitemporalEvent[] {
    return [...(this.streams.get(streamId) ?? [])];
  }

  public verifyStreamIntegrity(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || stream.length === 0) return true;

    for (let i = 0; i < stream.length; i++) {
      const current = stream[i];
      const expectedPrev = i > 0 ? stream[i - 1].eventHash : "0".repeat(64);

      if (current.previousEventHash !== expectedPrev) {
        return false;
      }

      const calculated = computeEventHash(
        current.streamId,
        current.sequenceNumber,
        current.eventType,
        current.payload,
        current.validTime,
        current.transactionTime,
        current.previousEventHash,
      );

      if (current.eventHash !== calculated) {
        return false;
      }
    }
    return true;
  }

  public replayEvents<T = Record<string, unknown>>(streamId: string, options: ReplayOptions<T> = {}): T {
    const stream = this.streams.get(streamId) ?? [];
    const asOfValid = options.asOfValidTime ? new Date(options.asOfValidTime).getTime() : Infinity;
    const asOfTx = options.asOfTransactionTime ? new Date(options.asOfTransactionTime).getTime() : Infinity;

    const filtered = stream.filter((e) => {
      const vTime = new Date(e.validTime).getTime();
      const tTime = new Date(e.transactionTime).getTime();
      return vTime <= asOfValid && tTime <= asOfTx;
    });

    const defaultReducer = (state: T, event: BitemporalEvent): T => {
      return { ...(state as Record<string, unknown>), ...event.payload } as unknown as T;
    };

    const reducer = options.reducer ?? defaultReducer;
    let state = options.initialState ?? ({} as unknown as T);

    for (const ev of filtered) {
      state = reducer(state, ev);
    }

    return state;
  }

  public getChangeStream(streamId: string): CdcEnvelope[] {
    const stream = this.streams.get(streamId) ?? [];
    const cdcList: CdcEnvelope[] = [];
    let previousState: Record<string, unknown> | null = null;

    for (const ev of stream) {
      const isCreate = previousState === null;
      const isDelete = ev.eventType.toUpperCase().includes("DELETE");
      const operation: CdcOperation = isCreate ? "CREATE" : isDelete ? "DELETE" : "UPDATE";

      const currentState: Record<string, unknown> | null = isDelete
        ? null
        : { ...(previousState ?? {}), ...ev.payload };

      const diff: Record<string, { before: unknown; after: unknown }> = {};
      if (isCreate) {
        for (const [k, v] of Object.entries(ev.payload)) {
          diff[k] = { before: null, after: v };
        }
      } else if (isDelete) {
        for (const [k, v] of Object.entries(previousState ?? {})) {
          diff[k] = { before: v, after: null };
        }
      } else {
        for (const [k, v] of Object.entries(ev.payload)) {
          const beforeVal = previousState?.[k];
          if (beforeVal !== v) {
            diff[k] = { before: beforeVal ?? null, after: v };
          }
        }
      }

      cdcList.push({
        operation,
        streamId,
        sequenceNumber: ev.sequenceNumber,
        eventType: ev.eventType,
        timestamp: ev.transactionTime,
        before: previousState ? { ...previousState } : null,
        after: currentState ? { ...currentState } : null,
        diff,
      });

      previousState = currentState;
    }

    return cdcList;
  }

  public generateReceipt(outputPath = this.evidencePath): {
    receiptPath: string;
    sha256: string;
    totalEvents: number;
    totalStreams: number;
  } {
    let totalEvents = 0;
    for (const s of this.streams.values()) totalEvents += s.length;

    const payload = {
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      totalStreams: this.streams.size,
      totalEvents,
    };

    const content = JSON.stringify(payload, null, 2);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const sealed = { ...payload, evidenceSha256: sha256 };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(sealed, null, 2), "utf8");

    return {
      receiptPath: outputPath,
      sha256,
      totalEvents,
      totalStreams: this.streams.size,
    };
  }

  public clear(): void {
    this.streams.clear();
    this.idempotencyIndex.clear();
  }
}
