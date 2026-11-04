/**
 * Sovereign 5/5 scorecard — Big Tech Max operational ceiling.
 * Explicitly NOT Level 5 / NSA_GRADE / absolute perfection.
 */

import fs from "node:fs";
import path from "node:path";

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { PHASE1_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import { PHASE2_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";
import { PHASE3_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase3CoreHandlers.ts";
import { PHASE4_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase4ToolNames.ts";
import { PHASE5_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase5ToolNames.ts";
import { PHASE6_MIGRATED_TOOL_NAMES } from "../mcp/tools/eosMcpPhase6ToolNames.ts";

export interface SovereignFivePillar {
  readonly id: string;
  readonly score: number;
  readonly max: number;
  readonly evidence: string;
}

export interface SovereignFiveScorecard {
  readonly title: string;
  readonly grade: "5/5" | "4/5" | "3/5" | "BELOW";
  readonly percent: number;
  readonly epistemicState: "SOVEREIGN_5_OF_5_WITHIN_TESTED_SCOPE" | "SOVEREIGN_PROGRESS_WITHIN_TESTED_SCOPE";
  readonly claimsDenied: readonly string[];
  readonly pillars: readonly SovereignFivePillar[];
  readonly godFileLines: number;
  readonly migratedTools: number;
  readonly locCutPercentVsPeak: number;
  readonly sha256Receipt: string;
}

const PEAK_GOD_LOC = 7122;

function gradeOf(percent: number): SovereignFiveScorecard["grade"] {
  if (percent >= 95) return "5/5";
  if (percent >= 80) return "4/5";
  if (percent >= 60) return "3/5";
  return "BELOW";
}

export function evaluateSovereignFiveScorecard(
  projectRoot: string = process.cwd()
): SovereignFiveScorecard {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const runtimeDeps = Object.keys(pkg.dependencies || {}).length;
  const godFile = path.join(projectRoot, "src/mcp/eosMcpServer.ts");
  const godFileLines = fs.existsSync(godFile)
    ? fs.readFileSync(godFile, "utf8").split(/\r?\n/).length
    : 0;
  const migrated = new Set([
    ...PHASE1_MIGRATED_TOOL_NAMES,
    ...PHASE2_MIGRATED_TOOL_NAMES,
    ...PHASE3_MIGRATED_TOOL_NAMES,
    ...PHASE4_MIGRATED_TOOL_NAMES,
    ...PHASE5_MIGRATED_TOOL_NAMES,
    ...PHASE6_MIGRATED_TOOL_NAMES
  ]);
  const locCutPercentVsPeak = Math.round(
    ((PEAK_GOD_LOC - godFileLines) / PEAK_GOD_LOC) * 1000
  ) / 10;

  const registry = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "docs/projects/registry.json"), "utf8")
  );
  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  const ownerOk = projects.filter((p: { ownerApproval?: string }) => p.ownerApproval).length;
  const tipSeal = fs.existsSync(path.join(projectRoot, "docs/evidence/provenance.intoto.jsonl"));
  const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
  const level5Drift = /\bLevel-5\b|\bLevel 5\b/i.test(readme) && !/not Level 5|within tested scope/i.test(readme);

  const pillars: SovereignFivePillar[] = [
    {
      id: "LAYER0_PURITY",
      score: runtimeDeps === 0 ? 20 : 0,
      max: 20,
      evidence: `runtimeDependenciesCount=${runtimeDeps}`
    },
    {
      id: "MCP_MODULAR_AUTHORITY",
      score: Math.min(20, Math.round((migrated.size / 60) * 20)),
      max: 20,
      evidence: `${migrated.size} registry tools; god-file ${godFileLines} LOC (−${locCutPercentVsPeak}% vs peak)`
    },
    {
      id: "FLEET_LAW_IV",
      score: ownerOk === 10 ? 20 : Math.round((ownerOk / 10) * 20),
      max: 20,
      evidence: `ownerApproval ${ownerOk}/10 · fleet projects ${projects.length}`
    },
    {
      id: "EVIDENCE_TIP_SEAL",
      score: tipSeal ? 20 : 0,
      max: 20,
      evidence: tipSeal ? "provenance.intoto.jsonl present" : "tip-seal missing"
    },
    {
      id: "EPISTEMIC_HONESTY",
      score: level5Drift ? 5 : 20,
      max: 20,
      evidence: level5Drift
        ? "README still markets Level-5 without within-scope framing"
        : "Level-5 denied; WITHIN_TESTED_SCOPE language active"
    }
  ];

  const totalScore = pillars.reduce((a, p) => a + p.score, 0);
  const totalMax = pillars.reduce((a, p) => a + p.max, 0);
  const percent = totalMax === 0 ? 0 : Math.round((totalScore / totalMax) * 1000) / 10;
  const grade = gradeOf(percent);

  return deepFreeze({
    title: "Glorian Sovereign 5/5 Scorecard",
    grade,
    percent,
    epistemicState:
      grade === "5/5"
        ? "SOVEREIGN_5_OF_5_WITHIN_TESTED_SCOPE"
        : "SOVEREIGN_PROGRESS_WITHIN_TESTED_SCOPE",
    claimsDenied: [
      "Level 5",
      "NSA_GRADE",
      "AEROSPACE_CERTIFIED",
      "FEDERAL_ATO",
      "ABSOLUTE_UNIVERSAL_PERFECTION"
    ],
    pillars,
    godFileLines,
    migratedTools: migrated.size,
    locCutPercentVsPeak,
    sha256Receipt: pureSha256(
      `SOVEREIGN5:${grade}:${percent}:${migrated.size}:${godFileLines}:${ownerOk}`
    )
  });
}
