/**
 * CLI Shared-Memory Worker Pool & Multi-Process Jepsen WAL Recovery Handlers
 *
 * Implements toolchain:workers:* subcommands for SharedArrayBuffer WebAssembly.Memory
 * allocation, multi-core Atomics worker reductions, multi-process SQLite WAL crash
 * recovery drills, and signed audit receipt emission.
 *
 * Conforms to SPEC-311 / CHANGE-173.
 */

import { EosSharedMemoryWorkerPoolCore } from "../../src/core/eosSharedMemoryWorkerPool.ts";

const HANDLERS = {};

async function cmd_workers_arena(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const { report } = EosSharedMemoryWorkerPoolCore.createSharedWasmArena(4, 16);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SHARED WASM ARENA (SPEC-311 / SharedArrayBuffer)     `);
  console.log(`===============================================================`);
  console.log(`  Pages / Bytes    : ${report.initialPages}..${report.maxPages} pages (${report.byteLength} B)`);
  console.log(`  SharedBuffer     : ${report.isSharedArrayBuffer}`);
  console.log(`===============================================================\n`);
}

async function cmd_workers_reduce(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const reduction = await EosSharedMemoryWorkerPoolCore.executeParallelSharedArenaReduction(
    [10, 20, 30, 40, 50, 60, 70, 80],
    2,
  );
  const fleetIds = Array.from({ length: 16 }, (_, idx) => `fleet-svc-${idx + 1}`);
  const fleetShards = await EosSharedMemoryWorkerPoolCore.executeParallelElasticFleetAudit(fleetIds, 4);

  if (isJson) {
    console.log(JSON.stringify({ reduction, fleetShards }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MULTI-CORE SHARED MEMORY WORKERS (SPEC-311)          `);
  console.log(`===============================================================`);
  console.log(
    `  Atomics Reduce : sum=${reduction.totalSum} | max=${reduction.maxElement} | workers=${reduction.atomicCompletedWorkers}`,
  );
  console.log(
    `  Fleet Shards   : projects=${fleetShards.totalProjects} | shards=${fleetShards.shardCount} | root=${fleetShards.fleetMerkleRoot.slice(0, 24)}...`,
  );
  console.log(`===============================================================\n`);
}

async function cmd_workers_jepsen(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const crashReport = EosSharedMemoryWorkerPoolCore.executeMultiProcessWalCrashRecoveryDrill(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(crashReport, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN MULTI-PROCESS SQLITE WAL JEPSEN DRILL (SPEC-311)     `);
  console.log(`===============================================================`);
  console.log(
    `  Committed Survival : ${crashReport.committedRecordsRecovered}/${crashReport.committedRecordsExpected}`,
  );
  console.log(`  Dirty Leaks        : ${crashReport.uncommittedDirtyRecordsLeaked}`);
  console.log(`  Zero Data Loss     : ${crashReport.zeroDataLossVerified}`);
  console.log(`===============================================================\n`);
}

async function cmd_workers_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await EosSharedMemoryWorkerPoolCore.auditSharedMemoryWorkerPoolPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN SHARED WORKERS & JEPSEN AUDIT RECEIPT (SPEC-311)     `);
  console.log(`===============================================================`);
  console.log(`  Status           : ${receipt.status}`);
  console.log(`  Workers / Reduce : sum=${receipt.parallelReductionReport.totalSum}`);
  console.log(`  WAL Crash Drill  : zeroDataLoss=${receipt.walCrashRecoveryReport.zeroDataLossVerified}`);
  console.log(`  SIMD128 Loop     : ${receipt.inWasmSimdLoopNsPerOp} ns/op`);
  console.log(`  Signature        : ${receipt.cryptographicSignature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:workers:arena"] = cmd_workers_arena;
HANDLERS["toolchain:workers:reduce"] = cmd_workers_reduce;
HANDLERS["toolchain:workers:jepsen"] = cmd_workers_jepsen;
HANDLERS["toolchain:workers:audit"] = cmd_workers_audit;

export async function handleSharedMemoryWorkerPoolCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:workers command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
