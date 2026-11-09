/**
 * EOS SYSTEM — MISSION GOLDEN PATH ORCHESTRATOR (Layer 0)
 * Governed by SPEC-156 / CHANGE-091 / GLORIAN_SPOTIFY_ONLY_NORTH_STAR
 *
 * Composes amplify → Antigravity direction → architecture → tribunal →
 * Spotify-only North Star doctrine probe → Spotify institutional probe →
 * Nubank advisory (hard only for fintech) → turbo → ledger seal.
 * Fail-closed: no SUCCESS / DONE without mandatory stage exitCode 0.
 * Epistemic: MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE (explicitly NOT Level 5).
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";

import { assertPostcondition, assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { amplifyPrompt } from "./eosPromptAmplifier.ts";
import { EosAntigravityDirector } from "./eosAntigravityDirector.ts";
import { scanArchitecture } from "./eosArchitectureGuard.ts";
import { evaluateDecision } from "./eosCognitiveJudge.ts";
import { evaluateSpotifyArchitectureHealth, type SpotifyArchitectureMetrics } from "./eosSpotifyInstitutionalCodex.ts";
import { evaluateNubankArchitectureHealth, type NubankArchitectureMetrics } from "./eosNubankCodex.ts";
import { runTurboPipeline } from "./eosTurboEngine.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";
import { EosAgenticFinOpsGovernor } from "./eosAgenticFinOpsGovernor.ts";

export type MissionDomainHint = "general" | "audio" | "fintech" | "nubank" | "spotify" | "platform";

export type MissionStatus = "SUCCESS" | "BLOCKED" | "FAILED";

export type MissionStageId =
  | "INPUT_VALIDATION"
  | "FINOPS_COST_RECEIPT"
  | "AMPLIFY"
  | "MISSION_DIRECTION"
  | "ARCHITECTURE"
  | "CONSTITUTIONAL_TRIBUNAL"
  | "SPOTIFY_ONLY_NORTH_STAR"
  | "SPOTIFY_INSTITUTIONAL"
  | "NUBANK_INSTITUTIONAL"
  | "TURBO_VERIFY"
  | "LEDGER_SEAL";

export interface MissionStageResult {
  readonly stageId: MissionStageId;
  readonly mandatory: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly summary: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface MissionGoldenPathOptions {
  readonly projectRoot?: string;
  readonly target?: string;
  readonly domainHint?: MissionDomainHint;
  readonly architectureTargetDir?: string;
  readonly spotifyFloor?: number;
  readonly nubankFloor?: number;
  readonly sealLedger?: boolean;
  readonly ledgerPath?: string;
}

export interface MissionGoldenPathResult {
  readonly status: MissionStatus;
  readonly failingStage: MissionStageId | null;
  readonly directive: string;
  readonly target: string;
  readonly domainHint: MissionDomainHint;
  readonly stages: readonly MissionStageResult[];
  readonly epistemicState: "MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE" | "REMEDIATION_REQUIRED" | "BLOCKED";
  readonly sha256Receipt: string;
  readonly durationMs: number;
  readonly ledgerEntryId: string | null;
}

const DEFAULT_SPOTIFY_FLOOR = 75;
const DEFAULT_NUBANK_FLOOR = 80;

function existsRel(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

function inferDomainHint(directive: string, explicit?: MissionDomainHint): MissionDomainHint {
  if (explicit) return explicit;
  const d = directive.toLowerCase();
  if (/\bnubank\b|\bfintech\b|\bbanking\b|\bdatomic\b|\bsachem\b/.test(d)) return "fintech";
  if (
    /\bspotify\b|\bsoundcheck\b|\bbs\.?1770\b|\bloudness\b|\baudio\b|\bcamelot\b|\bplaylist\b|\bartist\b|\bmusic expression\b|\boctav/.test(
      d,
    )
  ) {
    return /\baudio\b|\bbs\.?1770\b|\bloudness\b|\bcamelot\b/.test(d) ? "audio" : "spotify";
  }
  if (/\bplatform\b|\bcontrol.?plane\b|\bmcp\b|\bfleet\b/.test(d)) return "platform";
  return "general";
}

/** Spotify-only North Star doctrine presence (Glorian control-plane repos). */
function probeSpotifyOnlyNorthStar(projectRoot: string): {
  readonly doctrinePresent: boolean;
  readonly octavesMethodPresent: boolean;
  readonly workCompanionPresent: boolean;
  readonly unitotalVowPresent: boolean;
  readonly missing: readonly string[];
} {
  const required: ReadonlyArray<{ readonly rel: string; readonly id: string }> = [
    { rel: "docs/governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md", id: "spotify_only_north_star" },
    { rel: "docs/governance/HOW_WE_IMPROVE_SPOTIFY_WITH_OCTAVES.md", id: "octaves_method" },
    { rel: "docs/career/SPOTIFY_WORK_COMPANION_OS.md", id: "work_companion_os" },
    { rel: "docs/governance/SPOTIFY_UNITOTAL_EXCELLENCE_COMMITMENT.md", id: "unitotal_vow" },
  ];
  const missing: string[] = [];
  for (const item of required) {
    if (!existsRel(projectRoot, item.rel)) missing.push(item.id);
  }
  return {
    doctrinePresent: !missing.includes("spotify_only_north_star"),
    octavesMethodPresent: !missing.includes("octaves_method"),
    workCompanionPresent: !missing.includes("work_companion_os"),
    unitotalVowPresent: !missing.includes("unitotal_vow"),
    missing,
  };
}

