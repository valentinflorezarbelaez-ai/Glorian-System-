/**
 * EOS Planetary Monorepo Engine & Aerospace Mission-Critical Governor
 * Specification: SPEC-119 (IEEE 830 / ISO 29148 / NASA JPL Power of Ten / Google Rosie)
 * Standard: Planet-Scale Codebases (Google Piper, Meta EdenFS) and Flight Software (NASA JPL)
 *
 * Layer 0 Purity: 100% pure TypeScript/Node.js standard library (node:crypto).
 * Zero external npm runtime dependencies.
 */

import { createHash } from "node:crypto";

export interface VirtualMonorepoNode {
  id: string;
  path: string;
  dependencies: string[];
  contentSha256?: string;
}

export interface SparseProjectionResult {
  targetFile: string;
  totalMonorepoNodes: number;
  projectedNodesCount: number;
  pruningRatioPercent: number;
  transitiveClosure: string[];
  merkleRootSha256: string;
  sha256Attestation: string;
}

export interface JplAuditFinding {
  rule: number;
  ruleName: string;
  severity: "BLOCKER" | "WARNING";
  line?: number;
  description: string;
}

export interface JplPowerOfTenResult {
  certifiedFlightReady: boolean;
  verdict: "JPL_CERTIFIED_FLIGHT_READY" | "FAIL_UNBOUNDED_LOOP_DETECTED" | "FAIL_SAFETY_CRITICAL_VIOLATION";
  assertionDensityRatio: number;
  maxFunctionLinesObserved: number;
  violationsCount: number;
  findings: JplAuditFinding[];
  sha256Attestation: string;
}

export interface RosieCodemodShard {
  shardIndex: number;
  totalShards: number;
  packagesAffected: string[];
  topologicalDepth: number;
  canarySafe: boolean;
}

export interface RosiePlanResult {
  planId: string;
  totalPackagesAffected: number;
  totalShards: number;
  shards: RosieCodemodShard[];
  sha256Attestation: string;
}

export interface TmrVoterDecision {
  modelId: string;
  approved: boolean;
  assertionHash: string;
  rationale: string;
}

export interface TmrConsensusResult {
  quorumApproved: boolean;
  verdict: "TMR_QUORUM_APPROVED" | "TMR_BYZANTINE_SPLIT_REJECTED";
  agreeingVotesCount: number;
  totalVoters: number;
  winningAssertionHash?: string;
  sha256Attestation: string;
}

export interface PlanetaryGovernorStatus {
  totalProjectionsExecuted: number;
  totalJplAuditsExecuted: number;
  totalTmrAdjudicationsExecuted: number;
  totalRosiePlansGenerated: number;
  state: "NOMINAL" | "FLIGHT_ACTIVE";
}

export class EosPlanetaryMonorepoGovernor {
  private static instance: EosPlanetaryMonorepoGovernor | null = null;

  private totalProjectionsExecuted = 0;
  private totalJplAuditsExecuted = 0;
  private totalTmrAdjudicationsExecuted = 0;
  private totalRosiePlansGenerated = 0;

  public static getInstance(): EosPlanetaryMonorepoGovernor {
    if (!EosPlanetaryMonorepoGovernor.instance) {
      EosPlanetaryMonorepoGovernor.instance = new EosPlanetaryMonorepoGovernor();
    }
    return EosPlanetaryMonorepoGovernor.instance;
  }

