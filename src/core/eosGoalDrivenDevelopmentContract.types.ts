/**
 * GDD contract types, constants, YAML-subset parser, and check-command safety.
 * Companion to eosGoalDrivenDevelopmentContract.ts (keep main module <= 800 lines).
 *
 * Invariant: Pure Layer-0 TypeScript — zero external runtime dependencies.
 */

import { assertPrecondition } from "./eosKernelPrimitives.ts";

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
  "src/core/eosGoalDrivenDevelopmentContract.types.ts",
]);

/**
 * Unfilled template tokens like `<metric>` / `<replace with ...>`.
 * Requires a letter immediately after `<` so bare comparisons
 * (`latency_ms < 200`, `x > 0 && x < 10`) are not rejected.
 */
export const ANGLE_BRACKET_PLACEHOLDER_RE = /<[A-Za-z][^<>]*>/;

export const GOAL_ID_RE = /^GOAL-[A-Z0-9][A-Z0-9_-]{1,63}$/;
/** Template / sample IDs that must never validate as Done (fail-closed). */
export const PLACEHOLDER_GOAL_ID_RE = /^GOAL-(TODO|EXAMPLE|SAMPLE|PLACEHOLDER)(-|$)/i;
export const PLACEHOLDER_METRIC_RE = /^(example_metric|snake_case_metric|todo_metric|metric_name)$/i;
export const DESTRUCTIVE_CHECK_RE = /\brm\s+-rf\b|\bsudo\b|\bcurl\b.*\|\s*(ba)?sh\b/i;
/** Trivial always-green checks — agents must not use these as measurable Done. */
export const TRIVIAL_CHECK_RE = /process\.exit\s*\(\s*0\s*\)/;
export const METRIC_NAME_RE = /^[a-z][a-z0-9_]{1,63}$/;
export const MAX_COMMAND_CHARS = 512;
export const MAX_TITLE_CHARS = 160;
export const MAX_DONE_WHEN_CHARS = 240;
export const MIN_ATTEMPTS = 1;
export const MAX_ATTEMPTS = 10;
export const MIN_COST_USD = 0.01;
export const MAX_COST_USD = 100;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 600_000;

export function isPlaceholderGoalId(id: string): boolean {
  return PLACEHOLDER_GOAL_ID_RE.test(id.trim());
}

export function containsAngleBracketPlaceholder(value: string): boolean {
  return ANGLE_BRACKET_PLACEHOLDER_RE.test(value);
}

/** Returns null when command is safe; otherwise an INVALID_FIELD message. */
export function checkCommandSafetyMessage(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return "check.command must be a non-empty string.";
  }
  if (trimmed.length > MAX_COMMAND_CHARS) {
    return `check.command must be a non-empty string <= ${MAX_COMMAND_CHARS} chars.`;
  }
  if (containsAngleBracketPlaceholder(trimmed)) {
    return "check.command still contains a template placeholder (angle brackets); replace before Done.";
  }
  if (DESTRUCTIVE_CHECK_RE.test(trimmed)) {
    return "check.command contains a blocked destructive pattern.";
  }
  if (TRIVIAL_CHECK_RE.test(trimmed)) {
    return "check.command is a trivial always-green stub (e.g. process.exit(0)); replace with a measurable check.";
  }
  return null;
}

export function extractGoalIdFromFence(block: string): string | null {
  const jsonMatch = block.match(/"id"\s*:\s*"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1].trim();
  const yamlMatch = block.match(/(?:^|\n)\s*id\s*:\s*["']?([A-Za-z0-9_-]+)["']?/);
  return yamlMatch ? yamlMatch[1].trim() : null;
}

export function fenceLooksLikeGoal(block: string): boolean {
  return /\bmetric\b/i.test(block) && /\bthreshold\b/i.test(block) && /\bcheck\b/i.test(block);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
