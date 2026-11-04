/**
 * EOS SYSTEM — PLANETARY APEX OPERATING DOCTRINE DRILLS (Layer 0)
 * Governed by SPEC-158 / CHANGE-093
 *
 * Software *doctrine drills* inspired by civilizational bottleneck orgs.
 * Explicitly NOT physical monopoly parity (ASML/TSMC), NOT orbital capability (SpaceX),
 * NOT classified black-budget parity (DARPA/NSA), NOT Level 5.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { evaluateApexDoctrineScorecard } from "./eosApexDoctrineScorecard.ts";
import { CORE_TIER0_TOOL_NAMES } from "../mcp/eosMcpToolCatalog.ts";
import { PHASE1_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import { PHASE2_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";
import { PHASE3_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase3CoreHandlers.ts";

export type ApexPillarId =
  | "ASML_TSMC_PRECISION"
  | "SPACEX_TMR_AVIONICS"
  | "DEEPMIND_INVARIANTS"
  | "DARPA_SKUNK_ISOLATION"
  | "NSA_LIVERMORE_IMMUTABILITY";

export interface PillarAuditResult {
  readonly pillarId: ApexPillarId;
  readonly name: string;
  readonly compliant: boolean;
  readonly score: number;
  readonly latencyUs: number;
  readonly details: string;
  readonly sha256Receipt: string;
}

export interface PlanetaryApexReport {
  readonly status: "APEX_DRILL_PASS" | "DEGRADED" | "CRITICAL_VIOLATION";
  readonly epistemicState: "APEX_DRILL_WITHIN_TESTED_SCOPE";
  readonly claimsDenied: readonly string[];
  readonly overallScore: number;
  readonly totalDurationUs: number;
  readonly pillars: readonly PillarAuditResult[];
  readonly sha256Receipt: string;
  readonly auditedAtIso: string;
}

export interface TmrVoteInput<T> {
  readonly vectorA: T;
  readonly vectorB: T;
  readonly vectorC: T;
}

export interface TmrVoteResult<T> {
  readonly agreedValue: T;
  readonly quorumReached: boolean;
  readonly unanimous: boolean;
  readonly dissentingNode: "A" | "B" | "C" | "NONE";
  readonly sha256Receipt: string;
}

const CLAIMS_DENIED = [
  "Level 5",
  "ASML/TSMC physical monopoly parity",
  "SpaceX orbital / Starship capability",
  "DARPA/NSA/NRO black-budget program parity",
  "Neuralink/CRISPR biological capability"
] as const;

export class EosPlanetaryApexDoctrine {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    assertPrecondition(
      typeof projectRoot === "string" && projectRoot.length > 0,
      "projectRoot must be a non-empty string"
    );
    this.projectRoot = path.resolve(projectRoot);
  }

  /** SpaceX-style TMR 2-of-3 voting drill (software consensus, not avionics hardware). */
  public static executeTmrVoting<T>(input: TmrVoteInput<T>): TmrVoteResult<T> {
    assertPrecondition(Boolean(input), "TmrVoteInput must be provided");

    const hashA = pureSha256(JSON.stringify(input.vectorA));
    const hashB = pureSha256(JSON.stringify(input.vectorB));
    const hashC = pureSha256(JSON.stringify(input.vectorC));

    let agreedValue: T;
    let unanimous = false;
    let quorumReached = true;
    let dissentingNode: "A" | "B" | "C" | "NONE" = "NONE";

    if (hashA === hashB && hashB === hashC) {
      agreedValue = input.vectorA;
      unanimous = true;
    } else if (hashA === hashB) {
      agreedValue = input.vectorA;
      dissentingNode = "C";
    } else if (hashA === hashC) {
      agreedValue = input.vectorA;
      dissentingNode = "B";
    } else if (hashB === hashC) {
      agreedValue = input.vectorB;
      dissentingNode = "A";
    } else {
      agreedValue = input.vectorA;
      quorumReached = false;
    }

    return deepFreeze({
      agreedValue,
      quorumReached,
      unanimous,
      dissentingNode,
      sha256Receipt: pureSha256(`TMR:${hashA}:${hashB}:${hashC}:${quorumReached}:${dissentingNode}`)
    });
  }

  /**
   * Audits five software-analog pillars with measurable evidence (not hardcoded vanity 100s).
   */
  public auditPillars(): PlanetaryApexReport {
    const t0 = process.hrtime.bigint();
    const pillars: PillarAuditResult[] = [];

    // 1. ASML analog: deterministic micro-budget loop (software timing drill only)
    const p1Start = process.hrtime.bigint();
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum = (sum * 1664525 + 1013904223) & 0xffffffff;
    }
    const p1DurationUs = Number(process.hrtime.bigint() - p1Start) / 1000;
    pillars.push({
      pillarId: "ASML_TSMC_PRECISION",
      name: "Deterministic Hot-Path Timing Drill",
      compliant: p1DurationUs < 1000,
      score: p1DurationUs < 500 ? 100 : p1DurationUs < 1000 ? 90 : 40,
      latencyUs: Number(p1DurationUs.toFixed(2)),
      details: `1,000 bitwise transitions in ${p1DurationUs.toFixed(2)}µs (software drill; not EUV lithography)`,
      sha256Receipt: pureSha256(`ASML_DRILL:${p1DurationUs}:${sum}`)
    });

    // 2. SpaceX analog: real TMR 2-of-3
    const p2Start = process.hrtime.bigint();
    const tmrTest = EosPlanetaryApexDoctrine.executeTmrVoting({
      vectorA: { telemetryActive: true, velocityMps: 7800 },
      vectorB: { telemetryActive: true, velocityMps: 7800 },
      vectorC: { telemetryActive: false, velocityMps: 0 }
    });
    const p2DurationUs = Number(process.hrtime.bigint() - p2Start) / 1000;
    pillars.push({
      pillarId: "SPACEX_TMR_AVIONICS",
      name: "TMR 2-of-3 Software Consensus",
      compliant: tmrTest.quorumReached && tmrTest.dissentingNode === "C",
      score: tmrTest.quorumReached ? 100 : 0,
      latencyUs: Number(p2DurationUs.toFixed(2)),
      details: `Quorum=${tmrTest.quorumReached}; dissent=${tmrTest.dissentingNode} (software vote; not flight computers)`,
      sha256Receipt: tmrTest.sha256Receipt
    });

    // 3. DeepMind analog: apex doctrine scorecard + frozen evidence object
    const p3Start = process.hrtime.bigint();
    const card = evaluateApexDoctrineScorecard(this.projectRoot);
    const frozen = Object.isFrozen(deepFreeze({ status: card.epistemicState, percent: card.percent }));
    const p3Ok = frozen && card.percent >= 85 && card.claimsDenied.includes("Level 5");
    const p3DurationUs = Number(process.hrtime.bigint() - p3Start) / 1000;
    pillars.push({
      pillarId: "DEEPMIND_INVARIANTS",
      name: "Evidence-Bound Invariant Ceiling",
      compliant: p3Ok,
      score: p3Ok ? 100 : 50,
      latencyUs: Number(p3DurationUs.toFixed(2)),
      details: `ApexDoctrine ${card.grade} ${card.percent}% · epistemic ${card.epistemicState}`,
      sha256Receipt: card.sha256Receipt
    });

    // 4. DARPA analog: Layer-0 purity + core MCP single-path migration
    const p4Start = process.hrtime.bigint();
    let runtimeDeps = -1;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.projectRoot, "package.json"), "utf8"));
      runtimeDeps = Object.keys(pkg.dependencies || {}).length;
    } catch {
      runtimeDeps = -1;
    }
    const migrated = new Set([
      ...PHASE1_MIGRATED_TOOL_NAMES,
      ...PHASE2_MIGRATED_TOOL_NAMES,
      ...PHASE3_MIGRATED_TOOL_NAMES
    ]);
    const coreMigrated = [...CORE_TIER0_TOOL_NAMES].every((t) => migrated.has(t));
    const p4Ok = runtimeDeps === 0 && coreMigrated;
    const p4DurationUs = Number(process.hrtime.bigint() - p4Start) / 1000;
    pillars.push({
      pillarId: "DARPA_SKUNK_ISOLATION",
      name: "Hermetic Layer-0 + Core Dispatch Isolation",
      compliant: p4Ok,
      score: p4Ok ? 100 : 40,
      latencyUs: Number(p4DurationUs.toFixed(2)),
      details: `runtimeDeps=${runtimeDeps}; CORE_TIER0 migrated=${coreMigrated} (${migrated.size} handlers)`,
      sha256Receipt: pureSha256(`DARPA_DRILL:${runtimeDeps}:${coreMigrated}:${migrated.size}`)
    });

    // 5. NSA analog: provenance + SBOM presence (not SIGINT)
    const p5Start = process.hrtime.bigint();
    const prov = path.join(this.projectRoot, "docs/evidence/provenance.intoto.jsonl");
    const sbom = path.join(this.projectRoot, "docs/evidence/sbom.cdx.json");
    const p5Ok = fs.existsSync(prov) && fs.existsSync(sbom);
    const p5DurationUs = Number(process.hrtime.bigint() - p5Start) / 1000;
    pillars.push({
      pillarId: "NSA_LIVERMORE_IMMUTABILITY",
      name: "Supply-Chain Attestation Presence",
      compliant: p5Ok,
      score: p5Ok ? 100 : 0,
      latencyUs: Number(p5DurationUs.toFixed(2)),
      details: p5Ok
        ? "provenance.intoto.jsonl + sbom.cdx.json present (software SLSA drill; not SIGINT)"
        : "Missing SLSA/SBOM evidence artifacts",
      sha256Receipt: pureSha256(`NSA_DRILL:${p5Ok}:${p5DurationUs}`)
    });

    const totalDurationUs = Number(process.hrtime.bigint() - t0) / 1000;
    const overallScore = pillars.reduce((acc, p) => acc + p.score, 0) / pillars.length;
    const allCompliant = pillars.every((p) => p.compliant);

    const cumulativeHash = crypto.createHash("sha256");
    for (const p of pillars) cumulativeHash.update(p.sha256Receipt);
    const sha256Receipt = cumulativeHash.digest("hex");

    const report: PlanetaryApexReport = {
      status: allCompliant && overallScore >= 95 ? "APEX_DRILL_PASS" : "DEGRADED",
      epistemicState: "APEX_DRILL_WITHIN_TESTED_SCOPE",
      claimsDenied: CLAIMS_DENIED,
      overallScore: Number(overallScore.toFixed(1)),
      totalDurationUs: Number(totalDurationUs.toFixed(2)),
      pillars: Object.freeze(pillars),
      sha256Receipt,
      auditedAtIso: new Date().toISOString()
    };

    assertPostcondition(report.pillars.length === 5, "Report must evaluate exactly 5 apex pillars");
    assertPostcondition(report.sha256Receipt.length === 64, "Receipt must be 64-char SHA-256");
    return deepFreeze(report);
  }
}
