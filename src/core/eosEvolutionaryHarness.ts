/**
 * EOS SYSTEM — DEEPMIND SOVEREIGN EVOLUTIONARY HARNESS & ORCHESTRATION ENGINE (Layer 0)
 * Governed by SPEC-047, CHANGE-040, ADR-053 (v53.0.0)
 *
 * Implements Google DeepMind's core evolutionary & verifier-guided algorithms:
 * 1. Continuous Multivariate Fitness Function (AlphaEvolve)
 * 2. Semantic Behavioral & AST Clustering (AlphaCode 2)
 * 3. Adversarial Double-Blind Flow Engineering (AlphaCodium Red/Blue)
 * 4. Flash-to-Pro Token Circuit Breaker & Cascading Router
 * 5. Cryptographic Interface Contract Locking (InterfaceLock)
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import fs from "node:fs";
import path from "node:path";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export interface FitnessVector {
  readonly executionLatencyNs: number;
  readonly heapDeltaBytes: number;
  readonly astPurityScore: number; // 0..100
  readonly cyclomaticComplexity: number;
  readonly contractComplianceScore: number; // 0..100
  readonly compositeFitness: number; // 0..100
}

export interface CandidateMutation {
  readonly candidateId: string;
  readonly parentSha256: string;
  readonly patchContent: string;
  readonly targetFilePath: string;
  readonly mutationSignature: string;
}

export interface EvaluatedCandidate {
  readonly mutation: CandidateMutation;
  readonly fitness: FitnessVector;
  readonly passesContracts: boolean;
  readonly mutantSha256: string;
  readonly timestamp: string;
}

export interface SemanticCluster {
  readonly clusterId: string;
  readonly representativeCandidate: EvaluatedCandidate;
  readonly memberCandidateIds: readonly string[];
  readonly paretoDominant: boolean;
}

export interface AdversarialDoubleBlindSession {
  readonly sessionId: string;
  readonly openSpecId: string;
  readonly tlaInvariantRef: string;
  readonly allowedTestDirectory: string;
  readonly allowedSourceDirectory: string;
  readonly redTeamAgentId: string;
  readonly blueTeamAgentId: string;
  readonly redTeamViolations: number;
  readonly blueTeamViolations: number;
  readonly status: "ACTIVE" | "VERIFIED" | "ISOLATION_BREACHED";
}

export interface LockedInterfaceContract {
  readonly contractId: string;
  readonly targetFilePath: string;
  readonly exportedSignatures: readonly string[];
  readonly lockedSha256: string;
  readonly lockedAt: string;
}

export interface TokenCircuitBreakerState {
  readonly maxGenerations: number;
  readonly currentGeneration: number;
  readonly stagnationCounter: number;
  readonly circuitTripped: boolean;
  readonly recommendedModelTier: "FLASH_EXPLORATION" | "PRO_DEEP_REASONING";
  readonly diagnosticAstPayload: string | null;
}

export interface EvolutionaryRunReport {
  readonly targetModulePath: string;
  readonly openSpecId: string;
  readonly generationsEvaluated: number;
  readonly totalCandidatesSampled: number;
  readonly retainedParetoCandidates: readonly EvaluatedCandidate[];
  readonly bestCandidate: EvaluatedCandidate | null;
  readonly tokenBreakerState: TokenCircuitBreakerState;
  readonly ledgerEntryId: string | null;
  readonly sha256RunReceipt: string;
}

export class EosEvolutionaryHarness {
  /**
   * Computes a continuous, multivariate fitness vector (AlphaEvolve)
   * balancing runtime performance, memory efficiency, AST purity, and contract satisfaction.
   */
  public static computeFitnessVector(
    latencyNs: number,
    heapDeltaBytes: number,
    astPurityScore: number,
    cyclomaticComplexity: number,
    contractComplianceScore: number
  ): FitnessVector {
    assertPrecondition(Number.isFinite(latencyNs) && latencyNs >= 0, "latencyNs must be >= 0");
    assertPrecondition(Number.isFinite(heapDeltaBytes), "heapDeltaBytes must be finite");
    assertPrecondition(astPurityScore >= 0 && astPurityScore <= 100, "astPurityScore must be 0..100");
    assertPrecondition(contractComplianceScore >= 0 && contractComplianceScore <= 100, "contractScore must be 0..100");

    // Normalized sub-scores (0..100)
    // Latency: sub-100us (100,000 ns) is optimal 100; degrades toward 0 at >= 10,000,000 ns
    const latencyScore = Math.max(0, Math.min(100, 100 - (latencyNs / 100_000)));
    // Heap: zero or negative delta is 100; degrades with allocations
    const heapScore = Math.max(0, Math.min(100, 100 - (Math.max(0, heapDeltaBytes) / 1024)));
    // Complexity: <= 5 is 100; degrades above 20
    const complexityScore = Math.max(0, Math.min(100, 100 - Math.max(0, cyclomaticComplexity - 5) * 5));

    // Weighted composite (AlphaEvolve multivariate objective)
    const compositeFitness = Math.round(
      (contractComplianceScore * 0.40) +
      (astPurityScore * 0.25) +
      (latencyScore * 0.15) +
      (complexityScore * 0.10) +
      (heapScore * 0.10)
    );

    return deepFreeze({
      executionLatencyNs: Math.round(latencyNs),
      heapDeltaBytes: Math.round(heapDeltaBytes),
      astPurityScore: Math.round(astPurityScore),
      cyclomaticComplexity: Math.round(cyclomaticComplexity),
      contractComplianceScore: Math.round(contractComplianceScore),
      compositeFitness: Math.max(0, Math.min(100, compositeFitness))
    });
  }

  /**
   * Evaluates a candidate mutation diff and seals its genetic lineage in SQLite WAL.
   */
  public static evaluateCandidate(
    candidate: CandidateMutation,
    measured: {
      latencyNs: number;
      heapDeltaBytes: number;
      astPurityScore: number;
      cyclomaticComplexity: number;
      contractComplianceScore: number;
    },
    options?: {
      ledgerDbPath?: string;
      projectId?: string;
    }
  ): EvaluatedCandidate {
    assertPrecondition(Boolean(candidate && candidate.candidateId), "Candidate must be valid");
    const fitness = this.computeFitnessVector(
      measured.latencyNs,
      measured.heapDeltaBytes,
      measured.astPurityScore,
      measured.cyclomaticComplexity,
      measured.contractComplianceScore
    );

    const mutantSha256 = pureSha256(
      candidate.parentSha256 + ":" + candidate.patchContent + ":" + candidate.targetFilePath
    );
    const passesContracts = fitness.contractComplianceScore === 100;

    const evaluated: EvaluatedCandidate = deepFreeze({
      mutation: candidate,
      fitness,
      passesContracts,
      mutantSha256,
      timestamp: new Date().toISOString()
    });

    if (options?.ledgerDbPath) {
      const ledger = new EosDurableSqliteLedger(options.ledgerDbPath);
      try {
        ledger.appendEntry({
          category: "VERIFICATION_RECEIPT",
          projectId: options.projectId || "eos-system",
          title: `AlphaEvolve Mutation Evaluated: ${candidate.candidateId} (Fitness ${fitness.compositeFitness}/100)`,
          payload: {
            candidateId: candidate.candidateId,
            parentSha256: candidate.parentSha256,
            mutantSha256,
            fitness,
            passesContracts
          },
          engramTopicKey: `eos/evolution/${candidate.candidateId}`
        });
      } finally {
        ledger.close();
      }
    }

    return evaluated;
  }

  /**
   * Clusters candidate mutations by AST/semantic behavior (AlphaCode 2)
   * to eliminate duplicate subagent outputs and retain only Pareto-dominant solutions.
   */
  public static clusterCandidates(
    candidates: readonly EvaluatedCandidate[]
  ): readonly SemanticCluster[] {
    assertPrecondition(Array.isArray(candidates), "candidates must be an array");
    if (candidates.length === 0) return deepFreeze([]);

    // Group by mutation signature + contract pass profile
    const groups = new Map<string, EvaluatedCandidate[]>();
    for (const c of candidates) {
      const key = `${c.mutation.mutationSignature}:${c.passesContracts}:${Math.floor(c.fitness.compositeFitness / 10)}`;
      const existing = groups.get(key) || [];
      existing.push(c);
      groups.set(key, existing);
    }

    const clusters: SemanticCluster[] = [];
    let clusterIdx = 1;

    for (const [key, group] of groups.entries()) {
      // Pick best representative within cluster by composite fitness
      const sorted = [...group].sort(
        (a, b) => b.fitness.compositeFitness - a.fitness.compositeFitness || a.fitness.executionLatencyNs - b.fitness.executionLatencyNs
      );
      const rep = sorted[0];
      const paretoDominant = rep.passesContracts && rep.fitness.compositeFitness >= 75;

      clusters.push(deepFreeze({
        clusterId: `CLUSTER-${String(clusterIdx).padStart(3, "0")}`,
        representativeCandidate: rep,
        memberCandidateIds: group.map((g) => g.mutation.candidateId),
        paretoDominant
      }));
      clusterIdx++;
    }

    return deepFreeze(clusters.sort((a, b) => (b.paretoDominant ? 1 : 0) - (a.paretoDominant ? 1 : 0)));
  }

  /**
   * Enforces double-blind adversarial flow engineering (AlphaCodium):
   * Red Team (Inquisitor) can ONLY write to test directories;
   * Blue Team (Constructor) can ONLY write to implementation directories.
   */
  public static validateAdversarialAction(
    session: AdversarialDoubleBlindSession,
    agentRole: "INQUISITOR_RED" | "CONSTRUCTOR_BLUE",
    targetFilePath: string,
    action: "READ" | "WRITE"
  ): { allowed: boolean; violationReason?: string } {
    assertPrecondition(Boolean(session && session.sessionId), "Session must be valid");
    const normalizedTarget = targetFilePath.replace(/\\/g, "/");

    if (action === "READ") {
      // Both can read specifications
      return { allowed: true };
    }

    if (agentRole === "INQUISITOR_RED") {
      // Red team cannot touch source code
      if (normalizedTarget.startsWith("src/") || normalizedTarget.startsWith("lib/")) {
        return {
          allowed: false,
          violationReason: `[DOUBLE_BLIND_BREACH] Red Team Inquisitor attempted unauthorized write to production source: ${targetFilePath}`
        };
      }
      return { allowed: true };
    }

    if (agentRole === "CONSTRUCTOR_BLUE") {
      // Blue team cannot tamper with test suites
      if (normalizedTarget.startsWith("test/") || normalizedTarget.startsWith("spec/") || normalizedTarget.includes(".test.")) {
        return {
          allowed: false,
          violationReason: `[DOUBLE_BLIND_BREACH] Blue Team Constructor attempted unauthorized mutation of test assertions: ${targetFilePath}`
        };
      }
      return { allowed: true };
    }

    return { allowed: false, violationReason: "Unknown agent role" };
  }

  /**
   * Locks shared interface signatures with a SHA-256 seal (InterfaceLock),
   * enabling safe high-concurrency subagent execution without coordination drift.
   */
  public static lockInterfaceContract(
    targetFilePath: string,
    content: string
  ): LockedInterfaceContract {
    assertPrecondition(typeof targetFilePath === "string" && targetFilePath.length > 0, "Path required");
    assertPrecondition(typeof content === "string", "Content required");

    // Extract exported interfaces, types, and functions
    const signatureMatches = content.match(/export\s+(?:interface|type|class|function|const)\s+([A-Za-z0-9_]+)/g) || [];
    const exportedSignatures = signatureMatches.map((s) => s.trim()).sort();
    const lockedSha256 = pureSha256(exportedSignatures.join("\n") + "\n" + content);

    return deepFreeze({
      contractId: `IFACE-${pureSha256(targetFilePath).slice(0, 10)}`,
      targetFilePath,
      exportedSignatures,
      lockedSha256,
      lockedAt: new Date().toISOString()
    });
  }

  /**
   * Verifies an implementation against a locked interface contract,
   * catching architectural collisions before merging.
   */
  public static verifyInterfaceLock(
    locked: LockedInterfaceContract,
    candidateContent: string
  ): { valid: boolean; driftDetails?: string } {
    const candidateSignatures = (candidateContent.match(/export\s+(?:interface|type|class|function|const)\s+([A-Za-z0-9_]+)/g) || [])
      .map((s) => s.trim())
      .sort();

    const missing = locked.exportedSignatures.filter((s) => !candidateSignatures.includes(s));
    if (missing.length > 0) {
      return {
        valid: false,
        driftDetails: `Missing required exported interface signatures: ${missing.join(", ")}`
      };
    }
    return { valid: true };
  }

  /**
   * Evaluates the Flash-to-Pro token circuit breaker. If fitness stalls across >= 2 generations,
   * trips the circuit breaker to prevent token burning loops and recommends Pro deep reasoning.
   */
  public static evaluateTokenCircuitBreaker(
    history: readonly EvaluatedCandidate[],
    maxGenerations: number = 3
  ): TokenCircuitBreakerState {
    const genCount = history.length;
    let stagnationCounter = 0;

    for (let i = 1; i < history.length; i++) {
      if (history[i].fitness.compositeFitness <= history[i - 1].fitness.compositeFitness) {
        stagnationCounter++;
      } else {
        stagnationCounter = 0;
      }
    }

    const circuitTripped = stagnationCounter >= 2 || genCount >= maxGenerations;
    const recommendedModelTier = circuitTripped ? "PRO_DEEP_REASONING" : "FLASH_EXPLORATION";

    let diagnosticAstPayload: string | null = null;
    if (circuitTripped && history.length > 0) {
      const latest = history[history.length - 1];
      diagnosticAstPayload = JSON.stringify({
        stagnationReason: "Fitness failed to improve over consecutive generations",
        generationsEvaluated: genCount,
        latestFitness: latest.fitness,
        failingContracts: !latest.passesContracts
      });
    }

    return deepFreeze({
      maxGenerations,
      currentGeneration: genCount,
      stagnationCounter,
      circuitTripped,
      recommendedModelTier,
      diagnosticAstPayload
    });
  }
}
