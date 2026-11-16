/**
 * GLORIAN SYSTEM — ZERO-COPY SHARED MEMORY ARENA TYPES
 *
 * Formal contracts for SharedArrayBuffer memory layouts, atomic control headers,
 * lock-free SPSC circular ring buffers, and zero-copy message transfers.
 *
 * Governed by SPEC-303 (FR-303-01..FR-303-06, BDD-1593..BDD-1598).
 * Strict Law V: Zero third-party runtime dependencies.
 */

export const ARENA_MAGIC = 0x454f534d; // 'EOSM' in ASCII
export const ARENA_VERSION = 1;
export const HEADER_SIZE_BYTES = 64;
export const FRAME_HEADER_BYTES = 8; // 4 bytes length, 2 bytes flags, 2 bytes reserved

export interface SharedMemoryHeader {
  readonly magic: number;
  readonly version: number;
  readonly capacityBytes: number;
  readonly headIndex: number;
  readonly tailIndex: number;
  readonly writeSeq: number;
  readonly readSeq: number;
  readonly droppedMessages: number;
  readonly flags: number;
}

export interface SharedMemoryStats {
  readonly capacityBytes: number;
  readonly usedBytes: number;
  readonly freeBytes: number;
  readonly headIndex: number;
  readonly tailIndex: number;
  readonly writeSeq: number;
  readonly readSeq: number;
  readonly droppedMessages: number;
}

export interface EnqueueResult {
  readonly success: boolean;
  readonly bytesWritten: number;
  readonly sequenceNumber: number;
  readonly errorReason?: "RING_BUFFER_FULL" | "PAYLOAD_TOO_LARGE";
}

export interface DequeueResult {
  readonly found: boolean;
  readonly payload?: Uint8Array;
  readonly payloadLength: number;
  readonly sequenceNumber: number;
  readonly flags: number;
}

export interface SharedMemoryAuditReceipt {
  readonly receiptType: "EOS_ZERO_COPY_SHARED_MEMORY_AUDIT";
  readonly timestampIso: string;
  readonly specRef: "SPEC-303";
  readonly totalAllocatedBytes: number;
  readonly messagesProcessed: number;
  readonly zeroCopyVerified: boolean;
  readonly avgLatencyNanos: number;
  readonly sha256Signature: string;
}
