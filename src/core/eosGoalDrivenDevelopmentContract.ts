/**
 * Glorian System — Goal-Driven Development (GDD) Contract Harness (LIDR M7)
 *
 * Executable goal contract (not prose): metric + threshold + check command,
 * attempt/cost caps, and fail-closed protection against rewriting the check,
 * tests, or CI to manufacture a green result (builder ≠ verifier).
 *
 * Invariant: Pure Layer-0 TypeScript — zero external runtime dependencies.
 */

import { createHash } from "node:crypto";
import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

/** Comparison operators for a measurable metric threshold. */
export type GoalThresholdOp = "eq" | "neq" | "lte" | "gte" | "lt" | "gt";

export const GOAL_THRESHOLD_OPS: readonly GoalThresholdOp[] = Object.freeze([
  "eq",
  "neq",
  "lte",
  "gte",
  "lt",
  "gt",
]);

export interface GoalMetric {
  readonly name: string;
  readonly unit: string;
}

export interface GoalThreshold {
  readonly op: GoalThresholdOp;
  readonly value: number;
}

export interface GoalCheck {
  readonly command: string;
  readonly timeoutMs: number;
}

export interface GoalCaps {
  readonly maxAttempts: number;
  readonly maxCostUsd: number;
}

export interface GoalContract {
  readonly id: string;
  readonly title: string;
  readonly metric: GoalMetric;
  readonly threshold: GoalThreshold;
  readonly check: GoalCheck;
  readonly caps: GoalCaps;
  readonly protectedPaths: readonly string[];
  readonly doneWhen: string;
}

export type GoalValidationCode =
  | "OK"
  | "EMPTY_DOCUMENT"
  | "PARSE_ERROR"
  | "VAGUE_GOAL"
  | "MISSING_FIELD"
  | "INVALID_FIELD"
  | "ATTEMPT_CAP_EXCEEDED"
  | "COST_CAP_EXCEEDED"
  | "PROTECTED_PATH_MUTATION"
  | "THRESHOLD_NOT_MET";

export interface GoalValidationIssue {
  readonly code: GoalValidationCode;
  readonly path: string;
  readonly message: string;
}

export interface GoalValidationResult {
  readonly ok: boolean;
  readonly goal: GoalContract | null;
  readonly issues: readonly GoalValidationIssue[];
  readonly receiptSha256: string;
}

export interface GoalAttemptState {
  readonly attempt: number;
  readonly costUsdAccumulated: number;
}

export interface PathMutationVerdict {
  readonly allowed: boolean;
  readonly blockedPaths: readonly string[];
  readonly reason: string;
}

export interface MetricEvaluation {
  readonly passed: boolean;
  readonly actual: number;
  readonly op: GoalThresholdOp;
  readonly expected: number;
  readonly message: string;
}

/** Default paths agents must not rewrite to force a green check. */
export const DEFAULT_PROTECTED_PATHS: readonly string[] = Object.freeze([
  "test/**",
  ".github/workflows/**",
  ".github/pull_request_template.md",
  "package.json",
  "scripts/validate-gdd-goal.mjs",
  "src/core/eosGoalDrivenDevelopmentContract.ts",
]);

