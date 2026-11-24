/**
 * GLORIAN SYSTEM — ZERO-COPY SHARED MEMORY ARENA TEST SUITE
 *
 * Verifies SharedArrayBuffer allocation, lock-free SPSC circular ring buffers with Atomics,
 * multi-message wrap-around, buffer full drop tracking, magic header validation, and audit receipts.
 *
 * Governed by SPEC-303 (FR-303-01..FR-303-06, BDD-1593..BDD-1598).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosSharedMemoryArena } from "../src/core/eosSharedMemoryArena.ts";
import { ARENA_MAGIC, ARENA_VERSION, HEADER_SIZE_BYTES } from "../src/core/eosSharedMemoryArena.types.ts";

describe("SPEC-303: Zero-Copy Shared Memory Arena (SharedArrayBuffer + Atomics)", () => {
  it("BDD-1593: SharedArrayBuffer Off-Heap Arena Initialization", () => {
    const capacity = 1024;
    const arena = EosSharedMemoryArena.createArena(capacity);

    assert.ok(arena.buffer instanceof SharedArrayBuffer, "Must allocate a SharedArrayBuffer");
    assert.strictEqual(
      arena.buffer.byteLength,
      HEADER_SIZE_BYTES + capacity,
      "Buffer length must equal header + data capacity",
    );
    assert.strictEqual(arena.dataCapacity, capacity, "dataCapacity must match requested capacity");

    const stats = arena.getStats();
    assert.strictEqual(stats.capacityBytes, capacity);
    assert.strictEqual(stats.headIndex, 0);
    assert.strictEqual(stats.tailIndex, 0);
    assert.strictEqual(stats.usedBytes, 0);
    assert.strictEqual(stats.freeBytes, capacity - 1);
    assert.strictEqual(stats.writeSeq, 0);
    assert.strictEqual(stats.readSeq, 0);
    assert.strictEqual(stats.droppedMessages, 0);
  });

  it("BDD-1594: Lock-Free SPSC Enqueue and Dequeue Protocol", () => {
    const arena = EosSharedMemoryArena.createArena(4096);
    const message = "Glorian-Zero-Copy-IPC-Payload-2026";

    // Enqueue
    const enqResult = arena.enqueue(message, 42);
    assert.strictEqual(enqResult.success, true, "Enqueue must succeed");
    assert.strictEqual(enqResult.sequenceNumber, 0, "First write sequence is 0");
    assert.ok(enqResult.bytesWritten > message.length, "Bytes written includes frame header");

    const statsAfterEnq = arena.getStats();
    assert.strictEqual(statsAfterEnq.writeSeq, 1);
    assert.strictEqual(statsAfterEnq.readSeq, 0);
    assert.ok(statsAfterEnq.usedBytes > 0);

    // Dequeue
    const deqResult = arena.dequeue();
    assert.strictEqual(deqResult.found, true, "Dequeue must find message");
    assert.strictEqual(deqResult.sequenceNumber, 0, "First read sequence is 0");
    assert.strictEqual(deqResult.flags, 42, "Flags must match");
    assert.ok(deqResult.payload !== undefined);

    const decoded = Buffer.from(deqResult.payload).toString("utf8");
    assert.strictEqual(decoded, message, "Decoded payload must exactly match original message");

    // Dequeue again on empty buffer
    const emptyDeq = arena.dequeue();
    assert.strictEqual(emptyDeq.found, false, "Dequeue on empty arena must return found=false");
  });

  it("BDD-1595: Multi-Message Circular Ring Wrap-Around", () => {
    // Small buffer: 512 bytes data capacity
    const arena = EosSharedMemoryArena.createArena(512);

    // Write and read 20 sequential messages so ring buffer wraps around several times
    for (let i = 0; i < 20; i++) {
      const payload = `Message-Ring-Wrap-#${i}-Pad-Padding-To-Force-Wrapping-Boundary`;
      const enq = arena.enqueue(payload, i);
      assert.strictEqual(enq.success, true, `Enqueue #${i} must succeed`);

      const deq = arena.dequeue();
      assert.strictEqual(deq.found, true, `Dequeue #${i} must find message`);
      assert.strictEqual(deq.flags, i, `Flags #${i} must match`);
      const text = Buffer.from(deq.payload).toString("utf8");
      assert.strictEqual(text, payload, `Payload #${i} content must match across wrap-around`);
    }

    const finalStats = arena.getStats();
    assert.strictEqual(finalStats.writeSeq, 20);
    assert.strictEqual(finalStats.readSeq, 20);
    assert.strictEqual(finalStats.usedBytes, 0);
    assert.strictEqual(finalStats.droppedMessages, 0);
  });

  it("BDD-1596: Buffer Overrun Protection and Drop Counter Integrity", () => {
    // 256 bytes data capacity (smallest allowed)
    const arena = EosSharedMemoryArena.createArena(256);

    // Fill the buffer almost completely
    const largePayload = "X".repeat(200);
    const firstEnq = arena.enqueue(largePayload);
    assert.strictEqual(firstEnq.success, true, "First payload should fit");

    // Second payload cannot fit into remaining ~48 bytes
    const secondPayload = "Y".repeat(100);
    const secondEnq = arena.enqueue(secondPayload);
    assert.strictEqual(secondEnq.success, false, "Must reject payload exceeding free bytes");
    assert.strictEqual(secondEnq.errorReason, "RING_BUFFER_FULL");

    const stats = arena.getStats();
    assert.strictEqual(stats.droppedMessages, 1, "Dropped messages counter must increment to 1");

    // Dequeue the first payload to make room
    const deq = arena.dequeue();
    assert.strictEqual(deq.found, true);

    // Now second payload should fit
    const thirdEnq = arena.enqueue(secondPayload);
    assert.strictEqual(thirdEnq.success, true, "Should succeed after freeing space");
  });

  it("BDD-1597: Memory Corruption and Magic Header Guard", () => {
    // Allocate raw buffer without valid magic
    const corruptedBuffer = new SharedArrayBuffer(1024);
    const ctrl = new Int32Array(corruptedBuffer, 0, HEADER_SIZE_BYTES / 4);
    Atomics.store(ctrl, 0, 0x12345678); // Invalid magic
    Atomics.store(ctrl, 1, ARENA_VERSION);
    Atomics.store(ctrl, 2, 512);

    assert.throws(
      () => {
        EosSharedMemoryArena.fromSharedBuffer(corruptedBuffer);
      },
      /INVALID_ARENA_HEADER/,
      "Must throw INVALID_ARENA_HEADER for invalid magic signature",
    );

    // Allocate buffer with invalid version
    const invalidVerBuffer = new SharedArrayBuffer(1024);
    const ctrl2 = new Int32Array(invalidVerBuffer, 0, HEADER_SIZE_BYTES / 4);
    Atomics.store(ctrl2, 0, ARENA_MAGIC);
    Atomics.store(ctrl2, 1, 999); // Unsupported version
    Atomics.store(ctrl2, 2, 512);

    assert.throws(
      () => {
        EosSharedMemoryArena.fromSharedBuffer(invalidVerBuffer);
      },
      /INVALID_ARENA_HEADER/,
      "Must throw INVALID_ARENA_HEADER for unsupported version",
    );
  });

  it("BDD-1598: End-to-End Cryptographic Audit Receipt Generation", () => {
    const receipt = EosSharedMemoryArena.auditSharedMemoryPipeline({ projectRoot: process.cwd() });

    assert.ok(receipt, "Audit receipt must be generated");
    assert.strictEqual(receipt.zeroCopyVerified, true, "zeroCopyVerified must be true");
    assert.strictEqual(receipt.messagesProcessed, 1000, "Should process 1000 benchmark messages");
    assert.ok(receipt.totalAllocatedBytes >= 65536, "Allocated bytes must be >= 64KB");
    assert.ok(receipt.avgLatencyNanos >= 0, "Latency benchmark must produce positive number");
    assert.strictEqual(typeof receipt.sha256Signature, "string", "Must generate SHA-256 signature");
    assert.strictEqual(receipt.sha256Signature.length, 64, "SHA-256 must be 64-hex string");

    const receiptPath = resolveEvidencePath("SHARED_MEMORY_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "Receipt file must exist");

    const content = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.strictEqual(content.receiptType, "EOS_ZERO_COPY_SHARED_MEMORY_AUDIT");
    assert.strictEqual(content.zeroCopyVerified, true);
    assert.strictEqual(content.sha256Signature, receipt.sha256Signature);
  });
});
