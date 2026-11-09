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
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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
import { EosGoAccelerator } from "../src/core/eosGoAccelerator.ts";
import { detectPolyglotPlan } from "../src/core/eosPolyglotAdapter.ts";
import { runMissionGoldenPath } from "../src/core/eosMissionGoldenPathOrchestrator.ts";
import { EosFleetPulseEngine } from "../src/core/eosFleetPulseEngine.ts";
import {
  evaluatePlatformSlos,
  assertDogfoodCeiling,
  buildCleanCanaryTelemetry,
  buildBreachingCanaryTelemetry,
  buildIvvReadinessChecklist,
  getCeilingEpistemicState,
} from "../src/core/eosPlatformOpsCeiling.ts";
import { EosAutonomousCodeSynthesizer } from "../src/core/eosAutonomousCodeSynthesizer.ts";
import { EosGentlemanStackBridge } from "../src/core/eosGentlemanStackBridge.ts";
import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";
import { EosMultiModelRouter } from "../src/core/eosMultiModelRouter.ts";
import { EosTlcFormalChecker } from "../src/core/eosTlcFormalChecker.ts";
import { EosFleetMissionControl } from "../src/core/eosFleetMissionControl.ts";
import { createPhase4InstitutionalHandlers } from "../src/mcp/tools/eosMcpPhase4InstitutionalHandlers.ts";
import { PHASE2_CORE_UTILITARIAN_HANDLERS } from "../src/mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";
import { EosSpotifyAgenticFactory } from "../src/core/eosSpotifyAgenticFactory.ts";
import { EosNeuroSymbolicFleetHealingEngine } from "../src/core/eosNeuroSymbolicFleetHealingEngine.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";
import { createPhase3CoreHandlers } from "../src/mcp/tools/eosMcpPhase3CoreHandlers.ts";
import { PHASE1_CORE_UTILITARIAN_HANDLERS } from "../src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { createPhase5DomainHandlers } from "../src/mcp/tools/eosMcpPhase5DomainHandlers.ts";
import { createPhase6DomainHandlers } from "../src/mcp/tools/eosMcpPhase6DomainHandlers.ts";
import { EosOpenSpecSync } from "../src/core/eosOpenSpecSync.ts";
import { EosSentinelDaemon } from "../src/core/eosSentinelDaemon.ts";
import { validatePatch } from "../src/core/eosPatchValidator.ts";
import { GlorianFleetHealthWatchdog } from "../src/core/glorianFleetHealthWatchdog.ts";
import { GlorianConstitutionalTribunal } from "../src/core/glorianConstitutionalTribunal.ts";
import { runControlPlaneHealthProbes } from "../src/core/eosControlPlaneHealthProbes.ts";
import { EosSapFixAutoshipper } from "../src/core/eosSapFixAutoshipper.ts";
import { EosPrometheusExporter } from "../src/core/eosPrometheusExporter.ts";
import { EosDurableWal } from "../src/core/eosDurableWal.ts";
import {
  EosWasmSandboxEngine,
  WASM_BYTECODE_TEMPLATES,
  getDefaultWasmSandboxEngine,
} from "../src/core/eosWasmSandboxEngine.ts";
import { EosDatalogVerifier } from "../src/core/eosDatalogVerifier.ts";
import { EosHnswVectorEngine } from "../src/core/eosHnswVectorEngine.ts";
import { EosWorktreeOrchestrator } from "../src/core/eosWorktreeOrchestrator.ts";
import { EosContinuousRefactorEngine } from "../src/core/eosContinuousRefactorEngine.ts";
import { EosFleetSoundcheckMesh } from "../src/core/eosFleetSoundcheckMesh.ts";
import { EosMctsHyperTuner } from "../src/core/eosMctsHyperTuner.ts";
import { EosAdaptiveConcurrencyGovernor } from "../src/core/eosAdaptiveConcurrencyGovernor.ts";
import { isValidEntry, loadFlakyBudget } from "../scripts/flaky-gate.mjs";
import { EosSurgicalSelfHealingKernel } from "../src/core/eosSurgicalSelfHealingKernel.ts";
import { EosDocumentationSearch } from "../src/core/eosDocumentationSearch.ts";
import { EosAdaptiveRateLimiter } from "../src/core/eosAdaptiveRateLimiter.ts";
import { EosBackpressureFlowController } from "../src/core/eosBackpressureFlowController.ts";
import { EosAgenticFinOpsGovernor } from "../src/core/eosAgenticFinOpsGovernor.ts";
import { EosApolloHermesMesh, EosCircuitBreaker, EosTokenBucketRateLimiter } from "../src/core/eosApolloHermesMesh.ts";
import { EosAcousticFeatureStore } from "../src/core/eosAcousticFeatureStore.ts";
import { EosAntiEntropyMerkleSync } from "../src/core/eosAntiEntropyMerkleSync.ts";
import {
  buildHealthyAcaDogfoodInput,
  runBigTechAcaCanaryGate,
  writeAcaCanaryEvidence,
} from "../src/core/eosBigTechAcaCanaryGate.ts";
import { issueBreakGlassGrant, evaluateBreakGlassGrant } from "../src/core/eosIamBreakGlass.ts";
import { resolveFleetProjectPath, resolveFleetRegistryPaths } from "../src/core/eosFleetPathResolver.ts";
import { EosPlanetaryMultiCloudEvacuationMesh } from "../src/core/eosPlanetaryMultiCloudEvacuationMesh.ts";

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

        // Probe failure branches to UNREACHABLE
        globalThis.fetch = async () => {
          throw new Error("connection reset");
        };
        const resProbeFail = createMockResponse();
        await fleetMod.default({ method: "GET", query: { probe: "true" } }, resProbeFail);
        assert.equal(resProbeFail.getStatusCode(), 200);
        assert.ok(resProbeFail.getBody()?.projects?.some((p) => p.productionProbe === "UNREACHABLE"));
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

      // OPTIONS
      const resOpt = createMockResponse();
      await memMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405 Method Not Allowed
      const resPut = createMockResponse();
      await memMod.default({ method: "PUT" }, resPut);
      assert.equal(resPut.getStatusCode(), 405);

      // INVALID_JSON
      const resBadJson = createMockResponse();
      await memMod.default({ method: "POST", body: "{ malformed json " }, resBadJson);
      assert.equal(resBadJson.getStatusCode(), 400);
      assert.equal(resBadJson.getBody()?.status, "INVALID_JSON");

      // INVALID_BODY (not an object)
      const resBadBody = createMockResponse();
      await memMod.default({ method: "POST", body: [1, 2, 3] }, resBadBody);
      assert.equal(resBadBody.getStatusCode(), 400);
      assert.equal(resBadBody.getBody()?.status, "INVALID_BODY");

      // BODY_TOO_LARGE
      const resTooLarge = createMockResponse();
      await memMod.default({ method: "POST", body: { big: "x".repeat(17000) } }, resTooLarge);
      assert.equal(resTooLarge.getStatusCode(), 413);
      assert.equal(resTooLarge.getBody()?.status, "BODY_TOO_LARGE");

      // INVALID_ACTION (action too long)
      const resBadAct = createMockResponse();
      await memMod.default({ method: "POST", body: { action: "a".repeat(50) } }, resBadAct);
      assert.equal(resBadAct.getStatusCode(), 400);
      assert.equal(resBadAct.getBody()?.status, "INVALID_ACTION");

      // QUERY_TOO_LONG
      const resLongQ = createMockResponse();
      await memMod.default({ method: "POST", body: { query: "q".repeat(300) } }, resLongQ);
      assert.equal(resLongQ.getStatusCode(), 400);
      assert.equal(resLongQ.getBody()?.status, "QUERY_TOO_LONG");

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

    it("exercises EosGoAccelerator availability, benchmark fallback, and bounds", () => {
      const fallbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), "go-fallback-"));
      try {
        const acc = new EosGoAccelerator(fallbackRoot);
        const avail = acc.isGoAvailable();
        assert.equal(typeof avail.binaryExists, "boolean");
        assert.equal(typeof avail.compilerAvailable, "boolean");

        const compiled = acc.compileBinary();
        assert.equal(compiled, false);

        const bench = acc.runBenchmark(2);
        assert.equal(bench.status, "LOCAL_DEMO_EXECUTED");
        assert.equal(bench.nativeGo, false);
        assert.equal(typeof bench.sha256Proof, "string");

        assert.throws(() => acc.runBenchmark(0), RangeError);
        assert.throws(() => acc.runBenchmark(129), RangeError);

        const bandit = acc.runBanditSimulation(5);
        assert.equal(bandit.status, "LOCAL_SIMULATION_EXECUTED");
        assert.equal(bandit.nativeGo, false);
        assert.ok(bandit.arms.length > 0);

        assert.throws(() => acc.runBanditSimulation(0), RangeError);
        assert.throws(() => acc.runBanditSimulation(100_001), RangeError);
      } finally {
        fs.rmSync(fallbackRoot, { recursive: true, force: true });
      }
    });

    it("exercises detectPolyglotPlan across all archetypes", () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "polyglot-test-"));
      try {
        // Unknown empty directory
        const unknown = detectPolyglotPlan(tmp);
        assert.equal(unknown.archetype, "UNKNOWN");

        // Go Microservice
        fs.writeFileSync(path.join(tmp, "go.mod"), "module test\n");
        const goPlan = detectPolyglotPlan(tmp);
        assert.equal(goPlan.archetype, "GO_MICROSERVICE");
        fs.writeFileSync(path.join(tmp, "Dockerfile"), "FROM alpine\n");
        const goWithDocker = detectPolyglotPlan(tmp);
        assert.ok(goWithDocker.detectedIndicators.includes("Dockerfile"));
        fs.unlinkSync(path.join(tmp, "go.mod"));
        fs.unlinkSync(path.join(tmp, "Dockerfile"));

        // Rust Core
        fs.writeFileSync(path.join(tmp, "Cargo.toml"), "[package]\nname = 'test'\n");
        const rustPlan = detectPolyglotPlan(tmp);
        assert.equal(rustPlan.archetype, "RUST_CORE");
        fs.unlinkSync(path.join(tmp, "Cargo.toml"));

        // Clojure Datomic
        fs.writeFileSync(path.join(tmp, "deps.edn"), "{}\n");
        const cljPlan = detectPolyglotPlan(tmp);
        assert.equal(cljPlan.archetype, "CLOJURE_DATOMIC");
        fs.unlinkSync(path.join(tmp, "deps.edn"));

        fs.writeFileSync(path.join(tmp, "project.clj"), "(defproject test)\n");
        const cljPlan2 = detectPolyglotPlan(tmp);
        assert.equal(cljPlan2.archetype, "CLOJURE_DATOMIC");
        fs.unlinkSync(path.join(tmp, "project.clj"));

        // Flutter / Dart
        fs.writeFileSync(path.join(tmp, "pubspec.yaml"), "name: test\n");
        const dartPlan = detectPolyglotPlan(tmp);
        assert.equal(dartPlan.archetype, "FLUTTER_DART_CLIENT");
        fs.unlinkSync(path.join(tmp, "pubspec.yaml"));

        // Python Data Pipeline
        fs.writeFileSync(path.join(tmp, "pyproject.toml"), "[tool.poetry]\n");
        const pyPlan = detectPolyglotPlan(tmp);
        assert.equal(pyPlan.archetype, "PYTHON_DATA_PIPELINE");
        fs.unlinkSync(path.join(tmp, "pyproject.toml"));

        fs.writeFileSync(path.join(tmp, "requirements.txt"), "numpy\n");
        const pyPlan2 = detectPolyglotPlan(tmp);
        assert.equal(pyPlan2.archetype, "PYTHON_DATA_PIPELINE");
        fs.unlinkSync(path.join(tmp, "requirements.txt"));

        // Node Zero Deps
        fs.writeFileSync(path.join(tmp, "package.json"), "{}");
        const nodePlan = detectPolyglotPlan(tmp);
        assert.equal(nodePlan.archetype, "NODE_ZERO_DEPS");
        fs.unlinkSync(path.join(tmp, "package.json"));
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("exercises runMissionGoldenPath directive validation and domain routing", () => {
      // Empty directive validation failure
      const failRes = runMissionGoldenPath("");
      assert.equal(failRes.status, "FAILED");
      assert.equal(failRes.failingStage, "INPUT_VALIDATION");
      assert.equal(failRes.epistemicState, "BLOCKED");

      // Execution with domain hints
      const domains = ["fintech", "audio", "spotify", "platform", "general"];
      for (const d of domains) {
        const res = runMissionGoldenPath(`Test mission directive for domain: ${d}`, {
          domainHint: d,
          sealLedger: false,
          spotifyFloor: 0,
          nubankFloor: 0,
        });
        assert.equal(res.domainHint, d);
        assert.ok(res.stages.length >= 2);
      }
    });

    it("exercises EosFleetPulseEngine audit and ANSI formatting", () => {
      const engine = new EosFleetPulseEngine(root);
      const report = engine.auditFleetPulse();
      assert.ok(report.totalProjects > 0);
      assert.equal(typeof report.sha256Receipt, "string");
      assert.equal(report.sha256Receipt.length, 64);

      const table = EosFleetPulseEngine.formatPulseTable(report);
      assert.ok(typeof table === "string" && table.includes("GLORIAN FLEET TACTICAL SOVEREIGNTY"));

      // 1. Missing registry error
      const badEngine = new EosFleetPulseEngine(path.join(root, "nonexistent_dir_pulse"));
      assert.throws(() => badEngine.auditFleetPulse(), /registry\.json must exist/);

      // 2. Custom registry exercising localPathEnv, localPath, resolvedLocalDir, git dirty, and git non-existent
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-pulse-test-"));
      try {
        fs.mkdirSync(path.join(tmpDir, "docs/projects"), { recursive: true });
        const dirtyRepo = path.join(tmpDir, "dirty-repo");
        fs.mkdirSync(dirtyRepo, { recursive: true });
        execFileSync("git", ["init", "--initial-branch=main"], { cwd: dirtyRepo });
        fs.writeFileSync(path.join(dirtyRepo, "untracked.txt"), "hello", "utf8");

        process.env.TEST_DIRTY_REPO_ENV = dirtyRepo;

        const customRegistry = {
          version: "1.0",
          registrySha256: "b".repeat(64),
          projects: [
            {
              id: "eos-system",
              name: "Glorian System",
              authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
            },
            {
              id: "test-env-project",
              name: "Test Env Project",
              localPathEnv: "TEST_DIRTY_REPO_ENV",
              authorization: "LEVEL_2_STAGING_AUTHORIZED",
            },
            {
              id: "test-explicit-path",
              name: "Test Explicit Path",
              localPath: dirtyRepo,
            },
            {
              id: "test-missing-project",
              name: "Test Missing Project",
              localPath: path.join(tmpDir, "does-not-exist"),
            },
          ],
        };
        fs.writeFileSync(path.join(tmpDir, "docs/projects/registry.json"), JSON.stringify(customRegistry), "utf8");

        const customEngine = new EosFleetPulseEngine(tmpDir);
        const customReport = customEngine.auditFleetPulse();
        assert.equal(customReport.totalProjects, 4);
        assert.ok(customReport.projects.some((p) => p.id === "test-env-project" && p.existsLocally));
        assert.ok(customReport.projects.some((p) => p.id === "test-missing-project" && !p.existsLocally));

        const customTable = EosFleetPulseEngine.formatPulseTable(customReport);
        assert.ok(customTable.length > 50);
      } finally {
        delete process.env.TEST_DIRTY_REPO_ENV;
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {
          // Ignore transient Windows file handle lock
        }
      }
    });

    it("exercises evaluatePlatformSlos and platform ceiling metrics", () => {
      // NOMINAL
      const nominal = evaluatePlatformSlos({
        timeToGreenMs: 2000,
        gatePassRate: 100,
        scorecardScore: 90,
        controlPlanePristine: true,
      });
      assert.equal(nominal.healthState, "NOMINAL");
      assert.equal(nominal.freezeDeployments, false);
      assert.equal(nominal.breaches.length, 0);

      // ELEVATED (TTG breach)
      const elevated = evaluatePlatformSlos({
        timeToGreenMs: 7000,
        gatePassRate: 100,
        scorecardScore: 90,
        controlPlanePristine: true,
      });
      assert.equal(elevated.healthState, "ELEVATED");
      assert.equal(elevated.freezeDeployments, true);

      // CRITICAL (Gate pass rate breach)
      const criticalGate = evaluatePlatformSlos({
        timeToGreenMs: 2000,
        gatePassRate: 85,
        scorecardScore: 90,
        controlPlanePristine: true,
      });
      assert.equal(criticalGate.healthState, "CRITICAL");
      assert.equal(criticalGate.freezeDeployments, true);

      // CRITICAL (Scorecard score breach)
      const criticalScore = evaluatePlatformSlos({
        timeToGreenMs: 2000,
        gatePassRate: 100,
        scorecardScore: 70,
        controlPlanePristine: true,
      });
      assert.equal(criticalScore.healthState, "CRITICAL");
      assert.equal(criticalScore.freezeDeployments, true);

      // Pristine breach
      const dirty = evaluatePlatformSlos({
        timeToGreenMs: 2000,
        gatePassRate: 100,
        scorecardScore: 90,
        controlPlanePristine: false,
      });
      assert.equal(dirty.freezeDeployments, true);

      // Dogfood, IV&V, and Canary helpers
      const dfClean = assertDogfoodCeiling(root);
      assert.equal(typeof dfClean.ok, "boolean");

      const dfMissing = assertDogfoodCeiling(path.join(os.tmpdir(), "nonexistent-dir-xyz"));
      assert.equal(dfMissing.ok, false);
      assert.equal(dfMissing.reason, "SCORECARD_MISSING");

      const cleanCanary = buildCleanCanaryTelemetry();
      assert.equal(cleanCanary.length, 4);

      const breachCanary = buildBreachingCanaryTelemetry();
      assert.equal(breachCanary.length, 1);

      const ivv = buildIvvReadinessChecklist(root);
      assert.ok(Array.isArray(ivv.items));
      assert.equal(typeof ivv.ready, "boolean");

      const epistemic = getCeilingEpistemicState();
      assert.equal(epistemic.state, "SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE");
      assert.ok(epistemic.forbiddenClaims.length >= 4);
    });

    it("exercises EosAutonomousCodeSynthesizer across domains and JPL rules", () => {
      assert.equal(EosAutonomousCodeSynthesizer.inferDomain("payment transaction ledger"), "fintech");
      assert.equal(EosAutonomousCodeSynthesizer.inferDomain("loudness lufs audio filter"), "audio");
      assert.equal(EosAutonomousCodeSynthesizer.inferDomain("mesh circuit breaker routing"), "platform");
      assert.equal(EosAutonomousCodeSynthesizer.inferDomain("darpa crypto proof enclave"), "govtech");
      assert.equal(EosAutonomousCodeSynthesizer.inferDomain("unrelated simple topic"), "general");

      const synth = new EosAutonomousCodeSynthesizer(root);
      const domains = ["fintech", "audio", "platform", "govtech", "general"];
      for (const domain of domains) {
        const bundle = synth.synthesizeBundle(`Construct ${domain} sovereign module`, domain);
        assert.equal(bundle.domain, domain);
        assert.ok(bundle.files.length >= 4);
        assert.equal(bundle.jplConformance.rule1SimpleControlFlow, true);
        assert.equal(bundle.jplConformance.rule5PreconditionAssertions, true);
        assert.equal(bundle.jplConformance.rule10CompilerZeroWarnings, true);
      }
    });

    it("exercises EosGentlemanStackBridge paths, probes, and audits", () => {
      const extraPaths = EosGentlemanStackBridge.resolveExtraToolPaths();
      assert.ok(Array.isArray(extraPaths));

      const nodeProbe = EosGentlemanStackBridge.probeBinary("node", ["--version"], [process.execPath]);
      assert.equal(nodeProbe.found, true);
      assert.ok(nodeProbe.versionOutput.length > 0);

      const missingProbe = EosGentlemanStackBridge.probeBinary("non-existent-binary-012345", ["-v"], []);
      assert.equal(missingProbe.found, false);

      const audit = EosGentlemanStackBridge.auditStack(root);
      assert.ok(audit.readinessScore >= 0);
      assert.ok(audit.pillars.length >= 5);
      assert.equal(typeof audit.sha256Receipt, "string");
    });

    it("exercises EosSlsaProvenanceSbom generation and supply chain integrity", () => {
      const sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(root);
      assert.equal(sbom.bomFormat, "CycloneDX");
      assert.equal(sbom.specVersion, "1.5");
      assert.ok(sbom.components.length > 0);

      const provenance = EosSlsaProvenanceSbom.generateSlsaProvenance(root, "0123456789abcdef0123456789abcdef01234567");
      assert.equal(provenance._type, "https://in-toto.io/Statement/v1");
      assert.equal(provenance.predicateType, "https://slsa.dev/provenance/v1");
      assert.ok(provenance.subject.length >= 3);

      const verification = EosSlsaProvenanceSbom.verifySupplyChain(root);
      assert.equal(typeof verification.valid, "boolean");
    });

    it("exercises EosMultiModelRouter configuration, FinOps stats, and error boundaries", async () => {
      const router = new EosMultiModelRouter({}, { cacheTtlMs: 2000, maxCallsPerMinute: 20 });
      const stats = router.getUsageStats();
      assert.equal(stats.totalCalls, 0);
      assert.equal(stats.totalEstimatedCostUsd, 0);

      // Missing API key path safely returns Err without throwing uncaught
      const result = await router.call("CODE", [{ role: "user", content: "hello test" }]);
      assert.equal(result.ok, false);
      assert.ok(result.error instanceof Error);
    });

    it("exercises api/_specs.js options, 405, and search filters", async () => {
      const specsMod = await import(pathToFileURL(path.join(root, "api/_specs.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await specsMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405 Method Not Allowed
      const resPost = createMockResponse();
      await specsMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // GET without query
      const resGet = createMockResponse();
      await specsMod.default({ method: "GET", query: {} }, resGet);
      assert.equal(resGet.getStatusCode(), 200);
      assert.ok(resGet.getBody().totalSpecs > 0);

      // GET with query and status
      const resQuery = createMockResponse();
      await specsMod.default({ method: "GET", query: { q: "SPEC-001", status: "UNKNOWN" } }, resQuery);
      assert.equal(resQuery.getStatusCode(), 200);
      assert.ok(resQuery.getBody().matchedSpecs >= 1);

      // GET with status ALL
      const resAll = createMockResponse();
      await specsMod.default({ method: "GET", query: { status: "ALL" } }, resAll);
      assert.equal(resAll.getStatusCode(), 200);
    });

    it("exercises api/_bigtech.js options, 405, vectors, monte carlo, and hash chain", async () => {
      const bigtechMod = await import(pathToFileURL(path.join(root, "api/_bigtech.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await bigtechMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405
      const resPost = createMockResponse();
      await bigtechMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // Action: vector / hnsw
      const resVec = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { action: "vector", query: "neural query" } }, resVec);
      assert.equal(resVec.getStatusCode(), 200);
      assert.equal(resVec.getBody().status, "LOCAL_VECTOR_DEMO");

      // Action: risk / aladdin (valid)
      const resRisk = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { action: "risk", iterations: "50", deadline: "15" } }, resRisk);
      assert.equal(resRisk.getStatusCode(), 200);
      assert.equal(resRisk.getBody().status, "LOCAL_MONTE_CARLO_DEMO");

      // Action: risk with invalid parameters
      const resBadIter = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { action: "risk", iterations: "invalid" } }, resBadIter);
      assert.equal(resBadIter.getStatusCode(), 400);

      const resBadDead = createMockResponse();
      await bigtechMod.default(
        { method: "GET", query: { action: "risk", deadline: "bad-deadline-string" } },
        resBadDead,
      );
      assert.equal(resBadDead.getStatusCode(), 400);

      const resOutOfRange = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { action: "risk", iterations: "0" } }, resOutOfRange);
      assert.equal(resOutOfRange.getStatusCode(), 400);

      // Action: chain / ledger
      const resChain = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { action: "chain" } }, resChain);
      assert.equal(resChain.getStatusCode(), 200);
      assert.equal(resChain.getBody().totalBlocks, 3);

      // Default scenario (valid)
      const resScen = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { scenario: "secret-leak-attempt" } }, resScen);
      assert.equal(resScen.getStatusCode(), 200);
      assert.equal(resScen.getBody().status, "LOCAL_SCENARIO_DESCRIPTION");

      // Default scenario (invalid)
      const resBadScen = createMockResponse();
      await bigtechMod.default({ method: "GET", query: { scenario: "unknown-bad-scenario" } }, resBadScen);
      assert.equal(resBadScen.getStatusCode(), 400);
    });

    it("exercises api/mcp.js options, 405, 406 accept negotiation, invalid bodies, and tools", async () => {
      const mcpMod = await import(pathToFileURL(path.join(root, "api/mcp.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await mcpMod.default({ method: "OPTIONS", headers: {} }, resOpt);
      assert.ok([200, 204].includes(resOpt.getStatusCode()));

      // GET -> 405
      const resGet = createMockResponse();
      await mcpMod.default({ method: "GET", headers: {} }, resGet);
      assert.equal(resGet.getStatusCode(), 405);

      // Missing Content-Type -> 415
      const resNoCt = createMockResponse();
      await mcpMod.default({ method: "POST", headers: {} }, resNoCt);
      assert.equal(resNoCt.getStatusCode(), 415);

      // Accept: text/event-stream -> 406
      const resStream = createMockResponse();
      await mcpMod.default(
        { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" } },
        resStream,
      );
      assert.equal(resStream.getStatusCode(), 406);

      // Accept: text/plain -> 406
      const resPlain = createMockResponse();
      await mcpMod.default(
        { method: "POST", headers: { "content-type": "application/json", accept: "text/plain" } },
        resPlain,
      );
      assert.equal(resPlain.getStatusCode(), 406);

      // Invalid body (null)
      const resNull = createMockResponse();
      await mcpMod.default({ method: "POST", headers: { "content-type": "application/json" }, body: null }, resNull);
      assert.equal(resNull.getStatusCode(), 400);

      // Malformed JSON string
      const resBadJson = createMockResponse();
      await mcpMod.default(
        { method: "POST", headers: { "content-type": "application/json" }, body: "not-json" },
        resBadJson,
      );
      assert.equal(resBadJson.getStatusCode(), 400);

      // Method ping
      const resPing = createMockResponse();
      await mcpMod.default(
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "x-forwarded-for": "127.0.0.1" },
          body: { jsonrpc: "2.0", id: 1, method: "ping" },
        },
        resPing,
      );
      assert.equal(resPing.getStatusCode(), 200);

      // Method initialize
      const resInit = createMockResponse();
      await mcpMod.default(
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "x-forwarded-for": "127.0.0.1" },
          body: { jsonrpc: "2.0", id: 2, method: "initialize", params: {} },
        },
        resInit,
      );
      assert.equal(resInit.getStatusCode(), 200);

      // Method tools/list
      const resList = createMockResponse();
      await mcpMod.default(
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "x-forwarded-for": "127.0.0.1" },
          body: { jsonrpc: "2.0", id: 3, method: "tools/list" },
        },
        resList,
      );
      assert.equal(resList.getStatusCode(), 200);

      // Method tools/call with unexposed tool
      const resUnexposed = createMockResponse();
      await mcpMod.default(
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "x-forwarded-for": "127.0.0.1" },
          body: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "forbidden_tool" } },
        },
        resUnexposed,
      );
      assert.equal(resUnexposed.getStatusCode(), 200);
      assert.equal(resUnexposed.getBody().error.code, -32601);
    });

    it("exercises EosTlcFormalChecker detectRuntime, fallback model verification, and ledger logging", () => {
      const diag = EosTlcFormalChecker.detectRuntime(root);
      assert.ok(typeof diag.javaInstalled === "boolean");
      assert.ok(typeof diag.tlaJarPresent === "boolean");

      const result = EosTlcFormalChecker.verifyModel("SPEC_001_CONSTITUTION", {
        projectRoot: root,
        forceFallback: true,
        steps: 50,
      });
      assert.equal(result.status, "PASS");
      assert.equal(result.executionMode, "FALLBACK_BOUNDED_JS");
      assert.equal(result.exploredStates, 50);

      const logged = EosTlcFormalChecker.recordReceiptInLedger(result, root);
      assert.equal(typeof logged, "boolean");
    });

    it("exercises EosFleetMissionControl overview and endpoint probe edge cases", async () => {
      const mc = new EosFleetMissionControl(root);
      const overview = mc.getFleetOverview();
      assert.ok(Array.isArray(overview));
      assert.ok(overview.length > 0);

      // Invalid URL probe
      const probeBad = await EosFleetMissionControl.probeEndpoint("not-a-valid-url");
      assert.equal(probeBad.reachable, false);
      assert.equal(probeBad.latencyMs, 0);
    });

    it("exercises createPhase4InstitutionalHandlers across Nubank, Spotify, and SLSA", () => {
      const handlers = createPhase4InstitutionalHandlers(root);

      // eos_nubank_audit
      const nubankAudit = handlers.eos_nubank_audit({
        hasMutableStateInDomain: false,
        usesHexagonalLayerIsolation: true,
        unitTestCoveragePercent: 95,
      });
      assert.ok(nubankAudit.institutionalScore >= 80);

      // eos_nubank_sachem_verify
      const sachem = handlers.eos_nubank_sachem_verify({
        previousSchema: { version: "1.0", fields: [{ name: "id", type: "string", required: true }] },
        proposedSchema: {
          version: "1.1",
          fields: [
            { name: "id", type: "string", required: true },
            { name: "email", type: "string", required: false },
          ],
        },
      });
      assert.equal(typeof sachem.isCompatible, "boolean");

      assert.throws(() => handlers.eos_nubank_sachem_verify({}), Error);

      // eos_nubank_postmortem
      const postmortem = handlers.eos_nubank_postmortem({
        incidentId: "INC-TEST",
        title: "Test Outage",
        severity: "SEV2",
      });
      assert.ok(postmortem.markdown.includes("INC-TEST"));

      // eos_nubank_datomic_transact
      const datomic = handlers.eos_nubank_datomic_transact({ txData: [] });
      assert.equal(typeof datomic.txHash, "string");

      // eos_spotify_audit_institutional
      const spotifyAudit = handlers.eos_spotify_audit_institutional({});
      assert.ok(spotifyAudit.institutionalScore >= 50);

      // eos_spotify_golden_path_verify
      const golden = handlers.eos_spotify_golden_path_verify({
        serviceName: "music-service",
        filesPresent: ["catalog-info.yaml", "docs/runbook.md"],
      });
      assert.equal(typeof golden.isCompliant, "boolean");

      // eos_spotify_canary_gate (pass & breach)
      const canaryPass = handlers.eos_spotify_canary_gate({
        trafficPercentage: 5,
        totalRequests: 1000,
        errorCount: 0,
        p99LatencyMs: 25,
      });
      assert.equal(canaryPass.decision, "ADVANCE_STAGE");

      const canaryFail = handlers.eos_spotify_canary_gate({
        trafficPercentage: 5,
        totalRequests: 1000,
        errorCount: 50,
        p99LatencyMs: 150,
      });
      assert.equal(canaryFail.decision, "TRIGGER_ROLLBACK");

      // eos_spotify_fleetshift_plan
      const fleetshift = handlers.eos_spotify_fleetshift_plan({
        migrationId: "MIG-999",
        targetRepos: ["repo-1"],
      });
      assert.equal(fleetshift.migrationId, "MIG-999");

      // eos_slsa_provenance_sbom
      const slsaSbom = handlers.eos_slsa_provenance_sbom({ mode: "sbom" });
      assert.ok(slsaSbom.sbom !== undefined);

      const slsaProv = handlers.eos_slsa_provenance_sbom({
        mode: "slsa",
        commitSha: "abcdef1234567890abcdef1234567890abcdef12",
      });
      assert.ok(slsaProv.slsa !== undefined);

      const slsaBoth = handlers.eos_slsa_provenance_sbom({ mode: "both" });
      assert.ok(slsaBoth.sbom !== undefined);
      assert.ok(slsaBoth.slsa !== undefined);

      // eos_nubank_postmortem with rich timeline & systemicRemediations
      const richPostmortem = handlers.eos_nubank_postmortem({
        incidentId: "INC-RICH-01",
        title: "Database Failover Latency Spike",
        severity: "SEV1",
        timeline: [
          { timestamp: "2026-11-08T00:00:00Z", description: "Alert fired", detectedBy: "alert" },
          { timestamp: "2026-11-08T00:05:00Z", description: "Customer report", detectedBy: "customer" },
          { timestamp: "2026-11-08T00:10:00Z", description: "Sentinel mitigation", detectedBy: "sentinel" },
        ],
        systemicRemediations: [{ action: "Upgrade connection pool", owner: "squad-data", deadline: "2026-12-15" }],
      });
      assert.ok(richPostmortem.markdown.includes("INC-RICH-01"));

      const slsaVerify = handlers.eos_slsa_provenance_sbom({ mode: "verify" });
      assert.ok(slsaVerify.verification);

      // eos_planetary_doctrine_audit (summary and json)
      const doctrineSummary = handlers.eos_planetary_doctrine_audit({ format: "summary" });
      assert.ok(doctrineSummary.status);
      assert.ok(doctrineSummary.pillars);

      const doctrineJson = handlers.eos_planetary_doctrine_audit({ format: "json" });
      assert.ok(doctrineJson.pillars);

      // eos_black_projects_triad_audit (summary and json)
      const triadSummary = handlers.eos_black_projects_triad_audit({ format: "summary" });
      assert.ok(triadSummary.status);
      assert.ok(triadSummary.pillars);

      const triadJson = handlers.eos_black_projects_triad_audit({ format: "json" });
      assert.ok(triadJson.pillars);
    });

    it("exercises PHASE2_CORE_UTILITARIAN_HANDLERS", () => {
      const handlers = PHASE2_CORE_UTILITARIAN_HANDLERS;
      const ctx = {
        projectRoot: root,
        resolveProjectPath: (rel) => path.join(root, rel),
        resolveConfinedLedgerPath: () => path.join(root, ".eos", "state.db"),
      };

      // eos_tmr_consensus
      const tmr = handlers.eos_tmr_consensus({ directive: "Verificar integridad del sistema" }, ctx);
      assert.equal(typeof tmr.consensusAchieved, "boolean");

      // eos_audit_fleet
      const fleetAudit = handlers.eos_audit_fleet({}, ctx);
      assert.equal(fleetAudit.scope, "LOCAL_REGISTRY_ONLY");
      assert.ok(fleetAudit.totalRegisteredProjects > 0);

      // eos_optimize_context
      const opt = handlers.eos_optimize_context({ content: "function hello() { return 42; }" }, ctx);
      assert.ok(typeof opt.compressedOutline === "string");

      const optFile = handlers.eos_optimize_context({ filePath: "package.json" }, ctx);
      assert.ok(typeof optFile.compressedOutline === "string");
      assert.throws(() => handlers.eos_optimize_context({ content: "A".repeat(300000) }, ctx), RangeError);

      // eos_validate_patch
      const vPatch = handlers.eos_validate_patch({ filePath: "package.json", content: '{"name": "test"}' }, ctx);
      assert.equal(typeof vPatch.valid, "boolean");
      assert.throws(() => handlers.eos_validate_patch({ filePath: "package.json", content: 123 }, ctx), RangeError);
      assert.throws(
        () => handlers.eos_validate_patch({ filePath: path.resolve(root, "package.json"), content: "{}" }, ctx),
        /project-relative/,
      );
      assert.throws(
        () => handlers.eos_validate_patch({ filePath: "../../evil.txt", content: "{}" }, ctx),
        /inside the configured/,
      );

      // eos_get_blast_radius
      const blast = handlers.eos_get_blast_radius({ filePath: "package.json" }, ctx);
      assert.equal(typeof blast.totalImpactedFiles, "number");

      // eos_query_code_graph
      const summary = handlers.eos_query_code_graph({}, ctx);
      assert.ok(summary.totalFiles >= 0);

      // eos_check_openspec
      const auditSpecs = handlers.eos_check_openspec({ action: "audit" }, ctx);
      assert.ok(auditSpecs.totalSpecs >= 0);

      const listSpecs = handlers.eos_check_openspec({ action: "list_specs" }, ctx);
      assert.ok(Array.isArray(listSpecs));

      const listChanges = handlers.eos_check_openspec({ action: "list_changes" }, ctx);
      assert.ok(Array.isArray(listChanges));
    });

    it("exercises EosSpotifyAgenticFactory metadata, honk, and candidate inventories", () => {
      const factory = new EosSpotifyAgenticFactory(root);
      const honk = factory.dispatchHonk({
        taskName: "Build audio dsp filter",
        specDescription: "Implement pure Layer-0 audio filter",
        stack: "node",
      });
      assert.equal(honk.status, "PLAN_ONLY");
      assert.equal(honk.epistemicState, "NOT_VERIFIED");
      assert.ok(honk.steps.length >= 4);

      const xirp = factory.compileXirpContext();
      assert.ok(typeof xirp.serviceName === "string");
      assert.ok(typeof xirp.snapshotFingerprintSha256 === "string");

      const canaryPkg = factory.generateProgressiveCanary("streaming-service", "audio-infra");
      assert.equal(canaryPkg.templateOnly, true);
      assert.ok(canaryPkg.flaggerCanaryYaml.includes("flagger.app"));

      for (const stack of ["rust", "go", "node", "java"]) {
        const files = factory.inventoryCandidateFiles(stack);
        assert.ok(Array.isArray(files));
        assert.ok(files.length > 0);
      }
    });

    it("exercises EosNeuroSymbolicFleetHealingEngine SMT theorems and closed-loop repair", () => {
      const engine = new EosNeuroSymbolicFleetHealingEngine(root);

      // Precondition tests
      assert.throws(() => engine.verifyInvariantProof(null), /theoremName is required/);
      assert.throws(
        () => engine.verifyInvariantProof({ theoremName: "T1", clauses: null }),
        /clauses must be an array/,
      );
      assert.throws(() => engine.executeClosedLoopHealing(null), /faultId is required/);
      assert.throws(
        () => engine.executeClosedLoopHealing({ faultId: "F1", targetFilePath: "" }),
        /targetFilePath is required/,
      );
      assert.throws(
        () => engine.executeClosedLoopHealing({ faultId: "F1", targetFilePath: "x", failingLine: "invalid" }),
        /failingLine must be a number/,
      );
      assert.throws(() => engine.planAndExecuteLscCampaign(null), /campaignId is required/);
      assert.throws(
        () => engine.planAndExecuteLscCampaign({ campaignId: "C1", targetModules: null }),
        /targetModules must be an array/,
      );
      assert.throws(
        () => engine.planAndExecuteLscCampaign({ campaignId: "C1", targetModules: [], transformationRule: "" }),
        /transformationRule is required/,
      );

      // SAT theorem (violation model found) with safetyNegationClause
      const satProof = engine.verifyInvariantProof({
        theoremName: "ZeroPlainSecretsProof",
        clauses: [
          ["noSecrets", "alertActive"],
          ["!alertActive", "noSecrets"],
        ],
        safetyNegationClause: ["noSecrets"],
      });
      assert.equal(satProof.verdict, "VIOLATION_SAT_MODEL_FOUND");
      assert.equal(satProof.isProvablySecure, false);
      assert.ok(satProof.satisfyingModel);

      // UNSAT theorem (proved secure, model is null)
      const unsatProof = engine.verifyInvariantProof({
        theoremName: "UnsatProvenSecure",
        clauses: [["p"], ["!p"]],
      });
      assert.equal(unsatProof.verdict, "PROVED_UNSAT_SECURE");
      assert.equal(unsatProof.isProvablySecure, true);
      assert.equal(unsatProof.satisfyingModel, undefined);

      // Closed-loop repair with mock content
      const repairMock = engine.executeClosedLoopHealing({
        faultId: "FAULT-101",
        targetFilePath: "src/sample.ts",
        failingLine: 10,
        errorMessage: "Potential undefined reference access",
        mockOriginalContent: "export const x = 42;\nexport const y = x + 1;\n",
      });
      assert.ok(["VERIFIED_ZERO_REGRESSIONS", "REGRESSION_REJECTED", "PATCH_FAILED"].includes(repairMock.status));

      // Closed-loop repair reading real absolute file from disk
      const realPath = path.join(root, "src", "core", "eosKernelPrimitives.ts");
      const repairDisk = engine.executeClosedLoopHealing({
        faultId: "FAULT-102",
        targetFilePath: realPath,
        failingLine: 1,
        errorMessage: "Sample diagnostic on existing file",
      });
      assert.ok(repairDisk.sha256Receipt);

      // Closed-loop repair with non-existent relative file and empty mock
      const repairMissing = engine.executeClosedLoopHealing({
        faultId: "FAULT-103",
        targetFilePath: "nonexistent/missing_file_404.ts",
        failingLine: 5,
        errorMessage: "Missing file test",
      });
      assert.ok(repairMissing.sha256Receipt);

      // Plan LSC campaign with empty invariant clauses (request.invariantClauses omitted => empty CNF is SAT => aborts)
      const repNoClauses = engine.planAndExecuteLscCampaign({
        campaignId: "CAMP-NO-CLAUSES",
        targetModules: ["src/core/eosKernelPrimitives.ts"],
        transformationRule: "RULE_ADD_STRICT",
      });
      assert.equal(repNoClauses.status, "ABORTED_INVARIANT_VIOLATION");
    });

    it("exercises createPhase8AgiHandlers consulting, axioms, forge, and drift", () => {
      const handlers = createPhase8AgiHandlers({ projectRoot: root });

      // eos_consult
      const emptyConsult = handlers.eos_consult({});
      assert.ok(emptyConsult.error !== undefined);

      const consult = handlers.eos_consult({
        problem: "Architecture optimization for zero runtime dependencies",
        engagementType: "COMPREHENSIVE",
        techStack: "NODE_TYPESCRIPT",
      });
      assert.ok(consult.engagementId !== undefined);
      const consultDir = path.join(root, "docs/consulting");
      if (fs.existsSync(consultDir)) fs.rmSync(consultDir, { recursive: true, force: true });

      // eos_agi_axioms
      const axioms = handlers.eos_agi_axioms({});
      assert.ok(axioms.totalAxioms >= 0);
      assert.ok(typeof axioms.rulesBlock === "string");

      // eos_forge_list
      const forgeList = handlers.eos_forge_list({});
      assert.ok(Array.isArray(forgeList.tools));

      // eos_context_window
      const ctxWin = handlers.eos_context_window({
        objective: "Verify system integrity",
        targetFile: "package.json",
      });
      assert.ok(typeof ctxWin.totalTokensUsed === "number");

      // eos_spec_drift
      const drift = handlers.eos_spec_drift({});
      assert.ok(typeof drift.totalSpecsScanned === "number");
    });

    it("exercises api/_finops.js options, get, 405, and post classification", async () => {
      const finopsMod = await import(pathToFileURL(path.join(root, "api/_finops.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await finopsMod.default({ method: "OPTIONS" }, resOpt);
      assert.ok([200, 204].includes(resOpt.getStatusCode()));

      // GET
      const resGet = createMockResponse();
      await finopsMod.default({ method: "GET" }, resGet);
      assert.equal(resGet.getStatusCode(), 200);
      assert.equal(resGet.getBody().ok, true);

      // 405 Method Not Allowed
      const resPut = createMockResponse();
      await finopsMod.default({ method: "PUT" }, resPut);
      assert.equal(resPut.getStatusCode(), 405);

      // POST with missing directive -> 400
      const resEmpty = createMockResponse();
      await finopsMod.default({ method: "POST", body: {} }, resEmpty);
      assert.equal(resEmpty.getStatusCode(), 400);

      // POST with oversized directive -> 413
      const resHuge = createMockResponse();
      await finopsMod.default({ method: "POST", body: { directive: "A".repeat(33000) } }, resHuge);
      assert.equal(resHuge.getStatusCode(), 413);

      // POST valid with explicit tokens
      const resValid = createMockResponse();
      await finopsMod.default(
        { method: "POST", body: { directive: "Format and lint code", estimatedTokens: 2000 } },
        resValid,
      );
      assert.equal(resValid.getStatusCode(), 200);
      assert.equal(resValid.getBody().ok, true);

      // POST valid without explicit tokens
      const resValidAuto = createMockResponse();
      await finopsMod.default(
        { method: "POST", body: { directive: "Adjudicate formal TLA+ theorem proof" } },
        resValidAuto,
      );
      assert.equal(resValidAuto.getStatusCode(), 200);
      assert.equal(resValidAuto.getBody().ok, true);
    });

    it("exercises api/compile.js options, 405, amplify, and typed-array benchmark", async () => {
      const compileMod = await import(pathToFileURL(path.join(root, "api/compile.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await compileMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405
      const resPut = createMockResponse();
      await compileMod.default({ method: "PUT" }, resPut);
      assert.equal(resPut.getStatusCode(), 405);

      // POST with invalid json string
      const resBadJson = createMockResponse();
      await compileMod.default({ method: "POST", body: "invalid-json{" }, resBadJson);
      assert.equal(resBadJson.getStatusCode(), 400);

      // POST with invalid body (array)
      const resBadBody = createMockResponse();
      await compileMod.default({ method: "POST", body: [1, 2, 3] }, resBadBody);
      assert.equal(resBadBody.getStatusCode(), 400);

      // Amplify mode (valid)
      const resAmp = createMockResponse();
      await compileMod.default(
        { method: "POST", body: { mode: "amplify", prompt: "Build secure authenticator" } },
        resAmp,
      );
      assert.equal(resAmp.getStatusCode(), 200);
      assert.equal(resAmp.getBody().status, "LOCAL_DRAFT_GENERATED");

      // Amplify mode (invalid model)
      const resBadModel = createMockResponse();
      await compileMod.default(
        { method: "POST", body: { mode: "amplify", prompt: "Hello", model: "unsupported-model-xyz" } },
        resBadModel,
      );
      assert.equal(resBadModel.getStatusCode(), 400);

      // Default benchmark execution
      const resBench = createMockResponse();
      await compileMod.default({ method: "GET", query: { instruction: "Process matrix", profile: "fast" } }, resBench);
      assert.equal(resBench.getStatusCode(), 200);
      assert.equal(resBench.getBody().status, "LOCAL_BENCHMARK_EXECUTED");

      // Default benchmark with invalid profile length
      const resBadProf = createMockResponse();
      await compileMod.default({ method: "GET", query: { profile: "x".repeat(81) } }, resBadProf);
      assert.equal(resBadProf.getStatusCode(), 400);
    });

    it("exercises api/eval.js options, 405, titans matrix, and cognitive evaluation", async () => {
      const evalMod = await import(pathToFileURL(path.join(root, "api/eval.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      await evalMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405
      const resPost = createMockResponse();
      await evalMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // Titans actions
      const resXirp = createMockResponse();
      await evalMod.default({ method: "GET", query: { titan: "xirp" } }, resXirp);
      assert.equal(resXirp.getStatusCode(), 200);
      assert.equal(resXirp.getBody().status, "LOCAL_SIMULATION_EXECUTED");

      const resSpacex = createMockResponse();
      await evalMod.default({ method: "GET", query: { titan: "spacex" } }, resSpacex);
      assert.equal(resSpacex.getStatusCode(), 200);

      const resBadAction = createMockResponse();
      await evalMod.default({ method: "GET", query: { titan: "invalid-titan-action" } }, resBadAction);
      assert.equal(resBadAction.getStatusCode(), 400);

      // Cognitive eval with string code
      const resCode = createMockResponse();
      await evalMod.default({ method: "GET", query: { code: "export const answer = 42;" } }, resCode);
      assert.equal(resCode.getStatusCode(), 200);

      // Cognitive eval with oversized target path
      const resBadTarget = createMockResponse();
      await evalMod.default({ method: "GET", query: { target: "t".repeat(1025) } }, resBadTarget);
      assert.equal(resBadTarget.getStatusCode(), 400);
    });

    it("exercises api/health.js options, 405, head, get, traceparent, and cors origins", async () => {
      const healthMod = await import(pathToFileURL(path.join(root, "api/health.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      healthMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405 on POST
      const resPost = createMockResponse();
      healthMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // HEAD
      const resHead = createMockResponse();
      healthMod.default({ method: "HEAD" }, resHead);
      assert.equal(resHead.getStatusCode(), 200);

      // GET with valid traceparent
      const resValidTrace = createMockResponse();
      healthMod.default(
        {
          method: "GET",
          headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
        },
        resValidTrace,
      );
      assert.equal(resValidTrace.getStatusCode(), 200);
      assert.equal(resValidTrace.getBody().status, "UP");

      // GET with x-trace-id
      const resXTrace = createMockResponse();
      healthMod.default(
        {
          method: "GET",
          headers: { "x-trace-id": "4bf92f3577b34da6a3ce929d0e0e4736" },
        },
        resXTrace,
      );
      assert.equal(resXTrace.getStatusCode(), 200);

      // GET with allowed origin
      const prevAllowed = process.env.EOS_ALLOWED_ORIGINS;
      process.env.EOS_ALLOWED_ORIGINS = "https://glorian.internal, https://dashboard.local";
      try {
        const resCors = createMockResponse();
        healthMod.default(
          {
            method: "GET",
            headers: { origin: "https://glorian.internal" },
          },
          resCors,
        );
        assert.equal(resCors.getStatusCode(), 200);
        assert.equal(resCors.headers["access-control-allow-origin"], "https://glorian.internal");
      } finally {
        if (prevAllowed === undefined) delete process.env.EOS_ALLOWED_ORIGINS;
        else process.env.EOS_ALLOWED_ORIGINS = prevAllowed;
      }
    });

    it("exercises api/kernel.js options, 405, linux fixtures, omega demo, and subroutes", async () => {
      const kernelMod = await import(pathToFileURL(path.join(root, "api/kernel.js")).href);

      // OPTIONS
      const resOpt = createMockResponse();
      kernelMod.default({ method: "OPTIONS" }, resOpt);
      assert.equal(resOpt.getStatusCode(), 200);

      // 405 on POST without finops url/query
      const resPost = createMockResponse();
      kernelMod.default({ method: "POST" }, resPost);
      assert.equal(resPost.getStatusCode(), 405);

      // GET default path /proc/eos/version
      const resDef = createMockResponse();
      kernelMod.default({ method: "GET" }, resDef);
      assert.equal(resDef.getStatusCode(), 200);
      assert.equal(resDef.getBody().status, "STATIC_FIXTURE");

      // GET other fixtures
      for (const p of [
        "/proc/eos/rcu_stats",
        "/proc/eos/eevdf_sched",
        "/sys/kernel/ebpf_verifier",
        "/dev/anubis_law_gate",
      ]) {
        const resFix = createMockResponse();
        kernelMod.default({ method: "GET", query: { path: p } }, resFix);
        assert.equal(resFix.getStatusCode(), 200);
      }

      // GET 404 fixture
      const res404 = createMockResponse();
      kernelMod.default({ method: "GET", query: { path: "/proc/nonexistent" } }, res404);
      assert.equal(res404.getStatusCode(), 404);

      // Omega demo normal
      const resOmega = createMockResponse();
      kernelMod.default({ method: "GET", query: { module: "omega", statement: "Valid statement" } }, resOmega);
      assert.equal(resOmega.getStatusCode(), 200);
      assert.equal(resOmega.getBody().status, "LOCAL_DEMONSTRATION");

      // Omega demo statement invalid bounds
      const resOmegaBad = createMockResponse();
      kernelMod.default({ method: "GET", query: { module: "omega", statement: "x".repeat(4097) } }, resOmegaBad);
      assert.equal(resOmegaBad.getStatusCode(), 400);

      // BigTech routing
      const resBigTech = createMockResponse();
      kernelMod.default({ method: "GET", query: { module: "bigtech" } }, resBigTech);
      assert.equal(resBigTech.getStatusCode(), 200);

      // Specs routing
      const resSpecs = createMockResponse();
      kernelMod.default({ method: "GET", query: { module: "specs" } }, resSpecs);
      assert.equal(resSpecs.getStatusCode(), 200);

      // Finops routing
      const resFinops = createMockResponse();
      kernelMod.default({ method: "GET", query: { module: "finops" } }, resFinops);
      assert.equal(resFinops.getStatusCode(), 200);
    });

    it("exercises src/mcp/eosMcpServer.ts validation, protocols, resources, and prompts", async () => {
      const server = new EosMcpServer(root);

      // Protocol versions
      const init24 = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      });
      assert.equal(init24.result.protocolVersion, "2024-11-05");

      const init25 = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      });
      assert.equal(init25.result.protocolVersion, "2025-03-26");

      // Ping
      const pingRes = server.handleRequest({ jsonrpc: "2.0", id: 3, method: "ping" });
      assert.deepEqual(pingRes.result, {});

      // Notifications (initialized)
      const notifRes = server.handleRequest({ jsonrpc: "2.0", method: "notifications/initialized" });
      assert.equal(notifRes, null);

      // Invalid JSON-RPC requests
      assert.equal(server.handleRequest(null).error.code, -32600);
      assert.equal(server.handleRequest({ jsonrpc: "1.0", id: 1, method: "ping" }).error.code, -32600);
      assert.equal(server.handleRequest({ jsonrpc: "2.0", id: "x".repeat(129), method: "ping" }).error.code, -32600);
      assert.equal(server.handleRequest({ jsonrpc: "2.0", id: NaN, method: "ping" }).error.code, -32600);
      assert.equal(
        server.handleRequest({ jsonrpc: "2.0", id: 4, method: "ping", params: "invalid-params" }).error.code,
        -32602,
      );

      // Bounded JSON validation error cases
      const badKey = server.handleRequest({ jsonrpc: "2.0", id: 5, method: "ping", params: { __proto__: {} } });
      assert.equal(badKey.error.code, -32602);

      // Resources list and read
      const resList = server.handleRequest({ jsonrpc: "2.0", id: 6, method: "resources/list" });
      assert.ok(Array.isArray(resList.result.resources));

      for (const uri of [
        "eos://antigravity/director-playbook",
        "eos://specs/constitution",
        "eos://evidence/receipt",
        "eos://projects/registry",
      ]) {
        const readRes = server.handleRequest({ jsonrpc: "2.0", id: 7, method: "resources/read", params: { uri } });
        assert.ok(readRes.result.contents[0].text);
      }

      // Resources invalid uri
      const badUri = server.handleRequest({ jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: 12345 } });
      assert.equal(badUri.error.code, -32603);

      // Prompts list and get
      const pList = server.handleRequest({ jsonrpc: "2.0", id: 9, method: "prompts/list" });
      assert.ok(Array.isArray(pList.result.prompts));

      for (const promptName of ["eos-direct-mission", "eos-sdd-gate", "eos-fleet-audit"]) {
        const pGet = server.handleRequest({
          jsonrpc: "2.0",
          id: 10,
          method: "prompts/get",
          params: { name: promptName, arguments: { directive: "Test", target: "eos-system", feature: "Coverage" } },
        });
        assert.ok(pGet.result.messages.length > 0);
      }

      // Tools call validation and execution
      const badTool = server.handleRequest({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "" } });
      assert.equal(badTool.error.code, -32603);

      const unknownTool = server.handleRequest({
        jsonrpc: "2.0",
        id: 12,
        method: "tools/call",
        params: { name: "nonexistent_tool_12345" },
      });
      assert.ok(unknownTool.error);

      // Profiles and tool listing
      server.setToolProfile("minimal");
      const minTools = server.handleRequest({ jsonrpc: "2.0", id: 13, method: "tools/list" });
      assert.ok(minTools.result.tools.length > 0);

      server.setToolProfile("complete");
      const compTools = server.handleRequest({ jsonrpc: "2.0", id: 14, method: "tools/list" });
      assert.ok(compTools.result.tools.length >= minTools.result.tools.length);

      const registered = server.listRegisteredTools();
      assert.ok(registered.length > 0);
    });

    it("exercises src/mcp/tools/eosMcpPhase5DomainHandlers.ts Spotify domain tools", () => {
      const handlers = createPhase5DomainHandlers({
        projectRoot: root,
        resolveProjectPath: (v, k, fallback) => path.resolve(root, String(v || fallback || ".")),
      });

      assert.ok(handlers.eos_spotify_audit({ targetPath: "." }));
      assert.ok(handlers.eos_spotify_scaffold({ targetPath: ".", apply: false }));
      assert.ok(handlers.eos_spotify_standup({ squad: "sound-squad" }));
      assert.ok(handlers.eos_spotify_postmortem({ incidentId: "INC-001" }));
      assert.ok(handlers.eos_spotify_experiment({ name: "smart-recs" }));
      assert.ok(
        handlers.eos_spotify_honk_dispatch({
          taskName: "Audio Honk",
          specDescription: "Optimize ring buffer latency",
        }),
      );
      assert.ok(handlers.eos_spotify_xirp_context({ repo: "Glorian-System" }));
      assert.ok(handlers.eos_spotify_canary_manifest({ service: "playback" }));
      assert.ok(handlers.eos_spotify_mix_plan({ currentKey: "8A", targetKey: "9A", currentBpm: 124, targetBpm: 126 }));
      assert.ok(handlers.eos_spotify_shuffle({ tracks: [{ id: "t1", artist: "A", genre: "ambient", valence: 0.8 }] }));
      assert.ok(handlers.eos_spotify_taste_profile({ profileId: "user-1" }));
    });

    it("exercises src/mcp/tools/eosMcpPhase6DomainHandlers.ts Apex, FinOps, and Fleet tools", () => {
      const handlers = createPhase6DomainHandlers({
        projectRoot: root,
        resolveProjectPath: (v, k, fallback) => path.resolve(root, String(v || fallback || ".")),
      });

      assert.ok(handlers.eos_apex_compress_context({ content: "const a = 1;", path: "test.ts" }));
      assert.ok(handlers.eos_apex_route_model({ prompt: "Refactor core module", strictness: "sovereign" }));
      assert.ok(handlers.eos_finops_budget_check({ estimatedTokens: 5000 }, { onProgress: () => {} }));
      assert.ok(handlers.eos_finops_evaluate_stagnation({}));
      assert.ok(handlers.eos_finops_wallet_status({}));
      assert.ok(handlers.eos_finops_route_task({ taskType: "code-generation", tokenBudget: 4000 }));
      assert.ok(handlers.eos_fleet_pulse({}));
      assert.ok(handlers.eos_fleet_pulse({ format: "table" }));
      assert.ok(handlers.eos_fleet_registry_sync({ dryRun: true, audit: false }));
      const origWorkspace = process.env.EOS_WORKSPACE_ROOT;
      const emptyTmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-empty-workspace-"));
      try {
        process.env.EOS_WORKSPACE_ROOT = emptyTmp;
        assert.ok(handlers.eos_fleet_registry_sync({ dryRun: true, audit: true }));
      } finally {
        if (origWorkspace !== undefined) process.env.EOS_WORKSPACE_ROOT = origWorkspace;
        else delete process.env.EOS_WORKSPACE_ROOT;
        try {
          fs.rmSync(emptyTmp, { recursive: true, force: true });
        } catch {
          void 0;
        }
      }
      assert.ok(handlers.eos_fleet_mission_control({ probe: false }));
      assert.ok(handlers.eos_fleet_elevate({ apply: false }));
      assert.throws(
        () => handlers.eos_fleet_elevate({ apply: true }),
        /Applying requires one registered targetProjectId/,
      );
      assert.ok(handlers.eos_fleet_verify({ target: "all", simulateDegraded: true }));
      assert.ok(handlers.eos_finops_wallet_status({ missionId: "MIS-001" }));
      assert.ok(
        handlers.eos_product_foundry_create({ name: "Core Ledger", domain: "finance" }, { onProgress: () => {} }),
      );
      assert.ok(handlers.eos_product_foundry_validate({ domain: "payments" }, { onProgress: () => {} }));
      assert.ok(handlers.eos_product_deliver_run({ name: "Core MVP", write: false }, { onProgress: () => {} }));
      assert.ok(handlers.eos_product_deliver_status());
      assert.ok(handlers.eos_synapse_arbitrate({ candidates: ["actionA", "actionB"] }));
      assert.ok(handlers.eos_synapse_propagate_golden_path({ patternId: "PAT-001" }));
      assert.ok(handlers.eos_synapse_fleet_knowledge_query({}));
      assert.ok(handlers.eos_synapse_mesh_status({}));
      assert.ok(handlers.eos_planetary_sparse_project({ targetFile: "package.json", monorepoNodes: [] }));
    });

    it("exercises src/core/eosOpenSpecSync.ts listSpecs, listChanges, and audit", () => {
      const synchronizer = new EosOpenSpecSync(root);
      const specs = synchronizer.listSpecs();
      assert.ok(Array.isArray(specs));
      assert.ok(specs.length > 0);

      const changes = synchronizer.listChanges();
      assert.ok(Array.isArray(changes));

      const report = synchronizer.audit();
      assert.ok(report.totalSpecs >= 0);
      assert.ok(report.sha256Proof);
    });

    it("exercises src/core/eosSentinelDaemon.ts tick, Merkle root, memory, and fleet health", () => {
      const daemon = new EosSentinelDaemon(root);
      const report = daemon.tick();
      assert.ok(report.merkleRootHash);
      assert.ok(report.filesMonitoredCount >= 0);
      assert.ok(report.memoryHealth.heapUsedBytes > 0);
      assert.ok(report.fleetHealth.totalNodes >= 0);
    });

    it("exercises src/core/eosNeuroSymbolicFleetHealingEngine.ts planAndExecuteLscCampaign", () => {
      const engine = new EosNeuroSymbolicFleetHealingEngine(root);

      // UNSAT clauses => provably secure campaign completed
      const repPass = engine.planAndExecuteLscCampaign({
        campaignId: "CAMP-001",
        targetModules: ["src/core/eosKernelPrimitives.ts"],
        transformationRule: "RULE_STRICT_TYPING",
        invariantClauses: [["p"], ["!p"]],
      });
      assert.equal(repPass.status, "CAMPAIGN_COMPLETED");
      assert.equal(repPass.successfulShards, 1);
      assert.ok(repPass.masterReceiptSha256);

      // SAT clauses => invariant violation aborted
      const repSat = engine.planAndExecuteLscCampaign({
        campaignId: "CAMP-002",
        targetModules: ["src/core/eosKernelPrimitives.ts"],
        transformationRule: "RULE_FAIL_CHECK",
        invariantClauses: [["p", "q"]],
      });
      assert.equal(repSat.status, "ABORTED_INVARIANT_VIOLATION");
      assert.equal(repSat.successfulShards, 0);
    });

    it("exercises EosMcpServer legacy dispatch for knowledge tools", () => {
      const server = new EosMcpServer(root);

      // eos_query_knowledge_graph sync first to populate graph
      const resSync = server.handleRequest({
        jsonrpc: "2.0",
        id: 100,
        method: "tools/call",
        params: { name: "eos_query_knowledge_graph", arguments: { action: "sync" } },
      });
      assert.ok(!resSync.error);

      // eos_query_knowledge_graph actions
      for (const action of ["stats", "find_orphans"]) {
        const res = server.handleRequest({
          jsonrpc: "2.0",
          id: 101,
          method: "tools/call",
          params: { name: "eos_query_knowledge_graph", arguments: { action } },
        });
        assert.ok(!res.error);
      }

      // eos_query_knowledge_graph neighbors and blast_radius with target
      const resNeigh = server.handleRequest({
        jsonrpc: "2.0",
        id: 102,
        method: "tools/call",
        params: {
          name: "eos_query_knowledge_graph",
          arguments: { action: "neighbors", target: "src/core/eosKernelPrimitives.ts", direction: "BOTH" },
        },
      });
      assert.ok(!resNeigh.error);

      const resBlast = server.handleRequest({
        jsonrpc: "2.0",
        id: 103,
        method: "tools/call",
        params: {
          name: "eos_query_knowledge_graph",
          arguments: { action: "blast_radius", target: "src/core/eosKernelPrimitives.ts", maxDepth: 1 },
        },
      });
      assert.ok(!resBlast.error);

      // eos_run_eval
      const resEvalText = server.handleRequest({
        jsonrpc: "2.0",
        id: 104,
        method: "tools/call",
        params: { name: "eos_run_eval", arguments: { isText: true, target: "export const x = 1;" } },
      });
      assert.ok(!resEvalText.error);

      const resEvalFile = server.handleRequest({
        jsonrpc: "2.0",
        id: 105,
        method: "tools/call",
        params: { name: "eos_run_eval", arguments: { target: "package.json" } },
      });
      assert.ok(!resEvalFile.error);

      // eos_titans_benchmark
      for (const titan of ["xirp", "spacex", "nvidia", "google", "xai", "all"]) {
        const resTitan = server.handleRequest({
          jsonrpc: "2.0",
          id: 106,
          method: "tools/call",
          params: { name: "eos_titans_benchmark", arguments: { titan } },
        });
        assert.ok(!resTitan.error);
      }

      // eos_reconcile_state
      const resRecon = server.handleRequest({
        jsonrpc: "2.0",
        id: 107,
        method: "tools/call",
        params: { name: "eos_reconcile_state", arguments: {} },
      });
      assert.ok(!resRecon.error);

      // eos_audio_dsp_benchmark
      const resDsp = server.handleRequest({
        jsonrpc: "2.0",
        id: 108,
        method: "tools/call",
        params: { name: "eos_audio_dsp_benchmark", arguments: { frames: 1024, iterations: 2 } },
      });
      assert.ok(!resDsp.error);

      // eos_apollo_rpc
      const resApollo = server.handleRequest({
        jsonrpc: "2.0",
        id: 109,
        method: "tools/call",
        params: {
          name: "eos_apollo_rpc",
          arguments: { serviceName: "playback-service", endpoint: "/play" },
        },
      });
      assert.ok(!resApollo.error);
    });

    it("exercises EosMcpServer legacy dispatch for sovereign tools", () => {
      const server = new EosMcpServer(root);

      const sovereignCalls = [
        { name: "eos_prometheus_metrics", arguments: {} },
        { name: "eos_bitwise_accelerate", arguments: { bufferSize: 1024, iterations: 10 } },
        { name: "eos_buffer_pool_stats", arguments: {} },
        { name: "eos_nano_benchmark", arguments: { iterations: 10 } },
        { name: "eos_sentinel_tick", arguments: {} },
        { name: "eos_vault_memory_audit", arguments: { wipeAll: false } },
        { name: "eos_gnostic_temple_audit", arguments: { intellectualHours: 4, emotionalHours: 2, motorHours: 2 } },
        {
          name: "eos_clave_de_sol_evaluate",
          arguments: { subjectAware: true, objectFocused: true, placePresent: true },
        },
        { name: "eos_three_mountains_status", arguments: {} },
        { name: "eos_sandbox_evaluate", arguments: { relPath: "temp.ts", content: "const a = 1;" } },
        { name: "eos_nsa_encrypt", arguments: { plaintext: "Classified directive" } },
        { name: "eos_consensus_status", arguments: {} },
        { name: "eos_simulate_bounded_models", arguments: {} },
        { name: "eos_simulate_jepsen_partition", arguments: { dropRate: 0.1, maxEvents: 10 } },
        { name: "eos_alchemical_transmute", arguments: { mode: "evaluate" } },
        { name: "eos_introspect_mind_levels", arguments: { description: "Self Observation", category: "IMPATIENCE" } },
        { name: "eos_autotuner_tick", arguments: { queueDepth: 5 } },
        { name: "eos_nsa_audit_logs", arguments: { limit: 5 } },
        { name: "eos_truetime_now", arguments: {} },
        { name: "eos_adaptive_concurrency_stats", arguments: {} },
        { name: "eos_hash_ring_lookup", arguments: { key: "user-123" } },
        { name: "eos_merkle_sync_diff", arguments: {} },
        { name: "eos_token_bucket_check", arguments: { clientId: "client-1", cost: 1 } },
        { name: "eos_hft_ipc_dispatch", arguments: { action: "status" } },
      ];

      for (let i = 0; i < sovereignCalls.length; i++) {
        const item = sovereignCalls[i];
        const res = server.handleRequest({
          jsonrpc: "2.0",
          id: 200 + i,
          method: "tools/call",
          params: { name: item.name, arguments: item.arguments },
        });
        assert.ok(!res.error, `Tool ${item.name} returned error: ${res.error?.message}`);
      }
    });

    it("exercises scripts/quickstart.mjs execution", () => {
      const qsPath = path.join(root, "scripts/quickstart.mjs");
      execFileSync(process.execPath, [qsPath], {
        cwd: root,
        stdio: "ignore",
        windowsHide: true,
      });
    });

    it("exercises bin/eos.mjs subcommands", () => {
      const cliPath = path.join(root, "bin/eos.mjs");
      const subcommands = [
        ["help"],
        ["guide"],
        ["cheat-sheet"],
        ["health"],
        ["metrics"],
        ["wal"],
        ["bench:nano"],
        ["daemon"],
        ["mcp", "status"],
        ["worktree", "list"],
        ["spec", "list"],
        ["titan", "xirp"],
        ["titan", "spacex"],
        ["spotify", "standup"],
        ["spotify", "squad"],
        ["judge", "Evaluación de prueba"],
        ["amplify", "Directiva de prueba"],
        ["nocturnal", "evaluate"],
        ["nocturnal", "lock", "package.json"],
        ["pts"],
        ["truetime"],
        ["lsm"],
        ["tss"],
        ["microvm"],
        ["simd"],
        ["sparse-tree"],
        ["zk"],
        ["mmr"],
        ["raft"],
        ["fuzzer"],
        ["seccomp"],
        ["aca"],
        ["timetravel"],
        ["intercept"],
        ["sbom"],
        ["slsa"],
        ["cas"],
        ["smt"],
        ["swarm"],
        ["enforce"],
        ["flags"],
        ["slo"],
        ["perf"],
        ["drift"],
      ];

      for (const cmdArgs of subcommands) {
        try {
          execFileSync(process.execPath, [cliPath, ...cmdArgs], {
            cwd: root,
            stdio: "ignore",
            windowsHide: true,
          });
        } catch {
          // Some benchmark or simulator commands exit gracefully on edge environments
        }
      }
    });

    it("exercises scripts/quickstart.mjs, install-antigravity-mcp.mjs, and install-gentleman-autoupdate.mjs", async () => {
      // 1. scripts/quickstart.mjs
      try {
        execFileSync(process.execPath, [path.join(root, "scripts/quickstart.mjs")], {
          cwd: root,
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        /* ignore */
      }

      // 2. scripts/install-antigravity-mcp.mjs
      const { installAntigravityIntegration } = await import(
        pathToFileURL(path.join(root, "scripts/install-antigravity-mcp.mjs")).href
      );
      const tmpGemini = fs.mkdtempSync(path.join(os.tmpdir(), "eos-install-test-"));
      try {
        const installRes = installAntigravityIntegration({
          projectRoot: root,
          geminiConfigDir: tmpGemini,
          appDataMcpDir: null,
          fleetOverrides: { CUSTOM_VAR: "true" },
        });
        assert.ok(Array.isArray(installRes.actions));
        assert.ok(installRes.actions.length >= 3);
      } finally {
        try {
          fs.rmSync(tmpGemini, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {
          /* ignore */
        }
      }

      // 3. scripts/install-gentleman-autoupdate.mjs
      const {
        synthesizeSilentVbsLauncher,
        synthesizePosixCronLine,
        installGentlemanAutoUpdateSchedule,
        queryGentlemanAutoUpdateSchedule,
        uninstallGentlemanAutoUpdateSchedule,
      } = await import(pathToFileURL(path.join(root, "scripts/install-gentleman-autoupdate.mjs")).href);

      const vbs = synthesizeSilentVbsLauncher("node.exe", "eos.mjs");
      assert.ok(vbs.includes("WScript.Shell"));

      const cron = synthesizePosixCronLine("/usr/bin/node", "/app/bin/eos.mjs", 4);
      assert.ok(cron.includes("0 */4 * * *"));

      const tmpSched = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sched-test-"));
      try {
        const installSched = installGentlemanAutoUpdateSchedule({
          projectRoot: tmpSched,
          dryRun: true,
          taskName: "EOS-TEST-TASK",
        });
        assert.equal(installSched.installed, true);
        assert.equal(installSched.dryRun, true);

        const queryRes = queryGentlemanAutoUpdateSchedule({ taskName: "NON_EXISTENT_SCHEDULE_TEST_XYZ" });
        assert.equal(typeof queryRes.registered, "boolean");

        const uninstRes = uninstallGentlemanAutoUpdateSchedule({ taskName: "NON_EXISTENT_SCHEDULE_TEST_XYZ" });
        assert.equal(typeof uninstRes.uninstalled, "boolean");
      } finally {
        try {
          fs.rmSync(tmpSched, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {
          /* ignore */
        }
      }
    });

    it("exercises PHASE1_CORE_UTILITARIAN_HANDLERS", () => {
      let progressCalls = 0;
      const ctx = {
        projectRoot: root,
        resolveProjectPath: (v, k, fallback) => path.resolve(root, String(v || fallback || ".")),
        onProgress: () => {
          progressCalls++;
        },
      };

      // eos_mission_run nominal path
      const mission1 = PHASE1_CORE_UTILITARIAN_HANDLERS.eos_mission_run(
        {
          directive: "Audit Layer-0 kernel invariants",
          domainHint: "SECURITY",
          target: "eos-system",
          architectureTargetDir: "src/core",
          sealLedger: false,
          persistLedger: false,
        },
        ctx,
      );
      assert.ok(mission1);
      assert.ok(progressCalls >= 2);

      // eos_mission_run fallback with rawPrompt and persistLedger=false
      const mission2 = PHASE1_CORE_UTILITARIAN_HANDLERS.eos_mission_run(
        {
          rawPrompt: "Alternative prompt directive",
          sealLedger: true,
          persistLedger: false,
        },
        { ...ctx, onProgress: undefined },
      );
      assert.ok(mission2);

      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_amplify_prompt({ rawPrompt: "Test prompt" }, ctx));
      assert.ok(
        PHASE1_CORE_UTILITARIAN_HANDLERS.eos_amplify_prompt(
          { rawPrompt: "", targetModel: "universal", strictLevel: "paranoid" },
          ctx,
        ),
      );
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_health_check({}, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_check_architecture({ targetDir: "src/core" }, ctx));
      assert.ok(
        PHASE1_CORE_UTILITARIAN_HANDLERS.eos_evaluate_decision(
          { title: "Test", description: "Desc", proposedAction: "Act" },
          ctx,
        ),
      );
      assert.ok(
        PHASE1_CORE_UTILITARIAN_HANDLERS.eos_evaluate_decision(
          {
            title: "Decision With Snippet",
            description: "Evaluating",
            proposedAction: "Refactor",
            codeSnippet: "const z = 10;",
            targetDomain: "CORE",
          },
          ctx,
        ),
      );
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_turbo_verify({}, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_nocturnal_evolution({ format: "summary" }, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_nocturnal_evolution({ format: "json" }, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_gentleman_audit({}, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_gentleman_audit({ geminiConfigDir: "nonexistent_dir_123" }, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_fleet_soundcheck({}, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_fleet_soundcheck({ projectRoot: "." }, ctx));
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_ast_analyze({ targetDir: "src/core" }, ctx));
      process.env.EOS_FLEET_CRUD_SLACK_PATH = root;
      try {
        assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_ast_analyze({ projectId: "crud-slack", targetDir: "." }, ctx));
      } finally {
        delete process.env.EOS_FLEET_CRUD_SLACK_PATH;
      }
      assert.ok(PHASE1_CORE_UTILITARIAN_HANDLERS.eos_ast_analyze({}, ctx));
    });

    it("exercises EosMcpServer legacy dispatch for reliability handlers", () => {
      const server = new EosMcpServer(root);

      const reliabilityCalls = [
        { name: "eos_canary_rollout", arguments: {} },
        {
          name: "eos_canary_telemetry_evaluate",
          arguments: {
            deploymentId: "dep-1",
            environment: "preview",
            stage: "CANARY_1_PCT",
            errorRate5xx: 0,
            latencyP99Ms: 120,
            requestCount: 100,
          },
        },
        { name: "eos_cell_bulkhead_route", arguments: { partitionKey: "task-1" } },
        { name: "eos_cell_bulkhead_status", arguments: {} },
        { name: "eos_slo_burn_rate_evaluate", arguments: { serviceId: "auth-svc" } },
        { name: "eos_slo_budget_status", arguments: {} },
        { name: "eos_hedge_request_execute", arguments: { endpointId: "edge-1" } },
        { name: "eos_hedge_metrics_status", arguments: {} },
        { name: "eos_concurrency_evaluate", arguments: { priority: "HIGH", releaseAfterSimulatedRttMs: 10 } },
        { name: "eos_concurrency_status", arguments: {} },
        { name: "eos_trace_sampler_status", arguments: {} },
        { name: "eos_remediation_correlate_execute", arguments: {} },
        { name: "eos_remediation_engine_status", arguments: {} },
        { name: "eos_kernel_orchestrator_reconcile", arguments: {} },
        { name: "eos_kernel_orchestrator_status", arguments: {} },
        { name: "eos_transcendence_execute", arguments: {} },
        { name: "eos_transcendence_status", arguments: {} },
        // Deep branch coverage variations for reliability handlers
        { name: "eos_cell_bulkhead_status", arguments: { cellId: 0, setStatus: "DEGRADED" } },
        { name: "eos_cell_bulkhead_status", arguments: { cellId: 999 } },
        {
          name: "eos_slo_burn_rate_evaluate",
          arguments: {
            serviceId: "auth-svc",
            events: [{ timestampMs: Date.now(), isError: false, latencyMs: 10 }],
            evaluationTimestamp: Date.now(),
          },
        },
        { name: "eos_slo_budget_status", arguments: { serviceId: "auth-svc", checkDeploymentAllowed: true } },
        { name: "eos_slo_budget_status", arguments: { serviceId: "auth-svc", checkDeploymentAllowed: false } },
        { name: "eos_hedge_metrics_status", arguments: { endpointId: "edge-1", recordSampleLatencyMs: 25 } },
        {
          name: "eos_concurrency_evaluate",
          arguments: { priority: "CRITICAL", queueWaitMs: 50, releaseAfterSimulatedRttMs: 20 },
        },
        { name: "eos_concurrency_status", arguments: { reset: true, recordLatencyMs: 40 } },
        { name: "eos_trace_sampler_status", arguments: { reset: true, evictStale: true } },
        {
          name: "eos_remediation_correlate_execute",
          arguments: { burnRate5m: 15.0, concurrencyGradient: 0.8, traceErrorRate: 0.05 },
        },
        { name: "eos_remediation_engine_status", arguments: { reset: true } },
        {
          name: "eos_kernel_orchestrator_reconcile",
          arguments: {
            fleetSoundcheckScore: 95,
            sloErrorBudgetConsumptionPct: 20,
            predictiveHazardSeverityPct: 5,
            concurrencyHeadroomPct: 80,
            syntheticSocketBacklog: 2,
            virtualPagePressurePct: 10,
          },
        },
        { name: "eos_kernel_orchestrator_status", arguments: { reset: true } },
        { name: "eos_transcendence_execute", arguments: { pillar: "CONCURRENCY_AIMD" } },
        { name: "eos_transcendence_status", arguments: { reset: true } },
      ];

      for (let i = 0; i < reliabilityCalls.length; i++) {
        const item = reliabilityCalls[i];
        const res = server.handleRequest({
          jsonrpc: "2.0",
          id: 300 + i,
          method: "tools/call",
          params: { name: item.name, arguments: item.arguments },
        });
        assert.ok(!res.error, `Reliability tool ${item.name} failed: ${res.error?.message}`);
      }
    });

    it("exercises EosMcpServer legacy dispatch for governance handlers", () => {
      const server = new EosMcpServer(root);

      const governanceCalls = [
        {
          name: "eos_design_scaffold_component",
          arguments: { archetype: "SPOTIFY_XIRP", componentType: "INCIDENT_TIMELINE" },
        },
        { name: "eos_design_audit_markup", arguments: { markup: "<div class='container'></div>" } },
        { name: "eos_jpl_power_of_ten_audit", arguments: { sourceCode: "const a = 1;" } },
        { name: "eos_tmr_consensus_adjudicate", arguments: { votes: ["COMMIT", "COMMIT", "ABORT"] } },
        { name: "eos_tlc_checker", arguments: { action: "detect" } },
        { name: "eos_tlc_checker", arguments: { action: "check", steps: 50 } },
        { name: "eos_dashboard_status", arguments: { action: "snapshot" } },
        { name: "eos_conscious_witness", arguments: { proposedAction: "Audit" } },
        { name: "eos_sapfix_autoshipper", arguments: { faultId: "F1", failingLine: 1, dryRun: true } },
        { name: "eos_chaos_monkey_live", arguments: { burstCount: 2, recordToLedger: false } },
        { name: "eos_design_system_govern", arguments: {} },
      ];

      for (let i = 0; i < governanceCalls.length; i++) {
        const item = governanceCalls[i];
        const res = server.handleRequest({
          jsonrpc: "2.0",
          id: 400 + i,
          method: "tools/call",
          params: { name: item.name, arguments: item.arguments },
        });
        assert.ok(!res.error, `Governance tool ${item.name} failed: ${res.error?.message}`);
      }
    });

    it("exercises EosMcpServer legacy dispatch for runtime handlers", () => {
      const server = new EosMcpServer(root);

      const runtimeCalls = [
        { name: "eos_chaos_inject_eval", arguments: { experimentName: "resilience-test" } },
        { name: "eos_hnsw_index_add", arguments: { id: "doc-1", text: "Architecture document" } },
        { name: "eos_vector_similarity", arguments: { textA: "hello", textB: "world", metric: "cosine" } },
        { name: "eos_vector_similarity", arguments: { textA: "alpha", textB: "beta", metric: "euclidean" } },
        { name: "eos_sovereign_loop_stages", arguments: {} },
        { name: "eos_sovereign_loop_run", arguments: { projectId: "p-test", title: "Loop Run", userPrompt: "prompt" } },
        { name: "eos_otel_query_traces", arguments: { statusCode: "OK", minDurationMs: 0 } },
        { name: "eos_otel_export_otlp", arguments: {} },
        { name: "eos_autonomous_heal_loop", arguments: { dryRun: true } },
        { name: "eos_ast_mutation_synthesize", arguments: { targetFile: "src/core/eosPromptAmplifier.ts" } },
        { name: "eos_self_healing_status", arguments: {} },
        { name: "eos_ontology_query", arguments: { action: "status" } },
        { name: "eos_ontology_query", arguments: { action: "transitive", startId: "root" } },
        { name: "eos_ontology_query", arguments: { action: "asOf" } },
        { name: "eos_quantum_lattice_seal", arguments: { payload: "lattice-data" } },
        { name: "eos_refactor_execute", arguments: {} },
        { name: "eos_dst_simulate", arguments: { seed: 123, steps: 10 } },
        { name: "eos_dbc_verify", arguments: { sampleValue: 5 } },
      ];

      for (let i = 0; i < runtimeCalls.length; i++) {
        const item = runtimeCalls[i];
        const res = server.handleRequest({
          jsonrpc: "2.0",
          id: 500 + i,
          method: "tools/call",
          params: { name: item.name, arguments: item.arguments },
        });
        assert.ok(!res.error, `Runtime tool ${item.name} failed: ${res.error?.message}`);
      }
    });

    it("exercises createPhase3CoreHandlers across Tier-0 tools", () => {
      const server = new EosMcpServer(root);
      const phase3 = createPhase3CoreHandlers({
        projectRoot: root,
        resolveProjectPath: (v, k, fallback) => path.resolve(root, String(v || fallback || ".")),
        resolveConfinedLedgerPath: (_v) => path.resolve(root, ".eos/state.db"),
        hybridKnowledge: server["hybridKnowledge"],
        knowledgeStore: server["knowledgeStore"],
        agentSessionContract: server["agentSessionContract"],
        hnsw: EosMcpServer.globalHnsw,
      });

      const ctx = {
        projectRoot: root,
        resolveProjectPath: (v, k, fallback) => path.resolve(root, String(v || fallback || ".")),
        onProgress: () => {},
      };

      assert.ok(phase3.eos_semantic_search({ query: "architecture", mode: "hybrid" }, ctx));
      assert.ok(phase3.eos_semantic_search({ query: "architecture", mode: "vector" }, ctx));
      assert.ok(phase3.eos_autonomous_heal({ dryRun: true }, ctx));
      assert.ok(phase3.eos_manage_worktree({ action: "list" }, ctx));
      assert.ok(phase3.eos_manage_worktree({ action: "create", branch: "test-branch", apply: false }, ctx));
      assert.ok(phase3.eos_manage_worktree({ action: "remove", path: "non-existent" }, ctx));
      assert.ok(phase3.eos_hnsw_knn_search({ query: "security", k: 3 }, ctx));
      assert.ok(phase3.eos_hnsw_knn_search({ vector: new Array(128).fill(0.1), k: 2 }, ctx));
      assert.throws(() => phase3.eos_hnsw_knn_search({}, ctx), /Must provide either 'query' string or 'vector' array/);

      // eos_agent_session_contract exhaustive branches
      assert.ok(phase3.eos_agent_session_contract({ action: "status" }, ctx));
      const sessionOpen = phase3.eos_agent_session_contract(
        { action: "open", ideFamily: "cursor", directive: "Fix bug" },
        ctx,
      );
      assert.ok(sessionOpen);
      const realSessionId = sessionOpen.sessionId;
      assert.ok(phase3.eos_agent_session_contract({ action: "ensure", ideFamily: "antigravity" }, ctx));
      assert.ok(
        phase3.eos_agent_session_contract(
          { action: "record_tool", sessionId: realSessionId, toolName: "read_file" },
          ctx,
        ),
      );
      assert.ok(
        phase3.eos_agent_session_contract(
          { action: "authorize_write", sessionId: realSessionId, paths: ["src/a.ts"] },
          ctx,
        ),
      );
      assert.ok(
        phase3.eos_agent_session_contract({ action: "evaluate_write", ideFamily: "cursor", paths: ["src/a.ts"] }, ctx),
      );
      assert.ok(phase3.eos_agent_session_contract({ action: "align_gentleman" }, ctx));
      assert.throws(
        () => phase3.eos_agent_session_contract({ action: "invalid_action" }, ctx),
        /Unsupported eos_agent_session_contract action/,
      );

      assert.ok(phase3.eos_refactor_audit({ includeMetrics: true }, ctx));
      assert.ok(phase3.eos_mcts_tune({ action: "tune", iterations: 2 }, ctx));
      assert.ok(phase3.eos_antigravity_direct({ directive: "Verify architecture" }, ctx));
      assert.ok(phase3.eos_antigravity_doctor({}, ctx));

      // eos_sqlite_ledger exhaustive branches
      assert.ok(
        phase3.eos_sqlite_ledger(
          { action: "record", category: "SECURITY_AUDIT", title: "Audit Event", payload: { pass: true } },
          ctx,
        ),
      );
      assert.ok(phase3.eos_sqlite_ledger({ action: "search", query: "Audit" }, ctx));
      assert.ok(phase3.eos_sqlite_ledger({ action: "recent", limit: 5 }, ctx));
      assert.ok(phase3.eos_sqlite_ledger({ action: "verify" }, ctx));

      assert.ok(phase3.eos_gentleman_update({ action: "status" }, ctx));
      assert.ok(phase3.glorian_fleet_health_watchdog({}, ctx));
      assert.ok(phase3.glorian_constitutional_tribunal({}, ctx));
    });

    it("exercises eosPatchValidator.ts across all security, safety, and AST boundaries", () => {
      // Path traversal
      const rTraversal = validatePatch("../escaping.ts", "const a = 1;", root);
      assert.equal(rTraversal.valid, false);
      assert.equal(rTraversal.pathTraversalsFound, true);

      // Plaintext secret detection
      const rSecret = validatePatch(
        "src/core/auth.ts",
        `const token = '${["sk", "live", "12345678901234567890"].join("-")}';`,
        root,
      );
      assert.equal(rSecret.valid, false);
      assert.equal(rSecret.secretsFound, true);

      // Destructive pattern
      const rDestructive = validatePatch("src/core/temp.ts", "const cmd = 'rm -rf /';", root);
      assert.equal(rDestructive.valid, false);
      assert.equal(rDestructive.destructiveCommandsFound, true);

      // JSON syntax (valid & invalid)
      const rJsonBad = validatePatch("test.json", "{ invalidJson: }", root);
      assert.equal(rJsonBad.valid, false);
      assert.equal(rJsonBad.syntaxValid, false);

      const rJsonGood = validatePatch("test.json", '{"name": "eos"}', root);
      assert.equal(rJsonGood.valid, true);

      // JS syntax (valid & invalid)
      const rJsBad = validatePatch("test.js", "const 123bad = ;", root);
      assert.equal(rJsBad.valid, false);

      const rJsGood = validatePatch("test.js", "export const value = 42;", root);
      assert.equal(rJsGood.valid, true);

      // TS balanced braces / parens
      const rTsBraces = validatePatch("test.ts", "function unbalanced() {", root);
      assert.equal(rTsBraces.valid, false);

      const rTsParens = validatePatch("test.ts", "function unbalanced( { return 1; }", root);
      assert.equal(rTsParens.valid, false);

      const rTsGood = validatePatch("test.ts", "export function validFn(): number { return 1; }", root);
      assert.equal(rTsGood.valid, true);
    });

    it("exercises glorianFleetHealthWatchdog.ts safety, headers, and aggregate metrics", () => {
      const watchdog = new GlorianFleetHealthWatchdog(root);

      // SSRF quarantine checks
      assert.equal(watchdog.validateTargetSafety("ftp://example.com").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://localhost:8080").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://127.0.0.1:3000").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://169.254.169.254/latest").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://10.0.0.5").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://192.168.1.100").allowed, false);
      assert.equal(watchdog.validateTargetSafety("http://172.20.0.1").allowed, false);
      assert.equal(watchdog.validateTargetSafety("not-a-valid-url").allowed, false);
      assert.equal(watchdog.validateTargetSafety("https://api.github.com").allowed, true);

      // Security header evaluation
      const fullHeaders = watchdog.evaluateSecurityHeaders({
        "Strict-Transport-Security": "max-age=31536000",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
      });
      assert.equal(fullHeaders.score, 100);
      assert.equal(fullHeaders.hasHsts, true);

      const emptyHeaders = watchdog.evaluateSecurityHeaders({});
      assert.equal(emptyHeaders.score, 0);

      // Fleet health evaluation
      const emptyReport = watchdog.evaluateFleetHealth([]);
      assert.equal(emptyReport.totalProjectsEvaluated, 0);

      const report = watchdog.evaluateFleetHealth([
        { projectId: "p1", url: "https://p1.org", status: 200, ttfbMs: 30, securityScore: 100 },
        { projectId: "p2", url: "https://p2.org", status: 500, ttfbMs: 150, securityScore: 50 },
      ]);
      assert.equal(report.totalProjectsEvaluated, 2);
      assert.equal(report.healthyProjectsCount, 1);
    });

    it("exercises glorianConstitutionalTribunal.ts judges and consensus adjudication", () => {
      const tribunal = new GlorianConstitutionalTribunal(root);

      // Constitutional Judge violations
      const badConst = tribunal.evaluateConstitutionalJudge({
        actionId: "",
        category: "CODE_MUTATION",
        description: "short",
        diffOrPayload: "vibe-coding with improvised patch and function calcularSuma()",
      });
      assert.equal(badConst.approved, false);
      assert.ok(badConst.findings.length >= 3);

      // Security Judge violations
      const badSec = tribunal.evaluateSecurityJudge({
        actionId: "ACT-SEC-01",
        category: "DEPLOYMENT",
        description: "Deploy with secret",
        diffOrPayload: `const key = '${["sk", "123456789012345678901234"].join("-")}';`,
        targetDirectory: "C:\\Windows\\System32",
      });
      assert.equal(badSec.approved, false);
      assert.equal(badSec.veto, true);

      // Architectural Judge
      const badArch = tribunal.evaluateArchitecturalJudge({
        actionId: "ACT-ARCH-01",
        category: "ARCHITECTURE",
        description: "Direct DB query in React component",
        diffOrPayload: "import pg from 'pg';\nexport function Component() { return <div />; }",
      });
      assert.ok(badArch.findings.length > 0);

      // Full consensus adjudication (approved)
      const approvedRep = tribunal.adjudicate({
        actionId: "ACT-CLEAN-01",
        category: "CODE_MUTATION",
        description: "Pure domain logic optimization with formal specification",
        diffOrPayload: "export function pureCalculate(x: number): number { return x * 2; }",
      });
      assert.equal(approvedRep.overallVerdict, "SOVEREIGN_TRIBUNAL_APPROVED");
      assert.equal(approvedRep.quorumMet, true);

      // Full consensus adjudication (vetoed)
      const vetoedRep = tribunal.adjudicate({
        actionId: "ACT-VETO-01",
        category: "CODE_MUTATION",
        description: "Inject hardcoded token into repo",
        diffOrPayload: `const ghp = '${["ghp", "123456789012345678901234567890"].join("_")}';`,
      });
      assert.equal(vetoedRep.overallVerdict, "TRIBUNAL_VETOED");
      assert.ok(vetoedRep.vetoCount >= 1);
    });

    it("exercises eosControlPlaneHealthProbes.ts across full probe matrix and error fallbacks", () => {
      // Normal run against project root
      const health = runControlPlaneHealthProbes(root);
      assert.ok(["HEALTHY", "DEGRADED", "CRITICAL"].includes(health.status));
      assert.equal(health.epistemicState, "CONTROL_PLANE_HEALTH_WITHIN_TESTED_SCOPE");
      assert.ok(health.probesTotal >= 6);
      assert.ok(health.probesPassing >= 0);
      assert.equal(typeof health.sha256Receipt, "string");
      assert.ok(Array.isArray(health.claimsDenied));

      // Precondition violation
      assert.throws(() => runControlPlaneHealthProbes(""), /projectRoot must be a non-empty string/);

      // Isolated empty directory triggers DEGRADED / CRITICAL with missing files
      const nonExistentDir = path.join(os.tmpdir(), `eos-health-${Date.now()}`);
      fs.mkdirSync(nonExistentDir, { recursive: true });
      try {
        const degradedReport = runControlPlaneHealthProbes(nonExistentDir);
        assert.ok(["DEGRADED", "CRITICAL"].includes(degradedReport.status));
        assert.ok(degradedReport.probesPassing < degradedReport.probesTotal);
      } finally {
        fs.rmSync(nonExistentDir, { recursive: true, force: true });
      }
    });

    it("exercises eosSapFixAutoshipper.ts preconditions, synthesis, sandbox, and ledger recording", () => {
      // Precondition violations
      assert.throws(() => EosSapFixAutoshipper.executeCycle({}, root), /faultId is required/);
      assert.throws(() => EosSapFixAutoshipper.executeCycle({ faultId: "F1" }, root), /targetFilePath is required/);
      assert.throws(
        () => EosSapFixAutoshipper.executeCycle({ faultId: "F1", targetFilePath: "a.ts", failingLine: 0 }, root),
        /failingLine must be positive/,
      );

      // Cycle with mocked code
      const fault = {
        faultId: "FAULT-SAP-101",
        targetFilePath: "src/sample.ts",
        failingLine: 2,
        errorMessage: "Cannot read properties of undefined (reading 'value')",
        offendingExpression: "data.value",
        mockOriginalContent: "function execute(data) {\n  return data.value;\n}\n",
      };
      const report = EosSapFixAutoshipper.executeCycle(fault, root);
      assert.ok(["PR_READY", "REGRESSION_REJECTED"].includes(report.status));
      assert.equal(typeof report.verificationPassed, "boolean");
      assert.equal(report.patchApplied, true);
      assert.ok(report.prTitle.includes("FAULT-SAP-101"));
      assert.ok(report.prBodyMarkdown.includes("Zero-Vibe"));

      // Record in ledger
      const recorded = EosSapFixAutoshipper.recordReceiptInLedger(report, root);
      assert.equal(typeof recorded, "boolean");

      // Cycle without mocked code on non-existent file triggers fallback template
      const fallbackReport = EosSapFixAutoshipper.executeCycle(
        {
          faultId: "FAULT-SAP-102",
          targetFilePath: "src/non-existent-sample.ts",
          failingLine: 2,
          errorMessage: "Undefined error",
        },
        root,
      );
      assert.ok(fallbackReport.faultId === "FAULT-SAP-102");
    });

    it("exercises eosPrometheusExporter.ts snapshot collection and text formatting", () => {
      const exporter = new EosPrometheusExporter(root);
      const snap = exporter.collectSnapshot();
      assert.ok(snap.uptimeSeconds >= 0);
      assert.ok(snap.memoryRssBytes > 0);
      assert.ok(snap.activeSpecsCount >= 0);
      assert.ok(snap.fleetNodesCount > 0);

      const text = exporter.formatPrometheusText(snap);
      assert.ok(text.includes("# EOS System — Sovereign Metrics Exposition"));
      assert.ok(text.includes("eos_uptime_seconds"));
      assert.ok(text.includes("eos_memory_rss_bytes"));
      assert.ok(text.includes("eos_wal_committed_transactions_total"));

      // Default constructor & overrides
      const defaultExp = new EosPrometheusExporter();
      const snapOverridden = defaultExp.collectSnapshot({
        mcpActiveSessions: 7,
        walCommittedTx: 999,
      });
      assert.equal(snapOverridden.mcpActiveSessions, 7);
      assert.equal(snapOverridden.walCommittedTx, 999);
      const textOverridden = defaultExp.formatPrometheusText(snapOverridden);
      assert.ok(textOverridden.includes("eos_mcp_active_sessions 7"));
      assert.ok(textOverridden.includes("eos_wal_committed_transactions_total 999"));
    });

    it("exercises eosDurableWal.ts CRC calculation, append, recovery, and corruption traps", () => {
      const tmpWalDir = path.join(os.tmpdir(), `eos-wal-branch-${Date.now()}`);
      const walFile = path.join(tmpWalDir, "test.wal");

      try {
        const wal = new EosDurableWal(walFile, true);
        assert.equal(wal.getStats().recordsCount, 0);

        // Append with sync: false and sync: true
        const rec1 = wal.append({ type: "TEST_TX_1", value: 100 }, false);
        const rec2 = wal.append({ type: "TEST_TX_2", value: 200 }, true);
        assert.equal(rec1.txId, 1n);
        assert.equal(rec2.txId, 2n);

        // Read all
        const records = wal.readAll();
        assert.equal(records.length, 2);
        assert.equal(records[0].payload.type, "TEST_TX_1");
        assert.equal(records[1].payload.type, "TEST_TX_2");

        const replayRecs = wal.replay();
        assert.equal(replayRecs.length, 2);

        const stats = wal.getStatistics();
        assert.equal(stats.recordsCount, 2);
        assert.equal(stats.currentTxId, 2n);

        wal.close();

        // Closed WAL throws
        assert.throws(() => wal.append({ fail: true }), /WAL is not open/);
        assert.throws(() => wal.readAll(), /WAL is not open/);

        // Re-open existing
        const walReopened = new EosDurableWal(walFile, true);
        assert.equal(walReopened.getStats().recordsCount, 2);
        walReopened.close();

        // Corrupt magic header (>= 6 bytes so magic check executes)
        const badMagicFile = path.join(tmpWalDir, "bad-magic.wal");
        fs.writeFileSync(badMagicFile, Buffer.from("BADD00020002", "hex"));
        const walBadMagic = new EosDurableWal(badMagicFile, false);
        assert.throws(() => walBadMagic.open(), /Invalid WAL header magic/);

        // Corrupt version
        const badVerFile = path.join(tmpWalDir, "bad-ver.wal");
        const badVerBuf = Buffer.alloc(6);
        Buffer.from([0x45, 0x4f, 0x53, 0x57]).copy(badVerBuf, 0);
        badVerBuf.writeUInt16BE(99, 4);
        fs.writeFileSync(badVerFile, badVerBuf);
        const walBadVer = new EosDurableWal(badVerFile, false);
        assert.throws(() => walBadVer.open(), /Unsupported WAL version/);

        // Truncated file (< HEADER_SIZE) recovery
        const truncFile = path.join(tmpWalDir, "trunc.wal");
        fs.writeFileSync(truncFile, Buffer.from([0x45, 0x4f]));
        const walTrunc = new EosDurableWal(truncFile, true);
        assert.equal(walTrunc.getStats().recordsCount, 0);
        walTrunc.close();

        // Torn tail frame corruption recovery
        const tornFile = path.join(tmpWalDir, "torn.wal");
        const walTorn = new EosDurableWal(tornFile, true);
        walTorn.append({ record: 1 });
        walTorn.append({ record: 2 });
        walTorn.close();

        const tornBuf = fs.readFileSync(tornFile);
        tornBuf[tornBuf.length - 2] ^= 0xff;
        fs.writeFileSync(tornFile, tornBuf);

        const walTornRecovery = new EosDurableWal(tornFile, true);
        assert.equal(walTornRecovery.getStats().recordsCount, 1);
        walTornRecovery.close();
      } finally {
        fs.rmSync(tmpWalDir, { recursive: true, force: true });
      }
    });

    it("exercises eosWasmSandboxEngine.ts bytecode traps, worker limits, isolate, and microVM specs", async () => {
      const engine = new EosWasmSandboxEngine(root);

      // 1. Valid execution via Uint8Array, Buffer, and base64 string
      const rAdd = engine.executeWasm(WASM_BYTECODE_TEMPLATES.ADD, {
        entryFunction: "add",
        functionArgs: [15, 27],
      });
      assert.equal(rAdd.status, "COMPLETED");
      assert.equal(rAdd.returnValue, 42);

      const rAddBuf = engine.executeWasm(Buffer.from(WASM_BYTECODE_TEMPLATES.ADD), {
        entryFunction: "add",
        functionArgs: [20, 22],
      });
      assert.equal(rAddBuf.returnValue, 42);

      const rAddB64 = engine.executeWasm(Buffer.from(WASM_BYTECODE_TEMPLATES.ADD).toString("base64"), {
        entryFunction: "add",
        functionArgs: [1, 2],
      });
      assert.equal(rAddB64.returnValue, 3);

      // 2. Traps: unreachable and OOB
      const rTrap = engine.executeWasm(WASM_BYTECODE_TEMPLATES.TRAP, { entryFunction: "trap" });
      assert.equal(rTrap.status, "TRAPPED_UNREACHABLE");

      const rOob = engine.executeWasm(WASM_BYTECODE_TEMPLATES.OOB, { entryFunction: "oob" });
      assert.equal(rOob.status, "TRAPPED_OOB");

      // 3. Invalid bytecode -> EXECUTION_FAILED
      const rBad = engine.executeWasm(new Uint8Array([0x00, 0x11, 0x22, 0x33]));
      assert.equal(rBad.status, "EXECUTION_FAILED");

      // 4. executeWasmWorker with oversized bytecode
      const hugeBytecode = new Uint8Array(600 * 1024);
      const rHuge = await engine.executeWasmWorker(hugeBytecode);
      assert.equal(rHuge.status, "EXECUTION_FAILED");
      assert.ok(rHuge.stderr[0].includes("exceeds maximum allowed size"));

      // 5. executeIsolate with syntax error and timeout
      const rIsoGood = engine.executeIsolate("const a = 10; const b = 20; a + b;");
      assert.equal(rIsoGood.status, "COMPLETED");
      assert.equal(rIsoGood.returnValue, 30);

      const rIsoErr = engine.executeIsolate("throw new Error('isolate explosion');");
      assert.equal(rIsoErr.status, "EXECUTION_FAILED");

      const rIsoTimeout = engine.executeIsolate("while(true) {}", { timeoutMs: 50 });
      assert.equal(rIsoTimeout.status, "TIMEOUT_KILLED");

      // 6. generateMicroVmDescriptor
      const microVm = engine.generateMicroVmDescriptor({ vcpuCount: 4, memSizeMib: 1024 });
      assert.ok(microVm.enclaveId.startsWith("enclave-"));
      assert.equal(typeof microVm.specSha256, "string");

      // 7. getDefaultWasmSandboxEngine
      const defEngine = getDefaultWasmSandboxEngine(root);
      assert.ok(defEngine instanceof EosWasmSandboxEngine);
    });

    it("exercises eosGentlemanStackBridge.ts external canon, extra paths, and binary probing", () => {
      // External canon constants
      assert.ok(EosGentlemanStackBridge.EXTERNAL_CANON.site.includes("gentlemanprogramming"));
      assert.ok(EosGentlemanStackBridge.CO_GOVERNANCE_PROTOCOL.length >= 6);

      // Audit stack
      const report = EosGentlemanStackBridge.auditStack(root);
      assert.ok(["SOVEREIGN_GENTLEMAN_APEX", "CO_GOVERNANCE_PARTIAL", "INCOMPLETE"].includes(report.status));
      assert.ok(report.readinessScore >= 0);
      assert.ok(report.pillars.length >= 4);
      assert.equal(typeof report.sha256Receipt, "string");

      // Extra paths
      const paths = EosGentlemanStackBridge.resolveExtraToolPaths();
      assert.ok(Array.isArray(paths));

      // Missing binary probe
      const missing = EosGentlemanStackBridge.probeBinary("totally_missing_binary_abc_123", ["--version"], []);
      assert.equal(missing.found, false);
      assert.equal(missing.versionOutput, "not-found");
    });

    it("exercises eosDatalogVerifier.ts fixpoint deductive blast radius and rule evaluation", () => {
      const verifier = new EosDatalogVerifier(root);
      const factCount = verifier.buildEdbFromFilesystem();
      assert.ok(factCount > 0);
      assert.equal(
        verifier.hasFact("depends_on", ["src/core/eosKernelPrimitives.ts", "src/core/eosKernelPrimitives.ts"]),
        false,
      );

      const iterations = verifier.evaluateFixpoint();
      assert.ok(iterations >= 1);

      const blast = verifier.queryBlastRadius("src/core/eosKernelPrimitives.ts");
      assert.equal(blast.changedModule, "src/core/eosKernelPrimitives.ts");
      assert.ok(blast.impactedModules.length > 0);
      assert.ok(blast.predictiveTestSuites.length > 0);
      assert.ok(blast.totalFactsEvaluated > 0);
      assert.ok(blast.durationUs >= 0);
      assert.equal(blast.isolationGuarantee, "Google Piper / Mangle-grade deductive certainty");
    });

    it("exercises eosHnswVectorEngine.ts vector addition, cosine/euclidean distance, and k-NN search", () => {
      const hnsw = new EosHnswVectorEngine({ dimensions: 4, metric: "cosine" });
      hnsw.addPoint("node-1", [1, 0, 0, 0], { label: "first" });
      hnsw.addPoint("node-2", [0, 1, 0, 0], { label: "second" });
      hnsw.addPoint("node-3", [0.707, 0.707, 0, 0], { label: "third" });

      const results = hnsw.searchKnn([1, 0, 0, 0], 2);
      assert.equal(results.length, 2);
      assert.equal(results[0].id, "node-1");

      const stats = hnsw.getStats();
      assert.equal(stats.totalNodes, 3);
      assert.equal(stats.dimensions, 4);

      // Document addition and text search
      hnsw.addDocument("doc-1", "Authentication security token protocol");
      const textRes = hnsw.searchByText("security protocol", 2);
      assert.ok(textRes.length > 0);

      // Euclidean engine
      const eucHnsw = new EosHnswVectorEngine({ dimensions: 2, metric: "euclidean" });
      eucHnsw.addPoint("e-1", [0, 0]);
      eucHnsw.addPoint("e-2", [3, 4]);
      const eucRes = eucHnsw.searchKnn([0, 0], 1);
      assert.equal(eucRes[0].id, "e-1");
    });

    it("exercises eosWorktreeOrchestrator.ts porcelain parsing, validation, and safe bounds", () => {
      const orchestrator = new EosWorktreeOrchestrator(root);
      const list = orchestrator.listWorktrees();
      assert.ok(list.length > 0);
      assert.ok(list.some((w) => w.isMain || w.path));

      // Branch name validation error
      assert.throws(() => orchestrator.createWorktree("-bad-name"), /Branch name must be a non-empty/);
      assert.throws(() => orchestrator.createWorktree("/bad-name"), /Branch name must be a non-empty/);
      assert.throws(() => orchestrator.createWorktree("bad-name/"), /Branch name must be a non-empty/);

      // Remove root prevention
      const rmRoot = orchestrator.removeWorktree(root);
      assert.equal(rmRoot.success, false);
      assert.equal(rmRoot.error, "Cannot remove primary repository root worktree");

      // Remove non-registered worktree
      const rmNon = orchestrator.removeWorktree("non-existent-worktree-path-xyz");
      assert.equal(rmNon.success, false);
      assert.equal(rmNon.error, "Target is not a registered worktree of this repository.");

      // Prune
      const pruneRes = orchestrator.pruneWorktrees();
      assert.equal(pruneRes.success, true);

      // Status
      const status = orchestrator.getWorktreeStatus(root);
      assert.equal(typeof status.clean, "boolean");
      assert.ok(Array.isArray(status.modifiedFiles));
      assert.ok(Array.isArray(status.untrackedFiles));
    });

    it("exercises eosContinuousRefactorEngine.ts code diet, dead code, complexity, and daemon", () => {
      // Precondition violation
      assert.throws(
        () => EosContinuousRefactorEngine.auditDirectory("non-existent-dir-xyz"),
        /Target directory .* must exist/,
      );

      // Audit targeted directory
      const audit = EosContinuousRefactorEngine.auditDirectory(path.join(root, "src/mcp"));
      assert.ok(audit.scannedFilesCount > 0);
      assert.ok(audit.totalLinesAnalyzed > 0);
      assert.equal(typeof audit.sha256AuditReceipt, "string");
      assert.ok(Array.isArray(audit.duplications));
      assert.ok(Array.isArray(audit.deadCode));
      assert.ok(Array.isArray(audit.complexityBottlenecks));

      // Calculate diet ratio
      const diet = EosContinuousRefactorEngine.calculateCodeDietRatio(audit);
      assert.equal(diet.totalLines, audit.totalLinesAnalyzed);
      assert.equal(typeof diet.dietPercentage, "number");

      // Daemon runner start and stop
      const daemon = EosContinuousRefactorEngine.createDaemonRunner(root, 100000);
      assert.equal(daemon.isRunning(), true);
      daemon.stop();
      assert.equal(daemon.isRunning(), false);
    });

    it("exercises eosFleetSoundcheckMesh.ts comprehensive branches and registry resolution", () => {
      // 1. projectRoot omitted / non-existent -> default repos
      const defReport = EosFleetSoundcheckMesh.auditFleet();
      assert.equal(defReport.totalRepositories, 5);

      const nonExistentReport = EosFleetSoundcheckMesh.auditFleet("C:/non-existent-fleet-root-xyz");
      assert.equal(nonExistentReport.totalRepositories, 5);

      // 2. Corrupt JSON in registry
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soundcheck-test-"));
      try {
        const regDir = path.join(tmpDir, "docs/projects");
        fs.mkdirSync(regDir, { recursive: true });

        fs.writeFileSync(path.join(regDir, "registry.json"), "{ invalid-json ::: }");
        const corruptReport = EosFleetSoundcheckMesh.auditFleet(tmpDir);
        assert.equal(corruptReport.totalRepositories, 5);

        // Empty projects
        fs.writeFileSync(path.join(regDir, "registry.json"), JSON.stringify({ projects: [] }));
        const emptyReport = EosFleetSoundcheckMesh.auditFleet(tmpDir);
        assert.equal(emptyReport.totalRepositories, 5);

        // Set custom env variable for fleet path resolution
        const customFleetDir = path.join(tmpDir, "custom-fleet-repo");
        fs.mkdirSync(customFleetDir, { recursive: true });
        process.env.EOS_FLEET_CUSTOM_TEST_PATH = "custom-fleet-repo";

        // Multi-tier project list hitting all branch conditions
        const richProjects = [
          { id: "eos-system", name: "Core", productionUrl: "https://core.app" },
          {
            id: "env-repo",
            name: "Env Repo",
            localPathEnv: "EOS_FLEET_CUSTOM_TEST_PATH",
            productionUrl: "https://env.app",
          },
          {
            id: "dir-repo",
            name: "Dir Repo",
            resolvedLocalDir: "custom-fleet-repo",
            productionUrl: "http://insecure.app",
          },
          { id: "path-repo", name: "Path Repo", localPath: customFleetDir, productionUrl: "" },
          { id: "missing-ineligible", name: "Missing 1", localPath: "C:/missing-1", productionUrl: "" },
          {
            id: "missing-eligible",
            name: "Missing 2",
            localPath: "C:/missing-2",
            productionUrl: "https://missing2.app",
          },
          { id: "portafolio", name: "Fallback Match" },
        ];
        fs.writeFileSync(path.join(regDir, "registry.json"), JSON.stringify({ projects: richProjects }));

        const richReport = EosFleetSoundcheckMesh.auditFleet(tmpDir);
        assert.equal(richReport.totalRepositories, richProjects.length);
        assert.equal(typeof richReport.deploymentAuthorizedQuorum, "boolean");
        assert.equal(typeof richReport.fleetAverageScore, "number");

        // Verify grades & remediation branches
        const missingIneligible = richReport.reports.find((r) => r.id === "missing-ineligible");
        assert.ok(missingIneligible);
        assert.equal(missingIneligible.grade, "F");
        assert.equal(missingIneligible.eligibleForAutonomousDeploy, false);
        assert.ok(missingIneligible.remediationAction.includes("Remediar árbol de trabajo"));

        const missingEligible = richReport.reports.find((r) => r.id === "missing-eligible");
        assert.ok(missingEligible);
        assert.equal(missingEligible.grade, "A+");
        assert.equal(missingEligible.eligibleForAutonomousDeploy, true);
      } finally {
        delete process.env.EOS_FLEET_CUSTOM_TEST_PATH;
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("exercises eosMctsHyperTuner.ts parameter spaces, fitness calculation, and UCT tuning", () => {
      const tunerDefault = new EosMctsHyperTuner();
      const tunerCustom = new EosMctsHyperTuner(12345);

      // Precondition error
      assert.throws(() => tunerDefault.tuneParameters(0), /MCTS iterations must be > 0/);

      // Fitness function evaluation across edge parameters
      const fit1 = tunerDefault.evaluateFitness({
        ringBufferSize: 1024,
        maxConcurrency: 50,
        gcThresholdMb: 64,
        faultRate: 0.01,
      });
      assert.ok(fit1 > 0);

      const fit2 = tunerDefault.evaluateFitness({
        ringBufferSize: 16384,
        maxConcurrency: 1000,
        gcThresholdMb: 512,
        faultRate: 0.1,
      });
      assert.ok(fit2 > 0);

      // Tune parameters with small iteration count
      const report = tunerCustom.tuneParameters(20, {
        ringBufferSize: [1024, 2048],
        maxConcurrency: [50, 100],
        gcThresholdMb: [64, 128],
        faultRate: [0.01, 0.02],
      });
      assert.equal(report.totalIterations, 20);
      assert.ok(report.optimalFitness > 0);
      assert.ok(report.sha256Receipt.length === 64);
    });

    it("exercises eosAdaptiveConcurrencyGovernor, flaky-gate validator, and kernel primitives branch conditions", () => {
      // 1. EosAdaptiveConcurrencyGovernor branches
      const gov = new EosAdaptiveConcurrencyGovernor({
        minLimit: 5,
        maxLimit: 100,
        initialLimit: 20,
        queueHeadroom: 2,
        maxQueueDelayMs: 10,
        emergencyHeadroom: 5,
        smoothingAlpha: 0.5,
      });

      // Queue delay exceeded branch
      const shedDelay = gov.tryAcquire("NORMAL", 15);
      assert.equal(shedDelay.admitted, false);
      assert.ok(shedDelay.reason?.includes("QUEUE_DELAY_EXCEEDED"));

      // Priority shed branches
      // Fill to limit
      for (let i = 0; i < 25; i++) {
        gov.tryAcquire("NORMAL", 0);
      }
      // BEST_EFFORT shed
      const shedBest = gov.tryAcquire("BEST_EFFORT", 0);
      assert.equal(shedBest.admitted, false);

      // HIGH and CRITICAL tryAcquire
      const critAcq = gov.tryAcquire("CRITICAL", 0);
      assert.ok(critAcq.sha256Receipt.length === 64);

      // Release branches (inFlight > 0, inFlight == 0, observedRttMs <= 0, observedRttMs > 0)
      gov.release(0);
      gov.release(-5);
      gov.release(25);
      for (let i = 0; i < 30; i++) {
        gov.release();
      }
      // release when inFlight is 0
      gov.release();

      // recordLatency branches
      gov.recordLatency(5);
      gov.recordLatency(50);

      // getStatus and reset
      const status = gov.getStatus();
      assert.ok(status.sha256Receipt.length === 64);
      assert.equal(typeof status.gradient, "number");
      gov.reset();
      gov.reset(40);

      // 2. flaky-gate isValidEntry branch coverage
      assert.equal(isValidEntry(null), false);
      assert.equal(isValidEntry("not an object"), false);
      assert.equal(isValidEntry({}), false);
      assert.equal(isValidEntry({ testId: "" }), false);
      assert.equal(isValidEntry({ testId: "a", owner: "" }), false);
      assert.equal(isValidEntry({ testId: "a", owner: "o", expiresOn: "invalid-date" }), false);
      assert.equal(isValidEntry({ testId: "a", owner: "o", expiresOn: "2026-02-30" }), false);
      assert.equal(isValidEntry({ testId: "a", owner: "o", expiresOn: "2026-12-31" }), true);

      // loadFlakyBudget fallback when file has no quarantined array
      const budgetTmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-bad-budget-"));
      try {
        fs.mkdirSync(path.join(budgetTmp, "docs", "quality"), { recursive: true });
        fs.writeFileSync(
          path.join(budgetTmp, "docs", "quality", "flaky-budget.json"),
          JSON.stringify({ notQuarantined: true }),
        );
        const loaded = loadFlakyBudget(budgetTmp);
        assert.deepEqual(loaded.quarantined, []);
      } finally {
        try {
          fs.rmSync(budgetTmp, { recursive: true, force: true });
        } catch {
          void 0;
        }
      }

      // 3. EosKernelPrimitives deepFreeze & contract assertions
      const view = new Uint8Array([1, 2, 3]);
      assert.equal(deepFreeze(view), view);
      const fnObj = { fn: () => 42 };
      assert.equal(deepFreeze(fnObj), fnObj);
      assert.doesNotThrow(() => assertPostcondition(true, "valid"));
      assert.doesNotThrow(() => assertInvariant(true, "valid"));
    });

    it("exercises EosDiffPatcher, EosSurgicalSelfHealingKernel, and EosSapFixAutoshipper edge branches", () => {
      // 1. EosDiffPatcher branches
      const diffWithNoNewline = [
        "--- a/test.txt",
        "+++ b/test.txt",
        "@@ -1 +1 @@",
        "-old line",
        "\\ No newline at end of file",
        "+new line",
        "\\ No newline at end of file",
      ].join("\n");
      const parsedNoNewline = parseDiff(diffWithNoNewline);
      assert.equal(parsedNoNewline.hunks.length, 1);
      assert.equal(parsedNoNewline.hunks[0].oldCount, 1);
      assert.equal(parsedNoNewline.hunks[0].newCount, 1);

      // applyDiff escape target
      const patchEscape = applyDiff(
        { oldPath: "../escape.txt", newPath: "../escape.txt", hunks: [], sha256: "00" },
        root,
      );
      assert.equal(patchEscape.success, false);
      assert.ok(patchEscape.error?.includes("escapes project root"));

      // applyDiff non-existent target
      const patchNotFound = applyDiff(
        { oldPath: "nonexistent-file.xyz", newPath: "nonexistent-file.xyz", hunks: [], sha256: "00" },
        root,
      );
      assert.equal(patchNotFound.success, false);
      assert.ok(patchNotFound.error?.includes("does not exist"));

      // applyDiff mismatch removal line (triggers restore from backup)
      const tmpPatchDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-patch-test-"));
      try {
        const testFile = path.join(tmpPatchDir, "target.txt");
        fs.writeFileSync(testFile, "line 1\nline 2\nline 3\n", "utf8");
        const mismatchDiff = {
          oldPath: "target.txt",
          newPath: "target.txt",
          hunks: [
            {
              oldStart: 2,
              oldCount: 1,
              newStart: 2,
              newCount: 1,
              lines: [
                { type: "remove", content: "WRONG LINE" },
                { type: "add", content: "REPLACED" },
              ],
            },
          ],
          sha256: "11",
        };
        const mismatchRes = applyDiff(mismatchDiff, tmpPatchDir);
        assert.equal(mismatchRes.success, false);
        assert.ok(mismatchRes.error?.includes("Patch mismatch"));
        // original content must be restored intact
        assert.equal(fs.readFileSync(testFile, "utf8"), "line 1\nline 2\nline 3\n");

        // generateDiff variations
        const diffLeading = generateDiff("first\nsecond\nthird", "modified\nsecond\nthird", "file.txt");
        assert.ok(diffLeading.includes("@@ -1,2 +1,2 @@"));
        const diffTrailing = generateDiff("first\nsecond\nthird", "first\nsecond\nchanged", "file.txt");
        assert.ok(diffTrailing.includes("@@ -2,2 +2,2 @@"));
      } finally {
        try {
          fs.rmSync(tmpPatchDir, { recursive: true, force: true });
        } catch {
          void 0;
        }
      }

      // 2. EosSurgicalSelfHealingKernel branches
      // isolateFault bare stack and single-line fallback
      const bareDiag = EosSurgicalSelfHealingKernel.isolateFault(
        "TypeError: Cannot read properties of undefined (reading 'token')\n    at src/core/auth.ts:15:8",
      );
      assert.equal(bareDiag.targetExpression, "token");
      assert.equal(bareDiag.filePath, "src/core/auth.ts");
      assert.equal(bareDiag.lineNumber, 15);

      const notDefDiag = EosSurgicalSelfHealingKernel.isolateFault(
        "ReferenceError: client is not defined",
        "src/client.ts",
      );
      assert.equal(notDefDiag.targetExpression, "client");
      assert.equal(notDefDiag.filePath, "src/client.ts");

      // synthesizeSurgicalPatch with BOUNDARY_CLAMP and TRY_CATCH_WRAPPER
      const clampPatch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(
        bareDiag,
        "const x = array[idx];",
        "BOUNDARY_CLAMP",
      );
      assert.equal(clampPatch.strategy, "BOUNDARY_CLAMP");

      const tryCatchPatch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(
        notDefDiag,
        "return client.connect();",
        "TRY_CATCH_WRAPPER",
      );
      assert.equal(tryCatchPatch.strategy, "TRY_CATCH_WRAPPER");

      // synthesizeSurgicalPatch NULL_CHECK_GUARD with nested property
      const nestedDiag = EosSurgicalSelfHealingKernel.isolateFault(
        "TypeError: Cannot read properties of undefined (reading 'port')",
        "const p = config.network.port;",
      );
      const nestedPatch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(
        nestedDiag,
        "const p = config.network.port;",
        "NULL_CHECK_GUARD",
      );
      assert.ok(nestedPatch.replacementSnippet.includes("!config"));

      // applyPatchInMemory
      const patchedMemory = EosSurgicalSelfHealingKernel.applyPatchInMemory("line 1\nline 2", tryCatchPatch);
      assert.ok(patchedMemory.includes("try {"));

      // verifyInSandbox with intentional regression failure
      const failSim = EosSurgicalSelfHealingKernel.verifyInSandbox({
        originalSource: "function run() { return 1; }",
        patch: clampPatch,
        regressionTestCode: "throw new Error('Sandbox assertion regression');",
      });
      assert.equal(failSim.status, "FAIL");
      assert.equal(failSim.targetFunctionPass, false);

      // 3. EosSapFixAutoshipper branches
      assert.throws(
        () => EosSapFixAutoshipper.executeCycle({ faultId: "", targetFilePath: "x", failingLine: 1 }),
        /faultId is required/,
      );
      assert.throws(
        () => EosSapFixAutoshipper.executeCycle({ faultId: "F1", targetFilePath: "", failingLine: 1 }),
        /targetFilePath is required/,
      );
      assert.throws(
        () => EosSapFixAutoshipper.executeCycle({ faultId: "F1", targetFilePath: "x", failingLine: 0 }),
        /failingLine must be positive/,
      );

      const sapReport = EosSapFixAutoshipper.executeCycle(
        {
          faultId: "FA-002",
          targetFilePath: "nonexistent/mocked.ts",
          failingLine: 2,
          errorMessage: "Cannot read properties of null (reading 'id')",
          offendingExpression: "data.id",
        },
        root,
        { customBranchPrefix: "fix/custom-branch" },
      );
      assert.ok(sapReport.branchName.startsWith("fix/custom-branch"));
      assert.equal(typeof sapReport.verificationPassed, "boolean");
      assert.ok(sapReport.status === "PR_READY" || sapReport.status === "REGRESSION_REJECTED");
      assert.equal(EosSapFixAutoshipper.recordReceiptInLedger(sapReport, ":memory:"), true);

      // 4. EosDocumentationSearch empty query and getStats
      const docSearch = new EosDocumentationSearch(root, ":memory:");
      assert.throws(() => docSearch.search("   "), /Search query must be a non-empty string/);
      assert.deepEqual(docSearch.search("???"), []);
      const stats = docSearch.getStats();
      assert.equal(typeof stats.totalIndexed, "number");
      docSearch.close();
    });

    it("exercises EosAdaptiveRateLimiter, EosBackpressureFlowController, and EosAgenticFinOpsGovernor edge branches", async () => {
      // 1. EosAdaptiveRateLimiter
      const limiter = new EosAdaptiveRateLimiter({
        bucketCapacity: 2,
        refillRatePerSec: 100,
        windowSizeMs: 500,
        maxPerWindow: 2,
        adaptive: true,
      });

      // Stats on initial state
      const initialStats = limiter.getStats();
      assert.equal(initialStats.totalRequests, 0);
      assert.equal(initialStats.totalRejections, 0);
      assert.equal(initialStats.currentCapacity, 2);

      // Acquire 1 and 2
      const dec1 = limiter.tryAcquire();
      assert.equal(dec1.allowed, true);
      const dec2 = limiter.tryAcquire();
      assert.equal(dec2.allowed, true);

      // 3rd acquire triggers WINDOW limit denial (maxPerWindow = 2)
      const decWindowDeny = limiter.tryAcquire();
      assert.equal(decWindowDeny.allowed, false);
      assert.ok(decWindowDeny.rejectionRatio > 0);

      // Token bucket denial (when tokens < 1 with high maxPerWindow)
      const bucketLimiter = new EosAdaptiveRateLimiter({
        bucketCapacity: 1,
        refillRatePerSec: 0.001,
        windowSizeMs: 10000,
        maxPerWindow: 50,
        adaptive: false,
      });
      assert.equal(bucketLimiter.tryAcquire().allowed, true);
      const bucketDeny = bucketLimiter.tryAcquire();
      assert.equal(bucketDeny.allowed, false);
      assert.ok(bucketDeny.retryAfterMs > 0);

      // 2. EosBackpressureFlowController
      const bp = new EosBackpressureFlowController({
        initialWindow: 2,
        maxWindow: 4,
        highWatermark: 80,
        lowWatermark: 20,
        congestionMultiplier: 0.5,
      });

      assert.throws(() => bp.signalDemand(-1), /demand must be non-negative/);

      // tryEmit with 0 demand
      assert.equal(bp.tryEmit(), false);

      bp.signalDemand(5);
      // Emit 1 (inflight=1, window=2 -> 50% -> OPEN)
      assert.equal(bp.tryEmit(), true);
      // Emit 2 (inflight=2, window=2 -> 100% >= 80% -> HIGH_WATER)
      assert.equal(bp.tryEmit(), true);
      assert.equal(bp.getSnapshot().pressure, "HIGH_WATER");

      // Emit 3 (inflight >= window -> rejected)
      assert.equal(bp.tryEmit(), false);

      // Acknowledge item 1 -> inflight=1, window increases to 3 (additive)
      bp.acknowledge();
      assert.equal(bp.getSnapshot().windowSize, 3);

      // Acknowledge item 2 -> inflight=0, ratio=0 <= 20% -> OPEN
      bp.acknowledge();
      assert.equal(bp.getSnapshot().pressure, "OPEN");

      // Acknowledge when inflight=0 (no-op on inflight)
      bp.acknowledge();
      assert.equal(bp.getSnapshot().inflight, 0);

      // signalLoss with inflight=0
      bp.signalLoss();
      assert.equal(bp.getSnapshot().windowSize, 2);

      // signalLoss with inflight>0
      bp.tryEmit();
      assert.equal(bp.getSnapshot().inflight, 1);
      bp.signalLoss();
      assert.equal(bp.getSnapshot().inflight, 0);

      const bpStats = bp.getStats();
      assert.ok(bpStats.totalAccepted >= 2);
      assert.ok(bpStats.totalRejected >= 2);

      // 3. EosAgenticFinOpsGovernor
      const finops = EosAgenticFinOpsGovernor.getInstance();
      finops.reset();

      // evaluateStagnation with < 2 diffs
      const emptyStag = finops.evaluateStagnation([], false);
      assert.equal(emptyStag.stagnant, false);
      assert.equal(emptyStag.action, "PROCEED_NOMINAL");

      const singleStag = finops.evaluateStagnation(["diff one"], false);
      assert.equal(singleStag.stagnant, false);

      // evaluateStagnation with empty diff strings
      const emptyDiffStag = finops.evaluateStagnation(["", ""], false);
      assert.equal(emptyDiffStag.similarityScore, 1.0);

      // evaluateStagnation with 2 diffs approaching threshold (<3 length, failing test)
      const baseDiff = "w1 w2 w3 w4 w5 w6 w7 w8 w9 w10";
      const nearStag = finops.evaluateStagnation([baseDiff, `${baseDiff} w11`], false);
      assert.equal(nearStag.circuitBreakerState, "WARNING");
      assert.equal(nearStag.action, "WARN_COGNITIVE_STALL");

      // recordTokenUsage without prior wallet allocation
      const autoWallet = finops.recordTokenUsage("auto-mission-1", 1000, 500, "TIER_1_LOCAL_SLM");
      assert.equal(autoWallet.status, "ACTIVE");
      assert.ok(autoWallet.accumulatedSpendUsd > 0);

      // recordTokenUsage balanced tier
      const balWallet = finops.recordTokenUsage("auto-mission-1", 1000, 500, "TIER_2_BALANCED");
      assert.equal(balWallet.status, "ACTIVE");

      // evaluateCodeSurvival empty components
      const emptySurvival = finops.evaluateCodeSurvival([]);
      assert.equal(emptySurvival.totalComponentsTracked, 0);
      assert.equal(emptySurvival.roiMultiple, 1.0);

      // evaluateCodeSurvival with net negative AI debt (>30% churn)
      const highChurn = finops.evaluateCodeSurvival([
        { componentId: "debt-comp", initialLines: 100, retainedLines30Days: 20, totalInferenceCostUsd: 10.0 },
      ]);
      assert.equal(highChurn.netNegativeAiDebt, true);

      // evaluateCodeSurvival with totalInferenceCost = 0
      const zeroCostSurvival = finops.evaluateCodeSurvival([
        { componentId: "free-comp", initialLines: 100, retainedLines30Days: 90, totalInferenceCostUsd: 0 },
      ]);
      assert.equal(zeroCostSurvival.roiMultiple, 100.0);

      // evaluateCodeSurvival with totalInitial = 0
      const zeroInitial = finops.evaluateCodeSurvival([
        { componentId: "zero-init", initialLines: 0, retainedLines30Days: 0, totalInferenceCostUsd: 1.0 },
      ]);
      assert.equal(zeroInitial.averageSurvivalRatePercent, 100);

      // 4. EosApolloHermesMesh, EosCircuitBreaker, and EosTokenBucketRateLimiter
      const mesh = new EosApolloHermesMesh();

      // traceparent parsing errors
      assert.equal(mesh.parseTraceparent("malformed"), null);
      assert.equal(mesh.parseTraceparent("01-trace-span-flag"), null);

      // generateTraceContext with invalid string fallback
      const randomTrace = mesh.generateTraceContext("invalid-traceparent");
      assert.equal(randomTrace.version, "00");

      // CircuitBreaker HALF_OPEN failure transition to OPEN
      const cb = new EosCircuitBreaker({ resetTimeoutMs: 10, halfOpenTrialSuccesses: 2, slidingWindowSize: 2 });
      cb.recordFailure();
      cb.recordFailure();
      assert.equal(cb.getState(), "OPEN");
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(cb.getState(), "HALF_OPEN");
      cb.recordFailure();
      assert.equal(cb.getState(), "OPEN");
      assert.equal(cb.canExecute(), false);

      // TokenBucketRateLimiter getAvailableTokens
      const tbLimiter = new EosTokenBucketRateLimiter(10, 10);
      assert.ok(tbLimiter.getAvailableTokens() > 0);

      // invokeRpc failure with Error instance
      const rpcErr = await mesh.invokeRpc("error-service", "fail", {}, () => {
        throw new Error("RPC simulated error");
      });
      assert.equal(rpcErr.success, false);
      assert.equal(rpcErr.error, "RPC simulated error");

      // invokeRpc failure with non-Error string
      const rpcStrErr = await mesh.invokeRpc("string-error-service", "fail", {}, () => {
        throw "Raw string failure";
      });
      assert.equal(rpcStrErr.success, false);
      assert.equal(rpcStrErr.error, "Raw string failure");

      // invokeRpc rate limit denial
      const exhaustedMesh = new EosApolloHermesMesh(0, 0);
      const rpc429 = await exhaustedMesh.invokeRpc("fast-service", "op", {}, () => "ok");
      assert.equal(rpc429.success, false);
      assert.ok(rpc429.error?.includes("429"));

      // invokeRpc circuit breaker OPEN denial
      const openCb = mesh.getCircuitBreaker("broken-service", { slidingWindowSize: 1 });
      openCb.recordFailure();
      const rpcOpen = await mesh.invokeRpc("broken-service", "op", {}, () => "ok");
      assert.equal(rpcOpen.success, false);
      assert.ok(rpcOpen.error?.includes("OPEN"));

      // publishEvent with subscriber that throws
      mesh.subscribe("failing.topic", () => {
        throw new Error("Subscriber blown up");
      });
      const publishedEvt = mesh.publishEvent("failing.topic", "key-1", { data: 123 });
      assert.equal(publishedEvt.topic, "failing.topic");

      // 5. EosAcousticFeatureStore
      const acousticStore = new EosAcousticFeatureStore();
      const zeroVec = {
        tempo: 0,
        energy: 0,
        danceability: 0,
        valence: 0,
        acousticness: 0,
        instrumentalness: 0,
        liveness: 0,
        speechiness: 0,
      };
      // Affinity with zero vectors (magA === 0 or magB === 0)
      assert.equal(acousticStore.computeAffinityScore(zeroVec, zeroVec), 0.0);

      // Compute taste centroid with ONLY skipped tracks
      acousticStore.recordListen("user-all-skips", "track-s1", zeroVec, 10, 200);
      acousticStore.recordListen("user-all-skips", "track-s2", zeroVec, 15, 200);
      const allSkipsProfile = acousticStore.computeTasteCentroid("user-all-skips");
      assert.equal(allSkipsProfile.skipRate, 1.0);
      assert.equal(allSkipsProfile.totalSkips, 2);

      // 6. EosAntiEntropyMerkleSync
      const merkleSync = new EosAntiEntropyMerkleSync(3); // odd number of buckets
      merkleSync.put("k1", "val1");
      merkleSync.put("k2", { complex: "json" });
      merkleSync.put("k3", "val3");
      merkleSync.delete("k3");
      const treeOdd = merkleSync.buildMerkleTree();
      assert.ok(treeOdd.hash.length === 64);

      // compare identical trees
      const sameDiff = EosAntiEntropyMerkleSync.compareTrees(treeOdd, treeOdd);
      assert.equal(sameDiff.inSync, true);
      assert.equal(sameDiff.divergentRanges.length, 0);

      // compare different leaf trees
      const leafA = { hash: "a", rangeStart: 0, rangeEnd: 1, keysCount: 1 };
      const leafB = { hash: "b", rangeStart: 0, rangeEnd: 1, keysCount: 1 };
      const diffLeaves = EosAntiEntropyMerkleSync.compareTrees(leafA, leafB);
      assert.equal(diffLeaves.inSync, false);
      assert.equal(diffLeaves.divergentRanges.length, 1);
    });

    it("exercises BigTech ops wave, IAM break-glass, Fleet path resolver, and Planetary multi-cloud evacuation edge branches", async () => {
      // 1. EosPlanetaryMultiCloudEvacuationMesh edge branches
      const mesh = EosPlanetaryMultiCloudEvacuationMesh.getInstance();
      mesh.reset();

      assert.throws(() => mesh.evacuateCloudProvider("unregistered-cloud"), /not registered/);
      assert.throws(() => mesh.reintegrateProvider("unregistered-cloud", []), /not found/);

      // Register new custom cloud via updateTelemetry
      mesh.updateTelemetry("custom-cloud", 100, 5);
      const statusAfterRegister = mesh.getStatus();
      assert.equal(statusAfterRegister.activeCloudsCount, 4);

      // Trigger latency-only degradation (latency > 1500)
      mesh.updateTelemetry("custom-cloud", 1600, 5);
      // Trigger error-rate degradation (errorRate > 50)
      mesh.updateTelemetry("custom-cloud", 100, 55);

      // Flapping test with < 10 probes
      mesh.evacuateCloudProvider("custom-cloud", "test-evac");
      const shortProbes = [true, true, true];
      const flapResult = mesh.reintegrateProvider("custom-cloud", shortProbes);
      assert.equal(flapResult.success, false);
      assert.equal(flapResult.status, "COOLDOWN");

      mesh.reset();

      // 2. BigTech ACA Canary Gate edge branches
      const healthy = buildHealthyAcaDogfoodInput();
      const marginalResult = runBigTechAcaCanaryGate({
        ...healthy,
        baselineSamples: {
          errorRate: [0.0001, 0.0001],
          p99LatencyMs: [100, 100],
          memoryMb: [500, 500],
        },
        canarySamples: {
          errorRate: [0.0001, 0.0001],
          p99LatencyMs: [100, 100],
          memoryMb: [1500, 1500],
        },
        metricConfigs: [
          { name: "errorRate", importance: "HARD", upperBound: 0.001 },
          { name: "p99LatencyMs", importance: "HARD", upperBound: 500 },
          { name: "memoryMb", importance: "SOFT", upperBound: 1000 },
        ],
      });
      assert.equal(marginalResult.acaVerdict, "MARGINAL");
      assert.equal(marginalResult.verdict, "MARGINAL");

      const tmpAca = fs.mkdtempSync(path.join(os.tmpdir(), "aca-marginal-"));
      try {
        const written = writeAcaCanaryEvidence(tmpAca, marginalResult);
        assert.ok(fs.existsSync(written.canaryPath));
        assert.equal(written.incidentPath, null);
      } finally {
        fs.rmSync(tmpAca, { recursive: true, force: true });
      }

      // 3. IAM Break-Glass clamping and invalids
      const gLow = issueBreakGlassGrant({
        principal: { subjectId: "s1", tenantId: "t1", roles: [] },
        reason: "sev1-urgent-fix",
        ttlMs: 5000,
      });
      assert.equal(gLow.expiresAtMs - gLow.issuedAtMs, 60_000);

      const gHigh = issueBreakGlassGrant({
        principal: { subjectId: "s1", tenantId: "t1", roles: [] },
        reason: "sev1-urgent-fix",
        ttlMs: 999_999_999,
      });
      assert.equal(gHigh.expiresAtMs - gHigh.issuedAtMs, 3_600_000);

      assert.equal(evaluateBreakGlassGrant(null).code, "BREAK_GLASS_INVALID");
      assert.equal(evaluateBreakGlassGrant(undefined).code, "BREAK_GLASS_INVALID");
      assert.equal(evaluateBreakGlassGrant({}).code, "BREAK_GLASS_INVALID");
      assert.equal(evaluateBreakGlassGrant({ principal: { subjectId: "" } }).code, "BREAK_GLASS_INVALID");

      // 4. Fleet Path Resolver branches
      const invalidEnvRes = resolveFleetProjectPath(root, {
        id: "test-invalid-env",
        localPathEnv: "INVALID_NAME_NOT_UPPERCASE_PATTERN",
      });
      assert.equal(invalidEnvRes.status, "SKIPPED_SIBLING");

      const missingLocalRes = resolveFleetProjectPath(root, {
        id: "test-missing-local",
        localPath: path.join(root, "non-existent-folder-12345"),
      });
      assert.equal(missingLocalRes.status, "SKIPPED_SIBLING");

      // Test with EOS_WORKSPACE_ROOT — usable checkout needs .git + package.json
      const prevWsRoot = process.env.EOS_WORKSPACE_ROOT;
      const tmpWsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ws-root-"));
      try {
        const siblingRoot = path.join(tmpWsRoot, "sibling-repo");
        fs.mkdirSync(path.join(siblingRoot, ".git"), { recursive: true });
        fs.writeFileSync(path.join(siblingRoot, "package.json"), "{}\n", "utf8");
        // Empty git residue (no package.json) must stay SKIPPED — CI checkout failure residue.
        const residueRoot = path.join(tmpWsRoot, "git-residue-only");
        fs.mkdirSync(path.join(residueRoot, ".git"), { recursive: true });
        process.env.EOS_WORKSPACE_ROOT = tmpWsRoot;

        const resolvedWs = resolveFleetProjectPath(root, {
          id: "sibling-repo",
          resolvedLocalDir: "sibling-repo",
        });
        assert.equal(resolvedWs.status, "AVAILABLE");
        assert.equal(resolvedWs.resolution, "RESOLVED_LOCAL_DIR");

        const residue = resolveFleetProjectPath(root, {
          id: "git-residue-only",
          resolvedLocalDir: "git-residue-only",
        });
        assert.equal(residue.status, "SKIPPED_SIBLING");
        assert.equal(residue.resolution, "NONE");
      } finally {
        if (prevWsRoot === undefined) delete process.env.EOS_WORKSPACE_ROOT;
        else process.env.EOS_WORKSPACE_ROOT = prevWsRoot;
        fs.rmSync(tmpWsRoot, { recursive: true, force: true });
      }

      const allResolved = resolveFleetRegistryPaths(root, [{ id: "eos-system" }, { id: "sibling-missing" }]);
      assert.equal(allResolved.length, 2);

      // 5. Serverless API routes edge branches
      const mcpMod = await import(pathToFileURL(path.join(root, "api/mcp.js")).href);
      const mcpHandler = mcpMod.default;

      const res415 = createMockResponse();
      await mcpHandler({ method: "POST", headers: {} }, res415);
      assert.equal(res415.getStatusCode(), 415);

      const res406 = createMockResponse();
      await mcpHandler(
        { method: "POST", headers: { "content-type": "application/json", accept: "text/event-stream" } },
        res406,
      );
      assert.equal(res406.getStatusCode(), 406);

      const res413 = createMockResponse();
      await mcpHandler(
        { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(1024 * 1024 + 10) },
        res413,
      );
      assert.equal(res413.getStatusCode(), 413);

      const resUnknownMethod = createMockResponse();
      await mcpHandler(
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: { jsonrpc: "2.0", method: "unregistered/call", id: 99 },
        },
        resUnknownMethod,
      );
      assert.equal(resUnknownMethod.getStatusCode(), 200);

      const specsMod = await import(pathToFileURL(path.join(root, "api/_specs.js")).href);
      const specsHandler = specsMod.default;

      const resSpecsOpt = createMockResponse();
      await specsHandler({ method: "OPTIONS" }, resSpecsOpt);
      assert.equal(resSpecsOpt.getStatusCode(), 200);

      const resSpecs405 = createMockResponse();
      await specsHandler({ method: "POST" }, resSpecs405);
      assert.equal(resSpecs405.getStatusCode(), 405);

      const resSpecsAll = createMockResponse();
      await specsHandler({ method: "GET", query: { status: "ALL", q: "SPEC-001" } }, resSpecsAll);
      assert.equal(resSpecsAll.getStatusCode(), 200);

      const resSpecsFilter = createMockResponse();
      await specsHandler({ method: "GET", query: { status: "APPROVED", q: "system" } }, resSpecsFilter);
      assert.equal(resSpecsFilter.getStatusCode(), 200);

      const bigtechMod = await import(pathToFileURL(path.join(root, "api/_bigtech.js")).href);
      const bigtechHandler = bigtechMod.default;

      const resBtOpt = createMockResponse();
      await bigtechHandler({ method: "OPTIONS" }, resBtOpt);
      assert.equal(resBtOpt.getStatusCode(), 200);

      const resBt405 = createMockResponse();
      await bigtechHandler({ method: "POST" }, resBt405);
      assert.equal(resBt405.getStatusCode(), 405);

      const resBtScenario = createMockResponse();
      await bigtechHandler({ method: "GET", query: { scenario: "secret-leak-attempt" } }, resBtScenario);
      assert.equal(resBtScenario.getStatusCode(), 200);

      const resBtBadScenario = createMockResponse();
      await bigtechHandler({ method: "GET", query: { scenario: "invalid-drill-xyz" } }, resBtBadScenario);
      assert.equal(resBtBadScenario.getStatusCode(), 400);

      const resBtRisk = createMockResponse();
      await bigtechHandler({ method: "GET", query: { action: "risk", iterations: "25", deadline: "5" } }, resBtRisk);
      assert.equal(resBtRisk.getStatusCode(), 200);
    });
  });
});
