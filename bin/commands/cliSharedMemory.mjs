/**
 * CLI Zero-Copy Shared Memory Arena Handlers
 *
 * Implements toolchain:shm:* subcommands for off-heap shared memory allocation,
 * lock-free SPSC ring buffer streaming, Atomics coordination, and audit receipts.
 *
 * Conforms to SPEC-303 / CHANGE-165.
 */

import { EosSharedMemoryArena } from "../../src/core/eosSharedMemoryArena.ts";

const HANDLERS = {};
let globalArena = null;

function getOrCreateCliArena(capacityBytes = 65536) {
  if (!globalArena) {
    globalArena = EosSharedMemoryArena.createArena(capacityBytes);
  }
  return globalArena;
}

async function cmd_shm_alloc(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const capArg = args.find((a) => a.startsWith("--capacity="))?.split("=")[1];
  const capacityBytes = capArg ? parseInt(capArg, 10) : 65536;

  const arena = getOrCreateCliArena(capacityBytes);
  const stats = arena.getStats();

  const output = {
    allocatedBytes: stats.capacityBytes,
    controlHeaderBytes: 64,
    totalBufferBytes: stats.capacityBytes + 64,
    freeBytes: stats.freeBytes,
    usedBytes: stats.usedBytes,
    magicSignature: "0x454f534d (EOSM)",
    version: 1,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🧠  EOS ZERO-COPY SHARED MEMORY ARENA (SPEC-303)              ");
  console.log("===============================================================");
  console.log(
    `  Data Capacity       : ${output.allocatedBytes} bytes (${(output.allocatedBytes / 1024).toFixed(1)} KB)`,
  );
  console.log(`  Control Header      : ${output.controlHeaderBytes} bytes (Int32Array Atomics)`);
  console.log(`  Total Allocation    : ${output.totalBufferBytes} bytes off-heap`);
  console.log(`  Magic Signature     : ${output.magicSignature}`);
  console.log(`  Format Version      : ${output.version}`);
  console.log("---------------------------------------------------------------");
  console.log(`  Free Space          : ${output.freeBytes} bytes`);
  console.log(`  Used Space          : ${output.usedBytes} bytes`);
  console.log("===============================================================\n");
}

async function cmd_shm_produce(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const msgArg = args.find((a) => a.startsWith("--msg="))?.split("=")[1] || "telemetry-sample-ast-node";
  const countArg = args.find((a) => a.startsWith("--count="))?.split("=")[1];
  const count = countArg ? parseInt(countArg, 10) : 1;

  const arena = getOrCreateCliArena(65536);
  let totalBytes = 0;
  let lastSeq = 0;

  for (let i = 0; i < count; i++) {
    const payload = `${msgArg}-${i}`;
    const res = arena.enqueue(payload, 1);
    if (!res.success) {
      if (isJson) {
        console.log(JSON.stringify({ error: res.errorReason, enqueued: i, lastSeq }, null, 2));
      } else {
        console.error(`\n[SHM ERROR] Enqueue failed: ${res.errorReason} at iteration ${i}\n`);
      }
      return;
    }
    totalBytes += res.bytesWritten;
    lastSeq = res.sequenceNumber;
  }

  const stats = arena.getStats();
  const output = {
    messagesProduced: count,
    totalBytesWritten: totalBytes,
    lastSequenceNumber: lastSeq,
    currentHead: stats.headIndex,
    currentTail: stats.tailIndex,
    freeBytesRemaining: stats.freeBytes,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 📤  EOS SHARED MEMORY ATOMIC PRODUCER (SPEC-303)              ");
  console.log("===============================================================");
  console.log(`  Messages Produced   : ${output.messagesProduced}`);
  console.log(`  Bytes Written       : ${output.totalBytesWritten}`);
  console.log(`  Last Sequence No    : ${output.lastSequenceNumber}`);
  console.log(`  Ring Tail Pointer   : offset ${output.currentTail}`);
  console.log(`  Free Space Left     : ${output.freeBytesRemaining} bytes`);
  console.log("===============================================================\n");
}

async function cmd_shm_consume(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const arena = getOrCreateCliArena(65536);

  const dequeuedMessages = [];
  while (true) {
    const res = arena.dequeue();
    if (!res.found || !res.payload) {
      break;
    }
    dequeuedMessages.push({
      sequenceNumber: res.sequenceNumber,
      payloadText: Buffer.from(res.payload).toString("utf8"),
      length: res.payloadLength,
      flags: res.flags,
    });
  }

  const stats = arena.getStats();
  const output = {
    messagesConsumed: dequeuedMessages.length,
    messages: dequeuedMessages,
    currentHead: stats.headIndex,
    currentTail: stats.tailIndex,
    freeBytes: stats.freeBytes,
  };

  if (isJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 📥  EOS SHARED MEMORY ATOMIC CONSUMER (SPEC-303)              ");
  console.log("===============================================================");
  console.log(`  Messages Consumed   : ${output.messagesConsumed}`);
  console.log(`  Ring Head Pointer   : offset ${output.currentHead}`);
  console.log(`  Ring Tail Pointer   : offset ${output.currentTail}`);
  console.log("---------------------------------------------------------------");
  for (const m of dequeuedMessages.slice(0, 5)) {
    console.log(`    ↳ [#${m.sequenceNumber}] ${m.payloadText} (${m.length} bytes)`);
  }
  if (dequeuedMessages.length > 5) {
    console.log(`    ↳ ... and ${dequeuedMessages.length - 5} more message(s)`);
  }
  console.log("===============================================================\n");
}

async function cmd_shm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const projectRoot = commandContext.projectRoot || process.cwd();

  const receipt = EosSharedMemoryArena.auditSharedMemoryPipeline({ projectRoot });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ⚡  EOS ZERO-COPY SHARED MEMORY AUDIT RECEIPT (SPEC-303)       ");
  console.log("===============================================================");
  console.log(`  Timestamp           : ${receipt.timestampIso}`);
  console.log(`  Spec Reference      : ${receipt.specRef}`);
  console.log(`  Total Allocated     : ${receipt.totalAllocatedBytes} bytes`);
  console.log(`  Messages Processed  : ${receipt.messagesProcessed}`);
  console.log(`  Zero-Copy Verified  : ${receipt.zeroCopyVerified ? "YES (Pass)" : "NO"}`);
  console.log(`  Average Latency     : ${receipt.avgLatencyNanos} ns/op`);
  console.log(`  Signature (Receipt) : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:shm:alloc"] = cmd_shm_alloc;
HANDLERS["toolchain:shm:produce"] = cmd_shm_produce;
HANDLERS["toolchain:shm:consume"] = cmd_shm_consume;
HANDLERS["toolchain:shm:audit"] = cmd_shm_audit;

export async function handleSharedMemoryCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchSharedMemoryCommand(commandContext) {
  return handleSharedMemoryCommands(commandContext);
}
