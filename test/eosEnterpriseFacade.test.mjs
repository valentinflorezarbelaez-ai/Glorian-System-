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
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
  });
});
