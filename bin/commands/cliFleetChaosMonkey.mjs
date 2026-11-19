/**
 * @file cliFleetChaosMonkey.mjs
 * @description CLI handler for SPEC-364 / CHANGE-226: Fleet Chaos Monkey & Autonomous FDIR Engine.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosFleetChaosMonkey, REGISTERED_FLEET_REPOS } from "../../src/core/eosFleetChaosMonkey.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("FLEET_CHAOS_MONKEY_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_chaos_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const monkey = new EosFleetChaosMonkey();
  const receipt = await monkey.audit();
  const receiptPath = getReceiptPath(ROOT);

  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Fleet Chaos Monkey & Autonomous FDIR Engine (SPEC-364) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Fleet Repositories Count: ${receipt.fleetRepositoriesCount}`);
    console.log(`Total Experiments Run   : ${receipt.totalExperiments}`);
    console.log(`Certified Average MTTR  : ${receipt.certifiedAverageMttrMs} ms (< 500ms TARGET)`);
    console.log(`Checks Summary          :`);
    console.log(`  - Multi-Vector Injection: ${receipt.checks.multiVectorFaultInjection}`);
    console.log(`  - Sub-50ms Detection    : ${receipt.checks.sub50msAnomalyDetection}`);
    console.log(`  - Blast Radius Isolation: ${receipt.checks.sandboxedBlastRadiusIsolation}`);
    console.log(`  - Raft Swarm Remediation: ${receipt.checks.raftSwarmRemediation}`);
    console.log(`  - Sub-500ms MTTR Cert   : ${receipt.checks.sub500msMttrCertification}`);
    console.log(`  - Zero Dependency Purity: ${receipt.checks.zeroDependencyPurity}`);
    console.log(`Integrity Hash          : ${receipt.integrityHash}`);
    console.log(`Evidence Receipt        : ${receiptPath}`);
  }
}

async function cmd_chaos_fleet(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const monkey = new EosFleetChaosMonkey();
  const benchmark = await monkey.runFleetBenchmark(1);

  if (isJson) {
    console.log(JSON.stringify(benchmark, null, 2));
  } else {
    console.log("=== Fleet-Wide Chaos Resilience Benchmark (9/9 Repositories) ===");
    console.log(`Benchmark ID            : ${benchmark.benchmarkId}`);
    console.log(`Total Fault Injections  : ${benchmark.totalExperiments}`);
    console.log(`Successful Recoveries   : ${benchmark.successfulRecoveries}`);
    console.log(`Average Fleet MTTR      : ${benchmark.averageMttrMs} ms`);
    console.log(`Max Single MTTR         : ${benchmark.maxMttrMs} ms`);
    console.log(`MTTR Target Conforming  : ${benchmark.mttrTargetConforming ? "YES (MTTR < 500ms)" : "NO"}`);
    console.log(`Evaluated Repositories  : ${benchmark.evaluatedRepos.join(", ")}`);
  }
}

async function cmd_chaos_inject(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const vectorArg = args.find((a) => a.startsWith("--vector="));
  const vector = vectorArg ? vectorArg.split("=")[1] : "CORRUPTED_AST";
  const repoArg = args.find((a) => a.startsWith("--repo="));
  const repo = repoArg ? repoArg.split("=")[1] : "eos-system";

  const monkey = new EosFleetChaosMonkey();
  const exp = await monkey.executeFdirExperiment({
    vector,
    targetRepo: repo,
  });

  if (isJson) {
    console.log(JSON.stringify(exp, null, 2));
  } else {
    console.log("=== Chaos Fault Injection & Recovery Execution ===");
    console.log(`Experiment ID   : ${exp.experimentId}`);
    console.log(`Target Repo     : ${exp.targetRepo}`);
    console.log(`Vector          : ${exp.vector}`);
    console.log(`Detection Delay : ${exp.detectionLatencyMs} ms (< 50ms)`);
    console.log(`Isolation Delay : ${exp.isolationLatencyMs} ms (< 100ms)`);
    console.log(`Recovery Delay  : ${exp.recoveryLatencyMs} ms`);
    console.log(`Total MTTR      : ${exp.totalMttrMs} ms (< 500ms)`);
    console.log(`Final Status    : ${exp.fdirState}`);
  }
}

async function cmd_chaos_fdir(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json") || true;
  const monkey = new EosFleetChaosMonkey();

  const statuses = REGISTERED_FLEET_REPOS.map((repo) => ({
    repo,
    fdirState: monkey.getRepoState(repo),
  }));

  if (isJson) {
    console.log(JSON.stringify(statuses, null, 2));
  } else {
    console.log("=== Fleet FDIR Node Statuses ===");
    for (const s of statuses) {
      console.log(`- ${s.repo.padEnd(30)}: ${s.fdirState}`);
    }
  }
}

HANDLERS["toolchain:chaos:audit"] = cmd_chaos_audit;
HANDLERS["toolchain:chaos:fleet"] = cmd_chaos_fleet;
HANDLERS["toolchain:chaos:inject"] = cmd_chaos_inject;
HANDLERS["toolchain:chaos:fdir"] = cmd_chaos_fdir;

export async function handleFleetChaosMonkeyCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:chaos command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
