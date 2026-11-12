/**
 * GLORIAN SYSTEM — ENTERPRISE DOMAIN FACADE TEST SUITE (SPEC-186, BDD-946..BDD-950)
 *
 * Verifies standard CNCF/IEEE Enterprise Ergonomics:
 * - BDD-946: Ephemeral workspace isolation with tamper-evident attestation
 * - BDD-947: Circuit breaker governor trips on failure threshold
 * - BDD-948: Deterministic memory zeroization & state sanitization
 * - BDD-949: Proxy-resilient synthetic probe error reporting
 * - BDD-950: Unified system health audit aggregation
 *
 * Strict Layer-0 Purity: Zero third-party testing libraries. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  EosEnterpriseFacade,
  EphemeralWorkspaceManager,
  CircuitBreakerGovernor,
  EntropyZeroizer,
  SyntheticProbeExecutor,
  ConstitutionalTribunalEngine,
} from "../src/core/eosEnterpriseFacade.ts";

describe("SPEC-186: Big Tech Enterprise Domain Facade", () => {
  it("BDD-946: Ephemeral workspace isolation with tamper-evident attestation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-facade-ws-"));
    try {
      const manager = new EphemeralWorkspaceManager(tmpDir);

      // 1. Create workspace
      const descriptor = manager.createWorkspace(".worktrees/test-scratch");
      assert.ok(descriptor.workspaceId.startsWith("ASTRAL-"));
      assert.ok(descriptor.projectionPath.includes(descriptor.workspaceId));
      assert.equal(descriptor.active, true);
      assert.equal(descriptor.attestationToken.length, 64);

      // 2. Verify attestation
      const isAuthentic = manager.verifyAttestation(descriptor);
      assert.equal(isAuthentic, true);

      // 3. Query active workspaces count
      assert.equal(manager.getActiveWorkspacesCount(), 1);

      // 4. Commit workspace
      const commitReceipt = manager.commitWorkspace(descriptor.workspaceId, "mock-diff-sha256");
      assert.equal(commitReceipt.committed, true);
      assert.equal(commitReceipt.workspaceId, descriptor.workspaceId);
      assert.ok(commitReceipt.sealReceipt.length > 0);
      assert.equal(manager.getActiveWorkspacesCount(), 0);

      // 5. Dissolve workspace (already committed/removed)
      const dissolveReceipt = manager.dissolveWorkspace(descriptor.workspaceId);
      assert.equal(dissolveReceipt.dissolved, false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BDD-947: Circuit breaker governor trips on failure threshold and guards execution", async () => {
    const governor = new CircuitBreakerGovernor({ failureThreshold: 2, cooldownMs: 50 });
    const actionName = "payment_gateway_dispatch";

    // 1. Initial state is CLOSED
    assert.equal(governor.getState(actionName), "CLOSED");

    // 2. Successful execution through guard
    const value = await governor.executeWithGuard(actionName, () => "success-payload");
    assert.equal(value, "success-payload");
    assert.equal(governor.getState(actionName), "CLOSED");

    // 3. First failure: remains CLOSED
    await assert.rejects(
      async () => {
        await governor.executeWithGuard(actionName, () => {
          throw new Error("Temporary network glitch");
        });
      },
      { message: "Temporary network glitch" },
    );
    assert.equal(governor.getState(actionName), "CLOSED");

    // 4. Second failure: trips to OPEN
    await assert.rejects(
      async () => {
        await governor.executeWithGuard(actionName, () => {
          throw new Error("Downstream service unreachable");
        });
      },
      { message: "Downstream service unreachable" },
    );
    assert.equal(governor.getState(actionName), "OPEN");

    // 5. Subsequent execution fails immediately with CIRCUIT_BREAKER_OPEN
    await assert.rejects(async () => {
      await governor.executeWithGuard(actionName, () => "should-not-run");
    }, /CIRCUIT_BREAKER_OPEN/);

    // 6. Resource budget evaluation integration
    const normalBudget = governor.evaluateResourceBudget({
      tokensConsumed: 1000,
      elapsedMs: 200,
    });
    assert.equal(normalBudget.status, "PASS_HARMONY");
    assert.equal(normalBudget.tripped, false);

    const exhaustedBudget = governor.evaluateResourceBudget({
      tokensConsumed: 100_000,
      elapsedMs: 100,
    });
    assert.equal(exhaustedBudget.status, "RUNA_NOT_SEVERED");
    assert.equal(exhaustedBudget.tripped, true);
    assert.equal(exhaustedBudget.violationType, "TOKEN_LIMIT_EXCEEDED");
  });

  it("BDD-948: Deterministic memory zeroization and state sanitization", () => {
    // 1. Buffer zeroization
    const secretBuffer = Buffer.from("super-sensitive-master-cryptographic-key-12345");
    assert.ok(secretBuffer.length > 0);

    const purgeReceipt = EntropyZeroizer.zeroizeBuffer(secretBuffer);
    assert.equal(purgeReceipt.xorNoiseApplied, true);
    assert.equal(purgeReceipt.zeroFilled, true);
    assert.equal(purgeReceipt.entropyZero, true);
    assert.equal(purgeReceipt.sha384Seal.length, 96);

    // Verify all bytes in buffer are strictly 0x00
    for (let i = 0; i < secretBuffer.length; i++) {
      assert.equal(secretBuffer[i], 0);
    }

    // 2. State dictionary sanitization
    const state = {
      authToken: "secret-token",
      userId: 42,
      activeSession: true,
    };
    const sanitizeReport = EntropyZeroizer.zeroizeState(state);
    assert.equal(sanitizeReport.sanitizedKeysCount, 3);
    assert.equal(state.authToken, null);
    assert.equal(state.userId, null);
    assert.equal(state.activeSession, null);
  });

  it("BDD-949: Proxy-resilient synthetic probe error reporting", async () => {
    // 1. Invalid URL protocol
    const probeInvalid = await SyntheticProbeExecutor.probe("invalid-protocol-ftp://foo");
    assert.equal(probeInvalid.reachable, false);
    assert.equal(probeInvalid.error, "INVALID_URL");

    // 2. Unreachable domain behind proxy or network
    const probeUnreachable = await SyntheticProbeExecutor.probe(
      "https://domain-that-does-not-exist-in-any-dns-987654321.org",
      500,
    );
    assert.equal(probeUnreachable.reachable, false);
    assert.ok(probeUnreachable.error !== undefined, "error must be defined when reachable is false");
  });

  it("BDD-950: Unified system health audit aggregation", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-facade-health-"));
    try {
      const facade = new EosEnterpriseFacade(tmpDir);
      const healthReport = facade.auditHealth();

      assert.equal(healthReport.status, "HEALTHY");
      assert.equal(healthReport.memorySanitizerReady, true);
      assert.equal(healthReport.tribunalReady, true);
      assert.equal(healthReport.sha256Receipt.length, 64);
      assert.ok(healthReport.timestampIso.length > 0);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // Ignore Windows file locking on temp SQLite files
      }
    }
  });

  it("ConstitutionalTribunalEngine evaluates decisions fail-safe", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-facade-tribunal-"));
    try {
      const tribunal = new ConstitutionalTribunalEngine(tmpDir);
      const report = tribunal.evaluateDecision(
        "Refactor memory zeroizer",
        "Introduce hardware zeroization routine",
        "Refactor buffer sanitization",
      );
      assert.ok(report.sha256Receipt.length > 0);
      assert.ok(report.timestampIso.length > 0);
      assert.ok(report.overallVerdict.length > 0);
      assert.equal(report.judges.length, 3);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // Ignore Windows file locking on temp SQLite files
      }
    }
  });

  it("CLI command 'enterprise:health --json' outputs valid CNCF report", () => {
    const output = execFileSync(
      process.execPath,
      [path.join(process.cwd(), "bin/eos.mjs"), "enterprise:health", "--json"],
      {
        encoding: "utf8",
      },
    );
    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.status, "HEALTHY");
    assert.equal(parsed.memorySanitizerReady, true);
    assert.equal(parsed.tribunalReady, true);
    assert.equal(parsed.sha256Receipt.length, 64);
  });

  it("MCP tool 'eos_enterprise_workspace' with action='health' dispatches facade health audit", async () => {
    const { dispatchPhase7VerificationCase } = await import("../src/mcp/tools/eosMcpPhase7VerificationHandlers.ts");
    const result = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "health" },
      { projectRoot: process.cwd() },
    );
    assert.equal(result.status, "HEALTHY");
    assert.equal(result.memorySanitizerReady, true);
    assert.equal(result.tribunalReady, true);
    assert.equal(result.sha256Receipt.length, 64);
  });

  it("MCP tool 'eos_enterprise_workspace' dispatches verify_action, slsa_attest, arena_stats, and dtn_status", async () => {
    const { dispatchPhase7VerificationCase } = await import("../src/mcp/tools/eosMcpPhase7VerificationHandlers.ts");
    const callFacade = (payload) =>
      dispatchPhase7VerificationCase("eos_enterprise_workspace", payload, { projectRoot: process.cwd() });

    // 1. verify_action
    const verifyRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      {
        action: "verify_action",
        target: "npm run test",
        actionType: "SHELL_COMMAND",
        declaredPreconditions: { auth: true },
      },
      { projectRoot: process.cwd() },
    );
    assert.equal(verifyRes.status, "VERIFIED_SAFE");

    // 2. slsa_attest
    const slsaRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      {
        action: "slsa_attest",
        subjects: [
          {
            name: "release.tar.gz",
            digest: {
              sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          },
        ],
      },
      { projectRoot: process.cwd() },
    );
    assert.equal(slsaRes.payloadType, "application/vnd.in-toto+json");
    assert.ok(slsaRes.signatures.length > 0);

    // 3. arena_stats
    const arenaRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "arena_stats" },
      { projectRoot: process.cwd() },
    );
    assert.ok(arenaRes.bump.capacity > 0);
    assert.ok(arenaRes.slabs.classes.length > 0);

    // 4. dtn_status
    const dtnRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "dtn_status" },
      { projectRoot: process.cwd() },
    );
    assert.equal(typeof dtnRes.totalStoredBundles, "number");

    // 5. doctor
    const doctorRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "doctor", targetPath: process.cwd() },
      { projectRoot: process.cwd() },
    );
    assert.equal(typeof doctorRes.overallScore, "number");
    assert.ok(doctorRes.overallScore >= 0 && doctorRes.overallScore <= 100);
    assert.equal(doctorRes.detectedStack, "NODE_TYPESCRIPT");

    // 6. remediate
    const remediateRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "remediate", targetPath: process.cwd(), dryRun: true },
      { projectRoot: process.cwd() },
    );
    assert.equal(remediateRes.dryRun, true);
    assert.equal(remediateRes.detectedStack, "NODE_TYPESCRIPT");
    assert.ok(remediateRes.actions.length > 0);

    // 7. fuzz
    const fuzzRes = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "fuzz", iterations: 20 },
      { projectRoot: process.cwd() },
    );
    assert.equal(fuzzRes.totalIterations, 20);
    assert.equal(fuzzRes.stabilityScore, 100);
    assert.equal(fuzzRes.crashCount, 0);

    // 8. arena
    const arenaReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "arena", target: "npm test", rounds: 2 },
      { projectRoot: process.cwd() },
    );
    assert.equal(arenaReport.totalRounds, 2);
    assert.equal(typeof arenaReport.resilienceScore, "number");
    assert.ok(arenaReport.participatingAgents.length >= 4);
    assert.equal(arenaReport.bftVerdict, "CONSENSUS_HARDENED");

    // 9. zk_prove & zk_verify
    const zkProveReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "zk_prove", specId: "SPEC-193" },
      { projectRoot: process.cwd() },
    );
    assert.equal(zkProveReport.verified, true);
    assert.ok(zkProveReport.publicMerkleRoot.length === 64);

    const zkVerifyReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      {
        action: "zk_verify",
        proof: zkProveReport.proof,
        publicMerkleRoot: zkProveReport.publicMerkleRoot,
      },
      { projectRoot: process.cwd() },
    );
    assert.equal(zkVerifyReport.verified, true);

    // 10. compile_sea
    const seaReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "compile_sea", dryRun: true },
      { projectRoot: process.cwd() },
    );
    assert.equal(seaReport.success, true);
    assert.equal(seaReport.dryRun, true);
    assert.ok(seaReport.binaryPath.includes("glorian"));
    assert.ok(seaReport.sha256Receipt.length === 64);

    // 11. pq_kem
    const pqReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "pq_kem", hybrid: true },
      { projectRoot: process.cwd() },
    );
    assert.equal(pqReport.verified, true);
    assert.equal(pqReport.mode, "HYBRID");
    assert.equal(pqReport.sharedSecretHex.length, 64);

    // 12. synthesize_code
    const synthReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "synthesize_code", initialCode: "a - b" },
      { projectRoot: process.cwd() },
    );
    assert.equal(synthReport.success, true);
    assert.equal(synthReport.finalFitness, 100);
    assert.equal(synthReport.bestCandidate.code, "a + b");

    // 13. vector_index & vector_search
    const vectorIndexReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "vector_index", id: "auth_mod", code: "function verifyJwt() {}" },
      { projectRoot: process.cwd() },
    );
    assert.equal(vectorIndexReport.action, "vector_index");
    assert.equal(vectorIndexReport.id, "auth_mod");
    assert.equal(vectorIndexReport.size, 1);
    assert.ok(vectorIndexReport.sha256Receipt.length === 64);

    const vectorSearchReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "vector_search", query: "verify JWT authentication token", k: 2 },
      { projectRoot: process.cwd() },
    );
    assert.equal(vectorSearchReport.action, "vector_search");
    assert.equal(vectorSearchReport.matches.length, 2);
    assert.ok(vectorSearchReport.sha256Receipt.length === 64);

    // 14. tkg_assert & tkg_query
    const tkgAssertReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "tkg_assert", subject: "api_gateway", predicate: "routes_to", object: "order_service" },
      { projectRoot: process.cwd() },
    );
    assert.equal(tkgAssertReport.action, "tkg_assert");
    assert.equal(tkgAssertReport.fact.subject, "api_gateway");
    assert.ok(tkgAssertReport.sha256Receipt.length === 64);

    const tkgQueryReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "tkg_query", predicate: "transitive_depends", asOf: 100 },
      { projectRoot: process.cwd() },
    );
    assert.equal(tkgQueryReport.action, "tkg_query");
    assert.ok(tkgQueryReport.bindings.length >= 2);
    assert.equal(tkgQueryReport.derivation.fixedPointReached, true);
    assert.ok(tkgQueryReport.sha256Receipt.length === 64);

    // 15. wasm_decompile & wasm_prove
    const wasmDecompileReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "wasm_decompile", target: "ADD" },
      { projectRoot: process.cwd() },
    );
    assert.equal(wasmDecompileReport.action, "wasm_decompile");
    assert.ok(wasmDecompileReport.wat.includes("(module"));
    assert.equal(wasmDecompileReport.sha256Checksum.length, 64);

    const wasmProveReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "wasm_prove", target: "ADD" },
      { projectRoot: process.cwd() },
    );
    assert.equal(wasmProveReport.action, "wasm_prove");
    assert.equal(wasmProveReport.verified, true);
    assert.equal(wasmProveReport.stackSafe, true);
    assert.equal(wasmProveReport.isPure, true);
    assert.ok(wasmProveReport.sha256Receipt.length === 64);

    // 16. mcts_search & mcts_evaluate
    const mctsEvalReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mcts_evaluate", stateId: "eval_node", legalActions: ["act_x", "act_y"], metadata: { fitness: 0.5 } },
      { projectRoot: process.cwd() },
    );
    assert.equal(mctsEvalReport.action, "mcts_evaluate");
    assert.equal(mctsEvalReport.value, 0.5);
    assert.ok(mctsEvalReport.sha256Receipt.length === 64);

    const mctsSearchReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mcts_search", simulations: 20 },
      { projectRoot: process.cwd() },
    );
    assert.equal(mctsSearchReport.action, "mcts_search");
    assert.ok(mctsSearchReport.bestAction.length > 0);
    assert.equal(mctsSearchReport.totalSimulations, 20);
    assert.ok(mctsSearchReport.sha256Receipt.length === 64);

    // 17. tla_check & tla_synthesize
    const tlaCheckReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "tla_check", maxDepth: 10 },
      { projectRoot: process.cwd() },
    );
    assert.equal(tlaCheckReport.action, "tla_check");
    assert.equal(tlaCheckReport.verified, true);
    assert.ok(tlaCheckReport.totalStatesExplored >= 3);
    assert.ok(tlaCheckReport.sha256Receipt.length === 64);

    const tlaSynthReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "tla_synthesize" },
      { projectRoot: process.cwd() },
    );
    assert.equal(tlaSynthReport.action, "tla_synthesize");
    assert.ok(tlaSynthReport.tlaCode.includes("MODULE DistributedMutualExclusion"));
    assert.ok(tlaSynthReport.sha256Receipt.length === 64);

    // 18. raft_cluster & raft_propose
    const raftClusterReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "raft_cluster", nodeCount: 3 },
      { projectRoot: process.cwd() },
    );
    assert.equal(raftClusterReport.action, "raft_cluster");
    assert.equal(raftClusterReport.election.success, true);
    assert.equal(raftClusterReport.status.isQuorumFormed, true);
    assert.equal(raftClusterReport.receipt.sha256Receipt.length, 64);

    const raftProposeReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "raft_propose", command: { type: "SET", key: "mcp_audit", value: "PASSED" } },
      { projectRoot: process.cwd() },
    );
    assert.equal(raftProposeReport.action, "raft_propose");
    assert.equal(raftProposeReport.proposal.committed, true);
    assert.equal(raftProposeReport.status.isQuorumFormed, true);
    assert.equal(raftProposeReport.receipt.sha256Receipt.length, 64);

    // 19. ans_compress & ans_decompress
    const ansCompressReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "ans_compress", payload: "ENTERPRISE_FACADE_ANS_COMPRESSION_TEST" },
      { projectRoot: process.cwd() },
    );
    assert.equal(ansCompressReport.action, "ans_compress");
    assert.ok(ansCompressReport.metadata.uncompressedSize > 0);
    assert.ok(ansCompressReport.compressedBase64.length > 0);
    assert.equal(ansCompressReport.sha256Receipt.length, 64);

    const ansDecompressReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "ans_decompress", base64: ansCompressReport.compressedBase64 },
      { projectRoot: process.cwd() },
    );
    assert.equal(ansDecompressReport.action, "ans_decompress");
    assert.equal(ansDecompressReport.verified, true);
    assert.equal(ansDecompressReport.decompressedText, "ENTERPRISE_FACADE_ANS_COMPRESSION_TEST");
    assert.equal(ansDecompressReport.sha256Receipt.length, 64);

    // 20. autodiff_grad & autodiff_train
    const autodiffGradReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "autodiff_grad", values: [1.0, 2.0, 3.0] },
      { projectRoot: process.cwd() },
    );
    assert.equal(autodiffGradReport.action, "autodiff_grad");
    assert.equal(autodiffGradReport.gradientCheck.passed, true);
    assert.equal(autodiffGradReport.analyticalGrad.length, 3);
    assert.equal(autodiffGradReport.sha256Receipt.length, 64);

    const autodiffTrainReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "autodiff_train", epochs: 5 },
      { projectRoot: process.cwd() },
    );
    assert.equal(autodiffTrainReport.action, "autodiff_train");
    assert.equal(autodiffTrainReport.receipt.lossDecreased, true);
    assert.equal(autodiffTrainReport.receipt.sha256Receipt.length, 64);

    // 21. anomaly_detect & anomaly_forest
    const anomalyDetectReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "anomaly_detect", threshold: 0.6 },
      { projectRoot: process.cwd() },
    );
    assert.equal(anomalyDetectReport.action, "anomaly_detect");
    assert.equal(anomalyDetectReport.report.anomalyCount, 1);
    assert.equal(anomalyDetectReport.report.outliers.length, 1);
    assert.equal(anomalyDetectReport.report.sha256Receipt.length, 64);

    const anomalyForestReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "anomaly_forest" },
      { projectRoot: process.cwd() },
    );
    assert.equal(anomalyForestReport.action, "anomaly_forest");
    assert.equal(anomalyForestReport.isReady, true);
    assert.ok(anomalyForestReport.windowSize >= 30);
    assert.ok(anomalyForestReport.outlierScore.anomalyScore > 0.5);

    // 22. pbft_cluster, pbft_propose & pbft_slash
    const pbftClusterReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "pbft_cluster", nodeCount: 4 },
      { projectRoot: process.cwd() },
    );
    assert.equal(pbftClusterReport.action, "pbft_cluster");
    assert.equal(pbftClusterReport.status.totalNodes, 4);
    assert.equal(pbftClusterReport.status.f, 1);
    assert.equal(pbftClusterReport.status.quorumSize, 3);
    assert.equal(pbftClusterReport.status.activeQuorum, true);

    const pbftProposeReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "pbft_propose", nodeCount: 4, proposal: { type: "SET", key: "facade_key", value: "active" } },
      { projectRoot: process.cwd() },
    );
    assert.equal(pbftProposeReport.action, "pbft_propose");
    assert.ok(pbftProposeReport.receipt.sha256Receipt.length === 64);
    assert.equal(pbftProposeReport.fsmState.facade_key, "active");

    const pbftSlashReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "pbft_slash" },
      { projectRoot: process.cwd() },
    );
    assert.equal(pbftSlashReport.action, "pbft_slash");
    assert.equal(pbftSlashReport.slashingReceipt.evidenceType, "EQUIVOCATION_DETECTED");
    assert.equal(pbftSlashReport.slashingReceipt.slashedNodeId, "node-0");

    // 23. homomorphic_keygen, homomorphic_encrypt & homomorphic_add
    const heKeygenReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "homomorphic_keygen", polyDegree: 32 },
      { projectRoot: process.cwd() },
    );
    assert.equal(heKeygenReport.action, "homomorphic_keygen");
    assert.equal(heKeygenReport.keypair.publicKey.params.polyDegree, 32);
    assert.equal(heKeygenReport.keypair.publicKey.keyFingerprint.length, 64);

    const heEncryptReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "homomorphic_encrypt", polyDegree: 32, message: [42, 100, 7] },
      { projectRoot: process.cwd() },
    );
    assert.equal(heEncryptReport.action, "homomorphic_encrypt");
    assert.equal(heEncryptReport.ciphertext.c0.length, 32);
    assert.ok(heEncryptReport.ciphertext.noiseBudgetBits > 0);

    const heAddReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "homomorphic_add", polyDegree: 32, msgA: [10, 20], msgB: [5, 15] },
      { projectRoot: process.cwd() },
    );
    assert.equal(heAddReport.action, "homomorphic_add");
    assert.deepEqual(heAddReport.sumPlaintext, [15, 35]);
    assert.ok(heAddReport.noiseBudgetBits > 0);
    assert.equal(heAddReport.receipt.receiptSha256.length, 64);

    // 24. mpc_split, mpc_combine, mpc_add & mpc_multiply
    const mpcSplitReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mpc_split", threshold: 3, totalParties: 5, secret: 424242 },
      { projectRoot: process.cwd() },
    );
    assert.equal(mpcSplitReport.action, "mpc_split");
    assert.equal(mpcSplitReport.shares.length, 5);
    const mpcCombineReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mpc_combine" },
      { projectRoot: process.cwd() },
    );
    assert.equal(mpcCombineReport.action, "mpc_combine");
    assert.equal(mpcCombineReport.secret, "9999");
    const mpcAddReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mpc_add", valA: 1500, valB: 3500 },
      { projectRoot: process.cwd() },
    );
    assert.equal(mpcAddReport.sum, "5000");
    const mpcMultiplyReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "mpc_multiply", x: 120, y: 35 },
      { projectRoot: process.cwd() },
    );
    assert.equal(mpcMultiplyReport.product, "4200");

    // 25. vdf_compute, vdf_verify & vdf_beacon
    const vdfComputeReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "vdf_compute", delay: 100, seed: "facade-vdf-entropy" },
      { projectRoot: process.cwd() },
    );
    assert.equal(vdfComputeReport.action, "vdf_compute");
    assert.equal(vdfComputeReport.delayT, 100);
    const vdfVerifyReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "vdf_verify", delay: 100, seed: "facade-vdf-entropy" },
      { projectRoot: process.cwd() },
    );
    assert.equal(vdfVerifyReport.action, "vdf_verify");
    assert.equal(vdfVerifyReport.valid, true);
    const vdfBeaconReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "vdf_beacon", val: 123456 },
      { projectRoot: process.cwd() },
    );
    assert.equal(vdfBeaconReport.beacon.length, 64);

    // 26. r1cs_synthesize, r1cs_prove & r1cs_verify (SPEC-214)
    const r1csSynthReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "r1cs_synthesize", secret: 3 },
      { projectRoot: process.cwd() },
    );
    assert.equal(r1csSynthReport.action, "r1cs_synthesize");
    assert.equal(r1csSynthReport.numConstraints, 3);
    const r1csProveReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "r1cs_prove", secret: 3 },
      { projectRoot: process.cwd() },
    );
    assert.equal(r1csProveReport.action, "r1cs_prove");
    assert.equal(r1csProveReport.proofDigest.length, 64);
    const r1csVerifyReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "r1cs_verify", secret: 3 },
      { projectRoot: process.cwd() },
    );
    assert.equal(r1csVerifyReport.action, "r1cs_verify");
    assert.equal(r1csVerifyReport.valid, true);

    // 27. crdt_mutate, crdt_merge & crdt_delta (SPEC-215)
    const crdtMutateReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "crdt_mutate", nodeId: "facade-node" },
      { projectRoot: process.cwd() },
    );
    assert.equal(crdtMutateReport.action, "crdt_mutate");
    assert.ok(crdtMutateReport.stateHashSha256.length === 64);
    const crdtMergeReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "crdt_merge" },
      { projectRoot: process.cwd() },
    );
    assert.equal(crdtMergeReport.action, "crdt_merge");
    assert.equal(crdtMergeReport.converged, true);
    const crdtDeltaReport = dispatchPhase7VerificationCase(
      "eos_enterprise_workspace",
      { action: "crdt_delta" },
      { projectRoot: process.cwd() },
    );
    assert.equal(crdtDeltaReport.action, "crdt_delta");
    assert.equal(crdtDeltaReport.converged, true);

    // 28. mmr_append, mmr_prove & mmr_verify (SPEC-216)
    const mmrAppendReport = callFacade({ action: "mmr_append", count: 7 });
    assert.equal(mmrAppendReport.action, "mmr_append");
    assert.equal(mmrAppendReport.leafCount, 7);
    assert.equal(mmrAppendReport.mmrSize, 11);
    const mmrProveReport = callFacade({ action: "mmr_prove" });
    assert.equal(mmrProveReport.action, "mmr_prove");
    assert.equal(mmrProveReport.leafIndex, 2);
    const mmrVerifyReport = callFacade({ action: "mmr_verify" });
    assert.equal(mmrVerifyReport.action, "mmr_verify");
    assert.equal(mmrVerifyReport.valid, true);

    // 29. vrf_eval, vrf_verify & vrf_elect (SPEC-217)
    const vrfEvalReport = callFacade({ action: "vrf_eval", alpha: "facade-slot-102" });
    assert.equal(vrfEvalReport.action, "vrf_eval");
    assert.ok(vrfEvalReport.publicKeyHex.length === 66);
    const vrfVerifyReport = callFacade({ action: "vrf_verify", alpha: "facade-slot-102" });
    assert.equal(vrfVerifyReport.action, "vrf_verify");
    assert.equal(vrfVerifyReport.valid, true);
    const vrfElectReport = callFacade({ action: "vrf_elect", alpha: "facade-slot-102", threshold: 0.99 });
    assert.equal(vrfElectReport.action, "vrf_elect");
    assert.equal(vrfElectReport.isElected, true);

    // 30. smt_set, smt_prove & smt_verify (SPEC-218)
    const smtSetReport = callFacade({ action: "smt_set", key: "facade-k", value: "facade-v" });
    assert.equal(smtSetReport.action, "smt_set");
    assert.equal(smtSetReport.leafCount, 1);
    const smtProveReport = callFacade({ action: "smt_prove", key: "cert-001" });
    assert.equal(smtProveReport.action, "smt_prove");
    assert.equal(smtProveReport.proofType, "membership");
    const smtVerifyReport = callFacade({ action: "smt_verify", key: "cert-001" });
    assert.equal(smtVerifyReport.action, "smt_verify");
    assert.equal(smtVerifyReport.valid, true);

    // 31. frost_keygen, frost_sign & frost_verify (SPEC-219)
    const frostKeygen = callFacade({ action: "frost_keygen", threshold: 2, signers: 3 });
    assert.equal(frostKeygen.action, "frost_keygen");
    assert.equal(frostKeygen.participantCount, 3);
    const frostSign = callFacade({ action: "frost_sign", message: "facade-tx" });
    assert.equal(frostSign.action, "frost_sign");
    assert.ok(frostSign.signatureHex.length > 64);
    const frostVerify = callFacade({ action: "frost_verify", message: "facade-tx" });
    assert.equal(frostVerify.action, "frost_verify");
    assert.equal(frostVerify.valid, true);

    // 32. kzg_commit, kzg_open & kzg_verify (SPEC-220)
    const kzgCommit = callFacade({ action: "kzg_commit", coeffs: [7, 5, 2, 3] });
    assert.equal(kzgCommit.action, "kzg_commit");
    assert.equal(kzgCommit.degree, 3);
    const kzgOpen = callFacade({ action: "kzg_open", coeffs: [7, 5, 2, 3], point: 4 });
    assert.equal(kzgOpen.action, "kzg_open");
    assert.equal(kzgOpen.claimedValue, "251");
    const kzgVerify = callFacade({ action: "kzg_verify", coeffs: [7, 5, 2, 3], point: 4 });
    assert.equal(kzgVerify.action, "kzg_verify");
    assert.equal(kzgVerify.valid, true);

    // 33. ml_kem_keygen, ml_kem_encaps & ml_kem_decaps (SPEC-221)
    const mlKeyGen = callFacade({ action: "ml_kem_keygen" });
    assert.equal(mlKeyGen.action, "ml_kem_keygen");
    assert.equal(mlKeyGen.algorithm, "ML-KEM-768");
    const mlEncaps = callFacade({ action: "ml_kem_encaps", ek: mlKeyGen.encapsulationKeyHex });
    assert.equal(mlEncaps.action, "ml_kem_encaps");
    const mlDecaps = callFacade({
      action: "ml_kem_decaps",
      dk: mlKeyGen.decapsulationKeyHex,
      ct: mlEncaps.ciphertextHex,
    });
    assert.equal(mlDecaps.action, "ml_kem_decaps");
    assert.equal(mlDecaps.valid, true);

    // 34. bp_commit, bp_prove & bp_verify (SPEC-222)
    const bpComm = callFacade({ action: "bp_commit", value: 3333 });
    assert.equal(bpComm.action, "bp_commit");
    const bpProve = callFacade({ action: "bp_prove", value: 3333, m: 16 });
    assert.equal(bpProve.action, "bp_prove");
    const bpVerify = callFacade({ action: "bp_verify", value: 3333, m: 16 });
    assert.equal(bpVerify.action, "bp_verify");
    assert.equal(bpVerify.valid, true);
  });
});