const GOAL_ID_RE = /^GOAL-[A-Z0-9][A-Z0-9_-]{1,63}$/;
const METRIC_NAME_RE = /^[a-z][a-z0-9_]{1,63}$/;
const MAX_COMMAND_CHARS = 512;
const MAX_TITLE_CHARS = 160;
const MAX_DONE_WHEN_CHARS = 240;
const MIN_ATTEMPTS = 1;
const MAX_ATTEMPTS = 10;
const MIN_COST_USD = 0.01;
const MAX_COST_USD = 100;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 600_000;

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function issue(code: GoalValidationCode, path: string, message: string): GoalValidationIssue {
  return { code, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Minimal YAML subset parser for GDD goals (maps, scalars, string lists).
 * Fail-closed on unsupported constructs — no external YAML dependency.
 */
export function parseGoalYamlSubset(raw: string): unknown {
  assertPrecondition(typeof raw === "string", "raw must be a string");
  const text = raw.replace(/^\uFEFF/, "").replace(/\t/g, "  ");
  if (text.trim().length === 0) {
    throw new Error("EMPTY_YAML");
  }

  type Frame = { indent: number; container: Record<string, unknown> | unknown[] };
  const root: Record<string, unknown> = {};
  const stack: Frame[] = [{ indent: -1, container: root }];
  let pendingKey: string | null = null;
  let pendingIndent = 0;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent % 2 !== 0) {
      throw new Error(`INVALID_INDENT_LINE_${i + 1}`);
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
      pendingKey = null;
    }

    const frame = stack[stack.length - 1];
    const container = frame.container;

    if (trimmed.startsWith("- ")) {
      if (!Array.isArray(container)) {
        if (pendingKey !== null && isPlainObject(container)) {
          const list: unknown[] = [];
          container[pendingKey] = list;
          stack.push({ indent, container: list });
          pendingKey = null;
          const item = parseYamlScalar(trimmed.slice(2).trim());
          (stack[stack.length - 1].container as unknown[]).push(item);
          continue;
        }
        throw new Error(`LIST_WITHOUT_KEY_LINE_${i + 1}`);
      }
      container.push(parseYamlScalar(trimmed.slice(2).trim()));
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon <= 0) {
      throw new Error(`INVALID_MAPPING_LINE_${i + 1}`);
    }

    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`INVALID_KEY_LINE_${i + 1}`);
    }
    if (!isPlainObject(container)) {
      throw new Error(`MAPPING_INTO_LIST_LINE_${i + 1}`);
    }

    if (rest.length === 0) {
      // Look ahead: list or nested map
      const next = peekNextMeaningful(lines, i + 1);
      if (next && next.trimmed.startsWith("- ") && next.indent > indent) {
        const list: unknown[] = [];
        container[key] = list;
        stack.push({ indent, container: list });
        pendingKey = null;
      } else {
        const nested: Record<string, unknown> = {};
        container[key] = nested;
        stack.push({ indent, container: nested });
        pendingKey = key;
        pendingIndent = indent;
      }
      continue;
    }

    container[key] = parseYamlScalar(rest);
    pendingKey = key;
    pendingIndent = indent;
    void pendingIndent;
  }

  return root;
}

function peekNextMeaningful(
  lines: string[],
  from: number,
): { indent: number; trimmed: string } | null {
  for (let i = from; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const indent = lines[i].match(/^ */)?.[0].length ?? 0;
    return { indent, trimmed };
  }
  return null;
}

