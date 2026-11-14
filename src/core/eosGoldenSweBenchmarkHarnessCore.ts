/**
 * SPEC-246 / CHANGE-123 — Layer-0 Golden SWE Benchmark Harness Core.
 * Runs a reproducible adversarial & clean corpus across Glorian engines and
 * reports Precision, Recall, F1-Score, False Positive Rate, and Accuracy.
 */

import crypto from "node:crypto";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import { EosLiveGitDiffPrInspectorCore } from "./eosLiveGitDiffPrInspectorCore.ts";
import { EosApiContractSemanticDiffCore } from "./eosApiContractSemanticDiffCore.ts";
import { EosPropertyBasedShrinkingFuzzerCore } from "./eosPropertyBasedShrinkingFuzzerCore.ts";
import { EosFleetMultiRepoShipOrchestratorCore } from "./eosFleetMultiRepoShipOrchestratorCore.ts";
import type {
  ConfusionClassification,
  GoldenSweBenchmarkReport,
  RunGoldenSweBenchmarkOptions,
  SweBenchmarkCaseInput,
  SweBenchmarkCaseOutcome,
} from "./eosGoldenSweBenchmarkHarnessCore.types.ts";

function buildSyntheticCredPatchLine(): string {
  const token = ["gh", "p_BenchmarkExampleToken12345678901"].join("");
  return `+const leaked = "${token}";\n`;
}

function executeBuiltInCorpus(): readonly SweBenchmarkCaseInput[] {
  const cleanDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
    ticketId: "BENCH-01",
    numstatOverride: "12\t2\tsrc/core/a.ts\n16\t0\ttest/a.test.mjs\n",
    patchOverride: "+export const ok = true;\n+ALTER TABLE items ADD COLUMN note TEXT;\n",
  });
  const secretDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
    ticketId: "BENCH-02",
    numstatOverride: "4\t0\tsrc/core/a.ts\n8\t0\ttest/a.test.mjs\n",
    patchOverride: buildSyntheticCredPatchLine(),
  });
  const beyonceDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
    ticketId: "BENCH-03",
    numstatOverride: "20\t4\tsrc/core/payment.ts\n",
    patchOverride: "+export const charge = () => 1;\n",
  });
  const ddlDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
    ticketId: "BENCH-04",
    numstatOverride: "3\t0\tsrc/db/m.sql\n3\t0\ttest/m.test.mjs\n",
    patchOverride: "+DROP TABLE ledger;\n",
  });
  const breakingContract = EosApiContractSemanticDiffCore.compareContracts({
    contractId: "BENCH-05",
    baselineSource: "export function a() {}\nexport function b() {}",
    candidateSource: "export function a() {}",
  });
  const failingProperty = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
    name: "bench_bound",
    min: 0,
    max: 1000,
    runs: 60,
    seed: 1337,
    predicate: (v) => v <= 400,
  });
  const cleanFleet = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
    projectsOverride: [
      {
        id: "bench-ok",
        name: "Clean Service",
        status: "REGISTERED",
        intake: "INTAKE_COMPLETE",
        specification: "SPECIFICATION_APPROVED",
        audit: "AUDIT_COMPLETE",
        ownerApproval: "OWNER_APPROVAL",
        authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
      },
    ],
  });
  const blockedFleet = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
    projectsOverride: [
      {
        id: "bench-block",
        name: "Unverified Service",
        status: "REGISTERED",
        intake: "INTAKE_COMPLETE",
        specification: "SPECIFICATION_APPROVED",
        audit: "AUDIT_PENDING",
        ownerApproval: "OWNER_APPROVAL",
        authorization: "LEVEL_1",
      },
    ],
  });

  return [
    { caseId: "CASE-01-CLEAN-PR", category: "live-diff", expectedBlock: false, actualBlock: !cleanDiff.readyToShip },
    {
      caseId: "CASE-02-CREDENTIAL-LEAK",
      category: "secret-scan",
      expectedBlock: true,
      actualBlock: !secretDiff.readyToShip,
    },
    {
      caseId: "CASE-03-BEYONCE-MISSING-TESTS",
      category: "beyonce-rule",
      expectedBlock: true,
      actualBlock: !beyonceDiff.readyToShip,
    },
    {
      caseId: "CASE-04-UNSAFE-DROP-TABLE",
      category: "sql-ddl",
      expectedBlock: true,
      actualBlock: !ddlDiff.readyToShip,
    },
    {
      caseId: "CASE-05-CONTRACT-BREAKING-REMOVAL",
      category: "api-contract",
      expectedBlock: true,
      actualBlock: !breakingContract.backwardCompatible,
    },
    {
      caseId: "CASE-06-PBT-COUNTEREXAMPLE-CAUGHT",
      category: "property-fuzzer",
      expectedBlock: true,
      actualBlock: !failingProperty.passed,
    },
    {
      caseId: "CASE-07-FLEET-COMPLIANT",
      category: "law-iv-fleet",
      expectedBlock: false,
      actualBlock: cleanFleet.fleetVerdict !== "FLEET_SHIP_READY",
    },
    {
      caseId: "CASE-08-LAW-IV-BLOCK",
      category: "law-iv-fleet",
      expectedBlock: true,
      actualBlock: blockedFleet.fleetVerdict !== "FLEET_SHIP_READY",
    },
  ];
}

function classifyOutcome(c: SweBenchmarkCaseInput): SweBenchmarkCaseOutcome {
  let classification: ConfusionClassification;
  if (c.expectedBlock && c.actualBlock) classification = "TP";
  else if (!c.expectedBlock && !c.actualBlock) classification = "TN";
  else if (!c.expectedBlock && c.actualBlock) classification = "FP";
  else classification = "FN";

  return {
    caseId: c.caseId,
    category: c.category,
    expectedBlock: c.expectedBlock,
    actualBlock: c.actualBlock,
    classification,
    correct: classification === "TP" || classification === "TN",
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export class EosGoldenSweBenchmarkHarnessCore {
  static runGoldenBenchmark(options: RunGoldenSweBenchmarkOptions = {}): GoldenSweBenchmarkReport {
    const cases = options.casesOverride ?? executeBuiltInCorpus();
    const outcomes = cases.map(classifyOutcome);

    const truePositives = outcomes.filter((o) => o.classification === "TP").length;
    const trueNegatives = outcomes.filter((o) => o.classification === "TN").length;
    const falsePositives = outcomes.filter((o) => o.classification === "FP").length;
    const falseNegatives = outcomes.filter((o) => o.classification === "FN").length;

    const precision = truePositives + falsePositives > 0 ? round4(truePositives / (truePositives + falsePositives)) : 0;
    const recall = truePositives + falseNegatives > 0 ? round4(truePositives / (truePositives + falseNegatives)) : 0;
    const f1Score = precision + recall > 0 ? round4((2 * precision * recall) / (precision + recall)) : 0;
    const falsePositiveRate =
      falsePositives + trueNegatives > 0 ? round4(falsePositives / (falsePositives + trueNegatives)) : 0;
    const accuracy = outcomes.length > 0 ? round4((truePositives + trueNegatives) / outcomes.length) : 0;

    const payload = {
      totalCases: outcomes.length,
      truePositives,
      trueNegatives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      accuracy,
      outcomes,
    };
    const benchmarkDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return deepFreeze({ ...payload, benchmarkDigestSha256 });
  }
}
