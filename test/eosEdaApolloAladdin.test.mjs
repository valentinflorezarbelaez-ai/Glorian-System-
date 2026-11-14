/**
 * BDD Test Suite — SPEC-247..SPEC-249 / CHANGE-124
 * Covers Synopsys/seL4 EDA Prover, Palantir Apollo Air-Gapped Bundle Orchestrator,
 * BlackRock Aladdin Systemic Stress Engine, Docs-only Beyoncé Rule refinement, CLI & MCP.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EosEdaEquivalenceTimingProverCore } from "../src/core/eosEdaEquivalenceTimingProverCore.ts";
import { EosApolloAirGappedBundleOrchestratorCore } from "../src/core/eosApolloAirGappedBundleOrchestratorCore.ts";
import { EosAladdinSystemicRiskStressCore } from "../src/core/eosAladdinSystemicRiskStressCore.ts";
import { EosIssueToPrCanaryBridgeCore } from "../src/core/eosIssueToPrCanaryBridgeCore.ts";
import { dispatchPhase7FrontierActionExt2 } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts";

const ROOT = process.cwd();

test("SPEC-247..SPEC-249 / CHANGE-124 — EDA Formal Prover, Apollo Air-Gap & Aladdin Systemic Stress", async (t) => {
  await t.test("BDD-1256: proves default LEC equivalence, positive STA slack, and safe isolation", () => {
    const report = EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation();
    assert.equal(report.lecEquivalent, true);
    assert.equal(report.inputsTestedCount, 64);
    assert.equal(report.criticalPathDelayMicros, 400);
    assert.equal(report.slackMicros, 100);
    assert.equal(report.timingMet, true);
    assert.equal(report.nonInterferenceVerified, true);
    assert.equal(report.verdict, "SILICON_FORMAL_VERIFIED");
    assert.match(report.proverDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1257: detects logical equivalence divergence with exact counterexample", () => {
    const report = EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation({
      referenceFn: (x) => x * 2 + 1,
      candidateFn: (x) => (x >= 10 ? x * 2 + 2 : x * 2 + 1),
      inputDomain: [0, 5, 10, 15],
    });
    assert.equal(report.lecEquivalent, false);
    assert.equal(report.firstCounterexample?.input, 10);
    assert.equal(report.firstCounterexample?.referenceOutput, 21);
    assert.equal(report.firstCounterexample?.candidateOutput, 22);
    assert.equal(report.verdict, "FORMAL_VIOLATION_BLOCKED");
  });

  await t.test("BDD-1258: flags negative timing slack when critical path exceeds clock budget", () => {
    const report = EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation({
      timingDag: [
        { nodeId: "stage1", delayMicros: 300 },
        { nodeId: "stage2", delayMicros: 350, dependsOn: ["stage1"] },
      ],
      clockBudgetMicros: 500,
    });
    assert.equal(report.criticalPathDelayMicros, 650);
    assert.equal(report.slackMicros, -150);
    assert.equal(report.timingMet, false);
    assert.equal(report.verdict, "FORMAL_VIOLATION_BLOCKED");
  });

  await t.test("BDD-1259: rejects cyclic dependencies in timing DAG", () => {
    assert.throws(
      () =>
        EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation({
          timingDag: [
            { nodeId: "A", delayMicros: 10, dependsOn: ["B"] },
            { nodeId: "B", delayMicros: 10, dependsOn: ["A"] },
          ],
        }),
      /Cyclic dependency detected in timing DAG/,
    );
  });

  await t.test("BDD-1260: detects unclassified HIGH_SECRET -> LOW_PUBLIC non-interference leak", () => {
    const report = EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation({
      flows: [
        {
          sourceId: "secret_key",
          sourceDomain: "HIGH_SECRET",
          sinkId: "telemetry_beacon",
          sinkDomain: "LOW_PUBLIC",
          declassified: false,
        },
      ],
    });
    assert.equal(report.nonInterferenceVerified, false);
    assert.equal(report.illegalFlows.length, 1);
    assert.equal(report.verdict, "FORMAL_VIOLATION_BLOCKED");
  });

  await t.test("BDD-1261: compiles and offline-verifies Apollo air-gapped bundle as AIRGAP_DEPLOY_READY", () => {
    const report = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
      projectRoot: ROOT,
      bundleId: "APOLLO-TEST-248",
    });
    assert.equal(report.dsseVerified, true);
    assert.equal(report.recalled, false);
    assert.equal(report.constraintsMet, true);
    assert.equal(report.verdict, "AIRGAP_DEPLOY_READY");
    assert.match(report.artifactMerkleRootSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1262: blocks deployment when bundle version appears in recall ledger", () => {
    const report = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
      version: "75.0.0-bad1",
      recalledVersions: ["75.0.0-bad1"],
    });
    assert.equal(report.recalled, true);
    assert.equal(report.verdict, "RECALL_BLOCKED");
  });

  await t.test("BDD-1263: places bundle on CONSTRAINT_HOLD on target arch or memory mismatch", () => {
    const report = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
      targetNode: {
        nodeId: "sat-edge-07",
        arch: "arm64",
        memoryMb: 1024,
        quorumNodes: 2,
        airGappedOffline: true,
      },
    });
    assert.equal(report.constraintsMet, false);
    assert.ok(report.constraintViolations.length >= 2);
    assert.equal(report.verdict, "CONSTRAINT_HOLD");
  });

  await t.test("BDD-1264: confines air-gapped bundle disk persistence inside projectRoot", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-apollo-"));
    try {
      const report = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
        projectRoot: tmpRoot,
        bundleId: "APOLLO-DISK",
        writeBundleToDisk: true,
      });
      assert.ok(report.writtenBundlePath && fs.existsSync(report.writtenBundlePath));
      const parsed = JSON.parse(fs.readFileSync(report.writtenBundlePath, "utf8"));
      assert.equal(parsed.artifactMerkleRootSha256, report.artifactMerkleRootSha256);

      assert.throws(
        () =>
          EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
            projectRoot: tmpRoot,
            writeBundleToDisk: true,
            outputRelPath: "../escape.json",
          }),
        /Path traversal outside projectRoot is forbidden/,
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await t.test("BDD-1265: produces repeatable Merkle root and digest for fixed Apollo seed", () => {
    const opts = { bundleId: "APOLLO-DET", version: "75.0.0", keySeed: "apollo-seed-248" };
    const b1 = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle(opts);
    const b2 = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle(opts);
    assert.equal(b1.artifactMerkleRootSha256, b2.artifactMerkleRootSha256);
    assert.equal(b1.bundleDigestSha256, b2.bundleDigestSha256);
  });

  await t.test("BDD-1266: runs Aladdin Monte Carlo stress across 9-project fleet non-critical", () => {
    const report = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({ projectRoot: ROOT });
    assert.equal(report.portfolioSize, 9);
    assert.equal(report.trialsExecuted, 200);
    assert.notEqual(report.riskTier, "SYSTEMIC_CRITICAL");
    assert.ok(report.expectedShortfall99Percent >= report.valueAtRisk99Percent);
  });

  await t.test("BDD-1267: detects SYSTEMIC_CRITICAL risk tier under severe correlated shock", () => {
    const report = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({
      projectRoot: ROOT,
      shockProbability: 0.45,
      contagionCoupling: 0.75,
      trials: 300,
    });
    assert.equal(report.riskTier, "SYSTEMIC_CRITICAL");
    assert.ok(report.circuitBreakerDirectives.some((d) => d.includes("TRIP_FLEET_CIRCUIT_BREAKER")));
  });

  await t.test("BDD-1268: preserves coherent risk quantile ordering (VaR95 <= VaR99 <= CVaR99)", () => {
    const report = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({
      portfolioCountOverride: 16,
      trials: 250,
      seed: 99,
      shockProbability: 0.15,
      contagionCoupling: 0.3,
    });
    assert.ok(report.valueAtRisk95Percent <= report.valueAtRisk99Percent);
    assert.ok(report.valueAtRisk99Percent <= report.expectedShortfall99Percent);
    assert.ok(report.contagionAmplificationFactor >= 1);
  });

  await t.test("BDD-1269: rejects path traversal on Aladdin registryRelPath", () => {
    assert.throws(
      () =>
        EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({
          projectRoot: ROOT,
          registryRelPath: "../../etc/passwd",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1270: verifies repeatable Aladdin digest, docs Beyonce exemption, CLI & MCP actions", () => {
    const a1 = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({ projectRoot: ROOT, seed: 249 });
    const a2 = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({ projectRoot: ROOT, seed: 249 });
    assert.equal(a1.aladdinDigestSha256, a2.aladdinDigestSha256);

    const docsOnlyAudit = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles: [{ path: "docs/releases/EOS_FREEZE_GATE_STATUS.md", additions: 2, deletions: 2 }],
    });
    assert.equal(docsOnlyAudit.beyonceRuleSatisfied, true);
    assert.equal(docsOnlyAudit.blockingRisks.length, 0);

    const eda = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "eda:prove", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(eda.verdict, "SILICON_FORMAL_VERIFIED");

    const apollo = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "apollo:bundle", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(apollo.verdict, "AIRGAP_DEPLOY_READY");

    const aladdin = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "aladdin:stress", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(aladdin.portfolioSize, 9);

    const shipOut = JSON.parse(
      execFileSync(process.execPath, [path.join(ROOT, "bin/eos.mjs"), "ship", "--ticket=SPOT-249", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    assert.equal(shipOut.edaFormalProof.verdict, "SILICON_FORMAL_VERIFIED");
    assert.equal(shipOut.apolloAirGapBundle.verdict, "AIRGAP_DEPLOY_READY");
    assert.equal(shipOut.aladdinSystemicRisk.portfolioSize, 9);

    const mcpDeps = { projectRoot: ROOT, mcpCalls: 0, auditEntries: [] };
    assert.equal(
      dispatchPhase7FrontierActionExt2("eda_equivalence_timing_prove", {}, mcpDeps).verdict,
      "SILICON_FORMAL_VERIFIED",
    );
    assert.equal(dispatchPhase7FrontierActionExt2("apollo_airgap_bundle", {}, mcpDeps).verdict, "AIRGAP_DEPLOY_READY");
    assert.equal(dispatchPhase7FrontierActionExt2("aladdin_systemic_stress", {}, mcpDeps).portfolioSize, 9);
  });
});
