/**
 * EOS FEATURE FLAGS (Layer 0)
 * SPEC-053: Progressive delivery — deploy behind flags, toggle without redeploy.
 *
 * Stripe/Netflix standard: every new feature ships behind a flag.
 * If it breaks, disable it instantly via env var — no revert needed.
 *
 * v64 additions (Netflix LaunchDarkly standard):
 *   - Percentage/cohort rollout: rolloutPercentage + stableHash(userId) for sticky assignment
 *   - Runtime refresh: re-read flags.json every REFRESH_TTL_MS without process restart
 *   - Flag expiry: expiresAt field — flags past expiry emit a warning (prevent flag accumulation)
 *
 * Flags are read from environment variables with EOS_FLAG_ prefix.
 * Example: EOS_FLAG_AGI_PIPELINE=1 → flag "agi_pipeline" is enabled.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  readonly source: "env" | "file" | "default" | "rollout";
  readonly description: string;
  /** Optional percentage rollout 0–100. When set, enabled is determined by stableHash(userId). */
  readonly rolloutPercentage?: number;
  /** Optional ISO-8601 expiry date. Flags past this date emit a deprecation warning. */
  readonly expiresAt?: string;
}

export interface FlagConfig {
  readonly key: string;
  readonly description: string;
  readonly defaultValue?: boolean;
  /** Optional percentage rollout 0–100. */
  readonly rolloutPercentage?: number;
  /** Optional ISO-8601 expiry date string. */
  readonly expiresAt?: string;
}

const DEFAULT_FLAGS: readonly FlagConfig[] = Object.freeze([
  { key: "agi_pipeline", description: "AGI end-to-end pipeline (context → router → tribunal)", defaultValue: true },
  { key: "dynamic_tool_forge", description: "Dynamic MCP tool creation at runtime", defaultValue: true },
  { key: "spec_drift_detector", description: "Spec/code drift detection in CI", defaultValue: true },
  { key: "mutation_testing", description: "Mutation testing kill score gate in CI", defaultValue: true },
  { key: "property_based_tests", description: "Property-based test suite execution", defaultValue: true },
  { key: "design_linter", description: "AST design system linter in CI", defaultValue: true },
  { key: "mcp_auth", description: "Bearer token auth on MCP stream server", defaultValue: false },
  { key: "graph_cache", description: "Semantic graph persistent cache", defaultValue: true },
  { key: "consultant_offline", description: "Offline consulting engine (no API needed)", defaultValue: true },
  { key: "chaos_in_ci", description: "Chaos engineering tests in CI pipeline", defaultValue: false },
  { key: "perf_regression", description: "Performance regression testing in CI", defaultValue: false },
  { key: "accessibility_auto", description: "Automated WCAG accessibility testing in CI", defaultValue: true },
]);

/**
 * Feature flag system — reads from env vars first, falls back to defaults.
 * v64: adds percentage rollout, runtime refresh (30s TTL), and flag expiry warnings.
 *
 * @example
 * ```ts
 * if (isEnabled("agi_pipeline")) {
 *   // run the pipeline
 * }
 * // Percentage rollout — stable per userId (consistent assignment):
 * if (flags.isEnabledForUser("dynamic_tool_forge", userId)) {
 *   // only runs for users in the rollout cohort
 * }
 * ```
 */
export class EosFeatureFlags {
  private readonly flags = new Map<string, FeatureFlag>();
  private readonly flagFile: string | null;

  /** Runtime refresh — stale after REFRESH_TTL_MS (Netflix: flags propagate in <30s) */
  private static readonly REFRESH_TTL_MS = 30_000;
  private _lastRefreshAt = 0;

  constructor(projectRoot?: string, flagFile?: string) {
    // Try to load a flags.json file for non-env configuration
    const file = flagFile ?? (projectRoot ? path.join(projectRoot, "flags.json") : null);
    this.flagFile = file && fs.existsSync(file) ? file : null;

    this._loadFlags();
  }

