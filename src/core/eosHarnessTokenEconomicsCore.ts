/**
 * Glorian System — Harness Boundaries, Structured Token Economics &
 * Deterministic Decision Router Engine (SPEC-377 / CHANGE-239)
 *
 * Synthesizes LIDR Modules M5 (Harness Engineering) & M6 (Token Economics)
 * under Big Tech Layer-0 Pure standards (Anthropic / Stripe / Google / Meta):
 *  1. Declarative Harness Forbidden-Touch & Blast-Radius Enforcer (FR-377-01).
 *  2. Headroom-style MCP/JSON Columnar Structured Payload Compressor (FR-377-02).
 *  3. JEV-style Closed-Set Decision Classifier & Milestone-Boundary Router (FR-377-03).
 *  4. Prompt Cache Prefix Stability & Session Token Economics Auditor (FR-377-04).
 *  5. Ponytail Anti-Overengineering Gate & Caveman Compact Agent IPC (FR-377-05).
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import {
  estimateTokens,
  isPlainObject,
  isTestFilePath,
  matchesGlobPattern,
  normalizePosixPath,
  roundTo,
  sha256Hex,
} from "./eosHarnessTokenEconomicsCore.types.ts";
import type {
  AgenticWorkflowPhase,
  CacheBreakerFinding,
  CandidateChangeSet,
  ColumnarTableFold,
  CompactIpcPayload,
  CompactIpcReport,
  DecisionRoutingInput,
  DecisionRoutingReport,
  HarnessBoundaryContract,
  HarnessBoundaryReport,
  HarnessBoundaryViolation,
  HarnessTokenEconomicsAuditReceipt,
  MinimalDiffInput,
  MinimalDiffReport,
  MinimalismFinding,
  PromptCacheAuditInput,
  PromptCacheAuditReport,
  RouterModelTier,
  StructuredCompressionOptions,
  StructuredCompressionReport,
} from "./eosHarnessTokenEconomicsCore.types.ts";

export * from "./eosHarnessTokenEconomicsCore.types.ts";

// ---------------------------------------------------------------------------
// 1. FR-377-01: Declarative Harness Forbidden-Touch & Blast-Radius Enforcer
// ---------------------------------------------------------------------------

function checkFileAgainstContract(
  rawFile: string,
  contract: HarnessBoundaryContract,
  violations: HarnessBoundaryViolation[],
): void {
  const file = normalizePosixPath(rawFile);
  const forbiddenMatch = contract.forbiddenPaths.find((pat) => matchesGlobPattern(file, pat));
  if (forbiddenMatch) {
    violations.push({
      code: "FORBIDDEN_PATH",
      target: file,
      detail: `Matches forbidden boundary pattern '${forbiddenMatch}'.`,
    });
  }

  if (contract.allowedPaths.length > 0) {
    const inScope = contract.allowedPaths.some((pat) => matchesGlobPattern(file, pat));
    if (!inScope) {
      violations.push({
        code: "OUTSIDE_ALLOWED_SCOPE",
        target: file,
        detail: "File falls outside declared allowedPaths scope.",
      });
    }
  }

  if (!contract.allowTestMutation && isTestFilePath(file)) {
    violations.push({
      code: "TEST_MUTATION_BLOCKED",
      target: file,
      detail: "Test modification is forbidden by the active harness contract.",
    });
  }
}

export function evaluateHarnessBoundary(
  contract: HarnessBoundaryContract,
  changeSet: CandidateChangeSet,
): HarnessBoundaryReport {
  const violations: HarnessBoundaryViolation[] = [];
  const uniqueFiles = [...new Set(changeSet.changedFiles.map(normalizePosixPath).filter(Boolean))];
  const totalDiffLines = Math.max(0, changeSet.totalLinesAdded) + Math.max(0, changeSet.totalLinesDeleted);

  for (const file of uniqueFiles) {
    checkFileAgainstContract(file, contract, violations);
  }

  if (uniqueFiles.length > contract.maxFilesTouched) {
    violations.push({
      code: "MAX_FILES_EXCEEDED",
      target: `${uniqueFiles.length}/${contract.maxFilesTouched}`,
      detail: `Touched ${uniqueFiles.length} files, exceeding maxFilesTouched=${contract.maxFilesTouched}.`,
    });
  }

  if (totalDiffLines > contract.maxDiffLines) {
    violations.push({
      code: "MAX_DIFF_LINES_EXCEEDED",
      target: `${totalDiffLines}/${contract.maxDiffLines}`,
      detail: `Changed ${totalDiffLines} lines, exceeding maxDiffLines=${contract.maxDiffLines}.`,
    });
  }

  const verdict: "ALLOW" | "HARD_BLOCK" = violations.length === 0 ? "ALLOW" : "HARD_BLOCK";
  const body = {
    missionId: contract.missionId,
    verdict,
    blastRadiusSafe: verdict === "ALLOW",
    filesEvaluated: uniqueFiles.length,
    totalDiffLines,
    violations,
  };

  return { ...body, attestationHash: sha256Hex(body) };
}

// ---------------------------------------------------------------------------
// 2. FR-377-02: Structured MCP/JSON Payload Compressor (Headroom Pattern)
// ---------------------------------------------------------------------------

interface CompressionCounters {
  columnarTablesFolded: number;
  nullFieldsPruned: number;
  opaqueTokensDigested: number;
}

const OPAQUE_HEX_OR_B64 = /^(?:[0-9a-f]{40,}|[A-Za-z0-9+/=_-]{64,})$/;

function compressScalarString(value: string, maxLen: number, counters: CompressionCounters): string {
  if (OPAQUE_HEX_OR_B64.test(value) && value.length >= 40) {
    counters.opaqueTokensDigested += 1;
    return `<digest:${sha256Hex(value).slice(0, 10)}:len=${value.length}>`;
  }
  if (value.length > maxLen) {
    counters.opaqueTokensDigested += 1;
    const keep = Math.max(16, Math.floor((maxLen - 20) / 2));
    return `${value.slice(0, keep)}...[${value.length - keep * 2}c]...${value.slice(-keep)}`;
  }
  return value;
}

function isHomogeneousObjectArray(items: readonly unknown[]): items is readonly Record<string, unknown>[] {
  if (items.length < 3 || !items.every(isPlainObject)) return false;
  const firstKeys = Object.keys(items[0]).sort().join("|");
  if (!firstKeys) return false;
  let matching = 0;
  for (const item of items) {
    const keys = Object.keys(item).sort().join("|");
    if (keys === firstKeys) matching += 1;
  }
  return matching / items.length >= 0.8;
}

function foldHomogeneousArray(
  items: readonly Record<string, unknown>[],
  opts: Required<StructuredCompressionOptions>,
  depth: number,
  counters: CompressionCounters,
): ColumnarTableFold {
  counters.columnarTablesFolded += 1;
  const keySet = new Set<string>();
  for (const obj of items) {
    for (const [k, v] of Object.entries(obj)) {
      if (opts.stripNullishAndEmpty && (v === null || v === undefined || v === "")) {
        counters.nullFieldsPruned += 1;
        continue;
      }
      keySet.add(k);
    }
  }
  const columns = [...keySet];
  const sampled = sampleHeadTail(items, opts.maxArrayItems);
  const rows = sampled.kept.map((obj) => columns.map((col) => compressNode(obj[col], opts, depth + 1, counters)));
  return {
    __format: "columnar_table",
    columns,
    rows,
    totalRows: items.length,
    truncatedRows: sampled.truncated,
  };
}

function sampleHeadTail<T>(items: readonly T[], maxItems: number): { kept: T[]; truncated: number } {
  if (items.length <= maxItems) {
    return { kept: [...items], truncated: 0 };
  }
  const headCount = Math.max(1, Math.ceil(maxItems * 0.7));
  const tailCount = Math.max(1, maxItems - headCount);
  const kept = [...items.slice(0, headCount), ...items.slice(-tailCount)];
  return { kept, truncated: items.length - kept.length };
}

function compressObject(
  obj: Record<string, unknown>,
  opts: Required<StructuredCompressionOptions>,
  depth: number,
  counters: CompressionCounters,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (opts.stripNullishAndEmpty && (val === null || val === undefined || val === "")) {
      counters.nullFieldsPruned += 1;
      continue;
    }
    out[key] = compressNode(val, opts, depth + 1, counters);
  }
  return out;
}

function compressNode(
  value: unknown,
  opts: Required<StructuredCompressionOptions>,
  depth: number,
  counters: CompressionCounters,
): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return compressScalarString(value, opts.maxStringLength, counters);
  if (typeof value !== "object") return value;
  if (depth >= opts.maxDepth) return "<depth_truncated>";

  if (Array.isArray(value)) {
    const arr: readonly unknown[] = value;
    if (isHomogeneousObjectArray(arr)) {
      return foldHomogeneousArray(arr, opts, depth, counters);
    }
    const sampled = sampleHeadTail(arr, opts.maxArrayItems);
    const mapped = sampled.kept.map((el) => compressNode(el, opts, depth + 1, counters));
    if (sampled.truncated > 0) {
      mapped.push(`<truncated:${sampled.truncated}_items_of_${arr.length}>`);
    }
    return mapped;
  }

  return compressObject(value as Record<string, unknown>, opts, depth, counters);
}

function summarizeSchema(value: unknown): string {
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).slice(0, 8);
    return `object{${keys.join(",")}${Object.keys(value).length > 8 ? ",..." : ""}}`;
  }
  return typeof value;
}

export function compressStructuredPayload(
  payload: unknown,
  options: StructuredCompressionOptions = {},
): StructuredCompressionReport {
  const opts: Required<StructuredCompressionOptions> = {
    maxArrayItems: Math.max(2, options.maxArrayItems ?? 12),
    maxStringLength: Math.max(32, options.maxStringLength ?? 160),
    maxDepth: Math.max(2, options.maxDepth ?? 6),
    stripNullishAndEmpty: options.stripNullishAndEmpty ?? true,
  };

  const rawSerialized = JSON.stringify(payload) ?? "";
  const counters: CompressionCounters = {
    columnarTablesFolded: 0,
    nullFieldsPruned: 0,
    opaqueTokensDigested: 0,
  };
  const compressedPayload = compressNode(payload, opts, 0, counters);
  const serializedCompressed = JSON.stringify(compressedPayload) ?? "";
  const tokensBefore = estimateTokens(rawSerialized);
  const tokensAfter = estimateTokens(serializedCompressed);
  const tokensSaved = Math.max(0, tokensBefore - tokensAfter);
  const savingsPercent = tokensBefore > 0 ? roundTo((tokensSaved / tokensBefore) * 100, 2) : 0;

  const body = {
    tokensBefore,
    tokensAfter,
    tokensSaved,
    savingsPercent,
    columnarTablesFolded: counters.columnarTablesFolded,
    nullFieldsPruned: counters.nullFieldsPruned,
    opaqueTokensDigested: counters.opaqueTokensDigested,
    schemaSummary: summarizeSchema(payload),
  };

  return {
    compressedPayload,
    serializedCompressed,
    ...body,
    attestationHash: sha256Hex(body),
  };
}

// ---------------------------------------------------------------------------
// 3. FR-377-03: JEV-Style Deterministic Decision Classifier & Milestone Router
// ---------------------------------------------------------------------------

function recommendedTierForPhase(phase: AgenticWorkflowPhase, escalated: boolean): RouterModelTier {
  if (escalated || phase === "PLANNING") return "FRONTIER_OPUS";
  if (phase === "CLASSIFICATION") return "DETERMINISTIC_LOCAL";
  return "BALANCED_SONNET";
}

function scoreLabelsDeterministically(
  prompt: string,
  labels: readonly DecisionRoutingInput["labels"][number][],
): { bestLabel: string; confidence: number; breakdown: Record<string, number> } {
  const lower = prompt.toLowerCase();
  const breakdown: Record<string, number> = {};
  let totalScore = 0;
  let bestLabel = labels[0]?.label ?? "UNKNOWN";
  let bestScore = -1;
  let secondBest = 0;

  for (const rule of labels) {
    const weight = rule.weight ?? 1;
    let hits = 0;
    for (const kw of rule.keywords) {
      if (kw && lower.includes(kw.toLowerCase())) hits += 1;
    }
    const score = roundTo(hits * weight, 4);
    breakdown[rule.label] = score;
    totalScore += score;
    if (score > bestScore) {
      secondBest = Math.max(0, bestScore);
      bestScore = score;
      bestLabel = rule.label;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (totalScore <= 0 || bestScore <= 0) {
    return { bestLabel: "ABSTAIN_AMBIGUOUS", confidence: 0, breakdown };
  }
  const margin = (bestScore - secondBest) / totalScore;
  const dominance = bestScore / totalScore;
  const confidence = roundTo(Math.min(0.99, Math.max(0, 0.5 * dominance + 0.5 * margin)), 4);
  return { bestLabel, confidence, breakdown };
}

export function classifyAndRouteDecision(input: DecisionRoutingInput): DecisionRoutingReport {
  const threshold = input.confidenceThreshold ?? 0.65;
  const scored = scoreLabelsDeterministically(input.prompt, input.labels);
  const escalatedToFrontier = scored.confidence < threshold;
  const recommendedTier = recommendedTierForPhase(input.currentPhase, escalatedToFrontier);

  const isSamePhase =
    input.previousPhase !== undefined &&
    input.previousPhase === input.currentPhase &&
    input.activeModelTier !== undefined;
  const modelSwitchAllowed = !isSamePhase || escalatedToFrontier;
  const effectiveTier = modelSwitchAllowed ? recommendedTier : (input.activeModelTier ?? recommendedTier);
  const promptCachePreserved = !input.activeModelTier || effectiveTier === input.activeModelTier || !isSamePhase;

  const rationale = escalatedToFrontier
    ? `Confidence ${scored.confidence} < threshold ${threshold}; escalating safely to FRONTIER_OPUS.`
    : isSamePhase && effectiveTier !== recommendedTier
      ? `Mid-phase switch suppressed during ${input.currentPhase} to protect 90% Prompt Cache continuity.`
      : `Deterministic closed-set classification '${scored.bestLabel}' (confidence=${scored.confidence}) routed to ${effectiveTier}.`;

  const body = {
    queryId: input.queryId,
    selectedLabel: scored.bestLabel,
    confidence: scored.confidence,
    escalatedToFrontier,
    recommendedTier,
    effectiveTier,
    modelSwitchAllowed,
    promptCachePreserved,
    scoreBreakdown: scored.breakdown,
    rationale,
  };

  return { ...body, attestationHash: sha256Hex(body) };
}

// ---------------------------------------------------------------------------
// 4. FR-377-04: Prompt Cache Prefix Stability & Session Token Economics Auditor
// ---------------------------------------------------------------------------

const CACHE_BREAKER_PATTERNS: readonly { kind: CacheBreakerFinding["kind"]; regex: RegExp }[] = [
  { kind: "ISO_TIMESTAMP", regex: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/ },
  { kind: "UUID_TOKEN", regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i },
  { kind: "VOLATILE_EPOCH", regex: /\b1[6-9]\d{11}\b/ },
  { kind: "DYNAMIC_COUNTER", regex: /\b(?:request_id|turn_id|session_nonce|rand_seed)\s*[:=]\s*[\w-]+\b/i },
];

function scanPrefixForBreakers(segments: readonly string[]): CacheBreakerFinding[] {
  const findings: CacheBreakerFinding[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i] ?? "";
    for (const pattern of CACHE_BREAKER_PATTERNS) {
      const match = seg.match(pattern.regex);
      if (match) {
        findings.push({ segmentIndex: i, kind: pattern.kind, sample: match[0] });
      }
    }
  }
  return findings;
}

export function auditPromptCacheAndEconomics(input: PromptCacheAuditInput): PromptCacheAuditReport {
  const turns = Math.max(1, Math.floor(input.turns));
  const windowLimit = Math.max(1000, input.contextWindowTokens);
  const pricePer1M = input.inputCostPer1MUsd ?? 3.0;
  const cacheDiscount = Math.min(0.95, Math.max(0, input.cachedInputDiscount ?? 0.9));
  const compRatio = Math.min(0.85, Math.max(0, input.compressionSavingsRatio ?? 0.45));

  const cacheBreakers = scanPrefixForBreakers(input.staticPrefixSegments);
  const cachePrefixStable = cacheBreakers.length === 0;
  const staticPrefixTokens = input.staticPrefixSegments.reduce((acc, seg) => acc + estimateTokens(seg), 0);
  const dynamicSuffixTokens = input.dynamicSuffixSegments.reduce((acc, seg) => acc + estimateTokens(seg), 0);

  const projectedTurnInputTokens = staticPrefixTokens + dynamicSuffixTokens;
  const contextFillRatio = roundTo(projectedTurnInputTokens / windowLimit, 4);
  const contextRotAlert = contextFillRatio >= 0.7;
  const promptCacheHitRate = cachePrefixStable && turns > 1 ? roundTo((turns - 1) / turns, 4) : 0;

  // Naive session re-sends full uncompressed static + growing dynamic context every turn
  const naiveTotalTokens = staticPrefixTokens * turns + dynamicSuffixTokens * ((turns * (turns + 1)) / 2);
  const cachedPrefixTokens = cachePrefixStable
    ? staticPrefixTokens + staticPrefixTokens * (turns - 1) * (1 - cacheDiscount)
    : staticPrefixTokens * turns;
  const compressedDynamicTokens = dynamicSuffixTokens * (1 - compRatio) * ((turns * (turns + 1)) / 2);
  const optimizedTotalTokens = cachedPrefixTokens + compressedDynamicTokens;

  const naiveCostUsd = roundTo((naiveTotalTokens / 1_000_000) * pricePer1M, 6);
  const optimizedCostUsd = roundTo((optimizedTotalTokens / 1_000_000) * pricePer1M, 6);
  const savingsUsd = roundTo(Math.max(0, naiveCostUsd - optimizedCostUsd), 6);
  const savingsPercent = naiveCostUsd > 0 ? roundTo((savingsUsd / naiveCostUsd) * 100, 2) : 0;

  const recommendation = !cachePrefixStable
    ? "Move dynamic timestamps/UUIDs/counters out of static prefix segments to unlock 90% prompt caching."
    : contextRotAlert
      ? "Context fill >= 70%: run compaction checkpoint now before context rot degrades agent precision."
      : "Prompt prefix is cache-stable and context fill is within optimal operating envelope.";

  const body = {
    sessionId: input.sessionId,
    cachePrefixStable,
    cacheBreakers,
    staticPrefixTokens,
    dynamicSuffixTokens,
    projectedTurnInputTokens,
    contextFillRatio,
    contextRotAlert,
    promptCacheHitRate,
    naiveCostUsd,
    optimizedCostUsd,
    savingsUsd,
    savingsPercent,
    recommendation,
  };

  return { ...body, attestationHash: sha256Hex(body) };
}

// ---------------------------------------------------------------------------
// 5. FR-377-05: Anti-Overengineering Minimal-Diff Gate & Compact Agent IPC
// ---------------------------------------------------------------------------

function detectSpeculativeAbstractions(sourceSnippet: string, findings: MinimalismFinding[]): void {
  const declRegex = /(?:^|\n)\s*(?:function|const)\s+([a-zA-Z_]\w*)\s*(?:\(|=\s*\()/g;
  let match: RegExpExecArray | null = declRegex.exec(sourceSnippet);
  while (match !== null) {
    const sym = match[1];
    const isExported = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${sym}\\b`).test(sourceSnippet);
    if (!isExported) {
      const refs = sourceSnippet.match(new RegExp(`\\b${sym}\\b`, "g")) ?? [];
      if (refs.length <= 2) {
        findings.push({
          kind: "SINGLE_USE_ABSTRACTION",
          symbolOrTarget: sym,
          detail: `Internal helper '${sym}' has only ${Math.max(0, refs.length - 1)} call site(s); inline or justify reuse.`,
        });
      }
    }
    match = declRegex.exec(sourceSnippet);
  }
}

function detectPassThroughWrappers(sourceSnippet: string, findings: MinimalismFinding[]): void {
  const wrapperRegex =
    /function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)[^{]*\{\s*return\s+[a-zA-Z_]\w*\s*\(\s*\2\s*\)\s*;?\s*\}/g;
  let match: RegExpExecArray | null = wrapperRegex.exec(sourceSnippet);
  while (match !== null) {
    findings.push({
      kind: "PASSTHROUGH_WRAPPER",
      symbolOrTarget: match[1],
      detail: `Function '${match[1]}' is a trivial pass-through wrapper adding indirection with zero logic.`,
    });
    match = wrapperRegex.exec(sourceSnippet);
  }
}

export function evaluateMinimalDiffAndIpc(input: MinimalDiffInput): MinimalDiffReport {
  const findings: MinimalismFinding[] = [];
  const reqCount = Math.max(1, input.requirementsCount);
  const maxPerReq = input.maxLinesPerRequirement ?? 120;
  const linesPerRequirement = roundTo(Math.max(0, input.linesAdded) / reqCount, 2);

  detectSpeculativeAbstractions(input.sourceSnippet, findings);
  detectPassThroughWrappers(input.sourceSnippet, findings);

  if (linesPerRequirement > maxPerReq) {
    findings.push({
      kind: "EXCESSIVE_DIFF_BLOAT",
      symbolOrTarget: `${linesPerRequirement} lines/req`,
      detail: `Diff density (${linesPerRequirement} lines/req) exceeds minimal threshold (${maxPerReq}).`,
    });
  }

  for (const dep of input.addedDependencies ?? []) {
    findings.push({
      kind: "UNAUTHORIZED_DEPENDENCY",
      symbolOrTarget: dep,
      detail: `External runtime dependency '${dep}' violates Layer-0 zero-dependency purity (Law V).`,
    });
  }

  const minimalismVerdict: "PASS" | "FAIL_OVERENGINEERED" = findings.length === 0 ? "PASS" : "FAIL_OVERENGINEERED";
  const body = {
    patchId: input.patchId,
    minimalismVerdict,
    findings,
    linesPerRequirement,
  };
  return { ...body, attestationHash: sha256Hex(body) };
}

export function encodeCompactAgentIpc(payload: CompactIpcPayload): CompactIpcReport {
  const verboseJson = JSON.stringify(payload, null, 2);
  const filesPart = payload.changedFiles?.length ? `|F:${payload.changedFiles.join(",")}` : "";
  const metricsPart = payload.metrics
    ? `|M:${Object.entries(payload.metrics)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(";")}`
    : "";
  const compactSummary = payload.summary
    .replace(/\b(?:the|that|which|currently|basically|essentially|please|successfully|in order to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const compactFrame = `IPC|${payload.agentFrom}>${payload.agentTo}|${payload.phase[0]}|${payload.status}|${compactSummary}${filesPart}${metricsPart}`;
  const tokensBefore = estimateTokens(verboseJson);
  const tokensAfter = estimateTokens(compactFrame);
  const savingsPercent = tokensBefore > 0 ? roundTo(((tokensBefore - tokensAfter) / tokensBefore) * 100, 2) : 0;

  return {
    compactFrame,
    tokensBefore,
    tokensAfter,
    savingsPercent,
    attestationHash: sha256Hex({ compactFrame, tokensBefore, tokensAfter }),
  };
}

// ---------------------------------------------------------------------------
// 6. FR-377-06: Facade & Non-Vacuous Cryptographic Audit
// ---------------------------------------------------------------------------

export class EosHarnessTokenEconomicsCore {
  static evaluateBoundary = evaluateHarnessBoundary;
  static compressPayload = compressStructuredPayload;
  static classifyAndRoute = classifyAndRouteDecision;
  static auditCacheAndEconomics = auditPromptCacheAndEconomics;
  static evaluateMinimalDiff = evaluateMinimalDiffAndIpc;
  static encodeCompactIpc = encodeCompactAgentIpc;

  static audit(projectRoot: string = process.cwd()): HarnessTokenEconomicsAuditReceipt {
    // 1. Boundary check: forbidden touch MUST HARD_BLOCK, clean diff MUST ALLOW
    const contract: HarnessBoundaryContract = {
      missionId: "AUDIT-SPEC-377",
      allowedPaths: ["src/core/**"],
      forbiddenPaths: ["src/auth/**", "package-lock.json"],
      maxFilesTouched: 3,
      maxDiffLines: 300,
      allowTestMutation: false,
    };
    const blocked = evaluateHarnessBoundary(contract, {
      changedFiles: ["src/auth/token.ts", "test/auth.test.mjs"],
      totalLinesAdded: 25,
      totalLinesDeleted: 5,
    });
    const allowed = evaluateHarnessBoundary(contract, {
      changedFiles: ["src/core/engine.ts"],
      totalLinesAdded: 40,
      totalLinesDeleted: 10,
    });
    const boundaryEnforced = blocked.verdict === "HARD_BLOCK" && allowed.verdict === "ALLOW";

    // 2. Structured payload compression check (Headroom pattern)
    const sampleMcpPayload = {
      status: "ok",
      items: Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        service: "glorian-fleet",
        region: "us-east-1",
        checksum: "a".repeat(64),
        deprecatedNote: null,
        emptyTag: "",
      })),
    };
    const compressed = compressStructuredPayload(sampleMcpPayload, { maxArrayItems: 8 });
    const structuredCompressionEffective = compressed.columnarTablesFolded >= 1 && compressed.savingsPercent >= 50;

    // 3. JEV deterministic decision router + cache-safe milestone switching
    const routedSamePhase = classifyAndRouteDecision({
      queryId: "audit-route-1",
      prompt: "Run unit test verification and fix lint error in core module",
      labels: [
        { label: "TEST_FIX", keywords: ["test", "lint", "fix", "unit"] },
        { label: "ARCH_REDESIGN", keywords: ["migration", "rearchitecture", "schema"] },
      ],
      currentPhase: "EXECUTION",
      previousPhase: "EXECUTION",
      activeModelTier: "BALANCED_SONNET",
    });
    const routedAmbiguous = classifyAndRouteDecision({
      queryId: "audit-route-2",
      prompt: "Unclear novel philosophical tradeoff without keywords",
      labels: [
        { label: "TEST_FIX", keywords: ["test", "lint"] },
        { label: "DEPLOY", keywords: ["deploy", "release"] },
      ],
      currentPhase: "EXECUTION",
      previousPhase: "EXECUTION",
      activeModelTier: "BALANCED_SONNET",
    });
    const decisionRouterCacheSafe =
      !routedSamePhase.escalatedToFrontier &&
      routedSamePhase.promptCachePreserved &&
      routedAmbiguous.escalatedToFrontier;

    // 4. Prompt cache breaker & context rot audit
    const cacheAudit = auditPromptCacheAndEconomics({
      sessionId: "audit-session-377",
      staticPrefixSegments: [
        "EOS Constitution v75.0.0 generated at 2026-11-22T19:40:00Z id 550e8400-e29b-41d4-a716-446655440000",
        "Architecture guide ".repeat(400),
      ],
      dynamicSuffixSegments: ["Current diff payload ".repeat(300)],
      turns: 10,
      contextWindowTokens: 5000,
    });
    const cleanCacheAudit = auditPromptCacheAndEconomics({
      sessionId: "audit-session-clean",
      staticPrefixSegments: ["Immutable EOS Constitution & Architecture Spec ".repeat(200)],
      dynamicSuffixSegments: ["Turn diff summary ".repeat(40)],
      turns: 12,
      contextWindowTokens: 128000,
    });
    const cacheBreakerDetected =
      !cacheAudit.cachePrefixStable &&
      cacheAudit.cacheBreakers.length >= 2 &&
      cleanCacheAudit.cachePrefixStable &&
      cleanCacheAudit.savingsPercent >= 50;

    // 5. Anti-overengineering minimal-diff gate & compact agent IPC
    const bloatedPatch = evaluateMinimalDiffAndIpc({
      patchId: "audit-patch-1",
      sourceSnippet: "function unusedHelper(x) { return x + 1; }\nfunction wrap(a) { return core(a); }",
      linesAdded: 180,
      requirementsCount: 1,
      addedDependencies: ["left-pad"],
    });
    const ipc = encodeCompactAgentIpc({
      agentFrom: "architect-planner",
      agentTo: "core-implementer",
      phase: "EXECUTION",
      status: "OK",
      summary: "Please implement the validated specification successfully in order to satisfy all checks",
      changedFiles: ["src/core/eosHarnessTokenEconomicsCore.ts"],
      metrics: { tests: 8, coverage: 96 },
    });
    const minimalismGateEnforced =
      bloatedPatch.minimalismVerdict === "FAIL_OVERENGINEERED" &&
      bloatedPatch.findings.length >= 3 &&
      ipc.savingsPercent >= 35;

    const invariants = {
      boundaryEnforced,
      structuredCompressionEffective,
      decisionRouterCacheSafe,
      cacheBreakerDetected,
      minimalismGateEnforced,
    };
    const allOk = Object.values(invariants).every(Boolean);

    const payload = {
      specId: "SPEC-377" as const,
      changeId: "CHANGE-239" as const,
      status: allOk ? ("VERIFIED" as const) : ("FAILED" as const),
      generatedAt: new Date().toISOString(),
      invariants,
      sampleMetrics: {
        jsonSavingsPercent: compressed.savingsPercent,
        ipcSavingsPercent: ipc.savingsPercent,
        sessionCostSavingsPercent: cleanCacheAudit.savingsPercent,
      },
    };
    const receipt: HarnessTokenEconomicsAuditReceipt = {
      ...payload,
      receiptHash: sha256Hex(payload),
    };

    const receiptPath = resolveEvidencePath("HARNESS_TOKEN_ECONOMICS_RECEIPT.json", projectRoot);
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return receipt;
  }
}
