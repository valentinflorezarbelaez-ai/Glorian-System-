import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EosLiveGitDiffPrInspectorCore } from "../src/core/eosLiveGitDiffPrInspectorCore.ts";
import { EosRepoMapSymbolCompressorCore } from "../src/core/eosRepoMapSymbolCompressorCore.ts";
import { EosPropertyBasedShrinkingFuzzerCore } from "../src/core/eosPropertyBasedShrinkingFuzzerCore.ts";
import { dispatchPhase7FrontierActionExt2 } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt2.ts";

const ROOT = process.cwd();

test("SPEC-238..SPEC-240 / CHANGE-121 — Live Git Diff Inspector, RepoMap Compressor & Shrinking PBT", async (t) => {
  await t.test("BDD-1211: marks clean diff with tests & additive SQL as readyToShip", () => {
    const report = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: ROOT,
      ticketId: "SPOT-238",
      numstatOverride: "18\t2\tsrc/core/audioGain.ts\n35\t0\ttest/audioGain.test.mjs\n",
      patchOverride: "+export function normalizeGain() {}\n+ALTER TABLE streams ADD COLUMN trace_id TEXT;\n",
    });
    assert.equal(report.secretMatchesCount, 0);
    assert.equal(report.diffAudit.beyonceRuleSatisfied, true);
    assert.equal(report.diffAudit.migrationPattern, "SAFE_EXPAND_AND_CONTRACT");
    assert.equal(report.readyToShip, true);
    assert.match(report.inspectionDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1212: rejects repoPath or bundleRelPath traversal outside projectRoot", () => {
    assert.throws(
      () =>
        EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
          projectRoot: ROOT,
          repoPath: "../outside-workspace",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
    assert.throws(
      () =>
        EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
          projectRoot: ROOT,
          numstatOverride: "5\t0\tsrc/core/a.ts\n5\t0\ttest/a.test.mjs\n",
          writeBundle: true,
          bundleRelPath: "../../outside-bundle.md",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1213: blocks diff when synthetic credential pattern appears on added lines", () => {
    const syntheticCredLine = `+const hdr = "gh` + `p_${"x".repeat(24)}";`;
    const report = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: ROOT,
      ticketId: "SEC-238",
      numstatOverride: "1\t0\tsrc/core/a.ts\n1\t0\ttest/a.test.mjs\n",
      patchOverride: syntheticCredLine,
    });
    assert.ok(report.secretMatchesCount >= 1);
    assert.equal(report.readyToShip, false);
  });

  await t.test("BDD-1214: blocks diff on Beyonce Rule violation or DROP TABLE DDL", () => {
    const noTests = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: ROOT,
      numstatOverride: "25\t4\tsrc/core/billing.ts\n",
    });
    assert.equal(noTests.readyToShip, false);
    assert.ok(noTests.diffAudit.blockingRisks.some((r) => r.includes("Beyonce Rule")));

    const unsafeSql = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: ROOT,
      numstatOverride: "5\t0\tsrc/core/billing.ts\n10\t0\ttest/billing.test.mjs\n",
      patchOverride: "+DROP TABLE legacy_sessions;\n",
    });
    assert.equal(unsafeSql.readyToShip, false);
    assert.equal(unsafeSql.diffAudit.migrationPattern, "UNSAFE_BREAKING_DDL");
  });

  await t.test("BDD-1215: persists PR bundle inside confined .eos directory when writeBundle is true", () => {
    const relBundle = ".eos/tmp-bdd1215-bundle.md";
    const absBundle = path.join(ROOT, relBundle);
    try {
      const report = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
        projectRoot: ROOT,
        ticketId: "SPOT-BUNDLE",
        numstatOverride: "4\t0\tsrc/core/a.ts\n8\t0\ttest/a.test.mjs\n",
        writeBundle: true,
        bundleRelPath: relBundle,
      });
      assert.equal(report.writtenBundlePath, relBundle);
      assert.ok(fs.existsSync(absBundle));
      const content = fs.readFileSync(absBundle, "utf8");
      assert.match(content, /SPOT-BUNDLE/);
    } finally {
      fs.rmSync(absBundle, { force: true });
    }
  });

  await t.test("BDD-1216: ranks imported core modules higher by graph centrality", () => {
    const map = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      maxTokenBudget: 2000,
      sourceFilesOverride: [
        { path: "src/core/alphaKernel.ts", content: "export class AlphaKernel {}\nexport function boot() {}" },
        {
          path: "src/core/betaService.ts",
          content: 'import { AlphaKernel } from "./alphaKernel.ts";\nexport const b = 1;',
        },
        {
          path: "src/core/gammaApi.ts",
          content: 'import { AlphaKernel } from "./alphaKernel.ts";\nexport function run() {}',
        },
      ],
    });
    assert.equal(map.rankedEntries[0].path, "src/core/alphaKernel.ts");
    assert.equal(map.rankedEntries[0].inDegree, 2);
    assert.ok(map.rankedEntries[0].rankScore > map.rankedEntries[1].rankScore);
  });

  await t.test("BDD-1217: strictly enforces maxTokenBudget ceiling during RepoMap packing", () => {
    const map = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      maxTokenBudget: 30,
      sourceFilesOverride: [
        {
          path: "src/core/oneLongModuleNameOne.ts",
          content:
            "export function alphaSymbolName() {}\nexport function betaSymbolName() {}\nexport function gammaSymbolName() {}\nexport function deltaSymbolName() {}\n",
        },
        {
          path: "src/core/twoLongModuleNameTwo.ts",
          content:
            "export function epsilonSymbolName() {}\nexport function zetaSymbolName() {}\nexport function etaSymbolName() {}\nexport function thetaSymbolName() {}\n",
        },
        {
          path: "src/core/threeLongModuleNameThree.ts",
          content:
            "export function iotaSymbolName() {}\nexport function kappaSymbolName() {}\nexport function lambdaSymbolName() {}\nexport function muSymbolName() {}\n",
        },
      ],
    });
    assert.ok(map.estimatedCompressedTokens <= 30);
    assert.ok(map.filesIncluded < map.filesScanned);
  });

  await t.test("BDD-1218: extracts public symbols across Go, Python, Rust, and TypeScript", () => {
    const map = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      sourceFilesOverride: [
        { path: "pkg/player.go", content: "package player\nfunc PlayTrack(id string) error { return nil }\n" },
        { path: "app/worker.py", content: "class JobWorker:\n  pass\ndef run_job():\n  pass\n" },
        { path: "src/lib.rs", content: "pub struct Engine {}\npub fn start_engine() {}\n" },
        { path: "src/index.ts", content: "export interface Config {}\nexport function initApp() {}\n" },
      ],
    });
    const allSyms = map.rankedEntries.flatMap((e) => e.symbols);
    assert.ok(allSyms.includes("PlayTrack"));
    assert.ok(allSyms.includes("JobWorker"));
    assert.ok(allSyms.includes("start_engine"));
    assert.ok(allSyms.includes("initApp"));
  });

  await t.test("BDD-1219: scans confined targetDir on disk and rejects traversal", () => {
    const diskMap = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      projectRoot: ROOT,
      targetDir: "src/core",
      maxTokenBudget: 900,
      maxFiles: 10,
    });
    assert.equal(diskMap.filesScanned, 10);
    assert.ok(diskMap.tokenSavingsPercent >= 50);
    assert.throws(
      () =>
        EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
          projectRoot: ROOT,
          targetDir: "../outside-dir",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  await t.test("BDD-1220: computes repeatable SHA-256 digests for identical RepoMap inputs", () => {
    const files = [{ path: "src/a.ts", content: "export const A = 1;\n" + "a".repeat(200) }];
    const r1 = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      sourceFilesOverride: files,
      maxTokenBudget: 500,
    });
    const r2 = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      sourceFilesOverride: files,
      maxTokenBudget: 500,
    });
    assert.equal(r1.repoMapDigestSha256, r2.repoMapDigestSha256);
  });

  await t.test("BDD-1221: discovers failing numeric case and binary-shrinks to exact minimal boundary", () => {
    const res = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "lt_42_boundary",
      seed: 99,
      runs: 200,
      min: 0,
      max: 10000,
      predicate: (n) => n < 42,
    });
    assert.equal(res.passed, false);
    assert.equal(res.minimalCounterexample, 42);
    assert.ok(res.shrinkStepsTaken >= 1);
  });

  await t.test("BDD-1222: shrinks string counterexample down to minimal failing character", () => {
    const res = EosPropertyBasedShrinkingFuzzerCore.checkStringProperty({
      name: "no_uppercase_A",
      seed: 42,
      runs: 200,
      maxLength: 24,
      alphabet: "abcABC123",
      predicate: (s) => !s.includes("A"),
    });
    assert.equal(res.passed, false);
    assert.equal(res.minimalCounterexample, "A");
  });

  await t.test("BDD-1223: verifies passing invariants with zero shrink steps and repeatable digest", () => {
    const r1 = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "zero_mult",
      seed: 2026,
      runs: 100,
      predicate: (n) => n * 0 === 0,
    });
    const r2 = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "zero_mult",
      seed: 2026,
      runs: 100,
      predicate: (n) => n * 0 === 0,
    });
    assert.equal(r1.passed, true);
    assert.equal(r1.shrinkStepsTaken, 0);
    assert.equal(r1.resultDigestSha256, r2.resultDigestSha256);
  });

  await t.test("BDD-1224: runs built-in property suite cleanly", () => {
    const suite = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(1337);
    assert.equal(suite.allPassed, true);
    assert.equal(suite.totalProperties, 3);
    assert.equal(suite.passedProperties, 3);
    assert.match(suite.suiteDigestSha256, /^[0-9a-f]{64}$/);
  });

  await t.test("BDD-1225: executes master 'ship --json' CLI and 'jarvis_ship_readiness' MCP flow", () => {
    const cliOut = execFileSync(
      process.execPath,
      [path.join(ROOT, "bin/eos.mjs"), "ship", "--ticket=SPOT-240", "--json"],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
    const parsedCli = JSON.parse(cliOut);
    assert.equal(parsedCli.mode, "ship");
    assert.ok(["SHIP_APPROVED", "SHIP_BLOCKED"].includes(parsedCli.shipReadinessVerdict));
    assert.equal(parsedCli.propertySuite.allPassed, true);
    assert.ok(parsedCli.repoMap.filesIncluded >= 1);

    const mcpDeps = { projectRoot: ROOT, mcpCalls: 0, auditEntries: [] };
    const mcpShip = dispatchPhase7FrontierActionExt2(
      "jarvis_ship_readiness",
      {
        ticketId: "MCP-240",
        numstatOverride: "10\t0\tsrc/core/a.ts\n15\t0\ttest/a.test.mjs\n",
        patchOverride: "+export const ok = true;\n",
      },
      mcpDeps,
    );
    assert.equal(mcpShip.action, "jarvis_ship_readiness");
    assert.equal(mcpShip.shipReadinessVerdict, "SHIP_APPROVED");
  });
});