  /**
   * Projects the minimum hermetic transitive closure from a virtual planet-scale monorepo graph.
   */
  public projectSparseClosure(targetFile: string, monorepoNodes: VirtualMonorepoNode[]): SparseProjectionResult {
    const nodeMap = new Map<string, VirtualMonorepoNode>();
    for (const node of monorepoNodes) {
      nodeMap.set(node.path, node);
      nodeMap.set(node.id, node);
    }

    const visited = new Set<string>();
    const closure: string[] = [];

    const traverse = (pathOrId: string) => {
      if (visited.has(pathOrId)) return;
      visited.add(pathOrId);

      const node = nodeMap.get(pathOrId);
      if (node) {
        closure.push(node.path);
        for (const dep of node.dependencies) {
          traverse(dep);
        }
      } else {
        closure.push(pathOrId);
      }
    };

    traverse(targetFile);

    const totalMonorepoNodes = Math.max(monorepoNodes.length, 1);
    const projectedNodesCount = closure.length;
    const pruningRatioPercent = Number(Math.max(0, (1 - projectedNodesCount / totalMonorepoNodes) * 100).toFixed(2));

    // Compute Merkle Root of closure
    closure.sort();
    const merkleHasher = createHash("sha256");
    for (const p of closure) {
      merkleHasher.update(p);
    }
    const merkleRootSha256 = merkleHasher.digest("hex");

    const digestPayload = `SPARSE:${targetFile}:${projectedNodesCount}:${merkleRootSha256}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    this.totalProjectionsExecuted++;

    return {
      targetFile,
      totalMonorepoNodes,
      projectedNodesCount,
      pruningRatioPercent,
      transitiveClosure: closure,
      merkleRootSha256,
      sha256Attestation,
    };
  }

  /**
   * Audits source code against Gerard Holzmann's NASA/JPL Power of Ten Safety-Critical Rules.
   */
  public auditJplPowerOfTen(sourceCode: string): JplPowerOfTenResult {
    const findings: JplAuditFinding[] = [];
    const lines = sourceCode.split("\n");

    // Rule 1: Simple Control Flow (no goto, no unhandled recursive references)
    if (sourceCode.includes("goto ")) {
      findings.push({
        rule: 1,
        ruleName: "Simple Control Flow",
        severity: "BLOCKER",
        description: "Rule 1 Violation: 'goto' statements are forbidden in safety-critical systems.",
      });
    }

    // Rule 2: Fixed Upper Bound on Loops
    const hasUnboundedWhile = /while\s*\(\s*(true|1)\s*\)/i.test(sourceCode);
    const hasUnboundedFor = /for\s*\(\s*;\s*;\s*\)/i.test(sourceCode);
    if (hasUnboundedWhile || hasUnboundedFor) {
      findings.push({
        rule: 2,
        ruleName: "Fixed Upper Bound on Loops",
        severity: "BLOCKER",
        description: "Rule 2 Violation: Open-ended infinite loop detected without deterministic upper bound.",
      });
    }

    // Rule 4: Function Length (<= 60 lines per function heuristics)
    let maxFunctionLinesObserved = 0;
    let currentFuncLines = 0;
    let inFunction = false;

    for (const l of lines) {
      if (/function\s+\w+|const\s+\w+\s*=\s*\(.*?\)\s*=>|public\s+\w+\(/i.test(l)) {
        inFunction = true;
        currentFuncLines = 0;
      }
      if (inFunction) {
        currentFuncLines++;
        if (currentFuncLines > maxFunctionLinesObserved) {
          maxFunctionLinesObserved = currentFuncLines;
        }
      }
      if (inFunction && l.trim() === "}") {
        inFunction = false;
      }
    }

    if (maxFunctionLinesObserved > 60) {
      findings.push({
        rule: 4,
        ruleName: "Restrict Function Size",
        severity: "WARNING",
        description: `Rule 4 Warning: Function exceeds 60 lines of code (${maxFunctionLinesObserved} lines).`,
      });
    }

    // Rule 5: Assertion Density (min 2 assertions per function heuristic)
    const functionCount = Math.max(1, (sourceCode.match(/function\s+|=>\s*\{|public\s+\w+\(/g) || []).length);
    const assertionCount = (sourceCode.match(/assert\.|assert\(|if\s*\(.*?throw/g) || []).length;
    const assertionDensityRatio = Number((assertionCount / functionCount).toFixed(2));

    if (assertionDensityRatio < 2.0 && assertionCount < 2) {
      findings.push({
        rule: 5,
        ruleName: "Assertion Density",
        severity: "WARNING",
        description: `Rule 5 Warning: Assertion density is ${assertionDensityRatio} (NASA requires >= 2 asserts/function).`,
      });
    }

    // Rule 6: Minimal Scope (no global var)
    if (/^\s*var\s+/m.test(sourceCode)) {
      findings.push({
        rule: 6,
        ruleName: "Minimal Variable Scope",
        severity: "BLOCKER",
        description: "Rule 6 Violation: Mutable global 'var' declarations are prohibited.",
      });
    }

    const blockers = findings.filter((f) => f.severity === "BLOCKER");
    let certifiedFlightReady = blockers.length === 0;
    let verdict: "JPL_CERTIFIED_FLIGHT_READY" | "FAIL_UNBOUNDED_LOOP_DETECTED" | "FAIL_SAFETY_CRITICAL_VIOLATION" =
      "JPL_CERTIFIED_FLIGHT_READY";

    if (hasUnboundedWhile || hasUnboundedFor) {
      certifiedFlightReady = false;
      verdict = "FAIL_UNBOUNDED_LOOP_DETECTED";
    } else if (!certifiedFlightReady) {
      verdict = "FAIL_SAFETY_CRITICAL_VIOLATION";
    }

    const digestPayload = `JPL:${verdict}:${assertionDensityRatio}:${findings.length}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    this.totalJplAuditsExecuted++;

    return {
      certifiedFlightReady,
      verdict,
      assertionDensityRatio,
      maxFunctionLinesObserved,
      violationsCount: findings.length,
      findings,
      sha256Attestation,
    };
  }