function parseYamlScalar(raw: string): unknown {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** Parse JSON or YAML-subset goal documents. */
export function parseGoalDocument(raw: string): { value: unknown; format: "json" | "yaml" } {
  assertPrecondition(typeof raw === "string", "raw must be a string");
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (trimmed.length === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return { value: JSON.parse(trimmed), format: "json" };
  }

  return { value: parseGoalYamlSubset(trimmed), format: "yaml" };
}

/**
 * Extract a fenced ```goal / ```yaml / ```json block under a Goal Contract heading,
 * or the first fenced block labeled goal|yaml|json in the PR body.
 */
export function extractGoalFenceFromPrBody(markdown: string): string | null {
  assertPrecondition(typeof markdown === "string", "markdown must be a string");
  const fenceRe =
    /```(?:goal|yaml|yml|json)\s*\r?\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  const blocks: string[] = [];
  while ((match = fenceRe.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }
  if (blocks.length === 0) return null;

  // Prefer a block that looks like a goal (has metric/threshold/check keys).
  for (const block of blocks) {
    if (/\bmetric\b/i.test(block) && /\bthreshold\b/i.test(block) && /\bcheck\b/i.test(block)) {
      return block;
    }
  }
  return blocks[0];
}

function normalizeProtectedPaths(value: unknown): string[] {
  if (value === undefined) return [...DEFAULT_PROTECTED_PATHS];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("protectedPaths must be a non-empty string array");
  }
  const paths: string[] = [];
  for (const item of value) {
    if (!isNonEmptyString(item)) {
      throw new Error("protectedPaths entries must be non-empty strings");
    }
    paths.push(item.trim().replace(/\\/g, "/"));
  }
  return paths;
}

/**
 * Validate and freeze a GoalContract. Vague / incomplete goals fail closed.
 */
export function validateGoalDocument(raw: string): GoalValidationResult {
  const issues: GoalValidationIssue[] = [];
  const receiptBase = raw ?? "";

  if (!isNonEmptyString(raw)) {
    issues.push(issue("EMPTY_DOCUMENT", "$", "Goal document is empty."));
    return finalize(null, issues, receiptBase);
  }

  let parsed: unknown;
  try {
    parsed = parseGoalDocument(raw).value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "EMPTY_DOCUMENT" || message === "EMPTY_YAML") {
      issues.push(issue("EMPTY_DOCUMENT", "$", "Goal document is empty."));
    } else {
      issues.push(issue("PARSE_ERROR", "$", `Failed to parse goal document: ${message}`));
    }
    return finalize(null, issues, receiptBase);
  }

  if (!isPlainObject(parsed)) {
    issues.push(issue("VAGUE_GOAL", "$", "Goal must be an object with metric, threshold, and check."));
    return finalize(null, issues, receiptBase);
  }

  // Prose-only / vague: description without executable fields
  const hasMetric = isPlainObject(parsed.metric) || typeof parsed.metric === "string";
  const hasThreshold = isPlainObject(parsed.threshold) || typeof parsed.threshold === "number";
  const hasCheck =
    isPlainObject(parsed.check) ||
    (typeof parsed.check === "string" && parsed.check.trim().length > 0);

  if (!hasMetric || !hasThreshold || !hasCheck) {
    issues.push(
      issue(
        "VAGUE_GOAL",
        "$",
        "Vague goal rejected: metric, threshold, and check are all required (fail-closed).",
      ),
    );
    if (!hasMetric) issues.push(issue("MISSING_FIELD", "metric", "metric is required."));
    if (!hasThreshold) issues.push(issue("MISSING_FIELD", "threshold", "threshold is required."));
    if (!hasCheck) issues.push(issue("MISSING_FIELD", "check", "check is required."));
    return finalize(null, issues, receiptBase);
  }

  // id
  if (!isNonEmptyString(parsed.id) || !GOAL_ID_RE.test(parsed.id.trim())) {
    issues.push(
      issue("INVALID_FIELD", "id", 'id must match GOAL-[A-Z0-9_-]{2,64} (e.g. "GOAL-L0-DEPS").'),
    );
  }

  // title
  if (!isNonEmptyString(parsed.title) || parsed.title.trim().length > MAX_TITLE_CHARS) {
    issues.push(
      issue("INVALID_FIELD", "title", `title must be a non-empty string <= ${MAX_TITLE_CHARS} chars.`),
    );
  }

  // metric
  let metric: GoalMetric | null = null;
  if (isPlainObject(parsed.metric)) {
    const name = parsed.metric.name;
    const unit = parsed.metric.unit;
    if (!isNonEmptyString(name) || !METRIC_NAME_RE.test(name.trim())) {
      issues.push(
        issue("INVALID_FIELD", "metric.name", "metric.name must be snake_case [a-z][a-z0-9_]{1,63}."),
      );
    }
    if (!isNonEmptyString(unit) || unit.trim().length > 32) {
      issues.push(issue("INVALID_FIELD", "metric.unit", "metric.unit must be a non-empty string <= 32 chars."));
    }
    if (issues.every((x) => !x.path.startsWith("metric"))) {
      metric = { name: String(name).trim(), unit: String(unit).trim() };
    }
  } else {
    issues.push(issue("INVALID_FIELD", "metric", "metric must be an object { name, unit }."));
  }

  // threshold
  let threshold: GoalThreshold | null = null;
  if (isPlainObject(parsed.threshold)) {
    const op = parsed.threshold.op;
    const value = parsed.threshold.value;
    if (!isNonEmptyString(op) || !GOAL_THRESHOLD_OPS.includes(op as GoalThresholdOp)) {
      issues.push(
        issue("INVALID_FIELD", "threshold.op", `threshold.op must be one of: ${GOAL_THRESHOLD_OPS.join(", ")}.`),
      );
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(issue("INVALID_FIELD", "threshold.value", "threshold.value must be a finite number."));
    }
    if (
      isNonEmptyString(op) &&
      GOAL_THRESHOLD_OPS.includes(op as GoalThresholdOp) &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      threshold = { op: op as GoalThresholdOp, value };
    }
  } else {
    issues.push(issue("INVALID_FIELD", "threshold", "threshold must be an object { op, value }."));
  }

  // check
  let check: GoalCheck | null = null;
  if (isPlainObject(parsed.check)) {
    const command = parsed.check.command;
    const timeoutMs = parsed.check.timeoutMs;
    if (!isNonEmptyString(command) || command.trim().length > MAX_COMMAND_CHARS) {
      issues.push(
        issue(
          "INVALID_FIELD",
          "check.command",
          `check.command must be a non-empty string <= ${MAX_COMMAND_CHARS} chars.`,
        ),
      );
    } else if (/\brm\s+-rf\b|\bsudo\b|\bcurl\b.*\|\s*(ba)?sh\b/i.test(command)) {
      issues.push(issue("INVALID_FIELD", "check.command", "check.command contains a blocked destructive pattern."));
    }
    if (
      typeof timeoutMs !== "number" ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS
    ) {
      issues.push(
        issue(
          "INVALID_FIELD",
          "check.timeoutMs",
          `check.timeoutMs must be an integer in [${MIN_TIMEOUT_MS}, ${MAX_TIMEOUT_MS}].`,
        ),
      );
    }
    if (
      isNonEmptyString(command) &&
      command.trim().length <= MAX_COMMAND_CHARS &&
      typeof timeoutMs === "number" &&
      Number.isInteger(timeoutMs) &&
      timeoutMs >= MIN_TIMEOUT_MS &&
      timeoutMs <= MAX_TIMEOUT_MS &&
      !/\brm\s+-rf\b|\bsudo\b|\bcurl\b.*\|\s*(ba)?sh\b/i.test(command)
    ) {
      check = { command: command.trim(), timeoutMs };
    }
  } else if (isNonEmptyString(parsed.check)) {
    // Shorthand: check: "npm test"
    check = { command: parsed.check.trim(), timeoutMs: 120_000 };
  } else {
    issues.push(issue("INVALID_FIELD", "check", "check must be { command, timeoutMs } or a command string."));
  }

  // caps (required — unbounded loops are an anti-trap)
  let caps: GoalCaps | null = null;
  if (!isPlainObject(parsed.caps)) {
    issues.push(
      issue("MISSING_FIELD", "caps", "caps.maxAttempts and caps.maxCostUsd are required (fail-closed)."),
    );
  } else {
    const maxAttempts = parsed.caps.maxAttempts;
    const maxCostUsd = parsed.caps.maxCostUsd;
    if (
      typeof maxAttempts !== "number" ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < MIN_ATTEMPTS ||
      maxAttempts > MAX_ATTEMPTS
    ) {
      issues.push(
        issue(
          "INVALID_FIELD",
          "caps.maxAttempts",
          `caps.maxAttempts must be an integer in [${MIN_ATTEMPTS}, ${MAX_ATTEMPTS}].`,
        ),
      );
    }
    if (
      typeof maxCostUsd !== "number" ||
      !Number.isFinite(maxCostUsd) ||
      maxCostUsd < MIN_COST_USD ||
      maxCostUsd > MAX_COST_USD
    ) {
      issues.push(
        issue(
          "INVALID_FIELD",
          "caps.maxCostUsd",
          `caps.maxCostUsd must be a number in [${MIN_COST_USD}, ${MAX_COST_USD}].`,
        ),
      );
    }
    if (
      typeof maxAttempts === "number" &&
      Number.isInteger(maxAttempts) &&
      maxAttempts >= MIN_ATTEMPTS &&
      maxAttempts <= MAX_ATTEMPTS &&
      typeof maxCostUsd === "number" &&
      Number.isFinite(maxCostUsd) &&
      maxCostUsd >= MIN_COST_USD &&
      maxCostUsd <= MAX_COST_USD
    ) {
      caps = { maxAttempts, maxCostUsd };
    }
  }

  // protectedPaths
  let protectedPaths: string[] | null = null;
  try {
    protectedPaths = normalizeProtectedPaths(parsed.protectedPaths);
  } catch (err) {
    issues.push(
      issue("INVALID_FIELD", "protectedPaths", err instanceof Error ? err.message : String(err)),
    );
  }

  // doneWhen
  if (!isNonEmptyString(parsed.doneWhen) || parsed.doneWhen.trim().length > MAX_DONE_WHEN_CHARS) {
    issues.push(
      issue(
        "INVALID_FIELD",
        "doneWhen",
        `doneWhen must be a non-empty measurable statement <= ${MAX_DONE_WHEN_CHARS} chars.`,
      ),
    );
  }

  if (issues.length > 0 || !metric || !threshold || !check || !caps || !protectedPaths) {
    return finalize(null, issues, receiptBase);
  }

  const goal = deepFreeze({
    id: String(parsed.id).trim(),
    title: String(parsed.title).trim(),
    metric,
    threshold,
    check,
    caps,
    protectedPaths: Object.freeze([...protectedPaths]) as readonly string[],
    doneWhen: String(parsed.doneWhen).trim(),
  }) as GoalContract;

  return finalize(goal, issues, receiptBase);
}

function finalize(
  goal: GoalContract | null,
  issues: GoalValidationIssue[],
  raw: string,
): GoalValidationResult {
  const ok = goal !== null && issues.length === 0;
  const receiptSha256 = sha256Hex(
    JSON.stringify({
      ok,
      goal,
      issues,
      rawSha256: sha256Hex(raw),
    }),
  );
  return deepFreeze({ ok, goal, issues: Object.freeze([...issues]), receiptSha256 });
}

/** Evaluate an observed metric against the goal threshold. */
export function evaluateMetric(actual: number, threshold: GoalThreshold): MetricEvaluation {
  assertPrecondition(Number.isFinite(actual), "actual must be finite");
  assertPrecondition(GOAL_THRESHOLD_OPS.includes(threshold.op), "threshold.op invalid");
  assertPrecondition(Number.isFinite(threshold.value), "threshold.value must be finite");

  const { op, value: expected } = threshold;
  let passed = false;
  switch (op) {
    case "eq":
      passed = actual === expected;
      break;
    case "neq":
      passed = actual !== expected;
      break;
    case "lte":
      passed = actual <= expected;
      break;
    case "gte":
      passed = actual >= expected;
      break;
    case "lt":
      passed = actual < expected;
      break;
    case "gt":
      passed = actual > expected;
      break;
    default:
      passed = false;
  }

  return deepFreeze({
    passed,
    actual,
    op,
    expected,
    message: passed
      ? `metric ${actual} satisfies ${op} ${expected}`
      : `metric ${actual} does not satisfy ${op} ${expected}`,
  });
}

/** Fail closed when attempt or cost caps are exceeded. */
export function assertWithinCaps(
  state: GoalAttemptState,
  caps: GoalCaps,
): GoalValidationResult {
  assertPrecondition(Number.isInteger(state.attempt) && state.attempt >= 0, "attempt must be >= 0");
  assertPrecondition(Number.isFinite(state.costUsdAccumulated) && state.costUsdAccumulated >= 0, "cost must be >= 0");

  const issues: GoalValidationIssue[] = [];
  if (state.attempt > caps.maxAttempts) {
    issues.push(
      issue(
        "ATTEMPT_CAP_EXCEEDED",
        "caps.maxAttempts",
        `Attempt ${state.attempt} exceeds maxAttempts=${caps.maxAttempts}. Stop and report.`,
      ),
    );
  }
  if (state.costUsdAccumulated > caps.maxCostUsd) {
    issues.push(
      issue(
        "COST_CAP_EXCEEDED",
        "caps.maxCostUsd",
        `Accumulated cost $${state.costUsdAccumulated} exceeds maxCostUsd=$${caps.maxCostUsd}. Stop and report.`,
      ),
    );
  }

  const raw = JSON.stringify({ state, caps });
  const ok = issues.length === 0;
  const receiptSha256 = sha256Hex(JSON.stringify({ ok, issues, rawSha256: sha256Hex(raw) }));
  return deepFreeze({
    ok,
    goal: null,
    issues: Object.freeze([...issues]),
    receiptSha256,
  });
}

/**
 * Glob-lite matcher: supports `**` and `*` segments; paths normalized to `/`.
 */
export function pathMatchesProtected(changedPath: string, pattern: string): boolean {
  const pathNorm = changedPath.replace(/\\/g, "/").replace(/^\.\//, "");
  const patNorm = pattern.replace(/\\/g, "/").replace(/^\.\//, "");

  if (patNorm.endsWith("/**")) {
    const prefix = patNorm.slice(0, -3);
    return pathNorm === prefix || pathNorm.startsWith(`${prefix}/`);
  }
  if (patNorm.includes("*")) {
    const escaped = patNorm
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "{{DS}}")
      .replace(/\*/g, "[^/]*")
      .replace(/{{DS}}/g, ".*");
    return new RegExp(`^${escaped}$`).test(pathNorm);
  }
  return pathNorm === patNorm;
}

/**
 * Agents must not rewrite the check, tests, or CI (or other protected paths)
 * to manufacture a green result.
 */
export function assertMutationAllowed(
  changedPaths: readonly string[],
  protectedPaths: readonly string[] = DEFAULT_PROTECTED_PATHS,
): PathMutationVerdict {
  assertPrecondition(Array.isArray(changedPaths), "changedPaths must be an array");
  assertPrecondition(Array.isArray(protectedPaths) && protectedPaths.length > 0, "protectedPaths required");

  const blocked: string[] = [];
  for (const changed of changedPaths) {
    if (!isNonEmptyString(changed)) continue;
    const norm = changed.replace(/\\/g, "/");
    for (const pattern of protectedPaths) {
      if (pathMatchesProtected(norm, pattern)) {
        blocked.push(norm);
        break;
      }
    }
  }

  if (blocked.length > 0) {
    return deepFreeze({
      allowed: false,
      blockedPaths: Object.freeze([...blocked]) as readonly string[],
      reason:
        "PROTECTED_PATH_MUTATION: rewriting check/tests/CI (or other protected paths) to pass is forbidden (builder ≠ verifier).",
    });
  }

  return deepFreeze({
    allowed: true,
    blockedPaths: Object.freeze([]) as readonly string[],
    reason: "All changed paths are outside the protected set.",
  });
}

/**
 * Convenience: validate raw document and return a process-style summary for CLI/tests.
 */
export function summarizeValidation(result: GoalValidationResult): string {
  if (result.ok && result.goal) {
    return `GDD_PASS ${result.goal.id} receipt=${result.receiptSha256.slice(0, 12)}`;
  }
  const codes = [...new Set(result.issues.map((i) => i.code))].join(",");
  return `GDD_FAIL codes=${codes || "UNKNOWN"} receipt=${result.receiptSha256.slice(0, 12)}`;
}