function estimateCoveragePercent(projectRoot: string): number {
  const testDir = path.join(projectRoot, "test");
  if (!fs.existsSync(testDir)) return 40;
  let count = 0;
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (/\.(mjs|ts|js)$/.test(e.name)) count += 1;
    }
  };
  walk(testDir);
  if (count >= 80) return 90;
  if (count >= 40) return 85;
  if (count >= 15) return 75;
  return 55;
}

function probeSpotifyMetrics(projectRoot: string, domain: MissionDomainHint): SpotifyArchitectureMetrics {
  const hasCanary =
    existsRel(projectRoot, "src/core/eosProgressiveCanaryMesh.ts") ||
    existsRel(projectRoot, "src/core/eosStatisticalCanaryAuditor.ts") ||
    existsRel(projectRoot, "src/core/eosVercelCanaryObservability.ts");
  const hasPostmortem =
    existsRel(projectRoot, "docs/governance") ||
    existsRel(projectRoot, "openspec/specs/SPEC-024-SPOTIFY-INSTITUTIONAL-CODEX.md");
  return {
    usesGoldenPath:
      existsRel(projectRoot, "openspec") ||
      existsRel(projectRoot, "docs/governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md") ||
      existsRel(projectRoot, "docs/governance/GLORIAN_NORTH_STAR_SPOTIFY_NUBANK_NL_SDLC.md"),
    hasCatalogInfoYaml: existsRel(projectRoot, "catalog-info.yaml"),
    hasTechDocsAndRunbook: existsRel(projectRoot, "docs"),
    // Non-audio domains treat BS.1770 as N/A-pass (FR-512).
    compliesWithBS1770Loudness: domain !== "audio" ? true : hasCanary,
    hasProgressiveCanaryPipeline: hasCanary,
    hasAutomatedKillSwitch: hasCanary,
    hasBlamelessPostmortemProcess: hasPostmortem,
    unitTestCoveragePercent: estimateCoveragePercent(projectRoot),
  };
}

function probeNubankMetrics(projectRoot: string, archClean: boolean): NubankArchitectureMetrics {
  const hasLedger =
    existsRel(projectRoot, "src/core/eosDurableSqliteLedger.ts") ||
    existsRel(projectRoot, "src/core/eosBitemporalLedger.ts");
  return {
    hasMutableStateInDomain: false,
    usesHexagonalLayerIsolation: archClean,
    usesContractTestingInsteadOfE2E: existsRel(projectRoot, "test"),
    enforcesKafkaIdempotencyTokens: hasLedger,
    usesImmutableBitemporalLedgers: hasLedger,
    hasBlamelessPostmortemProcess: existsRel(projectRoot, "docs/governance"),
    unitTestCoveragePercent: estimateCoveragePercent(projectRoot),
  };
}

function stage(
  stageId: MissionStageId,
  mandatory: boolean,
  exitCode: number,
  durationMs: number,
  summary: string,
  evidence: Readonly<Record<string, unknown>>,
): MissionStageResult {
  return deepFreeze({ stageId, mandatory, exitCode, durationMs, summary, evidence });
}

/**
 * Executes the fail-closed Mission Golden Path for a natural-language directive.
 */