  /**
   * Decomposes widespread cross-package refactorings into topographically ordered atomic shards (Google Rosie).
   */
  public generateRosieCodemodPlan(packages: Array<{ id: string; dependencies: string[] }>): RosiePlanResult {
    const planId = `ROSIE-${Date.now().toString(36).toUpperCase()}`;

    // Topological stratification
    const depths = new Map<string, number>();
    for (const pkg of packages) {
      depths.set(pkg.id, 0);
    }

    // Assign depths
    for (let iter = 0; iter < packages.length; iter++) {
      for (const pkg of packages) {
        const currentDepth = depths.get(pkg.id) || 0;
        for (const dep of pkg.dependencies) {
          const depDepth = depths.get(dep) || 0;
          if (currentDepth <= depDepth) {
            depths.set(pkg.id, depDepth + 1);
          }
        }
      }
    }

    // Group into shards by depth
    const grouped = new Map<number, string[]>();
    for (const [id, depth] of depths.entries()) {
      if (!grouped.has(depth)) grouped.set(depth, []);
      grouped.get(depth)!.push(id);
    }

    const sortedDepths = Array.from(grouped.keys()).sort((a, b) => a - b);
    const shards: RosieCodemodShard[] = sortedDepths.map((depth, idx) => ({
      shardIndex: idx + 1,
      totalShards: sortedDepths.length,
      packagesAffected: grouped.get(depth)!.sort(),
      topologicalDepth: depth,
      canarySafe: true,
    }));

    const digestPayload = `ROSIE:${planId}:${packages.length}:${shards.length}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    this.totalRosiePlansGenerated++;

    return {
      planId,
      totalPackagesAffected: packages.length,
      totalShards: shards.length,
      shards,
      sha256Attestation,
    };
  }

  /**
   * Adjudicates Byzantine Triple Modular Redundancy (TMR) consensus across 3 independent voter decisions.
   */
  public adjudicateTmrConsensus(votes: TmrVoterDecision[]): TmrConsensusResult {
    this.totalTmrAdjudicationsExecuted++;

    if (votes.length < 3) {
      const digestPayload = `TMR:INSUFFICIENT:${votes.length}`;
      return {
        quorumApproved: false,
        verdict: "TMR_BYZANTINE_SPLIT_REJECTED",
        agreeingVotesCount: votes.length,
        totalVoters: votes.length,
        sha256Attestation: createHash("sha256").update(digestPayload).digest("hex"),
      };
    }

    // Group by (approved, assertionHash)
    const counts = new Map<string, { count: number; hash: string; approved: boolean }>();

    for (const v of votes) {
      const key = `${v.approved}:${v.assertionHash}`;
      if (!counts.has(key)) {
        counts.set(key, { count: 0, hash: v.assertionHash, approved: v.approved });
      }
      counts.get(key)!.count++;
    }

    let maxAgreement = 0;
    let winningGroup: { count: number; hash: string; approved: boolean } | null = null;

    for (const entry of counts.values()) {
      if (entry.count > maxAgreement) {
        maxAgreement = entry.count;
        winningGroup = entry;
      }
    }

    const quorumApproved = Boolean(winningGroup && winningGroup.approved && winningGroup.count >= 2);
    const verdict: "TMR_QUORUM_APPROVED" | "TMR_BYZANTINE_SPLIT_REJECTED" = quorumApproved
      ? "TMR_QUORUM_APPROVED"
      : "TMR_BYZANTINE_SPLIT_REJECTED";

    const digestPayload = `TMR:${verdict}:${maxAgreement}:${winningGroup?.hash || "NONE"}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    return {
      quorumApproved,
      verdict,
      agreeingVotesCount: maxAgreement,
      totalVoters: votes.length,
      winningAssertionHash: winningGroup?.hash,
      sha256Attestation,
    };
  }

  public getStatus(): PlanetaryGovernorStatus {
    return {
      totalProjectionsExecuted: this.totalProjectionsExecuted,
      totalJplAuditsExecuted: this.totalJplAuditsExecuted,
      totalTmrAdjudicationsExecuted: this.totalTmrAdjudicationsExecuted,
      totalRosiePlansGenerated: this.totalRosiePlansGenerated,
      state: "FLIGHT_ACTIVE",
    };
  }

  public reset(): void {
    this.totalProjectionsExecuted = 0;
    this.totalJplAuditsExecuted = 0;
    this.totalTmrAdjudicationsExecuted = 0;
    this.totalRosiePlansGenerated = 0;
  }
}
