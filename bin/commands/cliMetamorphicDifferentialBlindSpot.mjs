/**
 * @file cliMetamorphicDifferentialBlindSpot.mjs
 * @description CLI handler for SPEC-341 / CHANGE-203: Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMetamorphicDifferentialBlindSpotCore } from "../../src/core/eosMetamorphicDifferentialBlindSpot.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/BLINDSPOT_HUNTER_RECEIPT.json");

function parseIntFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const parsed = Number(arg.split("=")[1]);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const HANDLERS = {};

async function cmd_blindspot_shrink(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const runs = parseIntFlag(args, "--runs=", 120);
  const report = EosMetamorphicDifferentialBlindSpotCore.checkStructuralProperty({
    name: "naive_sort_blind_spot",
    seed,
    runs,
    generatorMode: "INT_ARRAY",
    predicate: (arr) => {
      const sorted = [...arr].sort();
      return sorted.every((v, idx) => idx === 0 || sorted[idx - 1] <= v);
    },
  });
  const payload = { command: "toolchain:blindspot:shrink", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Structural Property & Tree Shrinking ===");
    console.log(`Passed              : ${report.passed}`);
    console.log(`Minimal Counterex.  : ${JSON.stringify(report.minimalCounterexample)}`);
    console.log(`Shrink Steps        : ${report.shrinkStepsTaken}`);
  }
}

async function cmd_blindspot_differential(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const runs = parseIntFlag(args, "--runs=", 120);
  const report = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign({
    targetName: "naive_vs_numeric_sort",
    seed,
    runs,
    referenceFn: (arr) => [...arr].sort((a, b) => a - b),
    candidateFn: (arr) => [...arr].sort(),
  });
  const payload = { command: "toolchain:blindspot:differential", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Differential Oracle ===");
    console.log(`Equivalent          : ${report.equivalent}`);
    console.log(`Divergences         : ${report.divergenceCount}/${report.totalRuns}`);
    console.log(`Minimal Input       : ${JSON.stringify(report.minimalDivergingInput)}`);
  }
}

async function cmd_blindspot_metamorphic(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const sort = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
    relation: "SORT_PERMUTATION_IDEMPOTENCE",
    seed,
  });
  const filter = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
    relation: "FILTER_SUBSET_MONOTONICITY",
    seed: seed + 1,
  });
  const roundtrip = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
    relation: "JSON_ROUNDTRIP_INVERTIBILITY",
    seed: seed + 2,
  });
  const payload = {
    command: "toolchain:blindspot:metamorphic",
    allPassed: sort.passed && filter.passed && roundtrip.passed,
    relations: [sort, filter, roundtrip],
  };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Metamorphic Relation Verifier ===");
    console.log(`Sort Idempotence    : ${sort.passed}`);
    console.log(`Filter Monotonicity : ${filter.passed}`);
    console.log(`JSON Round-Trip     : ${roundtrip.passed}`);
  }
}

async function cmd_blindspot_fuzz(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const iterations = parseIntFlag(args, "--iterations=", 500);
  const report = EosMetamorphicDifferentialBlindSpotCore.runBoundaryFuzzCampaignSync({
    targetName: "cli_boundary_validator",
    seed,
    iterations,
    handler: (input) => {
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return { statusCode: 400, body: { error: "expected_object" } };
      }
      const age = input.age;
      if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 130) {
        return { statusCode: 422, body: { error: "invalid_age" } };
      }
      return { statusCode: 201, body: { ok: true } };
    },
  });
  const payload = { command: "toolchain:blindspot:fuzz", ...report };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Boundary Fuzz Campaign ===");
    console.log(`Iterations          : ${report.iterations}`);
    console.log(`Unhandled / HTTP5xx : ${report.unhandledExceptionCount} / ${report.http5xxCount}`);
    console.log(`Stability Score     : ${report.stabilityScore}`);
  }
}

async function cmd_blindspot_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const receipt = new EosMetamorphicDifferentialBlindSpotCore().audit(seed);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Audit Receipt (SPEC-341) ===");
    console.log(`Structural Shrink   : ${receipt.structuralShrinkCaughtSortBug}`);
    console.log(`Differential Oracle : ${receipt.differentialCaughtDivergence && receipt.differentialParityConfirmed}`);
    console.log(
      `Metamorphic Suite   : ${receipt.metamorphicSortPassed && receipt.metamorphicFilterPassed && receipt.metamorphicRoundtripPassed}`,
    );
    console.log(`Fuzz 500 Zero-500s  : ${receipt.fuzzHttp5xxCount === 0 && receipt.fuzzUnhandledExceptions === 0}`);
    console.log(`All Passed          : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest      : ${receipt.sha256Digest}`);
  }
}

async function cmd_blindspot_fleet(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const seed = parseIntFlag(args, "--seed=", 2026341);
  const iterations = parseIntFlag(args, "--iterations=", 50);
  const receipt = new EosMetamorphicDifferentialBlindSpotCore().auditFleetProjects({
    projectRoot: ROOT,
    seed,
    iterationsPerProject: iterations,
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Blind-Spot Hunter: Fleet Repositories Audit (SPEC-341 / SPEC-124) ===");
    console.log(`Total Fleet Projects: ${receipt.totalFleetProjects}`);
    console.log(`Audited Projects    : ${receipt.auditedProjects}`);
    console.log(`All Passed          : ${receipt.allPassed}`);
    console.log(`Mean Stability Score: ${receipt.meanStabilityScore}`);
    console.log(`SHA-256 Digest      : ${receipt.sha256Digest}`);
    for (const p of receipt.projects) {
      console.log(
        `  - [${p.passed ? "PASS" : "FAIL"}] ${p.projectId} (stability: ${p.stabilityScore}, 5xx: ${p.http5xxCount})`,
      );
    }
  }
}

HANDLERS["toolchain:blindspot:shrink"] = cmd_blindspot_shrink;
HANDLERS["toolchain:blindspot:differential"] = cmd_blindspot_differential;
HANDLERS["toolchain:blindspot:metamorphic"] = cmd_blindspot_metamorphic;
HANDLERS["toolchain:blindspot:fuzz"] = cmd_blindspot_fuzz;
HANDLERS["toolchain:blindspot:audit"] = cmd_blindspot_audit;
HANDLERS["toolchain:blindspot:fleet"] = cmd_blindspot_fleet;

export async function handleMetamorphicDifferentialBlindSpotCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:blindspot command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
