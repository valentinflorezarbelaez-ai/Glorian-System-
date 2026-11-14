/**
 * SPEC-237 / CHANGE-120 — Layer-0 Staff Engineer Adversarial PR & Design Dual-Judge.
 * Simulates Google Critique / Spotify Staff dual-persona inspection with zero
 * third-party runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import type {
  AdversarialVerdictStatus,
  JudgePersonaEvaluation,
  StaffAdversarialVerdictReport,
  StaffJudgeInput,
  StaffPillarScores,
} from "./eosStaffEngineerAdversarialJudgeCore.types.ts";

const PILLAR_REMEDIATION_HINTS: Record<keyof StaffPillarScores, string> = {
  idempotencyAndRetries: "Enforce deterministic idempotency keys and exponential backoff with bounded jitter.",
  resilienceAndBackpressure: "Eliminate single points of failure with circuit breakers, bounded queues, and timeouts.",
  dataAndMigrationSafety: "Use Expand-and-Contract zero-downtime SQL migrations without breaking DROP/NOT NULL locks.",
  observabilityAndSlo: "Add OpenTelemetry trace spans, latency P99 histograms, and SRE error-budget burn-rate alerts.",
  securityAndPrivacy: "Remove any plain secrets, enforce input validation, and sanitize third-party data contracts.",
  testingHoneycombAndBeyonceRule: "Satisfy the Beyonce Rule with isolated integration tests reaching >= 85% coverage.",
};

function clampScore(value: number | undefined, fallback: number): number {
  const num = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function buildNormalizedScores(input: StaffJudgeInput): StaffPillarScores {
  const p = input.pillarScores ?? {};
  const raw: StaffPillarScores = {
    idempotencyAndRetries: clampScore(p.idempotencyAndRetries, 90),
    resilienceAndBackpressure: clampScore(p.resilienceAndBackpressure, input.singlePointOfFailureDetected ? 40 : 90),
    dataAndMigrationSafety: clampScore(p.dataAndMigrationSafety, input.unsafeMigrationDetected ? 30 : 90),
    observabilityAndSlo: clampScore(p.observabilityAndSlo, 90),
    securityAndPrivacy: clampScore(p.securityAndPrivacy, input.plainSecretsDetected ? 0 : 95),
    testingHoneycombAndBeyonceRule: clampScore(
      p.testingHoneycombAndBeyonceRule,
      input.missingTestsForProdChanges ? 45 : 90,
    ),
  };
  return {
    idempotencyAndRetries: raw.idempotencyAndRetries,
    resilienceAndBackpressure: input.singlePointOfFailureDetected
      ? Math.min(raw.resilienceAndBackpressure, 40)
      : raw.resilienceAndBackpressure,
    dataAndMigrationSafety: input.unsafeMigrationDetected
      ? Math.min(raw.dataAndMigrationSafety, 30)
      : raw.dataAndMigrationSafety,
    observabilityAndSlo: raw.observabilityAndSlo,
    securityAndPrivacy: input.plainSecretsDetected ? 0 : raw.securityAndPrivacy,
    testingHoneycombAndBeyonceRule: input.missingTestsForProdChanges
      ? Math.min(raw.testingHoneycombAndBeyonceRule, 45)
      : raw.testingHoneycombAndBeyonceRule,
  };
}

function evaluateAlpha(scores: StaffPillarScores, input: StaffJudgeInput): JudgePersonaEvaluation {
  const findings: string[] = [];
  if (input.singlePointOfFailureDetected) findings.push("Critical SPOF detected in distributed path.");
  if (input.unsafeMigrationDetected) findings.push("Critical unsafe DDL migration detected.");
  if (scores.idempotencyAndRetries < 85)
    findings.push(`Idempotency/Retries below bar (${scores.idempotencyAndRetries}/85).`);
  if (scores.resilienceAndBackpressure < 85)
    findings.push(`Resilience/Backpressure below bar (${scores.resilienceAndBackpressure}/85).`);
  if (scores.dataAndMigrationSafety < 85)
    findings.push(`Data/Migration Safety below bar (${scores.dataAndMigrationSafety}/85).`);

  const avg = Math.round(
    (scores.idempotencyAndRetries + scores.resilienceAndBackpressure + scores.dataAndMigrationSafety) / 3,
  );
  const blocked = Boolean(input.singlePointOfFailureDetected || input.unsafeMigrationDetected);
  return {
    judgeId: "JudgeAlpha_ArchitectureAndResilience",
    score: avg,
    passed: !blocked && findings.length === 0,
    findings,
  };
}

function evaluateBeta(scores: StaffPillarScores, input: StaffJudgeInput): JudgePersonaEvaluation {
  const findings: string[] = [];
  if (input.plainSecretsDetected) findings.push("Plain secret exposure detected (Law VI violation).");
  if (input.missingTestsForProdChanges)
    findings.push("Production code modified without automated tests (Beyonce Rule).");
  if (scores.observabilityAndSlo < 85) findings.push(`Observability/SLO below bar (${scores.observabilityAndSlo}/85).`);
  if (scores.securityAndPrivacy < 85) findings.push(`Security/Privacy below bar (${scores.securityAndPrivacy}/85).`);
  if (scores.testingHoneycombAndBeyonceRule < 85) {
    findings.push(`Testing Honeycomb below bar (${scores.testingHoneycombAndBeyonceRule}/85).`);
  }

  const avg = Math.round(
    (scores.observabilityAndSlo + scores.securityAndPrivacy + scores.testingHoneycombAndBeyonceRule) / 3,
  );
  const blocked = Boolean(input.plainSecretsDetected || input.missingTestsForProdChanges);
  return {
    judgeId: "JudgeBeta_SecurityAndOperability",
    score: avg,
    passed: !blocked && findings.length === 0,
    findings,
  };
}

function resolveVerdict(scores: StaffPillarScores, input: StaffJudgeInput): AdversarialVerdictStatus {
  const hasCriticalFlag = Boolean(
    input.plainSecretsDetected ||
    input.unsafeMigrationDetected ||
    input.missingTestsForProdChanges ||
    input.singlePointOfFailureDetected,
  );
  const values = Object.values(scores) as number[];
  if (hasCriticalFlag || values.some((v) => v < 70)) return "BLOCKED";
  if (values.some((v) => v < 85)) return "CHANGES_REQUIRED";
  return "APPROVED";
}

function collectRemediations(scores: StaffPillarScores): string[] {
  const list: string[] = [];
  const entries = Object.entries(scores) as Array<[keyof StaffPillarScores, number]>;
  for (const [key, val] of entries) {
    if (val < 85) {
      list.push(PILLAR_REMEDIATION_HINTS[key]);
    }
  }
  return list;
}

export class EosStaffEngineerAdversarialJudgeCore {
  public static evaluateProposalOrPr(input: StaffJudgeInput): StaffAdversarialVerdictReport {
    const pillarScores = buildNormalizedScores(input);
    const judgeAlpha = evaluateAlpha(pillarScores, input);
    const judgeBeta = evaluateBeta(pillarScores, input);
    const verdict = resolveVerdict(pillarScores, input);
    const overallScore = Math.round(
      (pillarScores.idempotencyAndRetries +
        pillarScores.resilienceAndBackpressure +
        pillarScores.dataAndMigrationSafety +
        pillarScores.observabilityAndSlo +
        pillarScores.securityAndPrivacy +
        pillarScores.testingHoneycombAndBeyonceRule) /
        6,
    );
    const blockingFindings = verdict === "BLOCKED" ? [...judgeAlpha.findings, ...judgeBeta.findings] : [];
    const requiredRemediations = collectRemediations(pillarScores);
    const base = {
      targetId: input.targetId.trim() || "PR-000",
      title: (input.title ?? "Staff Architecture & Security Review").trim(),
      verdict,
      overallScore,
      judgeAlpha,
      judgeBeta,
      pillarScores,
      blockingFindings,
      requiredRemediations,
    };
    const attestationDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex");
    return { ...base, attestationDigestSha256 };
  }
}
