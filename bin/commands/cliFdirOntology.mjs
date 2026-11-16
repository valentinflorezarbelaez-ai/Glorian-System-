/**
 * CLI FDIR Knowledge Ontology Handlers
 *
 * Implements toolchain:fdir:* subcommands for ontology graph scanning,
 * orphan link quarantine, surgical purging ("La Sanación del Grafo"),
 * Tarjan SCC cycle resolution, and audit receipts.
 *
 * Conforms to SPEC-305 / CHANGE-167.
 */

import { EosFdirOntology } from "../../src/core/eosFdirOntology.ts";
import { EosOntologyCyclotron } from "../../src/core/eosOntologyCyclotron.ts";

const HANDLERS = {};
let globalCyclotron = null;

function getOrCreateCliCyclotron() {
  if (!globalCyclotron) {
    globalCyclotron = new EosOntologyCyclotron();
    const now = Date.now();
    globalCyclotron.registerNode("fleet:control-plane", "CORE_SERVICE", { name: "Glorian Control Plane" }, now);
    globalCyclotron.registerNode("fleet:auth-enclave", "SECURITY_SERVICE", { name: "Hardware TEE" }, now);
    globalCyclotron.registerNode("fleet:agent-mesh", "AGENT_RUNTIME", { name: "Automerge CRDT Mesh" }, now);
    globalCyclotron.registerEdge("fleet:control-plane", "fleet:auth-enclave", "SECURED_BY", 1.0, now);
    globalCyclotron.registerEdge("fleet:control-plane", "fleet:agent-mesh", "SYNCHRONIZES_WITH", 1.0, now);
  }
  return globalCyclotron;
}

async function cmd_fdir_scan(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const cyclotron = getOrCreateCliCyclotron();
  const report = EosFdirOntology.scanGraphIntegrity(cyclotron);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN FDIR KNOWLEDGE ONTOLOGY SCANNER (SPEC-305)           `);
  console.log(`===============================================================`);
  console.log(`  Status        : ${report.status}`);
  console.log(`  Total Nodes   : ${report.totalNodes}`);
  console.log(`  Total Edges   : ${report.totalEdges}`);
  console.log(`  Orphan Links  : ${report.orphanLinksCount}`);
  console.log(`  Cyclic SCCs   : ${report.cyclesCount}`);
  console.log(`  Scanned At    : ${report.scannedAtIso}`);
  console.log(`===============================================================\n`);
}

async function cmd_fdir_heal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const cyclotron = getOrCreateCliCyclotron();
  const result = EosFdirOntology.healGraphAnomalies(cyclotron);

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN FDIR SURGICAL GRAPH HEALER (SPEC-305)                `);
  console.log(`===============================================================`);
  console.log(`  Relational Restitution : ${result.healed ? "SUCCESS (OPTIMAL_HARMONY)" : "FAILED"}`);
  console.log(`  Purged Edges Count     : ${result.purgedEdgesCount}`);
  console.log(`  Cycles Broken Count    : ${result.cyclesBrokenCount}`);
  console.log(`  Remaining Anomalies    : ${result.remainingAnomaliesCount}`);
  console.log(`===============================================================\n`);
}

async function cmd_fdir_cycles(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const cyclotron = getOrCreateCliCyclotron();
  const cycles = EosFdirOntology.detectTarjanCycles(cyclotron);

  if (isJson) {
    console.log(JSON.stringify(cycles, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN TARJAN SCC CYCLIC DEADLOCK DETECTOR (SPEC-305)       `);
  console.log(`===============================================================`);
  console.log(`  Cycles Detected : ${cycles.length}`);
  for (const c of cycles) {
    console.log(`  ID: ${c.cycleId} | Nodes (${c.length}): ${c.nodes.join(" -> ")}`);
  }
  console.log(`===============================================================\n`);
}

async function cmd_fdir_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = EosFdirOntology.auditFdirOntologyPipeline({
    projectRoot: commandContext.root || process.cwd(),
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN FDIR ONTOLOGY AUDIT RECEIPT (SPEC-305)               `);
  console.log(`===============================================================`);
  console.log(`  Receipt Type        : ${receipt.receiptType}`);
  console.log(`  Nodes Evaluated     : ${receipt.totalNodesEvaluated}`);
  console.log(`  Edges Evaluated     : ${receipt.totalEdgesEvaluated}`);
  console.log(`  Orphan Links Purged : ${receipt.orphanLinksPurged}`);
  console.log(`  Cycles Resolved     : ${receipt.cyclesResolved}`);
  console.log(`  Harmony Restored    : ${receipt.harmonyRestored ? "YES" : "NO"}`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:fdir:scan"] = cmd_fdir_scan;
HANDLERS["toolchain:fdir:heal"] = cmd_fdir_heal;
HANDLERS["toolchain:fdir:cycles"] = cmd_fdir_cycles;
HANDLERS["toolchain:fdir:audit"] = cmd_fdir_audit;

export async function handleFdirCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchFdirOntology(commandContext) {
  return handleFdirCommands(commandContext);
}
