import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosEvolutionaryHarness } from "../src/core/eosEvolutionaryHarness.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-143: Multivariate Continuous Fitness Evaluation & AlphaEvolve Loop", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-evolve-fitness-"));
  const ledgerDbPath = path.join(tmpDir, "evolution_ledger.sqlite");

  try {
    const candidate = {
      candidateId: "CAND-001",
      parentSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      patchContent: "export const fastAdd = (a: number, b: number): number => a + b;",
      targetFilePath: "src/core/fastAdd.ts",
      mutationSignature: "SIG-FAST-ADD",
    };

    const evaluated = EosEvolutionaryHarness.evaluateCandidate(
      candidate,
      {
        latencyNs: 45000,
        heapDeltaBytes: 0,
        astPurityScore: 100,
        cyclomaticComplexity: 1,
        contractComplianceScore: 100,
      },
      {
        ledgerDbPath,
        projectId: "eos-system",
      },
    );

    assert.equal(evaluated.passesContracts, true);
    assert.ok(evaluated.fitness.compositeFitness >= 90);
    assert.equal(evaluated.mutantSha256.length, 64);

    // Verify genetic lineage persisted in SQLite WAL Ledger
    const ledger = new EosDurableSqliteLedger(ledgerDbPath);
    try {
      const integrity = ledger.verifyChainIntegrity();
      assert.equal(integrity.intact, true);
      assert.equal(integrity.totalEntries, 1);
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("BDD-144: Semantic Clustering & Deduplication (AlphaCode 2)", () => {
  const c1 = {
    mutation: {
      candidateId: "C-1",
      parentSha256: "p",
      patchContent: "code1",
      targetFilePath: "f",
      mutationSignature: "SIG-A",
    },
    fitness: EosEvolutionaryHarness.computeFitnessVector(50000, 0, 100, 2, 100),
    passesContracts: true,
    mutantSha256: "m1",
    timestamp: new Date().toISOString(),
  };
  const c2 = {
    mutation: {
      candidateId: "C-2",
      parentSha256: "p",
      patchContent: "code2",
      targetFilePath: "f",
      mutationSignature: "SIG-A",
    },
    fitness: EosEvolutionaryHarness.computeFitnessVector(40000, 0, 100, 2, 100),
    passesContracts: true,
    mutantSha256: "m2",
    timestamp: new Date().toISOString(),
  };
  const c3 = {
    mutation: {
      candidateId: "C-3",
      parentSha256: "p",
      patchContent: "code3",
      targetFilePath: "f",
      mutationSignature: "SIG-B",
    },
    fitness: EosEvolutionaryHarness.computeFitnessVector(90000, 100, 80, 5, 60),
    passesContracts: false,
    mutantSha256: "m3",
    timestamp: new Date().toISOString(),
  };

  const clusters = EosEvolutionaryHarness.clusterCandidates([c1, c2, c3]);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].paretoDominant, true);
  assert.equal(clusters[0].representativeCandidate.mutation.candidateId, "C-2");
});

test("BDD-145: Double-Blind Adversarial Flow Action Validation (AlphaCodium)", () => {
  const session = {
    sessionId: "SESS-01",
    openSpecId: "SPEC-047",
    tlaInvariantRef: "EvolutionaryHarness.tla",
    allowedTestDirectory: "test/",
    allowedSourceDirectory: "src/",
    redTeamAgentId: "INQUISITOR-RED",
    blueTeamAgentId: "CONSTRUCTOR-BLUE",
    redTeamViolations: 0,
    blueTeamViolations: 0,
    status: "ACTIVE",
  };

  // Red Team (Inquisitor) can write to test/ but CANNOT write to src/
  const redTestWrite = EosEvolutionaryHarness.validateAdversarialAction(
    session,
    "INQUISITOR_RED",
    "test/unit.test.ts",
    "WRITE",
  );
  assert.equal(redTestWrite.allowed, true);

  const redSrcWrite = EosEvolutionaryHarness.validateAdversarialAction(
    session,
    "INQUISITOR_RED",
    "src/core/math.ts",
    "WRITE",
  );
  assert.equal(redSrcWrite.allowed, false);
  assert.match(redSrcWrite.violationReason, /DOUBLE_BLIND_BREACH/);

  // Blue Team (Constructor) can write to src/ but CANNOT touch test/
  const blueSrcWrite = EosEvolutionaryHarness.validateAdversarialAction(
    session,
    "CONSTRUCTOR_BLUE",
    "src/core/math.ts",
    "WRITE",
  );
  assert.equal(blueSrcWrite.allowed, true);

  const blueTestWrite = EosEvolutionaryHarness.validateAdversarialAction(
    session,
    "CONSTRUCTOR_BLUE",
    "test/unit.test.ts",
    "WRITE",
  );
  assert.equal(blueTestWrite.allowed, false);
  assert.match(blueTestWrite.violationReason, /DOUBLE_BLIND_BREACH/);
});

