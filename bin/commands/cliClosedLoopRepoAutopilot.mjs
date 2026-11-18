/**
 * @file cliClosedLoopRepoAutopilot.mjs
 * @description CLI handler for SPEC-340 / CHANGE-202: Sovereign Closed-Loop Repository Autopilot Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosClosedLoopRepoAutopilotCore } from "../../src/core/eosClosedLoopRepoAutopilot.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const getReceiptPath = () => resolveEvidencePath("CLOSED_LOOP_AUTOPILOT_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_autopilot_ingest(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const maxEntities = Number(parseFlagValue(args, "--limit=", "12"));
  const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, maxEntitiesPerSource: maxEntities });
  const report = core.ingestRepositoryOntology();
  const payload = { command: "toolchain:autopilot:ingest", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Closed-Loop Autopilot: Ontological Ingestion ===");
    console.log(`Fleet Projects : ${report.fleetProjectsCount}`);
    console.log(`Mutation Targets: ${report.mutationTargetsCount}`);
    console.log(`TLC Verified   : ${report.tlcModelsVerifiedCount}`);
    console.log(`Hypergraph Nodes: ${report.totalHypergraphEntities} | Edges: ${report.totalHyperedges}`);
  }
}

async function cmd_autopilot_diagnose(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT });
  const ingestion = core.ingestRepositoryOntology();
  const report = core.diagnoseCausalRootCause(ingestion);
  const payload = { command: "toolchain:autopilot:diagnose", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Closed-Loop Autopilot: Causal SCM Diagnosis ===");
    console.log(`Backdoor Valid      : ${report.backdoorValid}`);
    console.log(`do(SPEC_CLARITY) ATE: ${report.interventionalAte}`);
    console.log(`Counterfactual FPY  : ${report.counterfactualFirstPassYield}`);
  }
}

async function cmd_autopilot_simulate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseFlagValue(args, "--seed=", "autopilot-closed-loop-seed");
  const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, simulationSeed: seed });
  const report = core.simulateRemediationPreFlight();
  const payload = { command: "toolchain:autopilot:simulate", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Closed-Loop Autopilot: DESH Pre-Flight Simulation ===");
    console.log(`Checkpoint ID       : ${report.checkpointId}`);
    console.log(`Rollback Succeeded  : ${report.rollbackSucceeded}`);
    console.log(`Snapshot Consistency: ${report.deshAudit.snapshotConsistency}`);
  }
}

async function cmd_autopilot_yield(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const commitLimit = Number(parseFlagValue(args, "--commits=", "20"));
  const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, commitLimit });
  const report = core.evaluateLiveGitHarnessTelemetry();
  const payload = { command: "toolchain:autopilot:yield", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Closed-Loop Autopilot: Live Git Harness Yield ===");
    console.log(`Commits Sampled : ${report.commitsSampled} (gitAvailable=${report.gitAvailable})`);
    console.log(`First-Pass Yield: ${(report.cohortTelemetry.firstPassYieldRatio * 100).toFixed(2)}%`);
    console.log(`Mean RAF        : ${report.cohortTelemetry.meanReworkAmplificationFactor}x`);
  }
}

async function cmd_autopilot_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT });
  const receipt = core.audit();

  const receiptPath = getReceiptPath();
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Closed-Loop Autopilot: Audit Receipt (SPEC-340) ===");
    console.log(`Stage Order Preserved: ${receipt.stageOrderPreserved}`);
    console.log(`Ontology Verified    : ${receipt.ontologyVerified}`);
    console.log(`Causal Verified      : ${receipt.causalVerified}`);
    console.log(`Simulation Verified  : ${receipt.simulationVerified}`);
    console.log(`Harness Verified     : ${receipt.harnessVerified}`);
    console.log(`All Passed           : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest       : ${receipt.sha256Digest}`);
  }
}

HANDLERS["toolchain:autopilot:ingest"] = cmd_autopilot_ingest;
HANDLERS["toolchain:autopilot:diagnose"] = cmd_autopilot_diagnose;
HANDLERS["toolchain:autopilot:simulate"] = cmd_autopilot_simulate;
HANDLERS["toolchain:autopilot:yield"] = cmd_autopilot_yield;
HANDLERS["toolchain:autopilot:audit"] = cmd_autopilot_audit;

export async function handleClosedLoopRepoAutopilotCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:autopilot command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
