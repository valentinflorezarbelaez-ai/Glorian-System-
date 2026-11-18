/**
 * @file eosClosedLoopRepoAutopilot.test.mjs
 * @description BDD test suite for SPEC-340 / CHANGE-202: Sovereign Closed-Loop
 * Repository Autopilot Engine (BDD-1815..1820).
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic (no writes to docs/evidence/).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { handleClosedLoopRepoAutopilotCommand } from "../bin/commands/cliClosedLoopRepoAutopilot.mjs";
import { AutopilotError, EosClosedLoopRepoAutopilotCore } from "../src/core/eosClosedLoopRepoAutopilot.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

test("SPEC-340 / CHANGE-202: Sovereign Closed-Loop Repository Autopilot Engine", async (t) => {
  await t.test("BDD-1815: Ontological Ingestion of Live Repository Artifacts (SPEC-333)", () => {
    const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, maxEntitiesPerSource: 12 });
    assert.strictEqual(core.getProjectRoot(), ROOT);

    const ingestion = core.ingestRepositoryOntology();
    assert.strictEqual(ingestion.fleetProjectsCount, 9);
    assert.strictEqual(ingestion.mutationTargetsCount, 12);
    assert.strictEqual(ingestion.tlcModelsVerifiedCount, 12);
    assert.strictEqual(ingestion.totalHypergraphEntities, 34);
    assert.strictEqual(ingestion.totalHyperedges, 33);
    assert.strictEqual(ingestion.ontologicalAudit.bitemporalMonotonicity, true);
    assert.strictEqual(ingestion.ontologicalAudit.referentialIntegrity, true);
    assert.strictEqual(ingestion.ontologicalAudit.mlsLatticeContainment, true);
    assert.strictEqual(ingestion.ontologicalAudit.deduplicationResolved, true);
  });

  await t.test("BDD-1816: Causal SCM Root-Cause Diagnosis & Counterfactual Inference (SPEC-338)", () => {
    const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT });
    const ingestion = core.ingestRepositoryOntology();
    const causal = core.diagnoseCausalRootCause(ingestion);

    assert.deepStrictEqual(causal.topologicalOrder, [
      "TASK_COMPLEXITY",
      "SPEC_CLARITY",
      "CODE_CHURN",
      "MUTATION_SCORE",
      "PR_FIRST_PASS_YIELD",
    ]);
    assert.deepStrictEqual(causal.backdoorSet, ["TASK_COMPLEXITY"]);
    assert.strictEqual(causal.backdoorValid, true);
    assert.strictEqual(causal.dSeparatedWhenConditionedOnConfounder, true);
    assert.ok(causal.interventionalAte > 0.35);
    assert.ok(causal.expectedYieldAtHighClarity > causal.expectedYieldAtLowClarity);
    assert.ok(causal.counterfactualFirstPassYield > causal.factualFirstPassYield);
    assert.strictEqual(
      causal.individualTreatmentEffect,
      Number((causal.counterfactualFirstPassYield - causal.factualFirstPassYield).toFixed(6)),
    );
    assert.strictEqual(causal.scmSelfAuditPassed, true);

    const directCausal = core.diagnoseCausalRootCause();
    assert.strictEqual(directCausal.backdoorValid, true);
  });

  await t.test("BDD-1817: Deterministic DESH Pre-Flight Simulation, Checkpoint & Rollback (SPEC-334)", () => {
    const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT });
    const causal = core.diagnoseCausalRootCause();
    const sim = core.simulateRemediationPreFlight(causal);

    assert.strictEqual(sim.seed, "autopilot-closed-loop-seed");
    assert.strictEqual(sim.checkpointId, "autopilot-cp-1");
    assert.strictEqual(sim.injectedFaultCount, 1);
    assert.strictEqual(sim.rollbackSucceeded, true);
    assert.strictEqual(sim.virtualTimeAfterReplayNs, 200);
    assert.strictEqual(sim.deshAudit.snapshotConsistency, true);
    assert.strictEqual(sim.deshAudit.virtualTimeMonotonicity, true);
    assert.strictEqual(sim.deshAudit.violationsCount, 0);

    const standaloneSim = core.simulateRemediationPreFlight();
    assert.strictEqual(standaloneSim.rollbackSucceeded, true);
  });

  await t.test("BDD-1818: Live Git Commit Harness Yield & 5-Stage Loop Verification (SPEC-339)", () => {
    const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, commitLimit: 10 });
    const harness = core.evaluateLiveGitHarnessTelemetry();

    assert.strictEqual(harness.gitAvailable, true);
    assert.ok(harness.commitsSampled >= 1 && harness.commitsSampled <= 10);
    assert.strictEqual(harness.cohortTelemetry.cohortSize, harness.commitsSampled);
    assert.ok(harness.cohortTelemetry.firstPassYieldRatio >= 0 && harness.cohortTelemetry.firstPassYieldRatio <= 1);
    assert.ok(harness.cohortTelemetry.meanReworkAmplificationFactor >= 1);
    assert.strictEqual(harness.harnessLoopResult.prReady, true);
    assert.strictEqual(harness.harnessLoopResult.firstPassSuccess, true);
    for (const sample of harness.sampleCommits) {
      assert.ok(sample.sha.length > 0 && sample.subject.length > 0);
      assert.ok(["SDD_SPEC", "BUGFIX_REWORK", "DOCS_SYNC"].includes(sample.category));
    }
  });

  await t.test("BDD-1819: Fail-Closed Validation Boundaries, Stage Guards & Isolated Fallback", () => {
    const missingDir = path.join(os.tmpdir(), `eos-autopilot-missing-${process.pid}-${Date.now()}`);
    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore({ projectRoot: missingDir }),
      (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_INVALID_ROOT" && err.name === "AutopilotError",
    );

    const fileInsteadOfDir = path.join(ROOT, "package.json");
    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore({ projectRoot: fileInsteadOfDir }),
      (err) =>
        err instanceof AutopilotError &&
        err.code === "AUTOPILOT_INVALID_ROOT" &&
        err.message.includes("invalid project root directory"),
    );

    for (const badMax of [0, 101, 1.5]) {
      assert.throws(
        () => new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, maxEntitiesPerSource: badMax }),
        (err) =>
          err instanceof AutopilotError &&
          err.code === "AUTOPILOT_INVALID_PARAMETERS" &&
          err.message.includes("maxEntitiesPerSource"),
      );
    }

    for (const badCommitLimit of [0, 201, 2.5]) {
      assert.throws(
        () => new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, commitLimit: badCommitLimit }),
        (err) =>
          err instanceof AutopilotError &&
          err.code === "AUTOPILOT_INVALID_PARAMETERS" &&
          err.message.includes("commitLimit"),
      );
    }

    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT, simulationSeed: "   " }),
      (err) =>
        err instanceof AutopilotError &&
        err.code === "AUTOPILOT_INVALID_PARAMETERS" &&
        err.message.includes("simulationSeed"),
    );

    const minCore = new EosClosedLoopRepoAutopilotCore({
      projectRoot: ROOT,
      maxEntitiesPerSource: 1,
      commitLimit: 1,
    });
    assert.strictEqual(minCore.ingestRepositoryOntology().fleetProjectsCount, 1);

    const maxCore = new EosClosedLoopRepoAutopilotCore({
      projectRoot: ROOT,
      maxEntitiesPerSource: 100,
      commitLimit: 200,
    });
    assert.ok(maxCore.evaluateLiveGitHarnessTelemetry().commitsSampled >= 1);

    // Stage ordering guards
    const ing = minCore.ingestRepositoryOntology();
    assert.throws(
      () => minCore.diagnoseCausalRootCause({ ...ing, totalHypergraphEntities: 0 }),
      (err) =>
        err instanceof AutopilotError &&
        err.code === "AUTOPILOT_STAGE_VIOLATION" &&
        err.message.includes("before ontology ingestion"),
    );
    const caus = minCore.diagnoseCausalRootCause(ing);
    assert.throws(
      () => minCore.simulateRemediationPreFlight({ ...caus, backdoorValid: false }),
      (err) =>
        err instanceof AutopilotError &&
        err.code === "AUTOPILOT_STAGE_VIOLATION" &&
        err.message.includes("causal backdoor invalid"),
    );

    // Isolated empty temp repo exercises absent JSON & git offline fallback + failing TLC model count
    const emptyRepo = fs.mkdtempSync(path.join(os.tmpdir(), "eos-autopilot-empty-"));
    try {
      const emptyCore = new EosClosedLoopRepoAutopilotCore({ projectRoot: emptyRepo });
      const offlineReceipt = emptyCore.audit();
      assert.strictEqual(offlineReceipt.allPassed, true);
      assert.strictEqual(offlineReceipt.ingestion.fleetProjectsCount, 1);
      assert.strictEqual(offlineReceipt.ingestion.mutationTargetsCount, 1);
      assert.strictEqual(offlineReceipt.ingestion.tlcModelsVerifiedCount, 1);
      assert.strictEqual(offlineReceipt.harness.gitAvailable, false);
      assert.strictEqual(offlineReceipt.harness.commitsSampled, 2);

      // Synthetic JSON artifacts with mixed pass/fail TLC models & real local git log categories
      fs.mkdirSync(path.join(emptyRepo, "docs/evidence"), { recursive: true });
      fs.writeFileSync(
        path.join(emptyRepo, "docs/evidence/TLC_RECEIPT.json"),
        JSON.stringify({
          models: [
            { specName: "GoodSpec", passed: true },
            { specName: "FailingSpec", passed: false },
          ],
        }),
        "utf8",
      );
      const mixedReceipt = emptyCore.ingestRepositoryOntology();
      assert.strictEqual(mixedReceipt.tlcModelsVerifiedCount, 1);

      spawnSync("git", ["init"], { cwd: emptyRepo, encoding: "utf8" });
      spawnSync("git", ["config", "user.email", "test@eos.local"], { cwd: emptyRepo, encoding: "utf8" });
      spawnSync("git", ["config", "user.name", "EOS Test"], { cwd: emptyRepo, encoding: "utf8" });
      fs.writeFileSync(path.join(emptyRepo, "a.txt"), "1\n", "utf8");
      spawnSync("git", ["add", "a.txt"], { cwd: emptyRepo, encoding: "utf8" });
      spawnSync("git", ["commit", "-m", "feat(core): initial feature"], { cwd: emptyRepo, encoding: "utf8" });
      fs.writeFileSync(path.join(emptyRepo, "a.txt"), "2\n", "utf8");
      spawnSync("git", ["commit", "-am", "fix(core): resolve edge regression"], { cwd: emptyRepo, encoding: "utf8" });
      fs.writeFileSync(path.join(emptyRepo, "a.txt"), "3\n", "utf8");
      spawnSync("git", ["commit", "-am", "docs(release): sync status"], { cwd: emptyRepo, encoding: "utf8" });

      const gitTelemetry = emptyCore.evaluateLiveGitHarnessTelemetry();
      assert.strictEqual(gitTelemetry.gitAvailable, true);
      assert.strictEqual(gitTelemetry.commitsSampled, 3);
      assert.deepStrictEqual(
        gitTelemetry.sampleCommits.map((c) => c.category),
        ["DOCS_SYNC", "BUGFIX_REWORK", "SDD_SPEC"],
      );
      assert.ok(gitTelemetry.cohortTelemetry.wastedReworkTokens === 3400);
      assert.ok(gitTelemetry.cohortTelemetry.firstPassCount === 2);
    } finally {
      fs.rmSync(emptyRepo, { recursive: true, force: true });
    }
  });

  await t.test("BDD-1820: Deterministic End-to-End Receipt, CLI Parity, MCP Dispatch & Temp Persistence", async () => {
    const core = new EosClosedLoopRepoAutopilotCore();
    assert.strictEqual(core.getProjectRoot(), ROOT);

    const receiptA = core.audit();
    const receiptB = core.runClosedLoopAutopilot();

    assert.strictEqual(receiptA.specRef, "SPEC-340");
    assert.deepStrictEqual(receiptA.stageOrder, ["INGESTION", "CAUSAL", "DESH", "HARNESS"]);
    assert.strictEqual(receiptA.stageOrderPreserved, true);
    assert.strictEqual(receiptA.ontologyVerified, true);
    assert.strictEqual(receiptA.causalVerified, true);
    assert.strictEqual(receiptA.simulationVerified, true);
    assert.strictEqual(receiptA.harnessVerified, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    // Hermetic persistence check under os.tmpdir() (never mutates docs/evidence/)
    const tmpReceiptPath = path.join(os.tmpdir(), `eos-test-autopilot-${process.pid}.json`);
    fs.writeFileSync(tmpReceiptPath, JSON.stringify(receiptA, null, 2), "utf8");
    try {
      const parsed = JSON.parse(fs.readFileSync(tmpReceiptPath, "utf8"));
      assert.strictEqual(parsed.sha256Digest, receiptA.sha256Digest);
    } finally {
      fs.rmSync(tmpReceiptPath, { force: true });
    }

    // CLI read-only subcommands
    for (const cmd of [
      "toolchain:autopilot:ingest",
      "toolchain:autopilot:diagnose",
      "toolchain:autopilot:simulate",
      "toolchain:autopilot:yield",
    ]) {
      const handled = await handleClosedLoopRepoAutopilotCommand({ command: cmd, args: ["--json"] });
      assert.strictEqual(handled, true);
    }
    await assert.rejects(
      () => handleClosedLoopRepoAutopilotCommand({ command: "toolchain:autopilot:unknown", args: [] }),
      /Unknown toolchain:autopilot command/,
    );

    // Native MCP execution check
    const mcp = new EosMcpServer(ROOT, "full");
    const mcpRes = mcp.handleRequest({
      jsonrpc: "2.0",
      id: 940,
      method: "tools/call",
      params: { name: "eos_closed_loop_autopilot_audit", arguments: {} },
    });
    assert.ok(mcpRes && !mcpRes.error && !mcpRes.result?.isError);
    const mcpPayload = JSON.parse(mcpRes.result.content[0].text);
    assert.strictEqual(mcpPayload.specRef, "SPEC-340");
    assert.strictEqual(mcpPayload.allPassed, true);
  });

  await t.test("BDD-1835: Autopilot Causal Evidence Carries Provenance (SPEC-342 FR-8)", () => {
    const core = new EosClosedLoopRepoAutopilotCore({ projectRoot: ROOT });
    const causal = core.diagnoseCausalRootCause();

    assert.ok(causal.evidence);
    assert.ok(causal.evidenceProvenance);
    assert.strictEqual(typeof causal.evidence.SPEC_CLARITY, "number");
    assert.strictEqual(typeof causal.evidence.PR_FIRST_PASS_YIELD, "number");
    assert.strictEqual(typeof causal.evidence.MUTATION_SCORE, "number");
    assert.ok(
      causal.evidenceProvenance.MUTATION_SCORE === "MEASURED" || causal.evidenceProvenance.MUTATION_SCORE === "PRIOR",
    );
    assert.ok(causal.evidenceProvenance.PR_FIRST_PASS_YIELD === "PRIOR");
  });
});