test("BDD-146: Flash-to-Pro Cascading & Token Circuit Breaker", () => {
  const cand = (fitnessVal) => ({
    mutation: { candidateId: "C", parentSha256: "p", patchContent: "x", targetFilePath: "f", mutationSignature: "s" },
    fitness: {
      executionLatencyNs: 100,
      heapDeltaBytes: 0,
      astPurityScore: 100,
      cyclomaticComplexity: 1,
      contractComplianceScore: fitnessVal,
      compositeFitness: fitnessVal,
    },
    passesContracts: fitnessVal === 100,
    mutantSha256: "m",
    timestamp: new Date().toISOString(),
  });

  // Stagnation over 2 generations trips circuit breaker
  const historyStagnated = [cand(60), cand(60), cand(59)];
  const breakerState = EosEvolutionaryHarness.evaluateTokenCircuitBreaker(historyStagnated, 3);

  assert.equal(breakerState.circuitTripped, true);
  assert.equal(breakerState.recommendedModelTier, "PRO_DEEP_REASONING");
  assert.ok(breakerState.diagnosticAstPayload !== null);
});

test("BDD-147: Cryptographic Interface Lock (InterfaceLock)", () => {
  const ifaceContent = `
    export interface SovereignKernel {
      readonly version: string;
      execute(input: string): boolean;
    }
    export function initializeKernel(): SovereignKernel;
  `;

  const locked = EosEvolutionaryHarness.lockInterfaceContract("src/core/kernel.ts", ifaceContent);
  assert.equal(locked.exportedSignatures.length, 2);
  assert.equal(locked.lockedSha256.length, 64);

  // Candidate with missing exported signature fails
  const driftingCandidate = `
    export interface SovereignKernel {
      readonly version: string;
    }
  `;
  const verification = EosEvolutionaryHarness.verifyInterfaceLock(locked, driftingCandidate);
  assert.equal(verification.valid, false);
  assert.match(verification.driftDetails, /initializeKernel/);
});

test("BDD-148: MCP eos_evolve_module dispatch in 'core' profile", () => {
  const coreServer = new EosMcpServer(projectRoot, "core");
  const listToolsRes = coreServer.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = listToolsRes?.result?.tools || [];
  const evolveTool = tools.find((t) => t.name === "eos_evolve_module");

  assert.ok(evolveTool, "eos_evolve_module must exist in 'core' profile");
  assert.equal(evolveTool.annotations.readOnlyHint, false);

  const evalCall = coreServer.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_evolve_module",
      arguments: {
        action: "evaluate",
        targetModulePath: "src/core/math.ts",
        candidatePatch: "export const x = 1;",
        metrics: {
          latencyNs: 40000,
          heapDeltaBytes: 0,
          astPurityScore: 100,
          cyclomaticComplexity: 1,
          contractComplianceScore: 100,
        },
      },
    },
  });

  assert.ok(!evalCall.error);
  const evalResult = JSON.parse(evalCall.result.content[0].text);
  assert.equal(evalResult.passesContracts, true);
  assert.ok(evalResult.fitness.compositeFitness >= 90);
});
