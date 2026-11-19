/**
 * EOS Zero-Copy Shared Memory Ring Buffer (IPC) — Type Definitions
 *
 * SPEC-355 / CHANGE-217: Deterministic Zero-Copy Shared Memory Inter-Process Ring Buffer (IPC) Architecture.
 * Types for cache-line aligned ring buffers, binary frame headers, atomic sequence cursors,
 * and high-frequency trading (HFT) zero-copy throughput benchmarks.
 *
 * @module eosZeroCopyIpcRingBuffer.types
 */

/**
 * Backpressure strategy when producer encounters a saturated ring buffer.
 */
export type IpcBackpressurePolicy = "BLOCKING_WAIT" | "SPIN_YIELD" | "FAIL_FAST" | "DROP_OLDEST_UNACKED";

/**
 * Concurrency access mode of the ring buffer.
 */
export type IpcConcurrencyMode = "SPSC" | "MPSC";

/**
 * Configuration options for initializing a zero-copy shared memory ring buffer.
 */
export interface IpcRingBufferConfig {
  readonly capacity: number;
  readonly slotSize: number;
  readonly backpressure?: IpcBackpressurePolicy;
  readonly concurrencyMode?: IpcConcurrencyMode;
}

/**
 * 20-byte binary frame header structure.
 */
export interface IpcFrameHeader {
  readonly magic: number;
  readonly typeId: number;
  readonly sequence: bigint;
  readonly payloadLength: number;
  readonly crc32: number;
}

/**
 * Zero-copy slice view into a read binary frame.
 */
export interface IpcFrameView {
  readonly header: IpcFrameHeader;
  readonly payload: Uint8Array;
}

/**
 * Result of attempting to write a frame into the ring buffer.
 */
export interface IpcWriteResult {
  readonly success: boolean;
  readonly sequence: bigint;
  readonly slotIndex: number;
  readonly error?: string;
}

/**
 * Result of reading a frame from the ring buffer.
 */
export interface IpcReadResult {
  readonly success: boolean;
  readonly frame?: IpcFrameView;
  readonly availableFrames: number;
}

/**
 * Telemetry emitted by high-throughput benchmark runs.
 */
export interface IpcBenchmarkResult {
  readonly operations: number;
  readonly totalDurationUs: number;
  readonly avgLatencyNs: number;
  readonly throughputOpsSec: number;
  readonly zeroCopyEfficiency: number;
}

/**
 * Formal verification audit receipt emitted by EosZeroCopyIpcGovernor.
 */
export interface ZeroCopyIpcReceipt {
  readonly specId: "SPEC-355";
  readonly changeId: "CHANGE-217";
  readonly timestamp: string;
  readonly capacity: number;
  readonly slotSize: number;
  readonly concurrencyMode: IpcConcurrencyMode;
  readonly benchmark: IpcBenchmarkResult;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT" | "DEVIATION_DETECTED";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}
