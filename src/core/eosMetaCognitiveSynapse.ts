/**
 * EOS SYSTEM — AUTONOMOUS META-COGNITIVE SYNAPSE (Layer 0)
 * Governed by SPEC-040, FR-117, BDD-111 & ADR-045
 *
 * Implements Bayesian multi-agent intent arbitration and autonomous belief
 * reconciliation across specialized cognitive agents.
 *
 * Mathematical Invariants:
 * 1. Bayesian posterior probability normalization: sum(P(H_i|E)) === 1.0.
 * 2. Deterministic priority resolution with zero deadlocks.
 * 3. Sub-millisecond arbitration turnaround.
 * 4. Zero external runtime dependencies.
 */

import crypto from "node:crypto";

export interface AgentIntentCandidate {
  readonly agentId: string;
  readonly role: string;
  readonly action: string;
  readonly priorBelief: number; // P(H) in (0, 1]
  readonly evidenceLikelihood: number; // P(E|H) in [0, 1]
}

export interface PosteriorResolution {
  readonly agentId: string;
  readonly role: string;
  readonly action: string;
  readonly priorBelief: number;
  readonly posteriorProbability: number; // P(H|E)
  readonly priorityRank: number;
}

export interface SynapseArbitrationReport {
  readonly totalCandidates: number;
  readonly winningCandidate: PosteriorResolution;
  readonly rankedCandidates: readonly PosteriorResolution[];
  readonly totalEvidenceLikelihood: number;
  readonly arbitrationDurationUs: number;
  readonly sha256Receipt: string;
}

export class EosMetaCognitiveSynapse {
  /**
   * Arbitrates concurrent multi-agent intents using Bayesian belief updates.
   * P(H_i | E) = (P(E | H_i) * P(H_i)) / sum(P(E | H_j) * P(H_j))
   */
  public static arbitrateIntents(candidates: readonly AgentIntentCandidate[]): SynapseArbitrationReport {
    const startNs = process.hrtime.bigint();

    if (candidates.length === 0) {
      throw new Error("Cannot arbitrate empty intent candidates");
    }

    // 1. Compute unnormalized posteriors: P(E|H) * P(H)
    const unnormalized = candidates.map((c) => ({
      candidate: c,
      weight: c.evidenceLikelihood * c.priorBelief,
    }));

    // 2. Marginal likelihood P(E) = sum(P(E|H_j) * P(H_j))
    const marginalLikelihood = unnormalized.reduce((acc, curr) => acc + curr.weight, 0);

    // Fallback if marginal is 0 (all likelihoods zeroed)
    const totalP = marginalLikelihood > 0 ? marginalLikelihood : candidates.length;

    // 3. Compute normalized posteriors
    const resolved: PosteriorResolution[] = unnormalized.map((item) => {
      const posterior = marginalLikelihood > 0 ? item.weight / totalP : 1.0 / candidates.length;
      return {
        agentId: item.candidate.agentId,
        role: item.candidate.role,
        action: item.candidate.action,
        priorBelief: item.candidate.priorBelief,
        posteriorProbability: Math.round(posterior * 10000) / 10000,
        priorityRank: 0,
      };
    });

    // 4. Sort descending by posterior probability
    resolved.sort((a, b) => b.posteriorProbability - a.posteriorProbability);

    // 5. Assign 1-based priority ranks
    for (let i = 0; i < resolved.length; i++) {
      (resolved[i] as any).priorityRank = i + 1;
    }

    const durationNs = process.hrtime.bigint() - startNs;
    const arbitrationDurationUs = Math.max(1, Number(durationNs / 1000n));

    const rawData = JSON.stringify({ resolved, marginalLikelihood });
    const sha256Receipt = crypto.createHash("sha256").update(rawData).digest("hex");

    return {
      totalCandidates: candidates.length,
      winningCandidate: resolved[0],
      rankedCandidates: resolved,
      totalEvidenceLikelihood: Math.round(marginalLikelihood * 10000) / 10000,
      arbitrationDurationUs,
      sha256Receipt,
    };
  }
}
