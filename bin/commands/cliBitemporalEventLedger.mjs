/**
 * @file cliBitemporalEventLedger.mjs
 * @description CLI handler for SPEC-357 / CHANGE-219: Autonomous Bitemporal Dynamic State Machine & Event Sourcing Hyper-Ledger.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosBitemporalLedgerCore } from "../../src/core/eosBitemporalEventSourcingLedger.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("BITEMPORAL_EVENT_SOURCING_LEDGER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_ledger_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosBitemporalLedgerCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous Bitemporal Event Sourcing Ledger (SPEC-357) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Blocks Count            : ${receipt.blocksCount}`);
    console.log(`Total Datoms Count      : ${receipt.totalDatomsCount}`);
    console.log(`LIDR SDLC Events        : ${receipt.lidrEventsTracked}`);
    console.log(`Throughput              : ${Math.round(receipt.benchmark.throughputTps).toLocaleString()} tps`);
    console.log(`Query Latency (asOf)    : ${receipt.benchmark.avgQueryLatencyUs.toFixed(1)} µs`);
    console.log(`Merkle Integrity        : ${receipt.benchmark.merkleVerified ? "VERIFIED" : "FAILED"}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Epistemic State         : ${receipt.epistemicState}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_ledger_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const txCount = 10000;
  const metrics = EosBitemporalLedgerCore.runBenchmark(txCount);

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log("=== Bitemporal Event Ledger Ingestion Benchmark ===");
    console.log(`Transactions Appended   : ${metrics.transactionsAppended.toLocaleString()}`);
    console.log(`Total Duration          : ${metrics.totalDurationUs.toFixed(1)} µs`);
    console.log(`Throughput              : ${Math.round(metrics.throughputTps).toLocaleString()} tps`);
    console.log(`Avg Query Latency       : ${metrics.avgQueryLatencyUs.toFixed(1)} µs`);
    console.log(`Merkle Chain Integrity  : ${metrics.merkleVerified ? "VALID" : "INVALID"}`);
  }
}

async function cmd_ledger_append(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const ledger = new EosBitemporalLedgerCore();
  const now = Date.now();

  const block = ledger.recordLidrEvent(
    "SPEC_PROPOSED",
    {
      specId: "SPEC-357",
      agentId: "agent-lidr-01",
      phase: "SPEC",
      details: { title: "Autonomous Bitemporal Event Sourcing Hyper-Ledger" },
    },
    now,
  );

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          blockIndex: block.blockIndex,
          blockHash: block.blockHash,
          merkleRoot: block.merkleRoot,
          datomsCount: block.datoms.length,
          timestamp: block.timestamp,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Bitemporal Datom Appended ===");
    console.log(`Block Index   : ${block.blockIndex}`);
    console.log(`Block Hash    : ${block.blockHash.substring(0, 16)}...`);
    console.log(`Merkle Root   : ${block.merkleRoot.substring(0, 16)}...`);
    console.log(`Datoms Count  : ${block.datoms.length}`);
    console.log(`Timestamp     : ${block.timestamp}`);
  }
}

async function cmd_ledger_asof(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const ledger = new EosBitemporalLedgerCore();
  const baseTime = 1700000000000;

  // Append initial state at T=1, V=baseTime
  ledger.recordLidrEvent(
    "SPEC_PROPOSED",
    { specId: "SPEC-357", agentId: "agent-1", phase: "SPEC", details: { status: "DRAFT" } },
    baseTime,
  );

  // Retract and update at T=2, V=baseTime + 1000
  ledger.recordLidrEvent(
    "SPEC_APPROVED",
    { specId: "SPEC-357", agentId: "architect-lead", phase: "APPROVED", details: { status: "APPROVED" } },
    baseTime + 1000,
  );

  // Time-travel queries:
  const historicalState = ledger.queryAsOf({
    entityId: "spec:SPEC-357",
    asOfTx: 1,
    asOfValid: baseTime + 500,
  });

  const currentState = ledger.queryAsOf({
    entityId: "spec:SPEC-357",
    asOfTx: 2,
    asOfValid: baseTime + 2000,
  });

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          asOfTx1: historicalState,
          asOfTx2: currentState,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== 2D As-Of Bitemporal Time Travel ===");
    console.log(`Historical (Tx: 1, Vt: ${baseTime + 500}):`);
    console.log(`  State : ${JSON.stringify(historicalState)}`);
    console.log(`Current (Tx: 2, Vt: ${baseTime + 2000}):`);
    console.log(`  State : ${JSON.stringify(currentState)}`);
  }
}

HANDLERS["toolchain:ledger:audit"] = cmd_ledger_audit;
HANDLERS["toolchain:ledger:bench"] = cmd_ledger_bench;
HANDLERS["toolchain:ledger:append"] = cmd_ledger_append;
HANDLERS["toolchain:ledger:asof"] = cmd_ledger_asof;

export async function handleBitemporalEventLedgerCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:ledger command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