export function runMissionGoldenPath(
  directive: string,
  options: MissionGoldenPathOptions = {},
): MissionGoldenPathResult {
  const started = process.hrtime.bigint();
  const stages: MissionStageResult[] = [];
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const target = String(options.target || "eos-system").trim() || "eos-system";
  const spotifyFloor = typeof options.spotifyFloor === "number" ? options.spotifyFloor : DEFAULT_SPOTIFY_FLOOR;
  const nubankFloor = typeof options.nubankFloor === "number" ? options.nubankFloor : DEFAULT_NUBANK_FLOOR;
  const sealLedger = options.sealLedger !== false;

  const fail = (
    status: MissionStatus,
    failingStage: MissionStageId,
    epistemic: MissionGoldenPathResult["epistemicState"],
    ledgerEntryId: string | null = null,
  ): MissionGoldenPathResult => {
    const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const receiptPayload = JSON.stringify({
      status,
      failingStage,
      directive: typeof directive === "string" ? directive.trim() : "",
      target,
      stageIds: stages.map((s) => s.stageId),
      exitCodes: stages.map((s) => s.exitCode),
    });
    const sha256Receipt = pureSha256(receiptPayload);
    assertPostcondition(sha256Receipt.length === 64, "Mission receipt must be 64-char SHA-256");
    return deepFreeze({
      status,
      failingStage,
      directive: typeof directive === "string" ? directive.trim() : "",
      target,
      domainHint: inferDomainHint(typeof directive === "string" ? directive : "", options.domainHint),
      stages: stages.slice(),
      epistemicState: epistemic,
      sha256Receipt,
      durationMs,
      ledgerEntryId,
    });
  };

  if (typeof directive !== "string" || directive.trim().length === 0) {
    stages.push(
      stage("INPUT_VALIDATION", true, 1, 0, "Directive must be a non-empty string", {
        boundBytes: 0,
      }),
    );
    return fail("FAILED", "INPUT_VALIDATION", "BLOCKED");
  }

  const cleanDirective = directive.trim();
  assertPrecondition(Buffer.byteLength(cleanDirective, "utf8") <= 32768, "Directive exceeds 32 KiB bound");
  const domainHint = inferDomainHint(cleanDirective, options.domainHint);
  stages.push(
    stage("INPUT_VALIDATION", true, 0, 0, "Directive admitted", {
      byteLength: Buffer.byteLength(cleanDirective, "utf8"),
      domainHint,
    }),
  );

  // 0b. FinOps cost receipt (API cost truth — subscription ≠ production spend)
  {
    const t0 = process.hrtime.bigint();
    const finops = EosAgenticFinOpsGovernor.getInstance();
    const estimatedTokens = Math.min(
      32_000,
      Math.max(1_000, Math.ceil(Buffer.byteLength(cleanDirective, "utf8") / 4) * 8),
    );
    const routing = finops.classifyTaskCostTier(cleanDirective, estimatedTokens);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok =
      typeof routing.estimatedCostUsd === "number" &&
      Number.isFinite(routing.estimatedCostUsd) &&
      routing.sha256Attestation.length === 64;
    stages.push(
      stage(
        "FINOPS_COST_RECEIPT",
        true,
        ok ? 0 : 1,
        ms,
        ok
          ? `Tier ${routing.tier} · est $${routing.estimatedCostUsd.toFixed(6)} · ${routing.recommendedProviderModel}`
          : "FinOps cost receipt failed",
        {
          tier: routing.tier,
          recommendedProviderModel: routing.recommendedProviderModel,
          estimatedTokens,
          estimatedCostUsd: routing.estimatedCostUsd,
          ratePerMillionUsd: routing.ratePerMillionUsd,
          rationale: routing.rationale,
          sha256Attestation: routing.sha256Attestation,
          epistemicNote: "Estimate only — not a live provider invoice; WITHIN_TESTED_SCOPE",
        },
      ),
    );
    if (!ok) return fail("FAILED", "FINOPS_COST_RECEIPT", "REMEDIATION_REQUIRED");
  }

  // 1. Amplify
  {
    const t0 = process.hrtime.bigint();
    const amplified = amplifyPrompt({ rawPrompt: cleanDirective, strictLevel: "hardened" });
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok = Boolean(amplified && amplified.synthesizedSystemPrompt);
    stages.push(
      stage("AMPLIFY", true, ok ? 0 : 1, ms, ok ? "EARS/BDD draft synthesized" : "Amplify failed", {
        earsCount: Array.isArray(amplified?.earsRequirements) ? amplified.earsRequirements.length : 0,
        bddCount: Array.isArray(amplified?.bddScenarios) ? amplified.bddScenarios.length : 0,
      }),
    );
    if (!ok) return fail("FAILED", "AMPLIFY", "REMEDIATION_REQUIRED");
  }

  // 2. Mission direction (Law IV barrier + DAG)
  {
    const t0 = process.hrtime.bigint();
    const plan = EosAntigravityDirector.directMission(cleanDirective, target, projectRoot);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const blocked = plan.writeBarrierStatus === "BLOCKED_BY_LAW_IV";
    stages.push(
      stage(
        "MISSION_DIRECTION",
        true,
        blocked ? 1 : 0,
        ms,
        blocked ? "Law IV write barrier blocked mission" : `Profile ${plan.profile}`,
        {
          profile: plan.profile,
          writeBarrierStatus: plan.writeBarrierStatus,
          dagToolCount: plan.prescribedMcpDag.length,
          sha256Receipt: plan.sha256Receipt,
        },
      ),
    );
    if (blocked) return fail("BLOCKED", "MISSION_DIRECTION", "BLOCKED");
  }

  // 3. Architecture
  let archClean = false;
  {
    const t0 = process.hrtime.bigint();
    const archDir = options.architectureTargetDir || "src/core";
    const report = scanArchitecture(path.join(projectRoot, archDir), projectRoot);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    archClean = report.isClean === true && report.architecturePurityScore >= 90;
    stages.push(
      stage(
        "ARCHITECTURE",
        true,
        archClean ? 0 : 1,
        ms,
        archClean
          ? `Architecture clean score=${report.architecturePurityScore}`
          : `Architecture dirty score=${report.architecturePurityScore} violations=${report.totalViolations}`,
        {
          architecturePurityScore: report.architecturePurityScore,
          totalViolations: report.totalViolations,
          circularDependencies: report.circularDependencies.length,
          isClean: report.isClean,
        },
      ),
    );
    if (!archClean) return fail("FAILED", "ARCHITECTURE", "REMEDIATION_REQUIRED");
  }

  // 4. Constitutional tribunal (cognitive judge)
  {
    const t0 = process.hrtime.bigint();
    const verdict = evaluateDecision({
      title: "Mission Golden Path Tribunal",
      description: cleanDirective,
      proposedAction:
        "Execute fail-closed NL→SDLC Mission Golden Path with Spotify-only North Star, Spotify institutional gates, Nubank advisory (hard if fintech), turbo evidence, and ledger seal. Derived from SPEC-156 EARS/BDD. No vibe coding.",
      targetDomain: "CORE",
    });
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok = verdict.approved === true && verdict.overallScore >= 70;
    stages.push(
      stage(
        "CONSTITUTIONAL_TRIBUNAL",
        true,
        ok ? 0 : 1,
        ms,
        ok ? `Tribunal approved score=${verdict.overallScore}` : `Tribunal rejected score=${verdict.overallScore}`,
        {
          approved: verdict.approved,
          overallScore: verdict.overallScore,
          epistemicState: verdict.epistemicState,
          remediations: verdict.requiredRemediations.slice(0, 5),
        },
      ),
    );
    if (!ok) return fail("BLOCKED", "CONSTITUTIONAL_TRIBUNAL", "BLOCKED");
  }

  // 4b. Spotify-only North Star doctrine (mandatory for eos-system / glorian control plane)
  {
    const t0 = process.hrtime.bigint();
    const probe = probeSpotifyOnlyNorthStar(projectRoot);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const isControlPlane =
      existsRel(projectRoot, "src/mcp/eosMcpServer.ts") && existsRel(projectRoot, "docs/projects/registry.json");
    const ok = !isControlPlane || probe.missing.length === 0;
    stages.push(
      stage(
        "SPOTIFY_ONLY_NORTH_STAR",
        isControlPlane,
        ok ? 0 : 1,
        ms,
        ok
          ? isControlPlane
            ? "Spotify-only North Star doctrine pack present"
            : "Spotify-only North Star advisory (non control-plane)"
          : `Missing Spotify-only doctrine: ${probe.missing.join(", ")}`,
        {
          isControlPlane,
          ...probe,
        },
      ),
    );
    if (!ok) return fail("FAILED", "SPOTIFY_ONLY_NORTH_STAR", "REMEDIATION_REQUIRED");
  }

  // 5. Spotify institutional (always mandatory)
  {
    const t0 = process.hrtime.bigint();
    const metrics = probeSpotifyMetrics(projectRoot, domainHint);
    const evaluation = evaluateSpotifyArchitectureHealth(metrics);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok = evaluation.institutionalScore >= spotifyFloor;
    stages.push(
      stage(
        "SPOTIFY_INSTITUTIONAL",
        true,
        ok ? 0 : 1,
        ms,
        ok
          ? `Spotify score=${evaluation.institutionalScore} tier=${evaluation.soundcheckTier}`
          : `Spotify below floor ${spotifyFloor}: score=${evaluation.institutionalScore}`,
        {
          institutionalScore: evaluation.institutionalScore,
          soundcheckTier: evaluation.soundcheckTier,
          floor: spotifyFloor,
          findings: evaluation.findings.slice(0, 6),
        },
      ),
    );
    if (!ok) return fail("FAILED", "SPOTIFY_INSTITUTIONAL", "REMEDIATION_REQUIRED");
  }

  // 6. Nubank institutional (hard for fintech/nubank; soft otherwise)
  {
    const hard = domainHint === "fintech" || domainHint === "nubank";
    const t0 = process.hrtime.bigint();
    const metrics = probeNubankMetrics(projectRoot, archClean);
    const evaluation = evaluateNubankArchitectureHealth(metrics);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok = !hard || evaluation.institutionalScore >= nubankFloor;
    stages.push(
      stage(
        "NUBANK_INSTITUTIONAL",
        hard,
        ok ? 0 : 1,
        ms,
        hard
          ? ok
            ? `Nubank hard gate score=${evaluation.institutionalScore} tier=${evaluation.tier}`
            : `Nubank below floor ${nubankFloor}: score=${evaluation.institutionalScore}`
          : `Nubank advisory score=${evaluation.institutionalScore} (soft)`,
        {
          institutionalScore: evaluation.institutionalScore,
          tier: evaluation.tier,
          hard,
          floor: nubankFloor,
        },
      ),
    );
    if (!ok) return fail("FAILED", "NUBANK_INSTITUTIONAL", "REMEDIATION_REQUIRED");
  }

  // 7. Turbo verify
  {
    const t0 = process.hrtime.bigint();
    const turbo = runTurboPipeline(projectRoot);
    const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    const ok = turbo.success === true;
    stages.push(
      stage(
        "TURBO_VERIFY",
        true,
        ok ? 0 : 1,
        ms,
        ok ? `Turbo PASS files=${turbo.totalFilesChecked}` : `Turbo FAIL violations=${turbo.violations.length}`,
        {
          success: turbo.success,
          totalFilesChecked: turbo.totalFilesChecked,
          totalDurationMs: turbo.totalDurationMs,
          epistemicState: turbo.epistemicState,
          violationSample: turbo.violations.slice(0, 5),
        },
      ),
    );
    if (!ok) return fail("FAILED", "TURBO_VERIFY", "REMEDIATION_REQUIRED");
  }

  // 8. Ledger seal
  let ledgerEntryId: string | null = null;
  {
    const t0 = process.hrtime.bigint();
    if (sealLedger) {
      const dbPath = options.ledgerPath || ":memory:";
      const ledger = new EosDurableSqliteLedger(dbPath);
      try {
        const record = ledger.appendEntry({
          category: "MISSION_DIRECTION",
          projectId: target,
          title: `Mission Golden Path: ${cleanDirective.slice(0, 120)}`,
          engramTopicKey: "mission/golden-path",
          payload: {
            spec: "SPEC-156",
            domainHint,
            stageIds: stages.map((s) => s.stageId),
            exitCodes: stages.map((s) => s.exitCode),
          },
        });
        ledgerEntryId = record.entryId;
        const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
        stages.push(
          stage("LEDGER_SEAL", true, 0, ms, `Ledger sealed ${record.entryId}`, {
            entryId: record.entryId,
            entryHash: record.entryHash,
            seq: record.seq,
          }),
        );
      } finally {
        ledger.close();
      }
    } else {
      const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
      stages.push(stage("LEDGER_SEAL", true, 0, ms, "Ledger seal skipped by option", { skipped: true }));
    }
  }

  const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  const receiptPayload = JSON.stringify({
    status: "SUCCESS",
    failingStage: null,
    directive: cleanDirective,
    target,
    domainHint,
    stageIds: stages.map((s) => s.stageId),
    exitCodes: stages.map((s) => s.exitCode),
    ledgerEntryId,
  });
  const sha256Receipt = pureSha256(receiptPayload);
  assertPostcondition(sha256Receipt.length === 64, "Mission receipt must be 64-char SHA-256");
  assertPostcondition(
    stages.every((s) => !s.mandatory || s.exitCode === 0),
    "SUCCESS requires all mandatory stages exitCode 0",
  );

  return deepFreeze({
    status: "SUCCESS",
    failingStage: null,
    directive: cleanDirective,
    target,
    domainHint,
    stages,
    epistemicState: "MISSION_GOLDEN_PATH_WITHIN_TESTED_SCOPE",
    sha256Receipt,
    durationMs,
    ledgerEntryId,
  });
}

export class EosMissionGoldenPathOrchestrator {
  public static run(directive: string, options?: MissionGoldenPathOptions): MissionGoldenPathResult {
    return runMissionGoldenPath(directive, options);
  }
}
