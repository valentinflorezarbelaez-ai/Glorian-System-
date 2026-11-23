/**
 * Glorian System — Harness Boundaries, Structured Token Economics &
 * Deterministic Decision Router Engine — Domain Types & Pure Helpers (Layer-0)
 *
 * Part of SPEC-377 / CHANGE-239 (LIDR M5 + M6 Big Tech Synthesis)
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, Node 24 strip-only.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// 1. Harness Forbidden-Touch & Blast-Radius Boundary Types (FR-377-01)
// ---------------------------------------------------------------------------

export type HarnessBoundaryViolationCode =
  | "FORBIDDEN_PATH"
  | "OUTSIDE_ALLOWED_SCOPE"
  | "TEST_MUTATION_BLOCKED"
  | "MAX_FILES_EXCEEDED"
  | "MAX_DIFF_LINES_EXCEEDED";

export interface HarnessBoundaryViolation {
  readonly code: HarnessBoundaryViolationCode;
  readonly target: string;
  readonly detail: string;
}

export interface HarnessBoundaryContract {
  readonly missionId: string;
  readonly allowedPaths: readonly string[];
  readonly forbiddenPaths: readonly string[];
  readonly maxFilesTouched: number;
  readonly maxDiffLines: number;
  readonly allowTestMutation: boolean;
}

export interface CandidateChangeSet {
  readonly changedFiles: readonly string[];
  readonly totalLinesAdded: number;
  readonly totalLinesDeleted: number;
}

export interface HarnessBoundaryReport {
  readonly missionId: string;
  readonly verdict: "ALLOW" | "HARD_BLOCK";
  readonly blastRadiusSafe: boolean;
  readonly filesEvaluated: number;
  readonly totalDiffLines: number;
  readonly violations: readonly HarnessBoundaryViolation[];
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 2. Structured MCP/JSON Payload Compressor Types — Headroom Pattern (FR-377-02)
// ---------------------------------------------------------------------------

export interface StructuredCompressionOptions {
  readonly maxArrayItems?: number;
  readonly maxStringLength?: number;
  readonly maxDepth?: number;
  readonly stripNullishAndEmpty?: boolean;
}

export interface ColumnarTableFold {
  readonly __format: "columnar_table";
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
  readonly totalRows: number;
  readonly truncatedRows: number;
}

export interface StructuredCompressionReport {
  readonly compressedPayload: unknown;
  readonly serializedCompressed: string;
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly tokensSaved: number;
  readonly savingsPercent: number;
  readonly columnarTablesFolded: number;
  readonly nullFieldsPruned: number;
  readonly opaqueTokensDigested: number;
  readonly schemaSummary: string;
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 3. JEV-Style Deterministic Decision Classifier & Router Types (FR-377-03)
// ---------------------------------------------------------------------------

export type AgenticWorkflowPhase = "PLANNING" | "EXECUTION" | "VERIFICATION" | "CLASSIFICATION";
export type RouterModelTier = "DETERMINISTIC_LOCAL" | "BALANCED_SONNET" | "FRONTIER_OPUS";

export interface ClosedLabelRule {
  readonly label: string;
  readonly keywords: readonly string[];
  readonly weight?: number;
}

export interface DecisionRoutingInput {
  readonly queryId: string;
  readonly prompt: string;
  readonly labels: readonly ClosedLabelRule[];
  readonly currentPhase: AgenticWorkflowPhase;
  readonly previousPhase?: AgenticWorkflowPhase;
  readonly activeModelTier?: RouterModelTier;
  readonly confidenceThreshold?: number;
}

export interface DecisionRoutingReport {
  readonly queryId: string;
  readonly selectedLabel: string;
  readonly confidence: number;
  readonly escalatedToFrontier: boolean;
  readonly recommendedTier: RouterModelTier;
  readonly effectiveTier: RouterModelTier;
  readonly modelSwitchAllowed: boolean;
  readonly promptCachePreserved: boolean;
  readonly scoreBreakdown: Readonly<Record<string, number>>;
  readonly rationale: string;
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 4. Prompt Cache Stability & Session Token Economics Types (FR-377-04)
// ---------------------------------------------------------------------------

export type CacheBreakerKind = "ISO_TIMESTAMP" | "UUID_TOKEN" | "VOLATILE_EPOCH" | "DYNAMIC_COUNTER";

export interface CacheBreakerFinding {
  readonly segmentIndex: number;
  readonly kind: CacheBreakerKind;
  readonly sample: string;
}

export interface PromptCacheAuditInput {
  readonly sessionId: string;
  readonly staticPrefixSegments: readonly string[];
  readonly dynamicSuffixSegments: readonly string[];
  readonly turns: number;
  readonly contextWindowTokens: number;
  readonly inputCostPer1MUsd?: number;
  readonly cachedInputDiscount?: number;
  readonly compressionSavingsRatio?: number;
}

export interface PromptCacheAuditReport {
  readonly sessionId: string;
  readonly cachePrefixStable: boolean;
  readonly cacheBreakers: readonly CacheBreakerFinding[];
  readonly staticPrefixTokens: number;
  readonly dynamicSuffixTokens: number;
  readonly projectedTurnInputTokens: number;
  readonly contextFillRatio: number;
  readonly contextRotAlert: boolean;
  readonly promptCacheHitRate: number;
  readonly naiveCostUsd: number;
  readonly optimizedCostUsd: number;
  readonly savingsUsd: number;
  readonly savingsPercent: number;
  readonly recommendation: string;
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 5. Anti-Overengineering Minimal-Diff Gate & Compact IPC Types (FR-377-05)
// ---------------------------------------------------------------------------

export type MinimalismFindingKind =
  "SINGLE_USE_ABSTRACTION" | "PASSTHROUGH_WRAPPER" | "EXCESSIVE_DIFF_BLOAT" | "UNAUTHORIZED_DEPENDENCY";

export interface MinimalismFinding {
  readonly kind: MinimalismFindingKind;
  readonly symbolOrTarget: string;
  readonly detail: string;
}

export interface MinimalDiffInput {
  readonly patchId: string;
  readonly sourceSnippet: string;
  readonly linesAdded: number;
  readonly requirementsCount: number;
  readonly addedDependencies?: readonly string[];
  readonly maxLinesPerRequirement?: number;
}

export interface MinimalDiffReport {
  readonly patchId: string;
  readonly minimalismVerdict: "PASS" | "FAIL_OVERENGINEERED";
  readonly findings: readonly MinimalismFinding[];
  readonly linesPerRequirement: number;
  readonly attestationHash: string;
}

export interface CompactIpcPayload {
  readonly agentFrom: string;
  readonly agentTo: string;
  readonly phase: AgenticWorkflowPhase;
  readonly status: "OK" | "BLOCKED" | "NEEDS_REVIEW";
  readonly summary: string;
  readonly changedFiles?: readonly string[];
  readonly metrics?: Readonly<Record<string, string | number | boolean>>;
}

export interface CompactIpcReport {
  readonly compactFrame: string;
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly savingsPercent: number;
  readonly attestationHash: string;
}

// ---------------------------------------------------------------------------
// 6. Audit Receipt Types (FR-377-06)
// ---------------------------------------------------------------------------

export interface HarnessTokenEconomicsAuditReceipt {
  readonly specId: "SPEC-377";
  readonly changeId: "CHANGE-239";
  readonly status: "VERIFIED" | "FAILED";
  readonly generatedAt: string;
  readonly invariants: {
    readonly boundaryEnforced: boolean;
    readonly structuredCompressionEffective: boolean;
    readonly decisionRouterCacheSafe: boolean;
    readonly cacheBreakerDetected: boolean;
    readonly minimalismGateEnforced: boolean;
  };
  readonly sampleMetrics: {
    readonly jsonSavingsPercent: number;
    readonly ipcSavingsPercent: number;
    readonly sessionCostSavingsPercent: number;
  };
  readonly receiptHash: string;
}

// ---------------------------------------------------------------------------
// 7. Pure Layer-0 Utilities
// ---------------------------------------------------------------------------

export function sha256Hex(payload: unknown): string {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(text).digest("hex");
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function normalizePosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function matchesGlobPattern(filePath: string, pattern: string): boolean {
  const normPath = normalizePosixPath(filePath);
  const normPat = normalizePosixPath(pattern);
  const escaped = normPat
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`).test(normPath);
}

export function isTestFilePath(filePath: string): boolean {
  const norm = normalizePosixPath(filePath);
  return norm.startsWith("test/") || norm.startsWith("tests/") || /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i.test(norm);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
