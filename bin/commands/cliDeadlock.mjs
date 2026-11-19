/**
 * EOS SYSTEM — DISTRIBUTED DEADLOCK DETECTION CLI (Layer 0)
 * Governed by SPEC-285, CHANGE-147
 */

import fs from "node:fs";
import path from "node:path";
import { EosDeadlockDetectionGovernor } from "../../src/core/eosDeadlockDetectionGovernor.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

export const HANDLERS = {};

async function cmd_toolchain_deadlock_audit(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/concurrency/sample-deadlock-wfg.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const transactions = raw.transactions || (Array.isArray(raw) ? raw : [raw]);
  const graph = EosDeadlockDetectionGovernor.buildWfg(transactions, raw.graphId);
  const report = EosDeadlockDetectionGovernor.detectDeadlocks(graph);

  const receiptPath = resolveEvidencePath("DEADLOCK_RECEIPT.json", root);
  const receipt = EosDeadlockDetectionGovernor.generateReceipt(report, receiptPath);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          graphId: report.graphId,
          hasDeadlock: report.hasDeadlock,
          cyclesCount: report.cycles.length,
          cycles: report.cycles,
          victims: report.victims,
          receiptPath,
          receiptSha256: receipt.sha256Signature,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" 🕸️ GLORIAN SYSTEM — DISTRIBUTED DEADLOCK AUDITOR (SPEC-285)");
  console.log("======================================================================");
  console.log(` Graph ID      : ${report.graphId}`);
  console.log(` Transactions  : ${graph.vertices.length}`);
  console.log(` Lock Edges    : ${graph.edges.length}`);
  console.log(` Deadlock State: ${report.hasDeadlock ? "⚠️ DEADLOCK DETECTED" : "✅ ACYCLIC (NO DEADLOCK)"}`);
  if (report.hasDeadlock) {
    console.log(` Cycles Count  : ${report.cycles.length}`);
    report.cycles.forEach((c, idx) => {
      console.log(`   Cycle ${idx + 1}        : ${c.join(" -> ")}`);
    });
    console.log(` Abort Victims : ${report.victims.join(", ")}`);
  }
  console.log(` Receipt Path  : ${receiptPath}`);
  console.log(` Signature     : ${receipt.sha256Signature}`);
  console.log("======================================================================");
}

async function cmd_toolchain_deadlock_wfg(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/concurrency/sample-deadlock-wfg.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const transactions = raw.transactions || (Array.isArray(raw) ? raw : [raw]);
  const graph = EosDeadlockDetectionGovernor.buildWfg(transactions, raw.graphId);

  if (isJson) {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  console.log("======================================================================");
  console.log(" 📊 GLORIAN SYSTEM — WAIT-FOR GRAPH TOPOLOGY (SPEC-285)");
  console.log("======================================================================");
  console.log(` Graph ID     : ${graph.graphId}`);
  console.log(` Vertices (${graph.vertices.length}): ${graph.vertices.join(", ")}`);
  console.log(` Edges (${graph.edges.length})   :`);
  graph.edges.forEach((e) => {
    console.log(`   ${e.from} ──[waits for: ${e.resource}]──> ${e.to}`);
  });
  console.log("======================================================================");
}

async function cmd_toolchain_deadlock_resolve(commandContext) {
  const { args, root, printBanner } = commandContext;
  const isJson = args.includes("--json");
  if (!isJson) printBanner();
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/concurrency/sample-deadlock-wfg.json";

  const stratArg = args.find((a) => a.startsWith("--strategy="));
  const strategy = stratArg ? stratArg.split("=")[1] : "wound-wait";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const transactions = raw.transactions || (Array.isArray(raw) ? raw : [raw]);
  const graph = EosDeadlockDetectionGovernor.buildWfg(transactions, raw.graphId);
  const { resolvedGraph, abortedTxIds } = EosDeadlockDetectionGovernor.resolveDeadlocks(graph);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          strategy,
          initialDeadlock: abortedTxIds.length > 0,
          abortedTxIds,
          remainingVertices: resolvedGraph.vertices,
          remainingEdges: resolvedGraph.edges.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" ⚡ GLORIAN SYSTEM — DEADLOCK RESOLUTION (SPEC-285)");
  console.log("======================================================================");
  console.log(` Strategy      : ${strategy.toUpperCase()}`);
  console.log(` Aborted Tx    : ${abortedTxIds.length > 0 ? abortedTxIds.join(", ") : "None (Acyclic)"}`);
  console.log(` Remaining Tx  : ${resolvedGraph.vertices.join(", ")}`);
  console.log(` Status        : ✅ CYCLES BROKEN & GRAPH RESTORED TO ACYCLIC`);
  console.log("======================================================================");
}

HANDLERS["toolchain:deadlock:audit"] = cmd_toolchain_deadlock_audit;
HANDLERS["toolchain:deadlock:wfg"] = cmd_toolchain_deadlock_wfg;
HANDLERS["toolchain:deadlock:resolve"] = cmd_toolchain_deadlock_resolve;

export async function handleDeadlockCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
