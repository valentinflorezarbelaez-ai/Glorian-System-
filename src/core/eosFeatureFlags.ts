/**
 * EOS FEATURE FLAGS (Layer 0)
 * SPEC-053: Progressive delivery — deploy behind flags, toggle without redeploy.
 *
 * Stripe/Netflix standard: every new feature ships behind a flag.
 * If it breaks, disable it instantly via env var — no revert needed.
 *
 * Flags are read from environment variables with EOS_FLAG_ prefix.
 * Example: EOS_FLAG_AGI_PIPELINE=1 → flag "agi_pipeline" is enabled.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";

export interface FeatureFlag {
  readonly key: string;
  readonly enabled: boolean;
  readonly source: "env" | "file" | "default";
  readonly description: string;
}

export interface FlagConfig {
  readonly key: string;
  readonly description: string;
  readonly defaultValue?: boolean;
}

const DEFAULT_FLAGS: readonly FlagConfig[] = Object.freeze([
  { key: "agi_pipeline",     description: "AGI end-to-end pipeline (context → router → tribunal)", defaultValue: true },
  { key: "dynamic_tool_forge",description: "Dynamic MCP tool creation at runtime", defaultValue: true },
  { key: "spec_drift_detector",description: "Spec/code drift detection in CI", defaultValue: true },
  { key: "mutation_testing",  description: "Mutation testing kill score gate in CI", defaultValue: true },
  { key: "property_based_tests",description: "Property-based test suite execution", defaultValue: true },
  { key: "design_linter",    description: "AST design system linter in CI", defaultValue: true },
  { key: "mcp_auth",         description: "Bearer token auth on MCP stream server", defaultValue: false },
  { key: "graph_cache",      description: "Semantic graph persistent cache", defaultValue: true },
  { key: "consultant_offline",description: "Offline consulting engine (no API needed)", defaultValue: true },
  { key: "chaos_in_ci",      description: "Chaos engineering tests in CI pipeline", defaultValue: false },
  { key: "perf_regression",  description: "Performance regression testing in CI", defaultValue: false },
  { key: "accessibility_auto",description: "Automated WCAG accessibility testing in CI", defaultValue: true },
]);

/**
 * Feature flag system — reads from env vars first, falls back to defaults.
 *
 * @example
 * ```ts
 * if (isEnabled("agi_pipeline")) {
 *   // run the pipeline
 * }
 * ```
 */
export class EosFeatureFlags {
  private readonly flags = new Map<string, FeatureFlag>();
  private readonly flagFile: string | null;

  constructor(projectRoot?: string, flagFile?: string) {
    // Try to load a flags.json file for non-env configuration
    const file = flagFile ?? (projectRoot ? path.join(projectRoot, "flags.json") : null);
    this.flagFile = file && fs.existsSync(file) ? file : null;

    for (const config of DEFAULT_FLAGS) {
      this.flags.set(config.key, this._resolve(config));
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
      };
    }

    // Try flag file
    if (this.flagFile) {
      try {
        const fileFlags = JSON.parse(fs.readFileSync(this.flagFile, "utf8"));
        if (config.key in fileFlags) {
          return {
            key: config.key,
            enabled: Boolean(fileFlags[config.key]),
            source: "file",
            description: config.description,
          };
        }
      } catch { /* corrupt file — use default */ }
    }

    return {
      key: config.key,
      enabled: config.defaultValue ?? false,
      source: "default",
      description: config.description,
    };
  }

  /** Returns true if the flag is enabled. */
  public isEnabled(key: string): boolean {
    const flag = this.flags.get(key);
    return flag?.enabled ?? false;
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
