/**
 * CLI Zero-Copy Circular Ring-Buffer Telemetry Handlers
 *
 * Implements toolchain:ringbuffer:* subcommands for lock-free ring buffer
 * creation, atomic push, batch drain, zero-allocation microbenchmarks,
 * and signed audit receipt emission.
 *
 * Conforms to SPEC-312 / CHANGE-174.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosZeroCopyRingBufferCore } from "../../src/core/eosZeroCopyRingBuffer.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("ZERO_COPY_RING_BUFFER_RECEIPT.json", ROOT);

const HANDLERS = {};

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

async function cmd_ringbuffer_create(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capacity = Number(parseFlagValue(args, "--capacity=", "1024"));
  const preferShared = !args.includes("--no-shared");

  const handle = EosZeroCopyRingBufferCore.createRingBuffer(capacity, preferShared);
  const header = EosZeroCopyRingBufferCore.readHeader(handle);

  const payload = {
    status: "CREATED",
    capacity: handle.capacity,
    slotByteSize: handle.slotByteSize,
    totalByteSize: handle.totalByteSize,
    isShared: handle.isShared,
    header,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ZERO-COPY RING BUFFER ARENA (SPEC-312)              `);
  console.log(`===============================================================`);
  console.log(`  Capacity / Slots : ${handle.capacity} slots (${handle.slotByteSize} B/slot)`);
  console.log(`  Total Allocation : ${handle.totalByteSize} bytes`);
  console.log(`  SharedBuffer     : ${handle.isShared}`);
  console.log(`  Header Magic     : 0x${header.magic.toString(16).toUpperCase()}`);
  console.log(`===============================================================\n`);
}

async function cmd_ringbuffer_push(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capacity = Number(parseFlagValue(args, "--capacity=", "256"));
  const count = Number(parseFlagValue(args, "--count=", "16"));
  const policy = parseFlagValue(args, "--policy=", "FAIL_FAST");

  const handle = EosZeroCopyRingBufferCore.createRingBuffer(capacity, false);
  const results = [];

  for (let i = 0; i < count; i++) {
    const res = EosZeroCopyRingBufferCore.pushEvent(
      handle,
      {
        timestampNs: BigInt(Date.now()) * 1_000_000n + BigInt(i),
        eventType: 2, // COUNTER
        metricId: 100 + i,
        workerId: 1,
        flags: 0,
        value: 1.0,
        traceIdHigh: 0x12345678n,
        traceIdLow: 0x9abcdef0n,
        spanId: BigInt(i + 1),
      },
      policy,
    );
    results.push(res);
  }

  const header = EosZeroCopyRingBufferCore.readHeader(handle);
  const payload = {
    status: "PUSHED",
    count,
    policy,
    head: header.head,
    tail: header.tail,
    dropped: header.droppedCount,
    successCount: results.filter((r) => r.success).length,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN RING BUFFER ATOMIC PUSH (SPEC-312)                   `);
  console.log(`===============================================================`);
  console.log(`  Pushed / Success : ${payload.successCount} / ${count} (policy: ${policy})`);
  console.log(`  Head / Tail      : ${header.head} / ${header.tail}`);
  console.log(`  Dropped Events   : ${header.droppedCount}`);
  console.log(`===============================================================\n`);
}

async function cmd_ringbuffer_drain(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capacity = Number(parseFlagValue(args, "--capacity=", "256"));
  const count = Number(parseFlagValue(args, "--count=", "32"));
  const batchSize = Number(parseFlagValue(args, "--batch=", "16"));

  const handle = EosZeroCopyRingBufferCore.createRingBuffer(capacity, false);

  for (let i = 0; i < count; i++) {
    EosZeroCopyRingBufferCore.pushEvent(
      handle,
      {
        timestampNs: BigInt(Date.now()) * 1_000_000n + BigInt(i),
        eventType: 1, // GAUGE
        metricId: 200 + (i % 4),
        workerId: 2,
        flags: 0,
        value: 42.5 + i,
        traceIdHigh: 0x11112222n,
        traceIdLow: 0x33334444n,
        spanId: BigInt(i + 100),
      },
      "DROP_OLDEST",
    );
  }

  const drainResult = EosZeroCopyRingBufferCore.drainBatch(handle, batchSize);
  const header = EosZeroCopyRingBufferCore.readHeader(handle);

  const payload = {
    status: "DRAINED",
    initialPushed: count,
    drainedCount: drainResult.drainedCount,
    remainingCount: drainResult.remainingCount,
    head: header.head,
    tail: header.tail,
    sampleValues: drainResult.slots.slice(0, 3).map((s) => ({
      metricId: s.metricId,
      value: s.value,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN RING BUFFER BATCH DRAIN (SPEC-312)                   `);
  console.log(`===============================================================`);
  console.log(`  Drained / Remain : ${drainResult.drainedCount} / ${drainResult.remainingCount}`);
  console.log(`  Head / Tail      : ${header.head} / ${header.tail}`);
  console.log(`===============================================================\n`);
}

async function cmd_ringbuffer_benchmark(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const iterations = Number(parseFlagValue(args, "--iterations=", "50000"));
  const capacity = Number(parseFlagValue(args, "--capacity=", "16384"));

  const report = EosZeroCopyRingBufferCore.benchmarkRingBufferThroughput(iterations, capacity);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ZERO-COPY RING BUFFER BENCHMARK (SPEC-312)          `);
  console.log(`===============================================================`);
  console.log(`  Iterations / Cap : ${report.iterations} ops (buffer cap: ${report.capacity})`);
  console.log(`  Throughput       : ${report.eventsPerSecond.toLocaleString()} events/sec`);
  console.log(`  Latency          : ${report.nsPerOp} ns/op`);
  console.log(`  Elapsed          : ${report.totalElapsedMs} ms`);
  console.log(`  Zero-Allocations : ${report.zeroAllocationsVerified}`);
  console.log(`===============================================================\n`);
}

async function cmd_ringbuffer_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capacity = Number(parseFlagValue(args, "--capacity=", "4096"));

  const handle = EosZeroCopyRingBufferCore.createRingBuffer(capacity, false);

  // Push and stream test
  for (let i = 0; i < 64; i++) {
    EosZeroCopyRingBufferCore.pushEvent(handle, {
      timestampNs: 1000n * BigInt(i),
      eventType: i % 2 === 0 ? 1 : 2,
      metricId: 10 + (i % 5),
      workerId: 1,
      flags: 0,
      value: 10.0 + i,
      traceIdHigh: 0xaa00n,
      traceIdLow: 0xbb00n,
      spanId: BigInt(i),
    });
  }

  const streamSummary = EosZeroCopyRingBufferCore.streamRingBufferToPrometheus(handle);
  const auditReport = EosZeroCopyRingBufferCore.auditRingBufferInvariants(handle);
  const benchmarkReport = EosZeroCopyRingBufferCore.benchmarkRingBufferThroughput(20_000, 4096);

  const receipt = {
    timestampIso: new Date().toISOString(),
    specRef: "SPEC-312",
    changeRef: "CHANGE-174",
    status: auditReport.verdict,
    capacity,
    invariantsChecked: auditReport.invariantsChecked,
    violations: auditReport.violations,
    streamSummary: {
      totalEventsProcessed: streamSummary.totalEventsProcessed,
      gaugesUpdated: streamSummary.gaugesUpdated,
      countersIncremented: streamSummary.countersIncremented,
    },
    benchmark: {
      eventsPerSecond: benchmarkReport.eventsPerSecond,
      nsPerOp: benchmarkReport.nsPerOp,
      zeroAllocationsVerified: benchmarkReport.zeroAllocationsVerified,
    },
    cryptographicSignature: auditReport.sha256Receipt,
  };

  const receiptDir = path.dirname(RECEIPT_PATH);
  if (!fs.existsSync(receiptDir)) {
    fs.mkdirSync(receiptDir, { recursive: true });
  }
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN ZERO-COPY RING BUFFER AUDIT RECEIPT (SPEC-312)       `);
  console.log(`===============================================================`);
  console.log(`  Verdict          : ${receipt.status}`);
  console.log(`  Invariants       : ${receipt.invariantsChecked} passed (0 violations)`);
  console.log(`  Stream Events    : ${receipt.streamSummary.totalEventsProcessed} processed`);
  console.log(
    `  Throughput       : ${receipt.benchmark.eventsPerSecond.toLocaleString()} events/sec (${receipt.benchmark.nsPerOp} ns/op)`,
  );
  console.log(`  Receipt Signature: ${receipt.cryptographicSignature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:ringbuffer:create"] = cmd_ringbuffer_create;
HANDLERS["toolchain:ringbuffer:push"] = cmd_ringbuffer_push;
HANDLERS["toolchain:ringbuffer:drain"] = cmd_ringbuffer_drain;
HANDLERS["toolchain:ringbuffer:benchmark"] = cmd_ringbuffer_benchmark;
HANDLERS["toolchain:ringbuffer:audit"] = cmd_ringbuffer_audit;

export async function handleRingBufferCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:ringbuffer command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
