/**
 * SPEC-156 / CHANGE-091 — Mission Golden Path BDD-480..482
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runMissionGoldenPath,
  EosMissionGoldenPathOrchestrator
} from "../src/core/eosMissionGoldenPathOrchestrator.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";
import { PHASE1_CORE_UTILITARIAN_HANDLERS } from "../src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-480: Nominal mission on eos-system succeeds within tested scope", () => {
  const result = runMissionGoldenPath("audit control plane health for Spotify Soundcheck alignment", {
    projectRoot: ROOT,
    target: "eos-system",
    domainHint: "platform",
    sealLedger: true,
    ledgerPath: ":memory:"
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.failingStage, null);
  assert.equal(result.epistemicState, "MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE");
  assert.match(result.sha256Receipt, /^[a-f0-9]{64}$/);
  assert.ok(result.stages.length >= 8);
  for (const stage of result.stages) {
    if (stage.mandatory) {
      assert.equal(stage.exitCode, 0, `${stage.stageId} must exit 0`);
    }
  }
  assert.ok(result.stages.some((s) => s.stageId === "SPOTIFY_ONLY_NORTH_STAR"));
  assert.ok(result.stages.some((s) => s.stageId === "SPOTIFY_INSTITUTIONAL"));
  assert.ok(result.stages.some((s) => s.stageId === "TURBO_VERIFY"));
  const finops = result.stages.find((s) => s.stageId === "FINOPS_COST_RECEIPT");
  assert.ok(finops);
  assert.equal(finops.mandatory, true);
  assert.equal(finops.exitCode, 0);
  assert.equal(typeof finops.evidence.estimatedCostUsd, "number");
  assert.match(String(finops.evidence.sha256Attestation), /^[a-f0-9]{64}$/);
  assert.ok(result.ledgerEntryId);
});

test("BDD-484: FinOps cost receipt is mandatory after input validation", () => {
  const result = runMissionGoldenPath("format and lint local AST outline for control plane", {
    projectRoot: ROOT,
    target: "eos-system",
    sealLedger: true,
    ledgerPath: ":memory:"
  });
  assert.equal(result.status, "SUCCESS");
  const finops = result.stages.find((s) => s.stageId === "FINOPS_COST_RECEIPT");
  assert.ok(finops);
  assert.equal(finops.exitCode, 0);
  assert.equal(finops.evidence.tier, "TIER_1_LOCAL_SLM");
  assert.ok(Number.isFinite(finops.evidence.estimatedCostUsd));
});

test("BDD-483: Spotify-only North Star doctrine pack is mandatory on control plane", () => {
  const result = runMissionGoldenPath("elevate music expression harmonic recommendations under Spotify-only North Star", {
    projectRoot: ROOT,
    target: "eos-system",
    sealLedger: true,
    ledgerPath: ":memory:"
  });
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.domainHint, "spotify");
  const north = result.stages.find((s) => s.stageId === "SPOTIFY_ONLY_NORTH_STAR");
  assert.ok(north);
  assert.equal(north.mandatory, true);
  assert.equal(north.exitCode, 0);
  assert.equal(north.evidence.doctrinePresent, true);
  assert.equal(north.evidence.workCompanionPresent, true);
});

test("BDD-481: Empty directive fail-closed", () => {
  const result = EosMissionGoldenPathOrchestrator.run("", { projectRoot: ROOT, ledgerPath: ":memory:" });
  assert.equal(result.status, "FAILED");
  assert.equal(result.failingStage, "INPUT_VALIDATION");
  assert.equal(result.epistemicState, "BLOCKED");
});

test("BDD-482: Fintech domain applies Nubank hard gate", () => {
  const result = runMissionGoldenPath("harden nubank fintech ledger idempotency gates", {
    projectRoot: ROOT,
    target: "eos-system",
    domainHint: "nubank",
    sealLedger: true,
    ledgerPath: ":memory:"
  });

  const nubank = result.stages.find((s) => s.stageId === "NUBANK_INSTITUTIONAL");
  assert.ok(nubank, "NUBANK_INSTITUTIONAL stage required");
  assert.equal(nubank.mandatory, true);
  assert.equal(nubank.evidence.hard, true);
  assert.equal(result.status, "SUCCESS");
});

test("SPEC-156: eos_mission_run is core utilitarian and dispatched", () => {
  assert.ok(CORE_TIER0_TOOL_NAMES.has("eos_mission_run"));
  assert.ok(!CORE_TIER0_TOOL_NAMES.has("eos_nano_benchmark"), "nano benchmark demoted to full profile");
  assert.ok(typeof PHASE1_CORE_UTILITARIAN_HANDLERS.eos_mission_run === "function");
  assert.ok(CORE_TIER0_TOOL_NAMES.size <= 30);

  const handled = PHASE1_CORE_UTILITARIAN_HANDLERS.eos_mission_run(
    { directive: "verify platform mission path", domainHint: "platform", sealLedger: true },
    {
      projectRoot: ROOT,
      resolveProjectPath: (value, _kind, fallback) =>
        path.resolve(ROOT, typeof value === "string" && value ? value : fallback || ".")
    }
  );
  assert.equal(handled.status, "SUCCESS");
  assert.match(handled.sha256Receipt, /^[a-f0-9]{64}$/);
});
