/**
 * EOS SYSTEM — FEATURE FLAG PROGRESSIVE DELIVERY ENGINE (Layer 0)
 * Governed by SPEC-148 (Uber Magma / LaunchDarkly pattern)
 *
 * Deterministic percentage-based rollout with kill-switch enforcement.
 * Uses a stable hash (SHA-256 of flagKey + entityId) mod 100 to determine
 * if a user/entity sees the feature. Kill switch overrides all.
 *
 * Zero external dependencies.
 */

import { createHash } from "node:crypto";
import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagState = "DISABLED" | "CANARY" | "GRADUAL" | "FULL";

export interface FeatureFlag {
  readonly key: string;
  readonly state: FlagState;
  readonly rolloutPercent: number; // 0-100
  readonly killSwitch: boolean;
  readonly ownerSquad: string;
  readonly createdAt: string;
  readonly guardrails: readonly { metric: string; maxThreshold: number; action: "REVERT" | "ALERT" }[];
}

export interface FlagEvaluation {
  readonly flagKey: string;
  readonly entityId: string;
  readonly variant: "on" | "off";
  readonly reason: "KILL_SWITCH" | "PERCENTAGE" | "FULL_ROLLOUT" | "DISABLED" | "NOT_FOUND";
  readonly bucket: number; // 0-99 (deterministic hash bucket)
  readonly sha256Receipt: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosFeatureFlagEngine {
  private readonly flags: Map<string, FeatureFlag> = new Map();

  /**
   * Registers or updates a feature flag.
   */
  setFlag(flag: FeatureFlag): void {
    assertPrecondition(flag.rolloutPercent >= 0 && flag.rolloutPercent <= 100, "rolloutPercent must be 0-100");
    assertPrecondition(flag.key.length > 0, "key must not be empty");
    this.flags.set(flag.key, deepFreeze(flag));
  }

  /**
   * Removes a flag entirely.
   */
  removeFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  /**
   * Activates kill switch — immediately disables regardless of rollout %.
   */
  killSwitch(key: string): void {
    const flag = this.flags.get(key);
    assertPrecondition(flag !== undefined, `Flag not found: ${key}`);
    this.flags.set(key, { ...(flag as FeatureFlag), killSwitch: true, state: "DISABLED", rolloutPercent: 0 });
  }

  /**
   * Sets progressive rollout percentage.
   */
  setRollout(key: string, percent: number): void {
    const flag = this.flags.get(key);
    assertPrecondition(flag !== undefined, `Flag not found: ${key}`);
    const state: FlagState = percent >= 100 ? "FULL" : percent > 0 ? "GRADUAL" : "DISABLED";
    this.flags.set(key, { ...(flag as FeatureFlag), rolloutPercent: percent, state, killSwitch: false });
  }

  /**
   * Evaluates whether an entity sees the feature.
   * Deterministic: same (flagKey, entityId) always produces same bucket.
   */
  evaluate(flagKey: string, entityId: string): FlagEvaluation {
    const flag = this.flags.get(flagKey);
    if (!flag) {
      return this.buildEval(flagKey, entityId, "off", "NOT_FOUND", 0);
    }
    if (flag.killSwitch) {
      return this.buildEval(flagKey, entityId, "off", "KILL_SWITCH", 0);
    }
    if (flag.state === "DISABLED" || flag.rolloutPercent === 0) {
      return this.buildEval(flagKey, entityId, "off", "DISABLED", 0);
    }
    if (flag.rolloutPercent >= 100) {
      return this.buildEval(flagKey, entityId, "on", "FULL_ROLLOUT", 100);
    }

    const bucket = this.computeBucket(flagKey, entityId);
    const variant = bucket < flag.rolloutPercent ? "on" : "off";
    return this.buildEval(flagKey, entityId, variant, "PERCENTAGE", bucket);
  }

  /**
   * Lists all registered flags.
   */
  listFlags(): readonly FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Returns flags in CANARY/GRADUAL state (actively rolling out).
   */
  activeRollouts(): readonly FeatureFlag[] {
    return this.listFlags().filter((f) => f.state === "CANARY" || f.state === "GRADUAL");
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private computeBucket(flagKey: string, entityId: string): number {
    const hash = createHash("sha256").update(`${flagKey}:${entityId}`).digest();
    // Use first 4 bytes for a uniform 32-bit integer
    const num = hash.readUInt32BE(0);
    return num % 100;
  }

  private buildEval(
    flagKey: string,
    entityId: string,
    variant: "on" | "off",
    reason: FlagEvaluation["reason"],
    bucket: number,
  ): FlagEvaluation {
    const canonical = `${flagKey}|${entityId}|${variant}|${reason}|${bucket}`;
    const receipt = createHash("sha256").update(canonical).digest("hex");
    return deepFreeze({ flagKey, entityId, variant, reason, bucket, sha256Receipt: receipt });
  }
}
