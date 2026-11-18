/**
 * @file eosMetamorphicDifferentialBlindSpot.test.mjs
 * @description BDD, 500-payload API/MCP fuzzing, and Judgment Day regression suite
 * for SPEC-341 / CHANGE-203 (BDD-1821..BDD-1826).
 *
 * Invariant: Pure Layer-0 testing, zero external runtime dependencies, hermetic (receipts in os.tmpdir()).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleMetamorphicDifferentialBlindSpotCommand } from "../bin/commands/cliMetamorphicDifferentialBlindSpot.mjs";
import { EosAgenticHarnessYieldCore, HarnessError } from "../src/core/eosAgenticHarnessYield.ts";
import { EosCausalStructuralModelCore, ScmError } from "../src/core/eosCausalStructuralModel.ts";
import { AutopilotError, EosClosedLoopRepoAutopilotCore } from "../src/core/eosClosedLoopRepoAutopilot.ts";
import {
  BlindSpotError,
  canonicalSerialize,
  createBlindSpotPrng,
  EosMetamorphicDifferentialBlindSpotCore,
  generateArbitraryJsonValue,
  shrinkJsonValue,
} from "../src/core/eosMetamorphicDifferentialBlindSpot.ts";
import { EosPropertyBasedShrinkingFuzzerCore } from "../src/core/eosPropertyBasedShrinkingFuzzerCore.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function createHttpMockRes() {
  let statusCode = 200;
  let body = null;
  const headers = {};
  return {
    setHeader(k, v) {
      headers[String(k).toLowerCase()] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    end(chunk) {
      if (typeof chunk === "string" && chunk.trim().startsWith("{")) {
        body = JSON.parse(chunk);
      }
      return this;
    },
    snapshot() {
      return { statusCode, body, headers };
    },
  };
}

test("SPEC-341 / CHANGE-203: Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter", async (t) => {
  await t.test("BDD-1821: Recursive Structural Arbitrary Generation & Counterexample Tree Shrinking", () => {
    const naiveSortRes = EosMetamorphicDifferentialBlindSpotCore.checkStructuralProperty({
      name: "numeric_order_invariant",
      seed: 2026341,
      runs: 200,
      generatorMode: "INT_ARRAY",
      predicate: (arr) => {
        const sorted = [...arr].sort();
        return sorted.every((v, idx) => idx === 0 || sorted[idx - 1] <= v);
      },
    });
    assert.strictEqual(naiveSortRes.passed, false);
    assert.ok(Array.isArray(naiveSortRes.minimalCounterexample));
    assert.strictEqual(naiveSortRes.minimalCounterexample.length, 2);
    assert.ok(naiveSortRes.shrinkStepsTaken >= 1);

    // Structural JSON tree generator + nested object shrinker removes irrelevant properties
    const rng = createBlindSpotPrng(77);
    const val = generateArbitraryJsonValue(rng, 0, 3);
    assert.notStrictEqual(val, undefined);

    const nestedRes = EosMetamorphicDifferentialBlindSpotCore.checkStructuralProperty({
      name: "no_boom_tag",
      seed: 99,
      runs: 10,
      generator: () => ({ extraA: 123, extraB: [1, 2, 3], nested: { tag: "BOOM", noise: "ignore" } }),
      predicate: (obj) => obj?.nested?.tag !== "BOOM",
    });
    assert.strictEqual(nestedRes.passed, false);
    assert.deepStrictEqual(nestedRes.minimalCounterexample, { nested: { tag: "BOOM" } });

    const shrunkScalar = shrinkJsonValue(-100, (n) => Number(n) > -50);
    assert.strictEqual(shrunkScalar.minimal, -50);
    assert.strictEqual(canonicalSerialize({ b: 2, a: -0 }), '{"a":-0,"b":2}');
  });

  await t.test("BDD-1822: Differential Testing Oracle (Divergence Shrinking & Parity Confirmation)", () => {
    const diffBug = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign({
      targetName: "naive_sort_vs_numeric",
      seed: 2026341,
      runs: 150,
      referenceFn: (arr) => [...arr].sort((a, b) => a - b),
      candidateFn: (arr) => [...arr].sort(),
    });
    assert.strictEqual(diffBug.equivalent, false);
    assert.ok(diffBug.divergenceCount >= 1);
    assert.ok(Array.isArray(diffBug.minimalDivergingInput));
    assert.strictEqual(diffBug.minimalDivergingInput.length, 2);

    const diffThrow = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign({
      targetName: "throwing_candidate",
      seed: 123,
      runs: 20,
      referenceFn: (arr) => arr.length,
      candidateFn: (arr) => {
        if (arr.length > 0) throw new Error("boom_on_non_empty");
        return 0;
      },
    });
    assert.strictEqual(diffThrow.equivalent, false);
    assert.strictEqual(diffThrow.candidateError, "boom_on_non_empty");
    assert.ok(Array.isArray(diffThrow.minimalDivergingInput));
    assert.strictEqual(diffThrow.minimalDivergingInput.length, 1);

    const diffOk = EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign({
      targetName: "equivalent_sorts",
      seed: 2026341,
      runs: 150,
      referenceFn: (arr) => [...arr].sort((a, b) => a - b),
      candidateFn: (arr) => [...arr].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    });
    assert.strictEqual(diffOk.equivalent, true);
    assert.strictEqual(diffOk.divergenceCount, 0);
  });

  await t.test("BDD-1823: Metamorphic Relation Verifier (Sort, Subset Filter, JSON Round-Trip & Custom)", () => {
    const sortOk = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "SORT_PERMUTATION_IDEMPOTENCE",
      seed: 101,
      runs: 120,
    });
    assert.strictEqual(sortOk.passed, true);

    const sortBad = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "SORT_PERMUTATION_IDEMPOTENCE",
      seed: 101,
      runs: 120,
      sortFn: (items) => [...items].sort(),
    });
    assert.strictEqual(sortBad.passed, false);
    assert.ok(sortBad.violationCount >= 1);

    const filterOk = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "FILTER_SUBSET_MONOTONICITY",
      seed: 102,
      runs: 120,
    });
    assert.strictEqual(filterOk.passed, true);

    const filterBad = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "FILTER_SUBSET_MONOTONICITY",
      seed: 102,
      runs: 120,
      filterFn: (items, t) => items.filter((n) => n < t), // Inverted monotonicity!
    });
    assert.strictEqual(filterBad.passed, false);

    const roundtripOk = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "JSON_ROUNDTRIP_INVERTIBILITY",
      seed: 103,
      runs: 120,
    });
    assert.strictEqual(roundtripOk.passed, true);

    const customOk = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "CUSTOM",
      seed: 104,
      runs: 40,
      customRelation: {
        transform: (x) => canonicalSerialize(x),
        evaluate: (x) => canonicalSerialize(x).length,
        holds: (a, b) => Number(a) >= 1 && Number(b) >= Number(a) + 2,
      },
    });
    assert.strictEqual(customOk.passed, true);

    const customBad = EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
      relation: "CUSTOM",
      seed: 104,
      runs: 10,
      customRelation: {
        transform: (x) => x,
        evaluate: (x) => canonicalSerialize(x),
        holds: () => false,
      },
    });
    assert.strictEqual(customBad.passed, false);
    assert.strictEqual(customBad.violationCount, 10);
  });

  await t.test("BDD-1824: 500-Payload Live Fuzz Campaign Against /api/mcp.js and EosMcpServer", async () => {
    const mcpMod = await import(pathToFileURL(path.join(ROOT, "api/mcp.js")).href);
    const httpHandler = mcpMod.default;
    const mcpServer = new EosMcpServer(ROOT, "full");
    const publicTools = [
      "eos_health_check",
      "eos_amplify_prompt",
      "eos_check_architecture",
      "eos_evaluate_decision",
      "eos_spotify_shuffle",
      "eos_optimize_context",
      "eos_slsa_provenance_sbom",
      "eos_semantic_search",
      "unexposed_admin_tool",
    ];

    const customCorpus = [
      null,
      [],
      "",
      "{not-json",
      { jsonrpc: "2.0", id: "", method: "tools/call", params: { name: "eos_health_check", arguments: {} } },
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "eos_amplify_prompt", arguments: { rawPrompt: "   " } },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "eos_slsa_provenance_sbom", arguments: { mode: "slsa", commitSha: "not-a-sha!" } },
      },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "eos_evaluate_decision", arguments: { title: "   ", description: "\t", proposedAction: "\n" } },
      },
    ];

    // 1. 500 arbitrary/fuzzed HTTP payloads against api/mcp.js
    const apiFuzz = await EosMetamorphicDifferentialBlindSpotCore.runBoundaryFuzzCampaign({
      targetName: "api/mcp.js",
      seed: 2026341,
      iterations: 500,
      customCorpus,
      handler: async (payload, i) => {
        const res = createHttpMockRes();
        const ip = `10.${(i >> 8) & 0xff}.${i & 0xff}.${(i % 200) + 1}`;
        const wrappedBody =
          i % 3 === 0
            ? payload
            : {
                jsonrpc: "2.0",
                id: `fuzz-${i}`,
                method: "tools/call",
                params: { name: publicTools[i % publicTools.length], arguments: payload },
              };
        await httpHandler(
          {
            method: i % 17 === 0 ? "OPTIONS" : "POST",
            socket: { remoteAddress: "127.0.0.1" },
            headers: {
              "content-type": i % 19 === 0 ? "text/plain" : "application/json",
              accept: "application/json",
              origin: i % 2 === 0 ? "https://evil-tenant.vercel.app" : "https://glorian-system.vercel.app",
              "x-forwarded-for": ip,
            },
            body: wrappedBody,
          },
          res,
        );
        const snap = res.snapshot();
        assert.notStrictEqual(snap.statusCode, 429);
        return { statusCode: snap.statusCode, body: snap.body };
      },
    });
    assert.strictEqual(apiFuzz.iterations, 500);
    assert.strictEqual(apiFuzz.unhandledExceptionCount, 0);
    assert.strictEqual(apiFuzz.http5xxCount, 0);
    assert.strictEqual(apiFuzz.stabilityScore, 1);

    // 2. 500 arbitrary/fuzzed JSON-RPC requests against EosMcpServer.handleRequest
    const rpcFuzz = await EosMetamorphicDifferentialBlindSpotCore.runBoundaryFuzzCampaign({
      targetName: "EosMcpServer.handleRequest",
      seed: 2026342,
      iterations: 500,
      customCorpus,
      handler: (payload, i) => {
        const req =
          i % 4 === 0
            ? payload
            : {
                jsonrpc: "2.0",
                id: `rpc-${i}`,
                method: "tools/call",
                params: { name: publicTools[i % publicTools.length], arguments: payload },
              };
        const out = mcpServer.handleRequest(req);
        if (out === null) return { statusCode: 202 };
        return { statusCode: out.error ? 400 : 200, body: out };
      },
    });
    assert.strictEqual(rpcFuzz.iterations, 500);
    assert.strictEqual(rpcFuzz.unhandledExceptionCount, 0);
    assert.strictEqual(rpcFuzz.http5xxCount, 0);
    assert.strictEqual(rpcFuzz.stabilityScore, 1);
  });

  await t.test("BDD-1825: Judgment Day Adversarial Regression Verification (All 31 Accepted Findings)", async () => {
    // --- ALPHA-01..06, ALPHA-18: EosClosedLoopRepoAutopilotCore ---
    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore(null),
      (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_INVALID_PARAMETERS",
    );
    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore({ projectRoot: "   " }),
      (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_INVALID_ROOT",
    );
    assert.throws(
      () => new EosClosedLoopRepoAutopilotCore({ simulationSeed: 123 }),
      (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_INVALID_PARAMETERS",
    );

    const badJsonRepo = fs.mkdtempSync(path.join(os.tmpdir(), "eos-jd-badjson-"));
    try {
      fs.mkdirSync(path.join(badJsonRepo, "docs/projects"), { recursive: true });
      fs.mkdirSync(path.join(badJsonRepo, "docs/quality"), { recursive: true });
      fs.mkdirSync(path.join(badJsonRepo, "docs/evidence"), { recursive: true });
      fs.writeFileSync(path.join(badJsonRepo, "docs/projects/registry.json"), "{corrupt-json", "utf8");
      fs.writeFileSync(
        path.join(badJsonRepo, "docs/quality/mutation-budget.json"),
        JSON.stringify({ floors: { "src/a/index.ts": 0.85, "src/b/index.ts": 0.9, "src/bad.ts": "nan" } }),
        "utf8",
      );
      fs.writeFileSync(
        path.join(badJsonRepo, "docs/evidence/TLC_RECEIPT.json"),
        JSON.stringify({
          models: [null, { passed: false }, { specName: "A", passed: "false" }, { specName: "B", passed: true }],
        }),
        "utf8",
      );
      const safeCore = new EosClosedLoopRepoAutopilotCore({ projectRoot: badJsonRepo });
      const ing = safeCore.ingestRepositoryOntology();
      assert.strictEqual(ing.fleetProjectsCount, 1);
      assert.strictEqual(ing.mutationTargetsCount, 2); // Collision-free index.ts entries, invalid "nan" skipped
      assert.strictEqual(ing.tlcModelsVerifiedCount, 1); // Only strict boolean true counted

      assert.throws(
        () => safeCore.diagnoseCausalRootCause({ ...ing, totalHypergraphEntities: Number.NaN }),
        (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_STAGE_VIOLATION",
      );
      const causal = safeCore.diagnoseCausalRootCause(ing);
      assert.throws(
        () => safeCore.simulateRemediationPreFlight({ ...causal, scmSelfAuditPassed: false }),
        (err) => err instanceof AutopilotError && err.code === "AUTOPILOT_STAGE_VIOLATION",
      );

      spawnSync("git", ["init"], { cwd: badJsonRepo, encoding: "utf8" });
      spawnSync("git", ["config", "user.email", "jd@eos.local"], { cwd: badJsonRepo, encoding: "utf8" });
      spawnSync("git", ["config", "user.name", "JD"], { cwd: badJsonRepo, encoding: "utf8" });
      fs.writeFileSync(path.join(badJsonRepo, "f.txt"), "1\n", "utf8");
      spawnSync("git", ["add", "f.txt"], { cwd: badJsonRepo, encoding: "utf8" });
      spawnSync("git", ["commit", "-m", "  fix(core): leading whitespace commit"], {
        cwd: badJsonRepo,
        encoding: "utf8",
      });
      const harnessReport = safeCore.evaluateLiveGitHarnessTelemetry();
      assert.strictEqual(harnessReport.sampleCommits[0].category, "BUGFIX_REWORK");
    } finally {
      fs.rmSync(badJsonRepo, { recursive: true, force: true });
    }

    // --- ALPHA-07..09: EosAgenticHarnessYieldCore ---
    const yieldCore = new EosAgenticHarnessYieldCore();
    assert.throws(
      () =>
        yieldCore.evaluateSpecReadiness({
          taskId: 12345,
          earsRequirements: 1,
          bddScenarios: 1,
          adrCount: 1,
          hasFormalTlaModel: true,
          ambiguityScore: 0.05,
        }),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );
    assert.throws(
      () =>
        yieldCore.evaluateCohortTelemetry([
          {
            prId: "NAN-1",
            methodology: "SDD_HARNESS",
            firstPassSuccess: true,
            retries: Number.NaN,
            firstPassTokens: Number.NaN,
            reworkTokens: 0,
            totalTokens: Number.NaN,
            costUsd: 0,
          },
        ]),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );
    assert.throws(
      () =>
        yieldCore.evaluateCohortTelemetry([
          {
            prId: "LIE-1",
            methodology: "SDD_HARNESS",
            firstPassSuccess: true,
            retries: 0,
            firstPassTokens: 1000,
            reworkTokens: 500,
            totalTokens: 1500,
            costUsd: 0.01,
          },
        ]),
      (err) => err instanceof HarnessError && err.code === "HARNESS_INVALID_PARAMETERS",
    );

    // --- ALPHA-11..17: EosCausalStructuralModelCore ---
    const scm = new EosCausalStructuralModelCore();
    assert.throws(
      () => scm.addVariable({ name: "X", parents: ["GHOST"], mechanism: () => 1 }),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () => scm.addVariable({ name: "   ", parents: null, mechanism: () => 0 }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    const benchScm = EosCausalStructuralModelCore.createBenchmarkConfoundedColliderScm();
    assert.throws(
      () => benchScm.computeInterventionalAte("X", "UNKNOWN_OUTCOME", 1, 0),
      (err) => err instanceof ScmError && err.code === "SCM_UNKNOWN_VARIABLE",
    );
    assert.throws(
      () =>
        benchScm.estimateBackdoorAdjustedAte({
          treatment: "X",
          outcome: "Y",
          adjustmentSet: ["Z"],
          samples: [],
          trueInterventionalAte: 2.0,
        }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    const factual = benchScm.evaluateForward({ Z: 1, X: 0.5, Y: 0.1, C: 0, D: 0 });
    assert.throws(
      () =>
        benchScm.inferCounterfactual({
          factualEvidence: { ...factual, Z: Number.NaN },
          interventions: { X: 1 },
          targetVariable: "Y",
        }),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => benchScm.mutilateGraph(null),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );
    assert.throws(
      () => benchScm.isDSeparated("X", "Y", null),
      (err) => err instanceof ScmError && err.code === "SCM_INVALID_PARAMETERS",
    );

    // --- BETA-01..07: EosPropertyBasedShrinkingFuzzerCore ---
    const runsNan = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "runs_nan_must_fail",
      runs: Number.NaN,
      predicate: () => false,
    });
    assert.strictEqual(runsNan.passed, false);

    const infRes = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "inf_bounds",
      min: 100,
      max: Number.POSITIVE_INFINITY,
      predicate: (n) => n < 150,
    });
    assert.strictEqual(infRes.passed, false);
    assert.ok(Number.isFinite(infRes.minimalCounterexample));

    const invertedRes = EosPropertyBasedShrinkingFuzzerCore.checkNumericProperty({
      name: "inverted_bounds",
      min: 100,
      max: 10,
      runs: 50,
      predicate: (n) => n === 100,
    });
    assert.strictEqual(invertedRes.passed, false);

    const strNan = EosPropertyBasedShrinkingFuzzerCore.checkStringProperty({
      name: "unicode_safe_shrink",
      alphabet: "🚀🔥",
      maxLength: 6,
      maxShrinkSteps: Number.NaN,
      runs: 20,
      predicate: (s) => !s.includes("🚀"),
    });
    assert.strictEqual(strNan.passed, false);
    assert.strictEqual(strNan.minimalCounterexample, "🚀");

    const suiteNan = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(Number.NaN);
    assert.strictEqual(suiteNan.seed, 1337);
    assert.strictEqual(suiteNan.allPassed, true);

    // --- BETA-08..14: Phase8 AGI Handlers & api/mcp.js ---
    const tmpAgiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-jd-agi-"));
    try {
      const phase8Tmp = createPhase8AgiHandlers({ projectRoot: tmpAgiRoot });
      const blankConsult = phase8Tmp.eos_consult({ problem: "   ", techStack: 123 });
      assert.strictEqual(blankConsult.error, "problem field is required");

      const agiNoCtx = await phase8Tmp.eos_agi_solve(
        {
          objective: "ok",
          branches: [{ id: "B1", strategy: "check", estimatedComplexity: 1, testCommandOverride: "node -v" }],
          testCommand: "node -v",
          timeoutMs: -500,
        },
        undefined,
      );
      assert.ok(agiNoCtx);
    } finally {
      fs.rmSync(tmpAgiRoot, { recursive: true, force: true });
    }

    const phase8 = createPhase8AgiHandlers({ projectRoot: ROOT });
    const driftNan = phase8.eos_spec_drift({ driftThresholdDays: "not-a-number" });
    assert.strictEqual(driftNan.driftScore, 0);

    const mcpMod = await import(pathToFileURL(path.join(ROOT, "api/mcp.js")).href);
    const corsEvil = createHttpMockRes();
    await mcpMod.default({ method: "OPTIONS", headers: { origin: "https://attacker-subdomain.vercel.app" } }, corsEvil);
    assert.strictEqual(corsEvil.snapshot().statusCode, 403);

    const emptyIdRes = createHttpMockRes();
    await mcpMod.default(
      {
        method: "POST",
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "content-type": "application/json", "x-forwarded-for": "10.99.99.1" },
        body: { jsonrpc: "2.0", id: "   ", method: "ping" },
      },
      emptyIdRes,
    );
    assert.strictEqual(emptyIdRes.snapshot().statusCode, 400);

    const badShaRes = createHttpMockRes();
    await mcpMod.default(
      {
        method: "POST",
        socket: { remoteAddress: "127.0.0.1" },
        headers: { "content-type": "application/json", "x-forwarded-for": "10.99.99.2" },
        body: {
          jsonrpc: "2.0",
          id: "sha-1",
          method: "tools/call",
          params: { name: "eos_slsa_provenance_sbom", arguments: { mode: "slsa", commitSha: "bad;rm" } },
        },
      },
      badShaRes,
    );
    assert.strictEqual(badShaRes.snapshot().body.error.code, -32602);
  });

  await t.test(
    "BDD-1826: Deterministic SPEC-341 Audit Receipt, CLI Parity, Native MCP & Fail-Closed Guards",
    async () => {
      const core = new EosMetamorphicDifferentialBlindSpotCore();
      const r1 = core.audit(2026341);
      const r2 = core.audit(2026341);

      assert.strictEqual(r1.specRef, "SPEC-341");
      assert.strictEqual(r1.structuralShrinkCaughtSortBug, true);
      assert.strictEqual(r1.minimalSortCounterexampleLength, 2);
      assert.strictEqual(r1.differentialCaughtDivergence, true);
      assert.strictEqual(r1.differentialParityConfirmed, true);
      assert.strictEqual(r1.metamorphicSortPassed, true);
      assert.strictEqual(r1.metamorphicFilterPassed, true);
      assert.strictEqual(r1.metamorphicRoundtripPassed, true);
      assert.strictEqual(r1.fuzzCampaignIterations, 500);
      assert.strictEqual(r1.fuzzUnhandledExceptions, 0);
      assert.strictEqual(r1.fuzzHttp5xxCount, 0);
      assert.strictEqual(r1.fuzzStabilityScore, 1);
      assert.strictEqual(r1.allPassed, true);
      assert.strictEqual(r1.sha256Digest.length, 64);
      assert.strictEqual(r1.sha256Digest, r2.sha256Digest);

      assert.throws(
        () => EosMetamorphicDifferentialBlindSpotCore.checkStructuralProperty({ name: "  ", predicate: () => true }),
        (err) => err instanceof BlindSpotError && err.code === "BLINDSPOT_INVALID_PARAMETERS",
      );
      assert.throws(
        () =>
          EosMetamorphicDifferentialBlindSpotCore.runDifferentialCampaign({
            targetName: "bad_runs",
            runs: 0,
            referenceFn: (x) => x,
            candidateFn: (x) => x,
          }),
        (err) => err instanceof BlindSpotError && err.code === "BLINDSPOT_INVALID_PARAMETERS",
      );
      assert.throws(
        () =>
          EosMetamorphicDifferentialBlindSpotCore.verifyMetamorphicRelation({
            relation: "CUSTOM",
          }),
        (err) => err instanceof BlindSpotError && err.code === "BLINDSPOT_INVALID_PARAMETERS",
      );
      await assert.rejects(
        () =>
          EosMetamorphicDifferentialBlindSpotCore.runBoundaryFuzzCampaign({
            targetName: " ",
            handler: () => ({ statusCode: 200 }),
          }),
        (err) => err instanceof BlindSpotError && err.code === "BLINDSPOT_INVALID_PARAMETERS",
      );

      const server = new EosMcpServer(ROOT, "full");
      const mcpRes = server.handleRequest({
        jsonrpc: "2.0",
        id: "blindspot-mcp-1",
        method: "tools/call",
        params: { name: "eos_blindspot_hunter_audit", arguments: {} },
      });
      const parsedMcp = JSON.parse(mcpRes.result.content[0].text);
      assert.strictEqual(parsedMcp.specRef, "SPEC-341");
      assert.strictEqual(parsedMcp.allPassed, true);

      assert.strictEqual(
        await handleMetamorphicDifferentialBlindSpotCommand({
          command: "toolchain:blindspot:shrink",
          args: ["--json"],
        }),
        true,
      );
      assert.strictEqual(
        await handleMetamorphicDifferentialBlindSpotCommand({
          command: "toolchain:blindspot:differential",
          args: ["--json"],
        }),
        true,
      );
      assert.strictEqual(
        await handleMetamorphicDifferentialBlindSpotCommand({
          command: "toolchain:blindspot:metamorphic",
          args: ["--json"],
        }),
        true,
      );
      assert.strictEqual(
        await handleMetamorphicDifferentialBlindSpotCommand({
          command: "toolchain:blindspot:fuzz",
          args: ["--json", "--iterations=10"],
        }),
        true,
      );

      const cliRes = spawnSync(process.execPath, ["bin/eos.mjs", "toolchain:blindspot:shrink", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
      });
      assert.strictEqual(cliRes.status, 0);
      const cliPayload = JSON.parse(cliRes.stdout);
      assert.strictEqual(cliPayload.command, "toolchain:blindspot:shrink");
      assert.strictEqual(cliPayload.passed, false);

      // Hermetic receipt write verification in os.tmpdir()
      const tmpReceipt = path.join(os.tmpdir(), `eos-test-BLINDSPOT-${process.pid}.json`);
      fs.writeFileSync(tmpReceipt, JSON.stringify(r1, null, 2), "utf8");
      assert.ok(fs.existsSync(tmpReceipt));
      fs.rmSync(tmpReceipt, { force: true });
    },
  );
});
