/**
 * EOS SYSTEM — LAYER-0 EXPANDED BRANCH COVERAGE SUITE (SPEC-160 / SPEC-146 / SPEC-141 / SPEC-145)
 *
 * Dedicated branch-exhaustion coverage across pure Layer-0 modules:
 * 1. EosAdaptiveRateLimiter (SPEC-153): Token bucket, sliding window eviction, AIMD expand/contract, deny paths.
 * 2. EosPeakAssuranceTcb (SPEC-146): Origin allowlist, payload bound, token hash & constant-time verify, Law IV barrier.
 * 3. EosAkashicMemory (SPEC-141): Samaelian factor & Sephirah classification, odd-proportional routing, RDD 4R templates.
 * 4. EosHybridKnowledgeEngine (SPEC-141): In-memory SQLite FTS5 + dense vector cosine similarity, RRF, lexical, vector, and hybrid retrieval.
 * 5. EosKnowledgeGraphEngine (SPEC-145): In-memory directed property graph, nodes, edges, blast-radius walk, memory closure, orphan analysis.
 * 6. EosNocturnalEvolutionEngine (SPEC-133): Nocturnal Darwinian evolution sweep, AlphaEvolve fitness score, SHA-256 ledger attestation.
 * 7. EosErrorCatalog (SPEC-120): Typed error taxonomy, error codes, prototype inheritance, and structured diagnostic payloads.
 * 8. EosLinuxKernelCore (SPEC-099): 7 pillars catalog, VFS proc fixtures, and EosRcuCell snapshot state management.
 *
 * Zero external runtime dependencies. Node 24 type-strip compliant.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { EosAdaptiveRateLimiter } from "../src/core/eosAdaptiveRateLimiter.ts";
import {
  isOriginAllowed,
  isPayloadWithinBound,
  hashToken,
  verifySessionTokenBinding,
  evaluateLawIvWriteBarrier,
  evaluateMcpAdmission,
  evaluateExternalWrite,
  MCP_MAX_PAYLOAD_BYTES,
  TCB_MUTATION_SCORE_FLOOR,
  TCB_MUTATION_TARGET_SNIPPET,
} from "../src/core/eosPeakAssuranceTcb.ts";
import {
  classifySamaelianFactorAndSephirah,
  evaluateOddProportionalRouting,
  createRddFourRLensesReviewTemplate,
  MEMORY_CAPABILITY_REFERENCE_CATALOG,
} from "../src/core/eosAkashicMemory.ts";
import { EosHybridKnowledgeEngine } from "../src/core/eosHybridKnowledgeEngine.ts";
import { EosKnowledgeGraphEngine } from "../src/core/eosKnowledgeGraphEngine.ts";
import { EosNocturnalEvolutionEngine } from "../src/core/eosNocturnalEvolutionEngine.ts";
import {
  EosFleetError,
  EosFleetPathNotFoundError,
  EosFleetGitError,
  EosPipelineError,
  EosSecretLeakError,
  EosArchitectureViolationError,
  EosCircularDependencyError,
  EosHealingError,
  EOS_ERROR_CODES,
} from "../src/core/eosErrorCatalog.ts";
import { LINUX_KERNEL_7_PILLARS, EOS_VFS_PROC_NODES, EosRcuCell } from "../src/core/eosLinuxKernelCore.ts";
import {
  ALLOWED_COLORS,
  getTokenSystemSummary,
  validateCssAgainstTokens,
  validateHtmlAgainstTokens,
} from "../src/core/eosDesignTokens.ts";
import {
  architecturalGrid,
  gridCell,
  telemetryHeader,
  spotlightPanel,
  codeBlock,
  consoleTrace,
  generatePrimitivesCSS,
  generateSpotlightScript,
} from "../src/core/eosDesignPrimitives.ts";
import {
  EosUniversalAgentSessionContract,
  SUPPORTED_IDE_FAMILIES,
  PREFERRED_IDE_FAMILIES,
} from "../src/core/eosUniversalAgentSessionContract.ts";
import { CANONICAL_FLEET_PROJECTS, evaluateFleetStatusSnapshot } from "../src/core/eosFleetDispatcher.ts";
import {
  EosL1SoAArena,
  FIVE_NANOSECOND_ENGINEERING_SECRETS,
  WORLD_TOP_5_FASTEST_SOFTWARE,
  compileNaturalInstructionToEosSpec,
} from "../src/core/eosNanosecondEngine.ts";
import { EosPipeline } from "../src/core/eosPipeline.ts";
import { EosBlackProjectsTriad } from "../src/core/eosBlackProjectsTriad.ts";
import { EosPlanetaryApexDoctrine } from "../src/core/eosPlanetaryApexDoctrine.ts";
import { BIGTECH_7_CROWN_JEWELS, BIGTECH_SCENARIO_CATALOG } from "../src/core/eosBigTechPantheon.ts";
import { ARBOL_DE_LA_VIDA_13, MANDATO_TEURGICO, PRACTICAS_OPERATIVAS } from "../src/core/samaelCodex.ts";

describe("Layer-0 Expanded Branch Coverage Suite", () => {
  describe("EosAdaptiveRateLimiter (SPEC-153)", () => {
    it("manages token bucket acquisition, AIMD capacity scaling, and sliding window eviction", () => {
      const limiter = new EosAdaptiveRateLimiter({
        bucketCapacity: 3,
        refillRatePerSec: 10,
        windowSizeMs: 50,
        maxPerWindow: 5,
        adaptive: true,
      });

      // 1. Initial acquires within capacity
      const first = limiter.tryAcquire();
      assert.equal(first.allowed, true);
      assert.equal(first.retryAfterMs, 0);
      assert.ok(first.currentCapacity >= 3);

      const second = limiter.tryAcquire();
      assert.equal(second.allowed, true);

      const third = limiter.tryAcquire();
      assert.equal(third.allowed, true);

      // 2. Token exhaustion deny path
      const exhausted = limiter.tryAcquire();
      assert.equal(exhausted.allowed, false);
      assert.ok(exhausted.retryAfterMs > 0);
      assert.ok(exhausted.rejectionRatio > 0);

      // 3. Stats reporting
      const stats = limiter.getStats();
      assert.equal(stats.totalRequests, 4);
      assert.equal(stats.totalRejections, 1);
      assert.ok(stats.currentCapacity >= 1);

      // 4. Test non-adaptive mode with window saturation
      const fixedLimiter = new EosAdaptiveRateLimiter({
        bucketCapacity: 10,
        refillRatePerSec: 1,
        windowSizeMs: 1000,
        maxPerWindow: 2,
        adaptive: false,
      });

      assert.equal(fixedLimiter.tryAcquire().allowed, true);
      assert.equal(fixedLimiter.tryAcquire().allowed, true);
      // Window is now full (2 max per window)
      const windowDenied = fixedLimiter.tryAcquire();
      assert.equal(windowDenied.allowed, false);
      assert.equal(windowDenied.remainingTokens, 0);
    });
  });

  describe("EosPeakAssuranceTcb (SPEC-146)", () => {
    it("validates origins, payload bounds, token bindings, and Law IV write barriers", () => {
      assert.equal(MCP_MAX_PAYLOAD_BYTES, 1048576);
      assert.equal(TCB_MUTATION_SCORE_FLOOR, 80);
      assert.ok(TCB_MUTATION_TARGET_SNIPPET.includes("function admit"));

      // isOriginAllowed branches
      assert.equal(isOriginAllowed(undefined, ["http://localhost:3000"]), false);
      assert.equal(isOriginAllowed("", ["http://localhost:3000"]), false);
      assert.equal(isOriginAllowed("   ", ["http://localhost:3000"]), false);
      assert.equal(isOriginAllowed("https://evil.com", []), false);
      assert.equal(isOriginAllowed("https://evil.com", ["https://app.glorian.ai"]), false);
      assert.equal(isOriginAllowed("https://app.glorian.ai", ["https://app.glorian.ai"]), true);

      // isPayloadWithinBound branches
      assert.equal(isPayloadWithinBound(512), true);
      assert.equal(isPayloadWithinBound(MCP_MAX_PAYLOAD_BYTES), true);
      assert.equal(isPayloadWithinBound(MCP_MAX_PAYLOAD_BYTES + 1), false);
      assert.throws(() => isPayloadWithinBound(-1), /TCB_PRECONDITION_FAILED/);
      assert.throws(() => isPayloadWithinBound(10, 500), /TCB_PRECONDITION_FAILED/);

      // hashToken and verifySessionTokenBinding branches
      const token = crypto.randomBytes(32).toString("hex");
      assert.throws(() => hashToken("too-short"), /TCB_PRECONDITION_FAILED/);
      const tokenHash = hashToken(token);
      assert.equal(/^[a-f0-9]{64}$/.test(tokenHash), true);

      assert.equal(verifySessionTokenBinding(tokenHash, token), true);
      const invalidToken = crypto.randomBytes(32).toString("hex");
      assert.equal(verifySessionTokenBinding(tokenHash, invalidToken), false);
      assert.throws(() => verifySessionTokenBinding("invalid-hash", token), /TCB_PRECONDITION_FAILED/);

      // evaluateLawIvWriteBarrier branches
      const validPreconditions = {
        registered: true,
        intakeComplete: true,
        specificationApproved: true,
        auditComplete: true,
        ownerApproval: true,
        implementationAuthorized: true,
      };
      assert.equal(evaluateLawIvWriteBarrier(validPreconditions), true);
      assert.equal(evaluateExternalWrite(validPreconditions).admitted, true);

      const invalidPreconditions = { ...validPreconditions, auditComplete: false };
      assert.equal(evaluateLawIvWriteBarrier(invalidPreconditions), false);
      const writeDenied = evaluateExternalWrite(invalidPreconditions);
      assert.equal(writeDenied.admitted, false);
      assert.equal(writeDenied.reason, "LAW_IV_INCOMPLETE");
      assert.equal(writeDenied.statusCode, 403);

      // evaluateMcpAdmission branches
      const allowlist = ["https://app.glorian.ai"];

      // 1. Origin denied
      const admOriginFail = evaluateMcpAdmission({
        origin: "https://attacker.org",
        allowlist,
        payloadBytes: 100,
        presentedToken: token,
      });
      assert.equal(admOriginFail.admitted, false);
      assert.equal(admOriginFail.reason, "ORIGIN_DENIED");
      assert.equal(admOriginFail.statusCode, 403);

      // 2. Payload too large
      const admPayloadFail = evaluateMcpAdmission({
        origin: "https://app.glorian.ai",
        allowlist,
        payloadBytes: MCP_MAX_PAYLOAD_BYTES + 10,
        presentedToken: token,
      });
      assert.equal(admPayloadFail.admitted, false);
      assert.equal(admPayloadFail.reason, "PAYLOAD_TOO_LARGE");
      assert.equal(admPayloadFail.statusCode, 413);

      // 3. Missing token
      const admMissingToken = evaluateMcpAdmission({
        origin: "https://app.glorian.ai",
        allowlist,
        payloadBytes: 100,
      });
      assert.equal(admMissingToken.admitted, false);
      assert.equal(admMissingToken.reason, "MISSING_TOKEN");
      assert.equal(admMissingToken.statusCode, 401);

      // 4. Token mismatch
      const admMismatch = evaluateMcpAdmission({
        origin: "https://app.glorian.ai",
        allowlist,
        payloadBytes: 100,
        sessionTokenHash: tokenHash,
        presentedToken: invalidToken,
      });
      assert.equal(admMismatch.admitted, false);
      assert.equal(admMismatch.reason, "TOKEN_BINDING_MISMATCH");
      assert.equal(admMismatch.statusCode, 401);

      // 5. Admitted success path (with token binding)
      const admSuccess = evaluateMcpAdmission({
        origin: "https://app.glorian.ai",
        allowlist,
        payloadBytes: 100,
        sessionTokenHash: tokenHash,
        presentedToken: token,
      });
      assert.equal(admSuccess.admitted, true);
      assert.equal(admSuccess.statusCode, 200);

      // 6. Admitted success path (without sessionTokenHash binding)
      const admSuccessNoBind = evaluateMcpAdmission({
        origin: "https://app.glorian.ai",
        allowlist,
        payloadBytes: 100,
        presentedToken: token,
      });
      assert.equal(admSuccessNoBind.admitted, true);
    });
  });

  describe("EosAkashicMemory (SPEC-141)", () => {
    it("classifies Samaelian factors and Sephirah, evaluates routing, and builds templates", () => {
      assert.ok(Array.isArray(MEMORY_CAPABILITY_REFERENCE_CATALOG));
      assert.ok(MEMORY_CAPABILITY_REFERENCE_CATALOG.length > 0);

      // classifySamaelianFactorAndSephirah branches
      const bugfixClass = classifySamaelianFactorAndSephirah("bugfix", "Fixing memory leak in worker");
      assert.equal(bugfixClass.factor, "MORIR");
      assert.ok(bugfixClass.sephirah.includes("Geburah"));

      const errClass = classifySamaelianFactorAndSephirah("manual", "critical error in FDIR protocol");
      assert.equal(errClass.factor, "MORIR");

      const sessionClass = classifySamaelianFactorAndSephirah("session_summary", "Autonomous session wrap-up");
      assert.equal(sessionClass.factor, "SACRIFICIO");
      assert.ok(sessionClass.sephirah.includes("Tiphereth"));

      const handoffClass = classifySamaelianFactorAndSephirah("learning", "handoff documentation for next fleet agent");
      assert.equal(handoffClass.factor, "SACRIFICIO");

      const nacerClass = classifySamaelianFactorAndSephirah("architecture", "Clean Hexagonal Domain Isolation");
      assert.equal(nacerClass.factor, "NACER");
      assert.ok(nacerClass.sephirah.includes("Daath"));

      // evaluateOddProportionalRouting branches
      const highRiskRoute = evaluateOddProportionalRouting("Migrate database schema for auth security");
      assert.equal(highRiskRoute.sizeTier, "LARGE_FEATURE_DOC");
      assert.equal(highRiskRoute.delegationReason, "INDEPENDENT_VERIFIER");
      assert.equal(highRiskRoute.publicState, "Checking");

      const normalRoute = evaluateOddProportionalRouting("Format comments in utils file");
      assert.equal(normalRoute.sizeTier, "SMALL_INLINE");
      assert.equal(normalRoute.delegationReason, "NONE_INLINE");
      assert.equal(normalRoute.publicState, "Ready");

      const emptyRoute = evaluateOddProportionalRouting("");
      assert.equal(emptyRoute.sizeTier, "SMALL_INLINE");

      // createRddFourRLensesReviewTemplate
      const review = createRddFourRLensesReviewTemplate("Sample Architecture", "sha256:abc123def456");
      assert.equal(review.riskTier, "NOT_ASSESSED");
      assert.equal(review.epistemicVerdict, "NOT_EXECUTED_TEMPLATE");
      assert.ok(review.lenses.reliability.includes("Sample Architecture"));
    });
  });

  describe("EosHybridKnowledgeEngine (SPEC-141)", () => {
    it("indexes documents and performs lexical, vector, and hybrid search with RRF", () => {
      const engine = new EosHybridKnowledgeEngine(process.cwd(), ":memory:");

      const doc1 = {
        docId: "SPEC-001",
        filePath: "docs/specs/SPEC-001.md",
        category: "SPEC",
        title: "Hexagonal Architecture Specification",
        content: "Hexagonal architecture enforces strict isolation between domain logic and infrastructure adapters.",
      };
      const doc2 = {
        docId: "SPEC-002",
        filePath: "docs/specs/SPEC-002.md",
        category: "SPEC",
        title: "Cryptographic Attestation & WAL Ledger",
        content: "SQLite write-ahead log ensures durable monotonic cryptographic receipts for all verification runs.",
      };
      const doc3 = {
        docId: "ADR-001",
        filePath: "docs/plans/ADR-001.md",
        category: "ADR",
        title: "Decision on Zero External Dependencies",
        content: "Standardize on pure Layer-0 TypeScript without npm packages to guarantee supply-chain immunity.",
      };

      engine.indexDocument(doc1);
      engine.indexDocument(doc2);
      engine.indexDocument(doc3);

      // Verify retrieval by ID
      const retrieved = engine.getDocument("SPEC-001");
      assert.ok(retrieved);
      assert.equal(retrieved.title, "Hexagonal Architecture Specification");

      // Verify stats
      const stats = engine.getStats();
      assert.equal(stats.totalDocuments, 3);
      assert.equal(stats.vectorCount, 3);

      // Lexical search
      const lexicalResults = engine.search("hexagonal architecture", { mode: "lexical", topK: 5 });
      assert.ok(lexicalResults.length > 0);
      assert.equal(lexicalResults[0].id, "SPEC-001");

      // Vector search
      const vectorResults = engine.search("cryptographic receipts", { mode: "vector", topK: 5 });
      assert.ok(vectorResults.length > 0);

      // Hybrid search with category filter
      const hybridResults = engine.search("dependencies architecture", {
        mode: "hybrid",
        topK: 5,
        category: "ADR",
      });
      assert.ok(hybridResults.length > 0);
      assert.equal(hybridResults[0].category, "ADR");

      // Unmatched search query
      const emptyResults = engine.search("xylophone quantum extraterrestrial", { mode: "lexical" });
      assert.equal(emptyResults.length, 0);

      engine.close();
    });
  });

  describe("EosKnowledgeGraphEngine (SPEC-145)", () => {
    it("builds a property graph, navigates blast radius, and detects orphans in memory", () => {
      const graph = new EosKnowledgeGraphEngine(process.cwd(), ":memory:");

      // Add nodes
      graph.upsertNode({
        id: "SPEC-100",
        type: "SPEC",
        title: "Kernel Architecture Spec",
        file: "docs/specs/SPEC-100.md",
        metadata: { tier: 1 },
        sha256: "sha256:1111",
      });
      graph.upsertNode({
        id: "BDD-100",
        type: "BDD",
        title: "Kernel Architecture BDD",
        file: "test/eosKernel.test.mjs",
        metadata: { scenarios: 4 },
        sha256: "sha256:2222",
      });
      graph.upsertNode({
        id: "MOD-100",
        type: "MODULE",
        title: "eosKernelPrimitives.ts",
        file: "src/core/eosKernelPrimitives.ts",
        metadata: { loc: 150 },
        sha256: "sha256:3333",
      });
      graph.upsertNode({
        id: "ORPHAN-001",
        type: "SPEC",
        title: "Orphaned Specification Without BDD",
        file: "docs/specs/ORPHAN-001.md",
        metadata: {},
        sha256: "sha256:4444",
      });

      // Add edges
      graph.upsertEdge({
        sourceId: "SPEC-100",
        targetId: "BDD-100",
        relation: "HAS_SCENARIO",
        weight: 1.0,
      });
      graph.upsertEdge({
        sourceId: "MOD-100",
        targetId: "SPEC-100",
        relation: "IMPLEMENTS",
        weight: 1.0,
      });

      // Retrieve node
      const node = graph.getNode("SPEC-100");
      assert.ok(node);
      assert.equal(node.type, "SPEC");

      // Compute blast radius
      const blastOut = graph.computeBlastRadius("SPEC-100", 2, "OUT");
      assert.ok(blastOut.totalReachable >= 1);
      assert.ok(blastOut.nodes.some((n) => n.id === "BDD-100"));

      const blastIn = graph.computeBlastRadius("SPEC-100", 2, "IN");
      assert.ok(blastIn.totalReachable >= 1);
      assert.ok(blastIn.nodes.some((n) => n.id === "MOD-100"));

      // Compute memory closure
      const closure = graph.computeMemoryClosure("SPEC-100", 2);
      assert.ok(closure.totalReachable >= 1);

      // Find orphans
      const orphans = graph.findOrphans();
      assert.ok(orphans.totalOrphans >= 1);
      assert.ok(orphans.specsWithoutBdd.includes("ORPHAN-001"));

      // Graph stats
      const stats = graph.getGraphStats();
      assert.equal(stats.totalNodes, 4);
      assert.equal(stats.totalEdges, 2);
      assert.ok(stats.graphSha256.length > 0);

      graph.close();
    });
  });

  describe("EosNocturnalEvolutionEngine (SPEC-133)", () => {
    it("executes an autonomous evolution sweep and records an attested receipt", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-nocturnal-test-"));
      let engine;
      try {
        fs.mkdirSync(path.join(tempDir, "src", "core"), { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "src", "core", "sampleModule.ts"),
          "export const A = 1;\nexport const B = 2;\n",
          "utf8",
        );

        engine = new EosNocturnalEvolutionEngine(tempDir);
        const report = engine.runEvolutionSweep({
          targetDir: path.join(tempDir, "src", "core"),
          dryRun: true,
        });

        assert.equal(report.status, "EVOLUTION_CYCLE_COMPLETED");
        assert.ok(report.scannedFilesCount >= 1);
        assert.ok(report.compositeFitnessScore >= 0 && report.compositeFitnessScore <= 100);
        assert.ok(typeof report.sha256Receipt === "string" && report.sha256Receipt.length === 64);
      } finally {
        try {
          if (engine?.ledger?.close) {
            engine.ledger.close();
          }
        } catch {
          /* ignore */
        }
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore Windows file locks */
        }
      }
    });
  });

  describe("EosErrorCatalog (SPEC-120)", () => {
    it("instantiates typed error taxonomy and verifies machine-readable codes and hierarchy", () => {
      assert.ok(typeof EOS_ERROR_CODES === "object");

      // EosFleetError & subtypes
      const fleetErr = new EosFleetError("Generic fleet issue", "proj-alpha");
      assert.equal(fleetErr.name, "EosFleetError");
      assert.equal(fleetErr.code, "EOS_FLEET_001");
      assert.equal(fleetErr.projectId, "proj-alpha");
      assert.ok(fleetErr instanceof Error);

      const pathErr = new EosFleetPathNotFoundError("proj-beta", "/path/to/missing");
      assert.equal(pathErr.name, "EosFleetPathNotFoundError");
      assert.equal(pathErr.code, "EOS_FLEET_002");
      assert.equal(pathErr.localPath, "/path/to/missing");
      assert.ok(pathErr instanceof EosFleetError);

      const gitErr = new EosFleetGitError("proj-gamma", "fatal: not a git repo");
      assert.equal(gitErr.name, "EosFleetGitError");
      assert.equal(gitErr.code, "EOS_FLEET_003");
      assert.equal(gitErr.gitError, "fatal: not a git repo");

      // EosPipelineError & subtypes
      const pipeErr = new EosPipelineError("Build failure", "compile");
      assert.equal(pipeErr.code, "EOS_PIPELINE_001");
      assert.equal(pipeErr.stage, "compile");

      const secretErr = new EosSecretLeakError("config/creds.json", "AWS_SECRET_KEY");
      assert.equal(secretErr.code, "EOS_PIPELINE_002");
      assert.equal(secretErr.filePath, "config/creds.json");
      assert.equal(secretErr.secretType, "AWS_SECRET_KEY");

      // EosArchitectureViolationError & subtypes
      const archErr = new EosArchitectureViolationError("Invalid upward import", "src/core/a.ts", "no-upward");
      assert.equal(archErr.name, "EosArchitectureViolationError");
      assert.equal(archErr.code, "EOS_ARCH_001");

      const circErr = new EosCircularDependencyError(["modA", "modB", "modA"]);
      assert.equal(circErr.code, "EOS_ARCH_002");
      assert.deepEqual(circErr.cycle, ["modA", "modB", "modA"]);

      // EosHealingError
      const healErr = new EosHealingError("Healing convergence timeout", "HEAL-001");
      assert.equal(healErr.name, "EosHealingError");
      assert.equal(healErr.code, "EOS_HEAL_001");
      assert.equal(healErr.targetFile, "HEAL-001");
    });
  });

  describe("EosLinuxKernelCore (SPEC-099)", () => {
    it("exposes the 7 kernel pillars, VFS proc fixtures, and EosRcuCell state transitions", () => {
      assert.equal(LINUX_KERNEL_7_PILLARS.length, 7);
      assert.ok(LINUX_KERNEL_7_PILLARS.some((p) => p.id === "rcu-lockless"));
      assert.ok(LINUX_KERNEL_7_PILLARS.some((p) => p.id === "ebpf-static-verifier"));

      assert.ok(EOS_VFS_PROC_NODES["/proc/eos/version"]);
      assert.ok(EOS_VFS_PROC_NODES["/sys/kernel/ebpf_verifier"]);
      assert.ok(EOS_VFS_PROC_NODES["/dev/anubis_law_gate"]);

      // EosRcuCell snapshot semantics
      const initial = { configVersion: 1, activeCluster: "alpha" };
      const rcu = new EosRcuCell(initial);

      const read1 = rcu.rcuReadDereference();
      assert.deepEqual(read1, initial);

      const updated = rcu.rcuAssignPointer((prev) => ({
        ...prev,
        configVersion: prev.configVersion + 1,
        activeCluster: "beta",
      }));

      assert.equal(updated.generation, 2);
      assert.equal(updated.snapshot.configVersion, 2);
      assert.equal(updated.snapshot.activeCluster, "beta");

      const read2 = rcu.rcuReadDereference();
      assert.equal(read2.configVersion, 2);
      assert.equal(read2.activeCluster, "beta");
    });
  });

  describe("EosDesignTokens (SPEC-052)", () => {
    it("enforces closed color palette and token validation across CSS and HTML", () => {
      assert.ok(typeof ALLOWED_COLORS === "object");
      assert.ok(ALLOWED_COLORS["void"]);
      assert.ok(ALLOWED_COLORS["accent-blue"]);

      const summary = getTokenSystemSummary();
      assert.ok(summary.totalColors >= 10);
      assert.ok(summary.totalAllowedRadii >= 5);
      assert.ok(summary.totalAllowedShadows >= 3);
      assert.ok(summary.totalFonts >= 2);

      // CSS validation branches
      const cleanCss = ".cell { color: #f4f4f5; background: #050505; border-radius: 4px; }";
      const cleanViolations = validateCssAgainstTokens(cleanCss, "clean.css");
      assert.equal(cleanViolations.length, 0);

      const dirtyCss =
        ".bad { color: #123456; border-radius: 16px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); style: inline; }";
      const dirtyViolations = validateCssAgainstTokens(dirtyCss, "dirty.css");
      assert.ok(dirtyViolations.length >= 2);
      assert.ok(dirtyViolations.some((v) => v.rule === "NO_RAW_COLORS"));

      // HTML validation branches
      const cleanHtml = '<div class="arch-grid"><span class="badge">System</span></div>';
      assert.equal(validateHtmlAgainstTokens(cleanHtml, "clean.html").length, 0);

      const dirtyHtml = '<div style="color: red" class="rounded-2xl shadow-xl"></div>';
      const htmlViolations = validateHtmlAgainstTokens(dirtyHtml, "dirty.html");
      assert.ok(htmlViolations.length >= 2);
      assert.ok(htmlViolations.some((v) => v.rule === "NO_INLINE_STYLES"));
      assert.ok(htmlViolations.some((v) => v.rule === "NO_LARGE_RADIUS"));
    });
  });

  describe("EosDesignPrimitives (SPEC-052)", () => {
    it("assembles immutable architectural components with zero external dependencies", () => {
      // 1. architecturalGrid
      const defaultGrid = architecturalGrid({ children: "<p>Child</p>" });
      assert.ok(defaultGrid.includes('class="arch-grid"'));
      assert.ok(defaultGrid.includes("--grid-cols:3"));

      const customGrid = architecturalGrid({
        columns: 4,
        max: "1400px",
        id: "kpi-grid",
        children: "<span>Test</span>",
      });
      assert.ok(customGrid.includes('id="kpi-grid"'));
      assert.ok(customGrid.includes("--grid-cols:4"));
      assert.ok(customGrid.includes("--grid-max:1400px"));

      // 2. gridCell
      const defaultCell = gridCell("<p>Content</p>");
      assert.ok(defaultCell.includes("grid-column:span 1"));
      const wideCell = gridCell("<p>Wide</p>", 2);
      assert.ok(wideCell.includes("grid-column:span 2"));

      // 3. telemetryHeader (all status branches)
      const statuses = ["ONLINE", "ACTIVE", "IDLE", "ALERT", "VERIFIED"];
      for (const st of statuses) {
        const header = telemetryHeader({ index: "01", title: "Core Header", status: st });
        assert.ok(header.includes(st));
        assert.ok(header.includes("telemetry-header__status-dot"));
      }

      const customHeader = telemetryHeader({ index: "SEC", title: "Security", statusColor: "#ff00ff" });
      assert.ok(customHeader.includes("background:#ff00ff"));

      // 4. spotlightPanel
      const defaultPanel = spotlightPanel({ content: "<p>Panel Content</p>" });
      assert.ok(defaultPanel.includes("spotlight-card"));

      const customPanel = spotlightPanel({
        index: "01",
        title: "Card Title",
        status: "VERIFIED",
        wide: true,
        content: "<div>Inner Content</div>",
      });
      assert.ok(customPanel.includes("spotlight-card__index"));
      assert.ok(customPanel.includes("spotlight-card__title"));
      assert.ok(customPanel.includes("grid-column:span 2"));

      // 5. codeBlock & consoleTrace
      const block = codeBlock({ code: "const x = 1;", language: "typescript", copyCommand: "const x = 1;" });
      assert.ok(block.includes("codeblock"));
      assert.ok(block.includes("const x = 1;"));

      const trace = consoleTrace([{ turn: 1, role: "SYSTEM", content: "Kernel ready", duration: "12 ms" }]);
      assert.ok(trace.includes("Kernel ready"));

      // 6. generatePrimitivesCSS & generateSpotlightScript
      const css = generatePrimitivesCSS();
      assert.ok(css.includes(".arch-grid"));
      assert.ok(css.includes(".spotlight-card"));

      const script = generateSpotlightScript();
      assert.ok(script.includes("<script>"));
      assert.ok(script.includes("mousemove"));
    });
  });

  describe("EosUniversalAgentSessionContract (SPEC-152 / SPEC-153)", () => {
    it("governs agent sessions, co-governance messages, and write barrier evaluation", () => {
      assert.ok(SUPPORTED_IDE_FAMILIES.includes("cursor"));
      assert.ok(SUPPORTED_IDE_FAMILIES.includes("antigravity"));
      assert.ok(PREFERRED_IDE_FAMILIES.includes("antigravity"));

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-contract-test-"));
      try {
        const contract = new EosUniversalAgentSessionContract(tempDir);
        assert.ok(contract.getLedgerPath().includes("agent-sessions.json"));

        // 1. Open session
        const session = contract.openSession({
          ideFamily: "antigravity",
          directive: "elevate branch coverage to 80%",
          target: "src/core",
        });
        assert.ok(session.sessionId);
        assert.equal(session.ideFamily, "antigravity");
        assert.ok(session.sessionReceipt.length > 0);

        // 2. Active session lookup
        const active = contract.getActiveSessionForIde("antigravity");
        assert.ok(active);
        assert.equal(active.sessionId, session.sessionId);

        // 3. Ensure preferred IDE session
        const preferred = contract.ensurePreferredIdeSession({
          ideFamily: "antigravity",
          directive: "automated test directive",
          target: "src/core",
        });
        assert.ok(preferred.sessionId);

        // 4. Gentleman Stack alignment & message formatting
        const alignment = contract.getGentlemanAlignment();
        assert.ok(alignment);
        assert.equal(typeof alignment.readinessScore, "number");
        assert.ok(alignment.readinessScore >= 0);

        const msg = contract.formatCoGovernanceSessionMessage("antigravity", session);
        assert.ok(msg.includes("co-governs"));

        // 5. Authorize write evaluation
        const authMissing = contract.authorizeWrite({ sessionId: "non-existent-id", targetPath: "src/core/a.ts" });
        assert.equal(authMissing.decision, "deny");

        const authReal = contract.authorizeWrite({ sessionId: session.sessionId, targetPath: "src/core/a.ts" });
        assert.ok(authReal.decision === "allow" || authReal.decision === "deny");

        // 6. Preferred write gate evaluation
        const gate = contract.evaluatePreferredWriteGate("antigravity", ["src/core/a.ts"]);
        assert.ok(gate.decision === "allow" || gate.decision === "deny");

        // 7. Record tool invocations
        contract.recordToolInvocation(session.sessionId, "eos_semantic_search");
        contract.recordToolAcrossLiveSessions("eos_ast_analyze");

        // 8. Session status
        const status = contract.getSessionStatus(session.sessionId);
        assert.equal(status.found, true);
        assert.equal(status.ideFamily, "antigravity");
      } finally {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    });
  });

  describe("EosFleetDispatcher (SPEC-124)", () => {
    it("reports canonical fleet projects and snapshot evaluations without side effects", () => {
      assert.ok(Array.isArray(CANONICAL_FLEET_PROJECTS));
      assert.ok(CANONICAL_FLEET_PROJECTS.length >= 4);

      const eosSystemManifest = CANONICAL_FLEET_PROJECTS.find((p) => p.id === "eos-system");
      assert.ok(eosSystemManifest);
      assert.equal(eosSystemManifest.status, "REGISTERED");
      assert.equal(eosSystemManifest.authorization, "LEVEL_3_PRODUCTION_AUTHORIZED");

      const snapshot = evaluateFleetStatusSnapshot();
      assert.equal(snapshot.dispatchId, "FLEET-REGISTRY-SNAPSHOT");
      assert.equal(snapshot.version, "10.1.0-portable-fleet-registry");
      assert.equal(snapshot.checksRun, false);
      assert.equal(snapshot.projectsRegistered, CANONICAL_FLEET_PROJECTS.length);
      assert.ok(snapshot.reports.length >= 4);
      assert.ok(snapshot.reports.every((r) => r.epistemicState === "NEEDS_AUDIT"));
    });
  });

  describe("EosNanosecondEngine (SPEC-051)", () => {
    it("executes zero-allocation Struct of Arrays L1 burst and compiles multi-profile blueprints", () => {
      assert.equal(FIVE_NANOSECOND_ENGINEERING_SECRETS.length, 5);
      assert.equal(WORLD_TOP_5_FASTEST_SOFTWARE.length, 5);

      // EosL1SoAArena burst
      const arena = new EosL1SoAArena();
      const burst = arena.executeVectorizedBurst(100);
      assert.ok(burst.totalOperations > 0);
      assert.equal(burst.heapAllocationsBytes, 0);
      assert.equal(burst.l1CacheFootprintBytes, 65536);
      assert.ok(burst.nanosecondsPerOp > 0);
      assert.ok(burst.throughputMillionOpsPerSec > 0);

      // compileNaturalInstructionToEosSpec across all 5 profiles
      const profiles = [
        "zed-gpui-120fps",
        "tigerbeetle-zig-backend",
        "citadel-kdb-hft",
        "xirp-bun-edge",
        "aberamentho-rtos-dsp",
      ];

      for (const prof of profiles) {
        const blueprint = compileNaturalInstructionToEosSpec(
          "Instrucción técnica para ingeniería de alto rendimiento",
          prof,
        );
        assert.equal(blueprint.profile, prof);
        assert.ok(blueprint.profileTitle.length > 0);
        assert.ok(blueprint.earsRequirements.length >= 1);
        assert.ok(blueprint.bddScenario.includes("ESCENARIO:"));
        assert.ok(blueprint.fivePillarsApplied.kernelBypass.length > 0);
        assert.ok(blueprint.fivePillarsApplied.dataOrientedSoA.length > 0);
        assert.ok(blueprint.fivePillarsApplied.zeroAllocationArena.length > 0);
        assert.ok(blueprint.fivePillarsApplied.lockFreeCas.length > 0);
        assert.ok(blueprint.fivePillarsApplied.simdAndGpu.length > 0);
        assert.ok(blueprint.referenceCode.length > 0);
        assert.equal(blueprint.benchmarkMetrics.heapAllocationsBytes, 0);
      }
    });
  });

  describe("EosPipeline (SPEC-050)", () => {
    it("runs end-to-end problem solver with context assembly and error isolation", async () => {
      const pipeline = new EosPipeline(process.cwd());
      const res = await pipeline.solve({
        problem: "Verify pipeline context resolution",
        targetFile: "package.json",
        testCommand: "node -v",
        pipelineDeadlineMs: 10000,
        branchCount: 1,
      });

      assert.equal(res.problem, "Verify pipeline context resolution");
      assert.ok(typeof res.solved === "boolean");
      assert.ok(res.contextAssembled.filesIncluded >= 1);
      assert.ok(typeof res.pipelineHash === "string");
    });
  });

  describe("EosBlackProjectsTriad (SPEC-126)", () => {
    it("audits Kelly Johnson Skunk Works, DARPA OODA, and NRO SAR pillars", () => {
      const triad = new EosBlackProjectsTriad(process.cwd());
      const audit = triad.auditTriad();

      assert.ok(audit.status === "TRIAD_DRILL_PASS" || audit.status === "TRIAD_DRILL_DEGRADED");
      assert.ok(audit.pillars.length === 3);
      assert.ok(audit.pillars.some((p) => p.pillarId === "SKUNK_KELLY_JOHNSON"));
      assert.ok(audit.pillars.some((p) => p.pillarId === "DARPA_OODA"));
      assert.ok(audit.pillars.some((p) => p.pillarId === "NRO_SAR"));
      assert.ok(audit.claimsDenied.length >= 4);
      assert.ok(audit.sha256Receipt.length === 64);
    });
  });

  describe("EosPlanetaryApexDoctrine (SPEC-128)", () => {
    it("audits precision timing, TMR avionics, and hermetic isolation pillars", () => {
      const doc = new EosPlanetaryApexDoctrine();
      const audit = doc.auditPillars();

      assert.ok(audit.pillars.length === 5);
      assert.ok(audit.pillars.some((p) => p.pillarId === "ASML_TSMC_PRECISION"));
      assert.ok(audit.pillars.some((p) => p.pillarId === "SPACEX_TMR_AVIONICS"));
      assert.ok(audit.pillars.some((p) => p.pillarId === "DARPA_SKUNK_ISOLATION"));
      assert.ok(audit.claimsDenied.length >= 4);
      assert.ok(audit.sha256Receipt.length === 64);
    });
  });

  describe("BigTechPantheon & SamaelCodex (SPEC-121 / SPEC-122)", () => {
    it("exposes Big Tech crown jewels and Samaelian architectural mandates", () => {
      assert.ok(Array.isArray(BIGTECH_7_CROWN_JEWELS));
      assert.ok(BIGTECH_7_CROWN_JEWELS.length >= 7);
      assert.ok(typeof BIGTECH_SCENARIO_CATALOG === "object");
      assert.ok(BIGTECH_SCENARIO_CATALOG["secret-leak-attempt"]);

      assert.ok(Array.isArray(ARBOL_DE_LA_VIDA_13));
      assert.ok(ARBOL_DE_LA_VIDA_13.length >= 13);
      assert.ok(Array.isArray(MANDATO_TEURGICO));
      assert.equal(MANDATO_TEURGICO.length, 5);
      assert.ok(typeof PRACTICAS_OPERATIVAS === "object");
    });
  });
});
