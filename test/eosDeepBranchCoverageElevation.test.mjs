/**
 * EOS SYSTEM — DEEP BRANCH COVERAGE ELEVATION SUITE (SPEC-160 / BDD-290)
 *
 * Exercises unexercised branch conditions across Layer-0 Core modules and Serverless API routes:
 * 1. api/fleet.js (OPTIONS, 405, probe=true, probe=false)
 * 2. api/graph.js (OPTIONS, 405, invalid action, invalid file, traversal, 404, summary mode)
 * 3. api/cicd.js (OPTIONS, 405, invalid mode, invalid payload, payload too large, SAST blocked, SAST clean)
 * 4. api/memory.js (mem_save validation, mem_judge, mem_compare, mem_context/list/stats, search query, unsupported)
 * 5. api/spotify.js (OPTIONS, 405, invalid action, camelot validation, mix parameters, features, mesh, dsp)
 * 6. api/jarvis.js (OPTIONS, 405, directive length, 5 intent classifications)
 * 7. api/teurgia.js (405, invalid json, invalid body, payload too large, 7 sephirotic spheres, invalid sphere, dharma bounds)
 * 8. src/core/eosKernelPrimitives.ts (asserts throw ContractError, deepFreeze views/functions/null, pureSha256 1/2/3/4-byte UTF-8)
 * 9. src/core/eosDiffPatcher.ts (parseDiff edge cases, malformed headers, applyPatch error conditions)
 * 10. src/core/eosAdaptiveConcurrencyLimiter.ts (concurrency acquire overload, AIMD expand/contract on release)
 *
 * Big Tech Standard (Google / Netflix SRE):
 * Elevates branch coverage strictly >= 75.0% across the repository.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertPrecondition,
  assertPostcondition,
  assertInvariant,
  ContractError,
  deepFreeze,
  pureSha256,
} from "../src/core/eosKernelPrimitives.ts";
import { parseDiff, applyDiff, generateDiff } from "../src/core/eosDiffPatcher.ts";
import { EosAdaptiveConcurrencyLimiter } from "../src/core/eosAdaptiveConcurrencyLimiter.ts";
import { EosTypeScriptAstAnalyzer } from "../src/core/eosTypeScriptAstAnalyzer.ts";
import { EosEnterpriseWorkspaceGovernor } from "../src/core/eosEnterpriseWorkspaceGovernor.ts";
import { EosUniversalProjectAdapter } from "../src/core/eosUniversalProjectAdapter.ts";
import { EosContainerSandbox } from "../src/core/eosContainerSandbox.ts";
import { EosProtobufContractEngine } from "../src/core/eosProtobufContractEngine.ts";
import {
  parseSemVer,
  compareSemVer,
  selectLatestStableTag,
  parseChecksumsManifest,
} from "../src/core/eosGentlemanAutoUpdater.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function createMockResponse() {
  let statusCode = 200;
  let body = null;
  const headers = {};
  return {
    statusCode: 200,
    headers,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
    end(data) {
      if (typeof data === "string" && data.trim().startsWith("{")) {
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
      }
      return this;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
    getHeaders: () => headers,
  };
}

describe("BDD-290: Deep Branch Coverage Elevation Suite", () => {
  describe("1. api/fleet.js branch coverage", () => {
    it("handles OPTIONS, 405, and probe parameter variations", async () => {
      const fleetMod = await import(pathToFileURL(path.join(root, "api/fleet.js")).href);

      // OPTIONS
      const resOptions = createMockResponse();
      await fleetMod.default({ method: "OPTIONS" }, resOptions);
      assert.equal(resOptions.getStatusCode(), 200);

      // 405 Method Not Allowed
      const resPost = createMockResponse();
      await fleetMod.default({ method: "POST", query: {} }, resPost);
      assert.equal(resPost.getStatusCode(), 405);
      assert.equal(resPost.getBody()?.status, "METHOD_NOT_ALLOWED");

      // probe=false (default)
      const resDefault = createMockResponse();
      await fleetMod.default({ method: "GET", query: { probe: "false" } }, resDefault);
      assert.equal(resDefault.getStatusCode(), 200);
      assert.ok(Array.isArray(resDefault.getBody()?.projects));
      assert.equal(resDefault.getBody()?.projects[0]?.productionProbe, "NOT_PROBED");

      // probe=1 (hermetic mock)
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => ({ status: 200 });
        const resProbe = createMockResponse();
        await fleetMod.default({ method: "GET", query: { probe: "1" } }, resProbe);
        assert.equal(resProbe.getStatusCode(), 200);
        assert.ok(Array.isArray(resProbe.getBody()?.projects));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("2. api/graph.js branch coverage", () => {
    it("handles OPTIONS, 405, invalid actions, traversal, and summary mode", async () => {
      const graphMod = await import(pathToFileURL(path.join(root, "api/graph.js")).href);

      // OPTIONS
      const resOptions = createMockResponse();
      await graphMod.default({ method: "OPTIONS" }, resOptions);
      assert.equal(resOptions.getStatusCode(), 200);

      // 405 Method Not Allowed
      const resPost = createMockResponse();
      await graphMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // INVALID_ACTION
      const resBadAction = createMockResponse();
      await graphMod.default({ method: "GET", query: { action: "unsupported" } }, resBadAction);
      assert.equal(resBadAction.getStatusCode(), 400);
      assert.equal(resBadAction.getBody()?.status, "INVALID_ACTION");

      // INVALID_FILE (oversized > 256)
      const resBadFile = createMockResponse();
      await graphMod.default({ method: "GET", query: { action: "blast", file: "a".repeat(300) } }, resBadFile);
      assert.equal(resBadFile.getStatusCode(), 400);
      assert.equal(resBadFile.getBody()?.status, "INVALID_FILE");

      // Path traversal rejection
      const resTraversal = createMockResponse();
      await graphMod.default({ method: "GET", query: { action: "blast", file: "../secrets.txt" } }, resTraversal);
      assert.equal(resTraversal.getStatusCode(), 400);
      assert.equal(resTraversal.getBody()?.status, "INVALID_FILE");

      // Non-existent source file not in graph -> 404
      const resMissing = createMockResponse();
      await graphMod.default(
        { method: "GET", query: { action: "blast", file: "src/core/nonexistent.ts" } },
        resMissing,
      );
      assert.equal(resMissing.getStatusCode(), 404);
      assert.equal(resMissing.getBody()?.status, "SOURCE_FILE_NOT_IN_GRAPH");

      // Valid blast calculation
      const resBlast = createMockResponse();
      await graphMod.default(
        { method: "GET", query: { action: "blast", file: "src/core/eosPromptAmplifier.ts" } },
        resBlast,
      );
      assert.equal(resBlast.getStatusCode(), 200);
      assert.equal(resBlast.getBody()?.action, "blast");

      // Summary action
      const resSummary = createMockResponse();
      await graphMod.default({ method: "GET", query: { action: "summary" } }, resSummary);
      assert.equal(resSummary.getStatusCode(), 200);
      assert.equal(resSummary.getBody()?.action, "summary");
    });
  });

  describe("3. api/cicd.js branch coverage", () => {
    it("handles OPTIONS, 405, input validation bounds, and SAST detection", async () => {
      const cicdMod = await import(pathToFileURL(path.join(root, "api/cicd.js")).href);

      // OPTIONS
      const resOptions = createMockResponse();
      cicdMod.default({ method: "OPTIONS" }, resOptions);
      assert.equal(resOptions.getStatusCode(), 200);

      // 405
      const resPost = createMockResponse();
      cicdMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // INVALID_MODE
      const resBadMode = createMockResponse();
      cicdMod.default({ method: "GET", query: { mode: "a".repeat(100) } }, resBadMode);
      assert.equal(resBadMode.getStatusCode(), 400);
      assert.equal(resBadMode.getBody()?.status, "INVALID_MODE");

      // PAYLOAD_TOO_LARGE (> 8192)
      const resLarge = createMockResponse();
      cicdMod.default({ method: "GET", query: { payload: "x".repeat(9000) } }, resLarge);
      assert.equal(resLarge.getStatusCode(), 413);
      assert.equal(resLarge.getBody()?.status, "PAYLOAD_TOO_LARGE");

      // SAST BLOCKED by sk-live API key
      const resSast1 = createMockResponse();
      const mockSk = ["sk", "live", "secretKey12345"].join("-");
      cicdMod.default({ method: "GET", query: { payload: `const key = '${mockSk}';` } }, resSast1);
      assert.equal(resSast1.getStatusCode(), 200);
      assert.equal(resSast1.getBody()?.status, "SIMULATION_BLOCKED_BY_STAGE_1_SAST");
      assert.equal(resSast1.getBody()?.blockedBySast, true);

      // SAST BLOCKED by AWS AKIA key
      const resSast2 = createMockResponse();
      const mockAkia = ["AK", "IA", "IOSFODNN7EXAMPLE"].join("");
      cicdMod.default({ method: "GET", query: { payload: mockAkia } }, resSast2);
      assert.equal(resSast2.getStatusCode(), 200);
      assert.equal(resSast2.getBody()?.blockedBySast, true);

      // SAST CLEAN
      const resClean = createMockResponse();
      cicdMod.default({ method: "GET", query: { payload: "console.log('clean code');" } }, resClean);
      assert.equal(resClean.getStatusCode(), 200);
      assert.equal(resClean.getBody()?.status, "SIMULATION_ONLY");
      assert.equal(resClean.getBody()?.blockedBySast, false);
    });
  });

  describe("4. api/memory.js branch coverage", () => {
    it("handles mem_save, mem_judge, mem_compare, search filters, and validation", async () => {
      const memMod = await import(pathToFileURL(path.join(root, "api/memory.js")).href);

      // Capability snapshot via mem_doctor
      const resCap = createMockResponse();
      await memMod.default({ method: "GET", query: { action: "mem_doctor" } }, resCap);
      assert.equal(resCap.getStatusCode(), 200);
      assert.equal(resCap.getBody()?.status, "CAPABILITY_SNAPSHOT");

      // mem_save valid
      const resSave = createMockResponse();
      await memMod.default(
        {
          method: "POST",
          body: {
            action: "mem_save",
            title: "Strict Branch Elevation",
            type: "testing",
            what: "Increased branch coverage to >=75%",
            why: "Big Tech quality doctrine",
          },
        },
        resSave,
      );
      assert.equal(resSave.getStatusCode(), 200);
      assert.equal(resSave.getBody()?.status, "PREVIEW_ONLY");
      assert.equal(resSave.getBody()?.observation?.title, "Strict Branch Elevation");

      // mem_save invalid field length (> 4096)
      const resSaveBad = createMockResponse();
      await memMod.default(
        {
          method: "POST",
          body: {
            action: "mem_save",
            title: "x".repeat(5000),
          },
        },
        resSaveBad,
      );
      assert.equal(resSaveBad.getStatusCode(), 400);
      assert.equal(resSaveBad.getBody()?.status, "INVALID_OBSERVATION");

      // mem_judge valid
      const resJudge = createMockResponse();
      await memMod.default(
        {
          method: "POST",
          body: { action: "mem_judge", relation: "supersedes", reasoning: "Elevates coverage from 70% to 75%" },
        },
        resJudge,
      );
      assert.equal(resJudge.getStatusCode(), 200);
      assert.equal(resJudge.getBody()?.status, "SIMULATION_ONLY");

      // mem_judge invalid reasoning
      const resJudgeBad = createMockResponse();
      await memMod.default(
        {
          method: "POST",
          body: { action: "mem_judge", reasoning: "x".repeat(5000) },
        },
        resJudgeBad,
      );
      assert.equal(resJudgeBad.getStatusCode(), 400);
      assert.equal(resJudgeBad.getBody()?.status, "INVALID_REASONING");

      // mem_search with query filter
      const resSearch = createMockResponse();
      await memMod.default({ method: "GET", query: { action: "mem_search", q: "arquitectura" } }, resSearch);
      assert.equal(resSearch.getStatusCode(), 200);
      assert.equal(resSearch.getBody()?.status, "DEMO_FIXTURE");

      // UNSUPPORTED_ACTION
      const resUnsupported = createMockResponse();
      await memMod.default({ method: "GET", query: { action: "nonexistent_action" } }, resUnsupported);
      assert.equal(resUnsupported.getStatusCode(), 400);
      assert.equal(resUnsupported.getBody()?.status, "UNSUPPORTED_ACTION");
    });
  });

  describe("5. api/spotify.js branch coverage", () => {
    it("handles OPTIONS, 405, actions, camelot validation, and mix parameters", async () => {
      const spotifyMod = await import(pathToFileURL(path.join(root, "api/spotify.js")).href);

      // OPTIONS
      const resOptions = createMockResponse();
      await spotifyMod.default({ method: "OPTIONS" }, resOptions);
      assert.equal(resOptions.getStatusCode(), 200);

      // 405
      const resPost = createMockResponse();
      await spotifyMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // INVALID_ACTION
      const resBadAction = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "invalid_action" } }, resBadAction);
      assert.equal(resBadAction.getStatusCode(), 400);
      assert.equal(resBadAction.getBody()?.status, "INVALID_ACTION");

      // INVALID_CAMELOT_KEY
      const resBadKey = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "camelot", key: "99Z" } }, resBadKey);
      assert.equal(resBadKey.getStatusCode(), 400);
      assert.equal(resBadKey.getBody()?.status, "INVALID_CAMELOT_KEY");

      // Valid camelot key
      const resGoodKey = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "camelot", key: "8A" } }, resGoodKey);
      assert.equal(resGoodKey.getStatusCode(), 200);

      // INVALID_MIX_PARAMETERS
      const resBadMix = createMockResponse();
      await spotifyMod.default(
        { method: "GET", query: { action: "mix", bpmA: "1000", bpmB: "128", duration: "5" } },
        resBadMix,
      );
      assert.equal(resBadMix.getStatusCode(), 400);
      assert.equal(resBadMix.getBody()?.status, "INVALID_MIX_PARAMETERS");

      // Valid mix
      const resMix = createMockResponse();
      await spotifyMod.default(
        { method: "GET", query: { action: "mix", keyA: "8A", keyB: "9A", bpmA: "124", bpmB: "126", duration: "5" } },
        resMix,
      );
      assert.equal(resMix.getStatusCode(), 200);

      // action=dsp
      const resDsp = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "dsp" } }, resDsp);
      assert.equal(resDsp.getStatusCode(), 200);

      // action=mesh
      const resMesh = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "mesh" } }, resMesh);
      assert.equal(resMesh.getStatusCode(), 200);

      // action=features
      const resFeatures = createMockResponse();
      await spotifyMod.default({ method: "GET", query: { action: "features", userId: "test-user-42" } }, resFeatures);
      assert.equal(resFeatures.getStatusCode(), 200);
    });
  });

  describe("6. api/jarvis.js branch coverage", () => {
    it("handles OPTIONS, 405, validation, and all 5 intent classifications", async () => {
      const jarvisMod = await import(pathToFileURL(path.join(root, "api/jarvis.js")).href);

      // OPTIONS
      const resOptions = createMockResponse();
      jarvisMod.default({ method: "OPTIONS" }, resOptions);
      assert.equal(resOptions.getStatusCode(), 200);

      // 405
      const resGet = createMockResponse();
      jarvisMod.default({ method: "GET" }, resGet);
      assert.equal(resGet.getStatusCode(), 405);

      // INVALID_DIRECTIVE (> 4096)
      const resBadDir = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "a".repeat(5000) } }, resBadDir);
      assert.equal(resBadDir.getStatusCode(), 400);
      assert.equal(resBadDir.getBody()?.status, "INVALID_DIRECTIVE");

      // 1. DEPLOYMENT_REQUEST_NOT_EXECUTED
      const resDeploy = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "despliega a produccion" } }, resDeploy);
      assert.equal(resDeploy.getStatusCode(), 200);
      assert.equal(resDeploy.getBody()?.intent, "DEPLOYMENT_REQUEST_NOT_EXECUTED");

      // 2. STATUS_REQUEST_NOT_PROBED
      const resStatus = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "estado de salud del sistema" } }, resStatus);
      assert.equal(resStatus.getStatusCode(), 200);
      assert.equal(resStatus.getBody()?.intent, "STATUS_REQUEST_NOT_PROBED");

      // 3. AUDIT_REQUEST_NOT_EXECUTED
      const resAudit = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "audita la flota de repositorios" } }, resAudit);
      assert.equal(resAudit.getStatusCode(), 200);
      assert.equal(resAudit.getBody()?.intent, "AUDIT_REQUEST_NOT_EXECUTED");

      // 4. SECURITY_REQUEST_NOT_EXECUTED
      const resSec = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "ejecuta sast y escaneo de secretos" } }, resSec);
      assert.equal(resSec.getStatusCode(), 200);
      assert.equal(resSec.getBody()?.intent, "SECURITY_REQUEST_NOT_EXECUTED");

      // 5. UNCLASSIFIED_DIRECTIVE
      const resUnclass = createMockResponse();
      jarvisMod.default({ method: "POST", body: { directive: "consulta general sin palabras clave" } }, resUnclass);
      assert.equal(resUnclass.getStatusCode(), 200);
      assert.equal(resUnclass.getBody()?.intent, "UNCLASSIFIED_DIRECTIVE");
    });
  });

  describe("7. api/teurgia.js branch coverage", () => {
    it("handles 405, invalid json, oversized payloads, invalid spheres, and all 7 sephirot", async () => {
      const teurgiaMod = await import(pathToFileURL(path.join(root, "api/teurgia.js")).href);

      // 405
      const resDelete = createMockResponse();
      teurgiaMod.default({ method: "DELETE" }, resDelete);
      assert.equal(resDelete.statusCode, 405);

      // INVALID_JSON
      const resBadJson = createMockResponse();
      teurgiaMod.default({ method: "POST", body: "not-json" }, resBadJson);
      assert.equal(resBadJson.statusCode, 400);

      // REQUEST_TOO_LARGE (> 8192)
      const resLarge = createMockResponse();
      teurgiaMod.default({ method: "POST", body: { data: "x".repeat(9000) } }, resLarge);
      assert.equal(resLarge.statusCode, 413);

      // INVALID_CONSULTATION (> 2000 bytes)
      const resBadConsult = createMockResponse();
      teurgiaMod.default({ method: "POST", body: { consulta: "x".repeat(2500) } }, resBadConsult);
      assert.equal(resBadConsult.statusCode, 400);

      // INVALID_SPHERE
      const resBadSphere = createMockResponse();
      teurgiaMod.default({ method: "POST", body: { esfera: "nonexistent_sphere" } }, resBadSphere);
      assert.equal(resBadSphere.statusCode, 400);

      // All 7 Sephirotic spheres
      const spheres = ["morir", "nacer", "tribunal", "proteccion", "lifaros", "daath", "absoluto"];
      for (const esfera of spheres) {
        const resSphere = createMockResponse();
        teurgiaMod.default({ method: "POST", body: { esfera, dharma: 80, enJuicio: 0 } }, resSphere);
        assert.equal(resSphere.statusCode, 200);
      }
    });
  });

  describe("8. src/core/eosKernelPrimitives.ts branch coverage", () => {
    it("exercises assertions, ContractError, deepFreeze variations, and multi-byte UTF-8 in pureSha256", () => {
      // Contract assertions
      assert.throws(
        () => assertPrecondition(false, "pre fail"),
        (err) => err instanceof ContractError && err.contractType === "PRECONDITION",
      );
      assert.throws(
        () => assertPostcondition(false, "post fail"),
        (err) => err instanceof ContractError && err.contractType === "POSTCONDITION",
      );
      assert.throws(
        () => assertInvariant(false, "inv fail"),
        (err) => err instanceof ContractError && err.contractType === "INVARIANT",
      );

      assertPrecondition(true, "ok");
      assertPostcondition(true, "ok");
      assertInvariant(true, "ok");

      // deepFreeze branches
      assert.equal(deepFreeze(null), null);
      assert.equal(deepFreeze(42), 42);
      assert.equal(deepFreeze("str"), "str");

      const u8 = new Uint8Array([1, 2, 3]);
      const frozenU8 = deepFreeze(u8);
      assert.equal(frozenU8, u8);

      const nested = {
        level1: {
          level2: {
            fn: () => "test",
            arr: [1, { a: "b" }],
          },
        },
      };
      deepFreeze(nested);
      assert.ok(Object.isFrozen(nested));
      assert.ok(Object.isFrozen(nested.level1));
      assert.ok(Object.isFrozen(nested.level1.level2));

      // pureSha256 byte encoding branches:
      // 1-byte ASCII (< 0x80)
      const h1 = pureSha256("hello");
      assert.equal(typeof h1, "string");
      assert.equal(h1.length, 64);

      // 2-byte UTF-8 (< 0x800)
      const h2 = pureSha256("café");
      assert.equal(h2.length, 64);

      // 3-byte UTF-8 (< 0xd800)
      const h3 = pureSha256("世界和平");
      assert.equal(h3.length, 64);

      // 4-byte UTF-8 surrogate pair astral plane (>= 0x10000)
      const h4 = pureSha256("🚀🛡️✨🔥");
      assert.equal(h4.length, 64);
    });
  });

  describe("9. src/core/eosDiffPatcher.ts branch coverage", () => {
    it("exercises parseDiff with malformed headers, context lines, applyDiff errors, and generateDiff", () => {
      // parseDiff with malformed header
      const malformedDiff = `--- a/test.txt\n+++ b/test.txt\n@@ invalid header @@\n+line1\n`;
      const parsedBad = parseDiff(malformedDiff);
      assert.equal(parsedBad.hunks.length, 0);

      // parseDiff with valid hunks containing add, remove, context, and EOF newline marker
      const validDiff = `--- a/test.txt\n+++ b/test.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2_mod\n line3\n\\ No newline at end of file\n`;
      const parsedGood = parseDiff(validDiff);
      assert.equal(parsedGood.hunks.length, 1);
      assert.ok(parsedGood.hunks[0].lines.length >= 4);

      // applyDiff on missing file
      const missingDiff = parseDiff(`--- a/missing.txt\n+++ b/missing.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n`);
      const resMissing = applyDiff(missingDiff, root);
      assert.equal(resMissing.success, false);
      assert.ok(resMissing.error?.includes("does not exist"));

      // applyDiff path traversal outside project root
      const traversalDiff = parseDiff(`--- a/../outside.txt\n+++ b/../outside.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n`);
      const resTraversal = applyDiff(traversalDiff, root);
      assert.equal(resTraversal.success, false);
      assert.ok(resTraversal.error?.includes("escapes project root"));

      // generateDiff
      const diffOutput = generateDiff("line1\nline2\n", "line1\nline2_modified\n", "sample.txt");
      assert.ok(diffOutput.includes("--- a/sample.txt"));
      assert.ok(diffOutput.includes("+++ b/sample.txt"));
      assert.ok(diffOutput.includes("-line2"));
      assert.ok(diffOutput.includes("+line2_modified"));
    });
  });

  describe("10. src/core/eosAdaptiveConcurrencyLimiter.ts branch coverage", () => {
    it("exercises acquire overload, rejection, and AIMD expansion/contraction on release", () => {
      const limiter = new EosAdaptiveConcurrencyLimiter({
        initialLimit: 1,
        minLimit: 1,
        maxLimit: 5,
        alpha: 2,
        beta: 4,
      });

      // Acquire initial slot
      const r1 = limiter.acquire();
      assert.equal(r1.granted, true);
      assert.ok(r1.token);

      // Acquire when full -> overload
      const r2 = limiter.acquire();
      assert.equal(r2.granted, false);
      assert.equal(r2.reason, "SHED_LOAD_CONCURRENCY_EXCEEDED");

      // Release with low RTT (AIMD additive increase)
      limiter.release(20);
      assert.equal(limiter.getMetrics().inFlight, 0);

      // Acquire again
      limiter.acquire();
      // Release with high RTT (AIMD multiplicative decrease)
      limiter.release(300);
      assert.equal(limiter.getMetrics().inFlight, 0);
    });
  });

  describe("11. src/core/eosTypeScriptAstAnalyzer.ts branch coverage", () => {
    it("exercises strip-only AST verifications, violations, and directory analysis", () => {
      // 1. Clean code
      const cleanCode = `
        import fs from "node:fs";
        export function computeTotal(a: number, b: number): number {
          return a + b;
        }
      `;
      const cleanMetrics = EosTypeScriptAstAnalyzer.analyzeSource(cleanCode, "src/core/sampleClean.ts", true);
      assert.equal(cleanMetrics.violations.length, 0);
      assert.equal(cleanMetrics.exportedSymbols.includes("computeTotal"), true);

      // 2. Layer 0 external import violation
      const badImportCode = `
        import lodash from "lodash";
        export const x = 1;
      `;
      const badImportMetrics = EosTypeScriptAstAnalyzer.analyzeSource(
        badImportCode,
        "src/core/sampleBadImport.ts",
        true,
      );
      assert.ok(badImportMetrics.violations.some((v) => v.code === "EXTERNAL_IMPORT_IN_LAYER0"));

      // 3. Prohibited TypeScript enum
      const enumCode = `
        export enum Color { Red, Green, Blue }
      `;
      const enumMetrics = EosTypeScriptAstAnalyzer.analyzeSource(enumCode, "src/core/sampleEnum.ts", false);
      assert.ok(enumMetrics.violations.some((v) => v.code === "TS_ENUM_PROHIBITED"));

      // 4. Prohibited TypeScript namespace
      const nsCode = `
        export namespace Geometry { export const PI = 3.14; }
      `;
      const nsMetrics = EosTypeScriptAstAnalyzer.analyzeSource(nsCode, "src/core/sampleNamespace.ts", false);
      assert.ok(nsMetrics.violations.some((v) => v.code === "TS_NAMESPACE_PROHIBITED"));

      // 5. Prohibited constructor parameter property
      const paramPropCode = `
        export class User {
          constructor(public name: string) {}
        }
      `;
      const paramPropMetrics = EosTypeScriptAstAnalyzer.analyzeSource(
        paramPropCode,
        "src/core/sampleParamProp.ts",
        false,
      );
      assert.ok(paramPropMetrics.violations.some((v) => v.code === "TS_PARAMETER_PROPERTY_PROHIBITED"));

      // 6. Cyclomatic complexity branches
      const complexCode = `
        export function decide(a: boolean, b: boolean, c: number): string {
          if (a && b) {
            while (c > 0) {
              c--;
              if (c === 5) break;
            }
          } else {
            switch (c) {
              case 1: return "one";
              case 2: return "two";
              default: return "other";
            }
          }
          try {
            return c ? "yes" : "no";
          } catch (e) {
            return "err";
          }
        }
      `;
      const complexMetrics = EosTypeScriptAstAnalyzer.analyzeSource(complexCode, "src/core/complex.ts", false);
      assert.ok(complexMetrics.cyclomaticComplexity >= 7);

      // 7. Directory analysis
      const dirReport = EosTypeScriptAstAnalyzer.analyzeDirectory(path.join(root, "src/core"), root);
      assert.ok(dirReport.filesAnalyzed >= 10);
      assert.equal(dirReport.layer0Pure, true);
    });
  });

  describe("12. src/core/eosEnterpriseWorkspaceGovernor.ts branch coverage", () => {
    it("exercises list, resolveAuthorizedWorkspace error branches, and workspace verification", () => {
      // List
      const workspaces = EosEnterpriseWorkspaceGovernor.listRegisteredWorkspaces(root);
      assert.ok(Array.isArray(workspaces));
      assert.ok(workspaces.length > 0);

      // Resolve valid READ_ONLY
      const resolved = EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace("eos-system", ".", "READ_ONLY", root);
      assert.equal(resolved.projectId, "eos-system");
      assert.ok(resolved.workspaceRoot);
      assert.ok(resolved.resolvedTargetPath);

      // Resolve non-existent workspace
      assert.throws(
        () =>
          EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace("nonexistent-workspace-id", ".", "READ_ONLY", root),
        (err) => String(err).includes("not registered"),
      );

      // Resolve with missing path
      assert.throws(
        () =>
          EosEnterpriseWorkspaceGovernor.resolveAuthorizedWorkspace("eos-system", "../traversal", "READ_ONLY", root),
        (err) => err instanceof ContractError || String(err).includes("traversal"),
      );

      // Verify workspace
      const report = EosEnterpriseWorkspaceGovernor.verifyWorkspace(root);
      assert.ok(report.gates.length >= 4);
      assert.ok(report.sha256VerificationReceipt.length === 64);
    });
  });

  describe("13. src/core/eosUniversalProjectAdapter.ts branch coverage", () => {
    it("exercises profile detection, audit, and dry-run elevation", () => {
      const adapter = new EosUniversalProjectAdapter(root);

      // Audit and fingerprint
      const audit = adapter.audit();
      assert.ok(["javascript", "typescript"].includes(audit.fingerprint.primaryLanguage));
      assert.equal(audit.fingerprint.packageManager, "npm");
      assert.equal(audit.fingerprint.testFramework, "node_test");
      assert.ok(audit.fingerprint.totalSourceFiles > 0);
      assert.ok(audit.localSignalScore > 0);
      assert.ok(audit.pillars.layerPurity);
      assert.ok(audit.pillars.testInfrastructure);
      assert.ok(audit.pillars.secretSecurity);
      assert.ok(audit.pillars.ciCdGateways);
      assert.ok(audit.pillars.aiScaffolding);
      assert.equal(audit.productionReadiness, "NOT_ASSESSED");

      // Elevate dry run
      const elevate = adapter.elevate(root, { dryRun: true });
      assert.equal(elevate.dryRun, true);
      assert.equal(elevate.writeApplied, false);
      assert.ok(elevate.sha256Proof.length === 64);
    });
  });

  describe("14. src/core/eosContainerSandbox.ts branch coverage", () => {
    it("exercises doctor and input validation guard branches", async () => {
      const sandbox = new EosContainerSandbox(root);

      // doctor()
      const doc = sandbox.doctor();
      assert.equal(typeof doc.ready, "boolean");
      assert.equal(typeof doc.message, "string");

      // Validation errors on run():
      // Non-string worktreePath
      await assert.rejects(() => sandbox.run({ worktreePath: 123, command: "ls" }), /must be a string/);

      // Non-string command
      await assert.rejects(() => sandbox.run({ worktreePath: ".", command: 456 }), /must be a string/);

      // Empty command
      await assert.rejects(() => sandbox.run({ worktreePath: ".", command: "   " }), /Provide an executable name/);

      // Command starting with -
      await assert.rejects(() => sandbox.run({ worktreePath: ".", command: "-invalid" }), /Provide an executable name/);

      // Command with NUL byte
      await assert.rejects(
        () => sandbox.run({ worktreePath: ".", command: "test\0cmd" }),
        /Provide an executable name/,
      );

      // commandArgs with non-string
      await assert.rejects(
        () => sandbox.run({ worktreePath: ".", command: "echo", commandArgs: [123] }),
        /must be an array of at most 512 strings/,
      );

      // applyChanges invalid type
      await assert.rejects(
        () => sandbox.run({ worktreePath: ".", command: "echo", applyChanges: "yes" }),
        /applyChanges must be a boolean/,
      );
    });
  });

  describe("15. src/core/eosProtobufContractEngine.ts branch coverage", () => {
    it("exercises wire types, varints, repeated fields, and schema bounds", () => {
      const engine = new EosProtobufContractEngine();

      // Invalid tag bounds
      assert.throws(
        () => engine.registerSchema({ name: "Bad", fields: [{ name: "f", tag: 0, wireType: 0, type: "int32" }] }),
        /All field tags must be 1\.\.536870911/,
      );

      // Unknown schema
      assert.throws(() => engine.encode("Unknown", {}), /Unknown schema/);
      assert.throws(() => engine.decode("Unknown", new Uint8Array()), /Unknown schema/);

      // Valid rich schema
      engine.registerSchema({
        name: "TelemetryRecord",
        fields: [
          { name: "id", tag: 1, wireType: 0, type: "int64" },
          { name: "delta", tag: 2, wireType: 0, type: "sint32" },
          { name: "active", tag: 3, wireType: 0, type: "bool" },
          { name: "ratio", tag: 4, wireType: 1, type: "double" },
          { name: "factor", tag: 5, wireType: 5, type: "float" },
          { name: "label", tag: 6, wireType: 2, type: "string" },
          { name: "tags", tag: 7, wireType: 2, type: "string", repeated: true },
        ],
      });

      const payload = {
        id: 123456789,
        delta: -42,
        active: true,
        ratio: 3.14159,
        factor: 2.5,
        label: "sensor_alpha",
        tags: ["v1", "prod", "cluster_us_east"],
      };

      const encoded = engine.encode("TelemetryRecord", payload);
      assert.ok(encoded.byteSize > 0);
      assert.equal(encoded.sha256Digest.length, 64);

      const decoded = engine.decode("TelemetryRecord", encoded.payload);
      assert.equal(decoded.id, 123456789);
      assert.equal(decoded.delta, -42);
      assert.equal(decoded.active, true);
      assert.equal(decoded.label, "sensor_alpha");
      assert.ok(Array.isArray(decoded.tags));
      assert.equal(decoded.tags.length, 3);
    });
  });

  describe("16. src/core/eosGentlemanAutoUpdater.ts branch coverage", () => {
    it("exercises parseSemVer, compareSemVer, selectLatestStableTag, and checksum parsing", () => {
      // parseSemVer
      assert.equal(parseSemVer(""), null);
      assert.equal(parseSemVer("not-a-version"), null);
      assert.equal(parseSemVer("1.2"), null);

      const v1 = parseSemVer("v1.2.3");
      assert.equal(v1.major, 1);
      assert.equal(v1.minor, 2);
      assert.equal(v1.patch, 3);
      assert.equal(v1.clean, "1.2.3");

      assert.equal(parseSemVer("2.10.4-rc.1"), null);

      const v2 = parseSemVer("2.10.4");
      assert.equal(v2.major, 2);
      assert.equal(v2.minor, 10);
      assert.equal(v2.patch, 4);

      // compareSemVer
      assert.equal(compareSemVer("v1.0.0", "v1.0.0"), 0);
      assert.equal(compareSemVer("v1.2.0", "v1.1.9"), 1);
      assert.equal(compareSemVer("v1.0.1", "v1.1.0"), -1);
      assert.equal(compareSemVer("v2.0.0", "v1.99.99"), 1);
      assert.equal(compareSemVer("invalid-a", "v1.0.0"), -1);
      assert.equal(compareSemVer("v1.0.0", "invalid-b"), 1);

      // selectLatestStableTag
      const sha1 = "a".repeat(40);
      const sha2 = "b".repeat(40);
      const sha3 = "c".repeat(40);
      const sha4 = "d".repeat(40);
      const lsRemote = `
        ${sha1}   refs/tags/v1.0.0
        ${sha2}   refs/tags/v1.1.0-rc.1
        ${sha3}   refs/tags/v1.2.0^{}
        ${sha4}   refs/tags/v1.2.0
      `;
      const latest = selectLatestStableTag(lsRemote);
      assert.equal(latest.version, "1.2.0");
      assert.equal(latest.commitSha, sha4);

      assert.equal(selectLatestStableTag(""), null);
      assert.equal(selectLatestStableTag("only non-semver lines"), null);

      // parseChecksumsManifest
      const sha64A = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const sha64B = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const manifest = `
        ${sha64A}  binary_linux_amd64.tar.gz
        ${sha64B}  binary_windows_amd64.zip
      `;
      const checksums = parseChecksumsManifest(manifest);
      assert.equal(checksums.get("binary_linux_amd64.tar.gz"), sha64A);
      assert.equal(checksums.get("binary_windows_amd64.zip"), sha64B);
    });
  });
});
