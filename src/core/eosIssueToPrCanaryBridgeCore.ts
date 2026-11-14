/**
 * SPEC-236 / CHANGE-120 — Layer-0 Universal Issue-to-PR Bridge, Diff Blast-Radius & Canary Rollback Engine.
 * Zero third-party runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import type { SdlcExecutionTrack } from "./eosJarvisSdlcOrchestratorCore.types.ts";
import type {
  AnalyzeDiffAndMigrationInput,
  CanaryRolloutAndRollbackPlan,
  CanaryStageDescriptor,
  CanonicalIssueDescriptor,
  CompileCanaryPlanInput,
  DiffAndMigrationAuditReport,
  DiffFileEntry,
  IssuePriorityLevel,
  MigrationSafetyPattern,
  RawIssuePayloadInput,
} from "./eosIssueToPrCanaryBridgeCore.types.ts";

const PRIORITY_SLA_MAP: Record<IssuePriorityLevel, number> = {
  P0: 4,
  P1: 24,
  P2: 72,
  P3: 168,
};

function sha256Hex(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function normalizeTicketId(raw: RawIssuePayloadInput): string {
  const fromField = raw.ticketId ?? raw.key ?? raw.identifier;
  if (typeof fromField === "string" && fromField.trim().length > 0) {
    return fromField.trim().slice(0, 64);
  }
  if (typeof raw.number === "number" && Number.isFinite(raw.number)) {
    return `GH-${Math.max(1, Math.trunc(raw.number))}`;
  }
  return "TICKET-000";
}

function normalizePriority(rawPriority: string | undefined): IssuePriorityLevel {
  const upper = (rawPriority ?? "medium").trim().toUpperCase();
  if (upper.includes("P0") || upper.includes("BLOCKER") || upper.includes("SEV0")) return "P0";
  if (upper.includes("P1") || upper.includes("CRITICAL") || upper.includes("HIGH") || upper.includes("URGENT")) {
    return "P1";
  }
  if (upper.includes("P3") || upper.includes("LOW")) return "P3";
  return "P2";
}

function extractChecklistCriteria(description: string, explicit?: readonly string[]): string[] {
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  const lines = description.split(/\r?\n/);
  const extracted: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s*(?:\[[ xX]\]\s*)?(.+)$/);
    if (match && match[1].trim().length > 3) {
      extracted.push(match[1].trim());
    }
  }
  return extracted.length > 0
    ? extracted.slice(0, 12)
    : ["Pass unit and integration tests behind dark-launch feature flag with zero plain secrets."];
}

function classifyIssueTrack(priority: IssuePriorityLevel, title: string, desc: string): SdlcExecutionTrack {
  if (priority === "P0" || priority === "P1") return "HEAVY_TRACK_SDD";
  const text = `${title} ${desc}`.toLowerCase();
  const heavySignals = ["migration", "schema", "architecture", "security", "crypto", "auth", "payment"];
  return heavySignals.some((kw) => text.includes(kw)) ? "HEAVY_TRACK_SDD" : "FAST_TRACK_TDD";
}

function classifyFileLayer(filePath: string): string {
  const p = filePath.replace(/\\/g, "/").toLowerCase();
  if (p.includes("test") || p.includes("spec.") || p.endsWith(".test.mjs")) return "Tests";
  if (p.includes("migration") || p.endsWith(".sql")) return "DatabaseMigration";
  if (p.startsWith("docs/") || p.startsWith("openspec/") || p.endsWith(".md")) return "Documentation";
  if (p.includes("/domain/") || p.includes("/core/")) return "Domain";
  if (p.includes("/application/") || p.includes("/usecase")) return "Application";
  if (p.includes("/ui/") || p.includes("/web/") || p.endsWith(".tsx") || p.endsWith(".html")) return "Presentation";
  return "Infrastructure";
}

function detectUnsafeDdl(sql: string): { pattern: MigrationSafetyPattern; unsafe: string[] } {
  const trimmed = sql.trim();
  if (!trimmed) return { pattern: "NONE", unsafe: [] };
  const unsafe: string[] = [];
  if (/\bDROP\s+(?:TABLE|COLUMN)\b/i.test(trimmed)) unsafe.push("DROP TABLE/COLUMN breaks running readers");
  if (/\bTRUNCATE\b/i.test(trimmed)) unsafe.push("TRUNCATE destroys live production data");
  if (/\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b/i.test(trimmed) && !/\bDEFAULT\b/i.test(trimmed)) {
    unsafe.push("ADD COLUMN NOT NULL without DEFAULT locks table or fails rolling writes");
  }
  if (unsafe.length > 0) return { pattern: "UNSAFE_BREAKING_DDL", unsafe };
  return { pattern: "SAFE_EXPAND_AND_CONTRACT", unsafe: [] };
}

function computeBlastRadius(files: readonly DiffFileEntry[], layerCount: number, hasUnsafeDdl: boolean): number {
  const totalLines = files.reduce((acc, f) => acc + (f.additions ?? 10) + (f.deletions ?? 5), 0);
  const raw = Math.min(100, files.length * 8 + layerCount * 10 + Math.round(totalLines / 40) + (hasUnsafeDdl ? 30 : 0));
  return Math.max(0, raw);
}

export class EosIssueToPrCanaryBridgeCore {
  public static parseIssuePayload(raw: RawIssuePayloadInput): CanonicalIssueDescriptor {
    const ticketId = normalizeTicketId(raw);
    const title = (raw.title ?? raw.summary ?? "Untitled engineering task").trim().slice(0, 160);
    const description = (raw.description ?? raw.body ?? "Execute change safely under SDD verification.")
      .trim()
      .slice(0, 2000);
    const priority = normalizePriority(raw.priority);
    const acceptanceCriteria = extractChecklistCriteria(description, raw.acceptanceCriteria);
    const affectedComponents = [...(raw.components ?? []), ...(raw.labels ?? [])]
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const body = {
      ticketId,
      sourceSystem: raw.sourceSystem ?? "manual",
      title,
      description,
      acceptanceCriteria,
      priority,
      slaHours: PRIORITY_SLA_MAP[priority],
      affectedComponents,
      suggestedTrack: classifyIssueTrack(priority, title, description),
    };
    return { ...body, issueDigestSha256: sha256Hex(body) };
  }

  public static analyzeDiffAndMigrationSafety(input: AnalyzeDiffAndMigrationInput): DiffAndMigrationAuditReport {
    const files = Array.isArray(input.changedFiles) ? input.changedFiles : [];
    const layerSet = new Set(files.map((f) => classifyFileLayer(f.path)));
    const touchedLayers = [...layerSet];
    const hasProdCode = touchedLayers.some(
      (layer) => layer !== "Tests" && layer !== "DatabaseMigration" && layer !== "Documentation",
    );
    const beyonceRuleSatisfied = !hasProdCode || layerSet.has("Tests");
    const ddlCheck = detectUnsafeDdl(input.sqlMigrationSnippet ?? "");

    const blockingRisks: string[] = [];
    if (!beyonceRuleSatisfied) {
      blockingRisks.push("Beyonce Rule violation: production source files modified without accompanying test files.");
    }
    if (ddlCheck.pattern === "UNSAFE_BREAKING_DDL") {
      blockingRisks.push(`Unsafe breaking DDL detected: ${ddlCheck.unsafe.join("; ")}`);
    }

    const blastRadiusScore = computeBlastRadius(files, touchedLayers.length, ddlCheck.unsafe.length > 0);
    const body = {
      touchedLayers,
      beyonceRuleSatisfied,
      migrationPattern: ddlCheck.pattern,
      unsafeDdlStatements: ddlCheck.unsafe,
      blastRadiusScore,
      blockingRisks,
    };
    return { ...body, diffDigestSha256: sha256Hex(body) };
  }

  public static compileCanaryAndRollbackPlan(input: CompileCanaryPlanInput): CanaryRolloutAndRollbackPlan {
    const maxErrorRateDeltaPercent = input.maxErrorRateDeltaPercent ?? 0.5;
    const maxLatencyP99Ms = input.maxLatencyP99Ms ?? 250;
    const stages: CanaryStageDescriptor[] = [
      {
        stageName: "CANARY_1",
        trafficPercent: 1,
        soakMinutes: 15,
        autoRollbackCondition: `errorDelta > ${maxErrorRateDeltaPercent}%`,
      },
      {
        stageName: "CANARY_10",
        trafficPercent: 10,
        soakMinutes: 30,
        autoRollbackCondition: `p99Latency > ${maxLatencyP99Ms}ms`,
      },
      {
        stageName: "CANARY_50",
        trafficPercent: 50,
        soakMinutes: 60,
        autoRollbackCondition: `errorDelta > ${maxErrorRateDeltaPercent}%`,
      },
      {
        stageName: "GENERAL_AVAILABILITY",
        trafficPercent: 100,
        soakMinutes: 120,
        autoRollbackCondition: "sloBurnRate > 2x",
      },
    ];
    const killSwitchCommands = {
      disableFeatureFlagCmd: `eos flags disable ${input.featureFlagKey} --ticket=${input.ticketId}`,
      gitRevertBranchCmd: `node bin/eos.mjs flow apply . ${input.workflowId} --rollback --confirm-diff=${input.approvalDiffSha256}`,
      worktreeCleanupCmd: `node bin/eos.mjs worktree prune --workflow=${input.workflowId}`,
    };
    const blamelessPostmortemTemplate = [
      `# Blameless Postmortem — ${input.ticketId}`,
      `- Feature Flag Kill-Switch: \`${input.featureFlagKey}\``,
      "- Impact Summary: <metric delta & affected slice>",
      "- Systemic Root Cause: <missing automated guard, never individual blame>",
      "- Permanent Guardrail Added: <new BDD test / contract invariant>",
    ].join("\n");
    const body = {
      ticketId: input.ticketId,
      featureFlagKey: input.featureFlagKey,
      stages,
      sloGuardrails: { maxErrorRateDeltaPercent, maxLatencyP99Ms },
      killSwitchCommands,
      blamelessPostmortemTemplate,
    };
    return { ...body, planDigestSha256: sha256Hex(body) };
  }
}
