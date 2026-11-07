/**
 * EOS SYSTEM — SECRETS AUTO-ROTATION PROTOCOL (Layer 0)
 * Governed by SPEC-152 (HashiCorp Vault / Google Cloud Secret Manager pattern)
 *
 * Manages credential lifecycle:
 * - Tracks secret metadata (creation time, TTL, last rotation)
 * - Computes rotation urgency (GREEN / AMBER / RED / EXPIRED)
 * - Generates deterministic rotation receipts
 * - Simulates zero-downtime dual-credential swap (old + new valid during overlap)
 *
 * Does NOT store actual secret values — only metadata and lifecycle state.
 * Zero external dependencies.
 */

import { createHash } from "node:crypto";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RotationUrgency = "GREEN" | "AMBER" | "RED" | "EXPIRED";

export interface SecretMetadata {
  readonly name: string;
  readonly createdAtMs: number;
  readonly ttlMs: number;
  readonly rotationOverlapMs: number; // Dual-credential window
  readonly lastRotatedMs: number | null;
  readonly version: number;
  readonly fingerprint: string; // SHA-256 of metadata (NOT the secret)
}

export interface RotationStatus {
  readonly name: string;
  readonly urgency: RotationUrgency;
  readonly agePercent: number; // % of TTL consumed
  readonly remainingMs: number;
  readonly version: number;
  readonly nextRotationDue: string; // ISO timestamp
}

export interface RotationResult {
  readonly name: string;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly rotatedAtMs: number;
  readonly overlapExpiryMs: number;
  readonly sha256Receipt: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosSecretsRotationProtocol {
  private readonly registry: Map<string, SecretMetadata> = new Map();

  /**
   * Registers a secret's metadata (not the actual secret value).
   */
  register(name: string, ttlMs: number, rotationOverlapMs = 3_600_000): void {
    assertPrecondition(ttlMs > 0, "ttlMs must be positive");
    assertPrecondition(rotationOverlapMs >= 0, "rotationOverlapMs must be >= 0");
    const now = Date.now();
    const meta: SecretMetadata = {
      name,
      createdAtMs: now,
      ttlMs,
      rotationOverlapMs,
      lastRotatedMs: null,
      version: 1,
      fingerprint: this.computeFingerprint(name, now, ttlMs, 1),
    };
    this.registry.set(name, deepFreeze(meta));
  }

  /**
   * Evaluates rotation urgency for a registered secret.
   */
  getStatus(name: string): RotationStatus {
    const meta = this.registry.get(name);
    assertPrecondition(meta !== undefined, `Secret not registered: ${name}`);
    const m = meta as SecretMetadata;

    const ageMs = Date.now() - m.createdAtMs;
    const agePercent = Math.min(100, Math.round((ageMs / m.ttlMs) * 100));
    const remainingMs = Math.max(0, m.ttlMs - ageMs);

    let urgency: RotationUrgency;
    if (remainingMs <= 0) urgency = "EXPIRED";
    else if (agePercent >= 90) urgency = "RED";
    else if (agePercent >= 70) urgency = "AMBER";
    else urgency = "GREEN";

    const nextDue = new Date(m.createdAtMs + m.ttlMs).toISOString();

    return deepFreeze({
      name,
      urgency,
      agePercent,
      remainingMs,
      version: m.version,
      nextRotationDue: nextDue,
    });
  }

  /**
   * Executes a rotation: increments version, resets age, starts overlap window.
   */
  rotate(name: string): RotationResult {
    const meta = this.registry.get(name);
    assertPrecondition(meta !== undefined, `Secret not registered: ${name}`);
    const m = meta as SecretMetadata;

    const now = Date.now();
    const previousVersion = m.version;
    const newVersion = m.version + 1;

    const updated: SecretMetadata = {
      name: m.name,
      createdAtMs: now,
      ttlMs: m.ttlMs,
      rotationOverlapMs: m.rotationOverlapMs,
      lastRotatedMs: now,
      version: newVersion,
      fingerprint: this.computeFingerprint(m.name, now, m.ttlMs, newVersion),
    };
    this.registry.set(name, deepFreeze(updated));

    const receipt = pureSha256(`${name}|${previousVersion}|${newVersion}|${now}`);

    return deepFreeze({
      name,
      previousVersion,
      newVersion,
      rotatedAtMs: now,
      overlapExpiryMs: now + m.rotationOverlapMs,
      sha256Receipt: receipt,
    });
  }

  /**
   * Returns status for all registered secrets.
   */
  getAllStatuses(): readonly RotationStatus[] {
    return Array.from(this.registry.keys()).map((name) => this.getStatus(name));
  }

  /**
   * Lists secrets requiring immediate rotation (RED or EXPIRED).
   */
  needsRotation(): readonly string[] {
    return this.getAllStatuses()
      .filter((s) => s.urgency === "RED" || s.urgency === "EXPIRED")
      .map((s) => s.name);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private computeFingerprint(name: string, ts: number, ttl: number, version: number): string {
    return createHash("sha256").update(`${name}|${ts}|${ttl}|v${version}`).digest("hex").slice(0, 16);
  }
}