  private _loadFlags(): void {
    this.flags.clear();
    for (const config of DEFAULT_FLAGS) {
      this.flags.set(config.key, this._resolve(config));
    }
    this._lastRefreshAt = Date.now();
    // Check for expired flags and emit warnings
    const now = new Date().toISOString();
    for (const flag of this.flags.values()) {
      if (flag.expiresAt && flag.expiresAt < now) {
        process.stderr.write(`[EOS FLAGS] WARN: Flag "${flag.key}" expired at ${flag.expiresAt} — consider removing it\n`);
      }
    }
  }

  private _maybeRefresh(): void {
    if (this.flagFile && Date.now() - this._lastRefreshAt > EosFeatureFlags.REFRESH_TTL_MS) {
      this._loadFlags();
    }
  }

  private _resolve(config: FlagConfig): FeatureFlag {
    const envKey = `EOS_FLAG_${config.key.toUpperCase()}`;
    const envVal = process.env[envKey];

    if (envVal !== undefined) {
      return {
        key: config.key,
        enabled: envVal === "1" || envVal === "true" || envVal === "on",
        source: "env",
        description: config.description,
        rolloutPercentage: config.rolloutPercentage,
        expiresAt: config.expiresAt,
      };
    }

    // Try flag file
    if (this.flagFile) {
      try {
        const fileFlags = JSON.parse(fs.readFileSync(this.flagFile, "utf8"));
        if (config.key in fileFlags) {
          const fileVal = fileFlags[config.key];
          return {
            key: config.key,
            enabled: Boolean(fileVal),
            source: "file",
            description: config.description,
            rolloutPercentage: config.rolloutPercentage,
            expiresAt: config.expiresAt,
          };
        }
      } catch { /* corrupt file — use default */ }
    }

    return {
      key: config.key,
      enabled: config.defaultValue ?? false,
      source: "default",
      description: config.description,
      rolloutPercentage: config.rolloutPercentage,
      expiresAt: config.expiresAt,
    };
  }

  /** Returns true if the flag is enabled for all users (no rollout percentage). */
  public isEnabled(key: string): boolean {
    this._maybeRefresh();
    const flag = this.flags.get(key);
    return flag?.enabled ?? false;
  }

  /**
   * Returns true if the flag is enabled for this specific userId.
   * For percentage rollouts: uses a stable deterministic hash so the same user
   * always gets the same assignment (sticky rollout — Netflix LaunchDarkly standard).
   * For binary flags: same as isEnabled().
   */
  public isEnabledForUser(key: string, userId: string): boolean {
    this._maybeRefresh();
    const flag = this.flags.get(key);
    if (!flag) return false;
    if (typeof flag.rolloutPercentage !== "number") return flag.enabled;
    // Stable hash: SHA-256(key:userId) mod 100 — consistent across restarts
    const hashHex = crypto.createHash("sha256").update(`${key}:${userId}`).digest("hex");
    const bucket = parseInt(hashHex.slice(0, 8), 16) % 100;
    return bucket < flag.rolloutPercentage;
  }

  /** Returns the full flag object (including source and description). */
  public getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /** Returns all registered flags with their current state. */
  public getAllFlags(): readonly FeatureFlag[] {
    return Object.freeze([...this.flags.values()]);
  }

  /** Returns a summary for CLI display. */
  public getSummary(): { enabled: number; disabled: number; total: number; flags: readonly FeatureFlag[] } {
    const all = this.getAllFlags();
    return {
      enabled: all.filter(f => f.enabled).length,
      disabled: all.filter(f => !f.enabled).length,
      total: all.length,
      flags: all,
    };
  }
}

/** Convenience: check a flag without instantiating the class. */
export function isEnabled(key: string, projectRoot?: string): boolean {
  return new EosFeatureFlags(projectRoot).isEnabled(key);
}
