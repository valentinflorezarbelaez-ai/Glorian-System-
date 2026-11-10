/**
 * EOS SYSTEM — MCP PHASE DEEP BRANCH ELEVATION SUITE (SPEC-165 / BDD-305)
 *
 * Targets residual branch coverage gaps across all extracted MCP Phase handlers:
 * 1. src/mcp/tools/eosMcpPhase3CoreHandlers.ts (Watchdog summary, Tribunal summary & categories, Gentleman status)
 * 2. src/mcp/tools/eosMcpPhase4InstitutionalHandlers.ts (Nubank mutable/isolation, Postmortem severities, Supply chain verify/sbom/slsa, Planetary summary)
 * 3. src/mcp/tools/eosMcpPhase5DomainHandlers.ts (Spotify scaffold flags, Xirp context sync, Fleetshift batch, Mix plan keys, Acoustic centroids, Shuffle tracks)
 * 4. src/mcp/tools/eosMcpPhase6DomainHandlers.ts (Fleet registry dry-run, Mission control probe, Fleet elevate bounds/apply, Fleet verify degradation)
 * 5. src/mcp/tools/eosMcpPhase7DomainHandlers.ts & sub-dispatchers (Routing invariant violation, Contract evolution schemas, SMT custom rules, Fuzz actions)
 * 6. src/mcp/tools/eosMcpPhase8AgiHandlers.ts (Consult context/constraints, AGI solve event loop, Dynamic forge, Context window bounds, Spec drift orphan toggle, Pipeline)
 *
 * Invariant: Zero external npm dependencies. Standard Node.js test runner.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { createPhase3CoreHandlers } from "../src/mcp/tools/eosMcpPhase3CoreHandlers.ts";
import { createPhase4InstitutionalHandlers } from "../src/mcp/tools/eosMcpPhase4InstitutionalHandlers.ts";
import { createPhase5DomainHandlers } from "../src/mcp/tools/eosMcpPhase5DomainHandlers.ts";
import { createPhase6DomainHandlers } from "../src/mcp/tools/eosMcpPhase6DomainHandlers.ts";
import { createPhase7DomainHandlers } from "../src/mcp/tools/eosMcpPhase7DomainHandlers.ts";
import { dispatchPhase7VerificationCase } from "../src/mcp/tools/eosMcpPhase7VerificationHandlers.ts";
import { dispatchPhase7RuntimeCase } from "../src/mcp/tools/eosMcpPhase7RuntimeHandlers.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";
import { EosDynamicToolForge } from "../src/core/eosDynamicToolForge.ts";
import {
  evaluateHookEvent,
  maybeTriggerOpportunisticGentlemanUpdate,
} from "../integrations/antigravity/eos-governance/scripts/eos-hook.mjs";
import { EosNsaCryptoSuite } from "../src/core/eosNsaCryptoSuite.ts";
import {
  isLeastPrivilegeProductPolicyPack,
  loadDefaultIamPolicyPack,
  defaultFactoryPrincipal,
  runBigTechProductFactory,
  buildDemoLedgerManifest,
} from "../src/core/eosBigTechProductFactory.ts";
import { EosEngineeringWorkflow } from "../src/core/eosEngineeringWorkflow.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

describe("MCP PHASE HANDLERS — DEEP BRANCH ELEVATION SUITE", () => {
  const server = new EosMcpServer(root);

  const sharedContext = {
    projectRoot: root,
    resolveProjectPath: (v, _kind, fallback) => path.resolve(root, String(v || fallback || ".")),
    resolveConfinedLedgerPath: (_v) => path.resolve(root, ".eos/state.db"),
    onProgress: () => {},
  };

  // -------------------------------------------------------------------------
  // 1. Phase 3 Core Handlers
  // -------------------------------------------------------------------------
  describe("1. Phase 3 Core Handlers Deep Branches", () => {
    const phase3 = createPhase3CoreHandlers({
      projectRoot: root,
      resolveProjectPath: sharedContext.resolveProjectPath,
      resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      hybridKnowledge: server["hybridKnowledge"],
      knowledgeStore: server["knowledgeStore"],
      agentSessionContract: server["agentSessionContract"],
      hnsw: EosMcpServer.globalHnsw,
    });

    it("evaluates glorian_fleet_health_watchdog format=summary and dryRun=true", () => {
      const summaryReport = phase3.glorian_fleet_health_watchdog({ dryRun: true, format: "summary" }, sharedContext);
      assert.ok(summaryReport);
      assert.equal(typeof summaryReport.summary, "string");
      assert.equal(typeof summaryReport.compositeHealthIndex, "number");
      assert.ok(summaryReport.sha256Receipt);

      const jsonReport = phase3.glorian_fleet_health_watchdog({ dryRun: true, format: "json" }, sharedContext);
      assert.ok(jsonReport);
      assert.ok(Array.isArray(jsonReport.projects));
    });

    it("evaluates glorian_constitutional_tribunal format=summary with custom categories and invariants", () => {
      const summary = phase3.glorian_constitutional_tribunal(
        {
          actionId: "ACT-TEST-001",
          category: "SECURITY_RULE",
          description: "Verify strict Layer-0 isolation invariants",
          diffOrPayload: "const clean = true;",
          targetDirectory: "src/core",
          declaredInvariants: ["INV-001-ZERO-DEPENDENCIES", "INV-002-EVIDENCE-FIRST"],
          format: "summary",
        },
        sharedContext,
      );
      assert.ok(summary);
      assert.equal(typeof summary.summary, "string");
      assert.equal(typeof summary.overallVerdict, "string");
      assert.equal(typeof summary.compositeScore, "number");
      assert.equal(typeof summary.quorumMet, "boolean");

      const json = phase3.glorian_constitutional_tribunal({ actionId: "ACT-TEST-002", format: "json" }, sharedContext);
      assert.ok(json);
      assert.equal(json.actionId, "ACT-TEST-002");
    });

    it("evaluates eos_gentleman_update action=status", () => {
      const statusRes = phase3.eos_gentleman_update({ action: "status" }, sharedContext);
      assert.ok(statusRes);
      assert.equal(statusRes.action, "status");
      assert.equal(typeof statusRes.isDue, "boolean");
      assert.equal(typeof statusRes.constitutionSha256, "string");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Phase 4 Institutional Handlers
  // -------------------------------------------------------------------------
  describe("2. Phase 4 Institutional Handlers Deep Branches", () => {
    const phase4 = createPhase4InstitutionalHandlers(root);

    it("evaluates eos_nubank_audit with non-default state and coverage branches", () => {
      const audit = phase4.eos_nubank_audit({
        hasMutableStateInDomain: true,
        usesHexagonalLayerIsolation: false,
        usesContractTestingInsteadOfE2E: false,
        enforcesKafkaIdempotencyTokens: false,
        usesImmutableBitemporalLedgers: false,
        hasBlamelessPostmortemProcess: false,
        unitTestCoveragePercent: 70,
      });
      assert.ok(audit);
      assert.equal(audit.institutionalScore < 80, true);
    });

    it("evaluates eos_nubank_postmortem with SEV1, custom timelines, and cognitive factors", () => {
      const pm = phase4.eos_nubank_postmortem({
        incidentId: "INC-SEV1-999",
        title: "Byzantine Partition in Datomic Cluster",
        severity: "SEV1",
        owningSquad: "ledger-core",
        affectedServices: ["transactor", "query-engine"],
        customerImpact: "Read-only fallback activated for 120 seconds",
        startTime: new Date(Date.now() - 3600000).toISOString(),
        resolutionTime: new Date().toISOString(),
        durationMinutes: 60,
        timeline: [
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            description: "Heartbeat degradation observed",
            detectedBy: "sentinel",
          },
          {
            timestamp: new Date().toISOString(),
            description: "Partition healed automatically",
            detectedBy: "alert",
          },
        ],
        fiveWhys: ["Why 1: High latency", "Why 2: GC pause"],
        cognitiveFactors: ["Complex distributed state interaction", "Telemetry alert fatigue"],
        systemicRemediations: [
          {
            description: "Automate heap dump on memory threshold",
            owner: "sre-lead",
            actionType: "PREVENT",
          },
        ],
      });
      assert.ok(pm.markdown.includes("INC-SEV1-999"));
      assert.ok(pm.markdown.includes("SEV1"));
    });

    it("evaluates eos_slsa_provenance_sbom across verify, sbom, slsa, and both modes", () => {
      const verifyRes = phase4.eos_slsa_provenance_sbom({ mode: "verify" });
      assert.ok(verifyRes.verification);

      const sbomRes = phase4.eos_slsa_provenance_sbom({ mode: "sbom", recordToLedger: false });
      assert.ok(sbomRes.sbom);
      assert.ok(sbomRes.sbom.bomFormat === "CycloneDX");

      const slsaRes = phase4.eos_slsa_provenance_sbom({
        mode: "slsa",
        recordToLedger: false,
        commitSha: "feac01ff1234567890abcdef",
      });
      assert.ok(slsaRes.slsa);
      assert.ok(slsaRes.slsa._type.includes("in-toto"));

      const bothRes = phase4.eos_slsa_provenance_sbom({ mode: "both", recordToLedger: false });
      assert.ok(bothRes.sbom);
      assert.ok(bothRes.slsa);
    });

    it("evaluates eos_planetary_doctrine_audit format=summary and format=json", () => {
      const summary = phase4.eos_planetary_doctrine_audit({ format: "summary" });
      assert.ok(summary);
      assert.equal(typeof summary.overallScore, "number");
      assert.ok(Array.isArray(summary.pillars));

      const json = phase4.eos_planetary_doctrine_audit({ format: "json" });
      assert.ok(json);
      assert.ok(json.sha256Receipt);
    });

    it("evaluates eos_black_projects_triad_audit format=summary and format=json", () => {
      const summary = phase4.eos_black_projects_triad_audit({ format: "summary" });
      assert.ok(summary);
      assert.equal(typeof summary.overallScore, "number");
      assert.ok(Array.isArray(summary.pillars));

      const json = phase4.eos_black_projects_triad_audit({ format: "json" });
      assert.ok(json);
      assert.ok(json.sha256Receipt);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Phase 5 Domain Handlers
  // -------------------------------------------------------------------------
  describe("3. Phase 5 Domain Handlers Deep Branches", () => {
    const phase5 = createPhase5DomainHandlers({
      projectRoot: root,
      resolveProjectPath: sharedContext.resolveProjectPath,
    });

    it("evaluates eos_spotify_scaffold with dry-run and custom name/owner", () => {
      const res = phase5.eos_spotify_scaffold({
        targetPath: ".",
        name: "custom-music-service",
        owner: "audio-team",
        apply: false,
      });
      assert.ok(res);
      assert.equal(res.templateOnly, true);
      assert.equal(res.writeApplied, false);
      assert.ok(
        res.catalogYaml.includes("custom-music-service") || res.catalogYaml.includes("eos-system-control-plane"),
      );
    });

    it("evaluates eos_spotify_xirp_context with syncFiles=false and syncFiles=true", () => {
      const compileOnly = phase5.eos_spotify_xirp_context({ syncFiles: false });
      assert.ok(compileOnly);
      assert.equal(compileOnly.registeredFleetProjects, 9);

      const syncFiles = phase5.eos_spotify_xirp_context({ syncFiles: true });
      assert.ok(syncFiles);
      assert.equal(typeof syncFiles.sha256, "string");
    });

    it("evaluates eos_spotify_fleetshift_batch with targetFleet and dryRun", () => {
      const batch = phase5.eos_spotify_fleetshift_batch({
        migrationId: "MIG-ELEVATION-001",
        targetFleet: ["eos-system"],
        apply: false,
      });
      assert.ok(batch);
      assert.equal(batch.status, "PLAN_ONLY");
      assert.equal(batch.migrationId, "MIG-ELEVATION-001");
    });

    it("evaluates eos_spotify_canary_manifest with custom service and squad parameters", () => {
      const canary = phase5.eos_spotify_canary_manifest({
        serviceName: "streaming-audio-edge",
        squad: "edge-core",
        p99LatencyMs: 75,
        maxErrorRatePercent: 0.02,
      });
      assert.ok(canary);
      assert.equal(canary.templateOnly, true);
      assert.ok(canary.flaggerCanaryYaml.includes("streaming-audio-edge"));
    });

    it("evaluates eos_spotify_mix_plan with custom camelot keys and duration", () => {
      const plan = phase5.eos_spotify_mix_plan({
        bpmA: 130,
        bpmB: 132,
        keyA: "8A",
        keyB: "9A",
        duration: 8.0,
      });
      assert.ok(plan);
      assert.equal(typeof plan.harmonicTransitionCost, "number");
      assert.equal(plan.durationSeconds, 8.0);
    });

    it("evaluates eos_spotify_taste_profile with custom userId", () => {
      const centroid = phase5.eos_spotify_taste_profile({ userId: "audiophile-elevated" });
      assert.ok(centroid);
      assert.equal(centroid.userId, "audiophile-elevated");
      assert.equal(typeof centroid.centroid.tempo, "number");
    });

    it("evaluates eos_spotify_shuffle with custom tracks array and seed", () => {
      const customTracks = [
        { id: "trk:1", artistId: "ArtistA", bpm: 128, camelotKey: "8A" },
        { id: "trk:2", artistId: "ArtistB", bpm: 130, camelotKey: "9A" },
      ];
      const result = phase5.eos_spotify_shuffle({ tracks: customTracks, seed: 9999 });
      assert.ok(result);
      assert.equal(result.orderedIds.length, 2);

      const defaultShuffle = phase5.eos_spotify_shuffle({ tracks: [], seed: 42 });
      assert.ok(defaultShuffle);
      assert.equal(defaultShuffle.orderedIds.length, 5);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Phase 6 Domain Handlers
  // -------------------------------------------------------------------------
  describe("4. Phase 6 Domain Handlers Deep Branches", () => {
    const phase6 = createPhase6DomainHandlers({
      projectRoot: root,
      resolveProjectPath: sharedContext.resolveProjectPath,
    });

    it("evaluates eos_fleet_registry_sync with dryRun=true", () => {
      const syncRes = phase6.eos_fleet_registry_sync({ dryRun: true });
      assert.ok(syncRes);
      assert.equal(syncRes.dryRun, true);
      assert.equal(syncRes.totalRegistered, 9);
    });

    it("evaluates eos_fleet_mission_control with probe=false", () => {
      const mcRes = phase6.eos_fleet_mission_control({ probe: false });
      assert.ok(mcRes);
      assert.ok(mcRes.registrySha256);
      assert.equal(mcRes.totalProjects, 9);
    });

    it("evaluates eos_fleet_elevate apply=false and bounds validation on apply=true", () => {
      const invOnly = phase6.eos_fleet_elevate({ apply: false });
      assert.equal(invOnly.status, "LOCAL_INVENTORY_ONLY");
      assert.equal(invOnly.writeApplied, false);

      assert.throws(
        () => phase6.eos_fleet_elevate({ apply: true, targetProjectId: "" }),
        /Applying requires one registered targetProjectId no longer than 128 bytes/,
      );

      assert.throws(
        () => phase6.eos_fleet_elevate({ apply: true, targetProjectId: "x".repeat(200) }),
        /Applying requires one registered targetProjectId no longer than 128 bytes/,
      );
    });

    it("evaluates eos_fleet_verify target=all and simulated degraded", () => {
      const normalRes = phase6.eos_fleet_verify({
        target: "all",
        recordToLedger: false,
        simulateDegraded: false,
      });
      assert.ok(normalRes);
      assert.equal(normalRes.status, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");

      const degradedRes = phase6.eos_fleet_verify({
        target: "all",
        recordToLedger: false,
        simulateDegraded: true,
      });
      assert.ok(degradedRes);
      assert.equal(degradedRes.status, "DEGRADED");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Phase 7 Domain, Verification, and Runtime Handlers
  // -------------------------------------------------------------------------
  describe("5. Phase 7 Domain & Sub-Dispatcher Deep Branches", () => {
    const phase7 = createPhase7DomainHandlers({
      projectRoot: root,
      resolveProjectPath: sharedContext.resolveProjectPath,
      resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
    });

    it("asserts createPhase7DomainHandlers binds registered handlers correctly", () => {
      assert.equal(typeof phase7.eos_contract_governor, "function");
      assert.equal(typeof phase7.eos_fuzz_hypervisor, "function");
      assert.equal(typeof phase7.eos_smt_reasoning_prover, "function");
    });

    it("evaluates dispatchPhase7VerificationCase for contract evolution with raw schema objects", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };

      const result = dispatchPhase7VerificationCase(
        "eos_contract_governor",
        {
          baseSchema: {
            contractId: "ContractV1",
            version: "1.0.0",
            fields: [{ name: "id", type: "string", optional: false }],
          },
          candidateSchema: {
            contractId: "ContractV2",
            version: "1.1.0",
            fields: [
              { name: "id", type: "string", optional: false },
              { name: "tag", type: "string", optional: true },
            ],
          },
          allowBreakingChanges: true,
        },
        deps,
      );
      assert.ok(result);
      assert.equal(result.gateVerdict, "APPROVED");
    });

    it("evaluates dispatchPhase7VerificationCase for empty contracts fallback", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };

      const result = dispatchPhase7VerificationCase("eos_contract_governor", {}, deps);
      assert.ok(result);
      assert.equal(result.baseContractId, "EmptyBase");
      assert.equal(result.candidateContractId, "EmptyCandidate");
    });

    it("evaluates dispatchPhase7VerificationCase for SMT prover with custom rules array", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };

      const proof = dispatchPhase7VerificationCase(
        "eos_smt_reasoning_prover",
        {
          mode: "abac",
          principalRole: "security_auditor",
          targetAction: "audit_read",
          rules: [
            { role: "security_auditor", action: "audit_read", allow: true },
            { role: "guest", action: "ledger_write", allow: false },
          ],
          recordToLedger: false,
        },
        deps,
      );
      assert.ok(proof);
      assert.ok(proof.theoremName.includes("security_auditor_audit_read"));
      assert.equal(typeof proof.isSatisfiable, "boolean");
    });

    it("throws on unknown tool in dispatchPhase7VerificationCase", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };
      assert.throws(
        () => dispatchPhase7VerificationCase("eos_unknown_nonexistent_verification_tool", {}, deps),
        /Phase-7 verification & governance handler missing case/,
      );
    });

    it("evaluates dispatchPhase7RuntimeCase for fuzz hypervisor time_travel and introspection", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };

      const timeTravel = dispatchPhase7RuntimeCase(
        "eos_fuzz_hypervisor",
        { action: "time_travel", targetHeight: 3 },
        deps,
      );
      assert.ok(timeTravel);
      assert.equal(timeTravel.chainVerified, true);

      const introspection = dispatchPhase7RuntimeCase("eos_fuzz_hypervisor", { action: "introspection" }, deps);
      assert.ok(introspection);
      assert.equal(introspection.status, "PERFECT_SYNCHRONY");

      const comp = dispatchPhase7RuntimeCase(
        "eos_fuzz_hypervisor",
        { action: "comprehensive", seed: 42, iterations: 5, recordToLedger: false },
        deps,
      );
      assert.ok(comp);
      assert.ok(comp.verdict);
    });

    it("throws on unknown tool in dispatchPhase7RuntimeCase", () => {
      const deps = {
        projectRoot: root,
        resolveProjectPath: sharedContext.resolveProjectPath,
        resolveConfinedLedgerPath: sharedContext.resolveConfinedLedgerPath,
      };
      assert.throws(
        () => dispatchPhase7RuntimeCase("eos_unknown_nonexistent_runtime_tool", {}, deps),
        /Phase-7 runtime & assurance handler missing case/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. Phase 8 AGI Handlers
  // -------------------------------------------------------------------------
  describe("6. Phase 8 AGI Handlers Deep Branches", () => {
    const tmpAgiRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-agi-mcp-"));
    fs.writeFileSync(path.join(tmpAgiRoot, "package.json"), fs.readFileSync(path.join(root, "package.json")));
    const phase8 = createPhase8AgiHandlers({ projectRoot: tmpAgiRoot });

    after(() => {
      try {
        fs.rmSync(tmpAgiRoot, { recursive: true, force: true });
      } catch {
        // Best-effort test fixture cleanup
      }
    });

    it("evaluates eos_consult with context and constraints passed", () => {
      const consult = phase8.eos_consult({
        problem: "Zero-dependency kernel optimization",
        engagementType: "FOCUSED",
        techStack: "NODE_TYPESCRIPT",
        context: "Sovereign Layer-0 node.js architecture",
        constraints: "Strict zero external npm dependencies",
      });
      assert.ok(consult.engagementId);
      assert.ok(consult.savedTo);

      const consultDir = path.join(root, "docs/consulting");
      if (fs.existsSync(consultDir)) fs.rmSync(consultDir, { recursive: true, force: true });
    });

    it("evaluates eos_agi_solve with thought branches and progress callbacks", async () => {
      const result = await phase8.eos_agi_solve(
        {
          objective: "Occam's razor hypothesis test",
          branches: [
            {
              id: "BRANCH-001",
              strategy: "Verify node version command",
              estimatedComplexity: 1,
              testCommandOverride: "node -v",
            },
          ],
          testCommand: "node -v",
          timeoutMs: 10000,
        },
        sharedContext,
      );
      assert.ok(result);
      assert.equal(typeof result.solved, "boolean");
      assert.ok(Array.isArray(result.progressEvents));
    });

    it("evaluates eos_forge_tool with valid module source and cleans up", () => {
      const forged = phase8.eos_forge_tool({
        toolName: "unit_test_probe_tool",
        description: "Test probe tool for branch coverage",
        inputSchema: { type: "object", properties: { key: { type: "string" } } },
        moduleSource:
          'export const name = "eos_unit_test_probe_tool";\n' +
          'export const description = "Test probe tool for branch coverage";\n' +
          'export const inputSchema = { type: "object" };\n' +
          'export async function execute(args) { return { status: "OK", echo: args.key }; }',
      });
      assert.ok(forged);
      assert.equal(forged.toolName, "eos_unit_test_probe_tool");
      assert.equal(forged.success, true);

      // Clean up forged tool
      const forge = new EosDynamicToolForge(root);
      forge.destroy("unit_test_probe_tool");
    });

    it("evaluates eos_context_window with custom token budget and false toggles", () => {
      const ctxWin = phase8.eos_context_window({
        objective: "Sovereign audit",
        targetFile: "package.json",
        tokenBudget: 16000,
        includeTests: false,
        includeSpecs: false,
      });
      assert.ok(ctxWin);
      assert.equal(typeof ctxWin.totalTokensUsed, "number");
      assert.equal(ctxWin.tokenBudget, 16000);
    });

    it("evaluates eos_spec_drift with custom driftThresholdDays and checkOrphanSpecs=false", () => {
      const drift = phase8.eos_spec_drift({
        driftThresholdDays: 14,
        checkOrphanSpecs: false,
      });
      assert.ok(drift);
      assert.equal(typeof drift.totalSpecsScanned, "number");
    });

    it("evaluates eos_consult empty problem and default context/constraints", () => {
      const empty = phase8.eos_consult({});
      assert.equal(empty.error, "problem field is required");

      const consult = phase8.eos_consult({
        problem: "Kernel pure verification",
        engagementType: "RAPID",
        techStack: "NODE_TYPESCRIPT",
      });
      assert.ok(consult.engagementId);
    });

    it("evaluates eos_context_window and spec_drift with truthy defaults", () => {
      const ctxWin = phase8.eos_context_window({
        objective: "Sovereign default audit",
        targetFile: "package.json",
        includeTests: true,
        includeSpecs: true,
      });
      assert.ok(ctxWin);

      const drift = phase8.eos_spec_drift({ checkOrphanSpecs: true });
      assert.ok(drift);
    });

    it("evaluates eos_pipeline with default testCommand and arguments", async () => {
      const res = await phase8.eos_pipeline({
        problem: "Default testCommand pipeline verify",
        targetFile: "package.json",
      });
      assert.ok(res);
      assert.equal(res.solved, false);
      assert.ok(res.error);
    });

    it("evaluates eos_pipeline solving with target file and fallback router", async () => {
      const pipelineRes = await phase8.eos_pipeline({
        problem: "Verify pipeline branch dispatch",
        targetFile: "package.json",
        testCommand: "node -v",
        tokenBudget: 8000,
        branchCount: 1,
        timeoutMs: 5000,
      });
      assert.ok(pipelineRes);
      assert.equal(typeof pipelineRes.pipelineHash, "string");
    });
  });

  // -------------------------------------------------------------------------
  // 7. Antigravity eos-hook.mjs Lifecycle & Gamma Security Guard
  // -------------------------------------------------------------------------
  describe("7. Antigravity eos-hook.mjs Lifecycle & Security Guard", () => {
    it("evaluates all 5 GAMMA destructive rules", () => {
      const patterns = [
        "rm -rf /",
        "rm -rf ~",
        "git push --force origin main",
        "git push -f origin master",
        "DROP DATABASE production",
        "DROP TABLE users",
        "Format-Volume -DriveLetter D",
        "del /s /q C:\\",
        "rmdir /s /q d:\\",
      ];
      for (const cmd of patterns) {
        const payload = JSON.stringify({ toolCall: { args: { CommandLine: cmd } } });
        const res = evaluateHookEvent("PreToolUse", payload);
        assert.equal(res.decision, "deny", `Expected deny for: ${cmd}`);
        assert.ok(res.reason.includes("Blocked by EOS Gamma Security Barrier"));
      }

      // Safe commands allowed
      const safe = evaluateHookEvent("PreToolUse", JSON.stringify({ toolCall: { args: { CommandLine: "npm test" } } }));
      assert.equal(safe.decision, "allow");

      // Empty / malformed payload fallback
      const emptyRes = evaluateHookEvent("PreToolUse", "");
      assert.equal(emptyRes.decision, "allow");

      const badJson = evaluateHookEvent("PreToolUse", "not-json");
      assert.equal(badJson.decision, "allow");

      // Unknown event returns {}
      const unknownEvent = evaluateHookEvent("UnknownEvent", "{}");
      assert.deepEqual(unknownEvent, {});
    });

    it("evaluates maybeTriggerOpportunisticGentlemanUpdate edge cases", () => {
      // Non-existent project root
      const noBin = maybeTriggerOpportunisticGentlemanUpdate("/non/existent/root/path");
      assert.equal(noBin.triggered, false);
      assert.equal(noBin.reason, "EOS_BIN_NOT_FOUND");

      // Real project root with dryRun
      const dry = maybeTriggerOpportunisticGentlemanUpdate(root, { dryRun: true, ttlMs: 0 });
      assert.ok(typeof dry.triggered === "boolean");
      assert.ok(typeof dry.reason === "string");

      // Active lock file
      const lockDir = path.join(root, ".eos", "state");
      fs.mkdirSync(lockDir, { recursive: true });
      const lockPath = path.join(lockDir, "gentleman-autoupdate.lock");
      fs.writeFileSync(lockPath, JSON.stringify({ acquiredAtMs: Date.now() }), "utf8");
      try {
        const locked = maybeTriggerOpportunisticGentlemanUpdate(root, { dryRun: true });
        assert.equal(locked.triggered, false);
        assert.equal(locked.reason, "LOCK_ACTIVE");
      } finally {
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. EosNsaCryptoSuite Military-Grade AES-GCM & Memory Zeroization
  // -------------------------------------------------------------------------
  describe("8. EosNsaCryptoSuite Military-Grade AES-GCM & Zeroization", () => {
    it("generates 256-bit keys and encrypts/decrypts with AAD and digests", () => {
      const key = EosNsaCryptoSuite.generateKey256();
      assert.equal(key.length, 32);

      // Encrypt with string plaintext and string AAD
      const env1 = EosNsaCryptoSuite.encryptAesGcm256("Top secret flight coordinates", key, "CLASSIFIED//TS//NOFORN");
      assert.equal(env1.algorithm, "AES-256-GCM");
      assert.equal(typeof env1.sha384Digest, "string");
      assert.equal(env1.aad, "CLASSIFIED//TS//NOFORN");

      const dec1 = EosNsaCryptoSuite.decryptAesGcm256(env1, key);
      assert.equal(dec1.toString("utf8"), "Top secret flight coordinates");

      // Encrypt with Buffer plaintext and Buffer AAD
      const env2 = EosNsaCryptoSuite.encryptAesGcm256(Buffer.from("Payload bytes"), key, Buffer.from("AAD bytes"));
      const dec2 = EosNsaCryptoSuite.decryptAesGcm256(env2, key);
      assert.equal(dec2.toString("utf8"), "Payload bytes");

      // SHA-384 and SHA-512
      assert.equal(typeof EosNsaCryptoSuite.computeSha384("data"), "string");
      assert.equal(typeof EosNsaCryptoSuite.computeSha512("data"), "string");
    });

    it("fails closed on tampering, mismatched AAD, or invalid keys", () => {
      const key = EosNsaCryptoSuite.generateKey256();
      const env = EosNsaCryptoSuite.encryptAesGcm256("Hermetic data", key, "AAD");

      // Invalid key size
      assert.throws(() => EosNsaCryptoSuite.encryptAesGcm256("data", Buffer.alloc(16)), /Key must be exactly 32 bytes/);
      assert.throws(() => EosNsaCryptoSuite.decryptAesGcm256(env, Buffer.alloc(16)), /Key must be exactly 32 bytes/);

      // Invalid IV length
      assert.throws(() => EosNsaCryptoSuite.decryptAesGcm256({ ...env, iv: "abcd" }, key), /Invalid IV length/);

      // Invalid AuthTag length
      assert.throws(
        () => EosNsaCryptoSuite.decryptAesGcm256({ ...env, authTag: "abcd" }, key),
        /Invalid AuthTag length/,
      );

      // Tampered ciphertext
      const tamperedCiphertext = env.ciphertext.slice(0, -2) + (env.ciphertext.endsWith("00") ? "11" : "00");
      assert.throws(
        () => EosNsaCryptoSuite.decryptAesGcm256({ ...env, ciphertext: tamperedCiphertext }, key),
        /AES-GCM AuthTag validation failed/,
      );

      // Mismatched AAD
      assert.throws(
        () => EosNsaCryptoSuite.decryptAesGcm256({ ...env, aad: "TAMPERED_AAD" }, key),
        /AES-GCM AuthTag validation failed/,
      );
    });

    it("verifies constant-time comparison and in-place DoD 4-pass zeroization", () => {
      // Constant-time compare
      assert.equal(EosNsaCryptoSuite.constantTimeCompare("secret-token", "secret-token"), true);
      assert.equal(EosNsaCryptoSuite.constantTimeCompare("secret-token", "wrong-length-t"), false);
      assert.equal(EosNsaCryptoSuite.constantTimeCompare("secret-token-a", "secret-token-b"), false);

      // Zeroization
      const buf = Buffer.from("super-sensitive-cryptographic-master-key-bytes");
      assert.equal(EosNsaCryptoSuite.isZeroized(buf), false);
      EosNsaCryptoSuite.zeroizeBuffer(buf);
      assert.equal(EosNsaCryptoSuite.isZeroized(buf), true);

      // Empty buffer edge case
      const emptyBuf = Buffer.alloc(0);
      EosNsaCryptoSuite.zeroizeBuffer(emptyBuf);
      assert.equal(EosNsaCryptoSuite.isZeroized(emptyBuf), true);
    });
  });

  // -------------------------------------------------------------------------
  // 9. EosBigTechProductFactory Policy & Gate Deep Branches
  // -------------------------------------------------------------------------
  describe("9. EosBigTechProductFactory Policy & Gate Deep Branches", () => {
    it("evaluates isLeastPrivilegeProductPolicyPack branches", () => {
      // Empty policies
      assert.equal(isLeastPrivilegeProductPolicyPack([]), false);

      // Broad prefix
      const broad = [{ id: "P1", tenantId: "T1", roles: ["admin"], actions: ["all"], resourcePrefix: "mcp/tools/" }];
      assert.equal(isLeastPrivilegeProductPolicyPack(broad), false);

      // Missing fine prefix
      const partial = [
        {
          id: "P1",
          tenantId: "T1",
          roles: ["admin"],
          actions: ["all"],
          resourcePrefix: "mcp/tools/eos_product_deliver_run",
        },
      ];
      assert.equal(isLeastPrivilegeProductPolicyPack(partial), false);

      // All fine prefixes
      const fine = [
        {
          id: "P1",
          tenantId: "T1",
          roles: ["admin"],
          actions: ["all"],
          resourcePrefix: "mcp/tools/eos_product_deliver_run",
        },
        {
          id: "P2",
          tenantId: "T1",
          roles: ["admin"],
          actions: ["all"],
          resourcePrefix: "mcp/tools/eos_product_foundry_create",
        },
        {
          id: "P3",
          tenantId: "T1",
          roles: ["admin"],
          actions: ["all"],
          resourcePrefix: "mcp/tools/eos_manage_worktree",
        },
        {
          id: "P4",
          tenantId: "T1",
          roles: ["admin"],
          actions: ["all"],
          resourcePrefix: "mcp/tools/eos_autonomous_heal",
        },
      ];
      assert.equal(isLeastPrivilegeProductPolicyPack(fine), true);
    });

    it("evaluates loadDefaultIamPolicyPack and defaultFactoryPrincipal", () => {
      const pack = loadDefaultIamPolicyPack(root);
      assert.ok(Array.isArray(pack));

      const fakePack = loadDefaultIamPolicyPack("/non/existent/path");
      assert.deepEqual(fakePack, []);

      const principal = defaultFactoryPrincipal();
      assert.equal(principal.subjectId, "factory-dogfood");
      assert.equal(principal.roles.includes("engineer"), true);
    });

    it("evaluates runBigTechProductFactory with unauthorized principal and default options", () => {
      const manifest = buildDemoLedgerManifest();
      const blocked = runBigTechProductFactory(manifest, {
        dryRun: true,
        principal: { subjectId: "unauthorized", tenantId: "tenant-local", roles: [] },
      });
      assert.equal(blocked.status, "BLOCKED");
      assert.equal(blocked.reason, "IAM_DENIED");

      const success = runBigTechProductFactory(manifest, { dryRun: true });
      assert.equal(success.status, "SUCCESS");
    });
  });

  // -------------------------------------------------------------------------
  // 10. EosEngineeringWorkflow Candidate Commands & Input Bounds
  // -------------------------------------------------------------------------
  describe("10. EosEngineeringWorkflow Candidate Commands & Input Bounds", () => {
    it("evaluates candidateValidationCommands across polyglot stacks", () => {
      const wf = new EosEngineeringWorkflow(root);
      const inspection = wf.inspect(root);
      assert.ok(inspection.audit);

      const cmds = wf.candidateValidationCommands(root, inspection.audit);
      assert.ok(Array.isArray(cmds));
      assert.ok(cmds.length > 0);
    });

    it("evaluates plan input validation and throws on excessive task length", () => {
      const wf = new EosEngineeringWorkflow(root);
      assert.throws(() => wf.plan(root, "x".repeat(600)), /Task must contain 1 to 512 UTF-8 bytes/);

      const plan = wf.plan(root, "Verify engineering workflow invariants");
      assert.equal(plan.planStatus, "PLAN_ONLY");
      assert.equal(plan.executionPerformed, false);
      assert.ok(plan.audit);
    });

    it("throws on invalid workflow ID in readRecord", () => {
      const wf = new EosEngineeringWorkflow(root);
      assert.throws(
        () => wf.readRecord(root, "not-a-valid-uuid-v4"),
        /Workflow ID must be a UUID returned by flow start/,
      );
    });
  });
});
