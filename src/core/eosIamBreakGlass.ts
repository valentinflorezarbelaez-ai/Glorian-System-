/**
 * IAM break-glass elevation (Layer-0) — composes SPEC-184
 * Time-bounded emergency principal grant. WITHIN_TESTED_SCOPE — not IdP/SSO.
 */

import crypto from "node:crypto";

import { deepFreeze } from "./eosKernelPrimitives.ts";
import type { IamPrincipal } from "./eosMultiTenantIamFoundation.ts";

export interface BreakGlassGrant {
  readonly grantId: string;
  readonly principal: IamPrincipal;
  readonly reason: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly sha256Receipt: string;
}

export interface BreakGlassEvaluation {
  readonly active: boolean;
  readonly code: "BREAK_GLASS_ACTIVE" | "BREAK_GLASS_EXPIRED" | "BREAK_GLASS_INVALID";
  readonly grant: BreakGlassGrant | null;
  readonly remainingMs: number;
}

const BREAK_GLASS_ROLE = "break-glass";
const MAX_GRANT_TTL_MS = 60 * 60_000;

function attest(parts: readonly string[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Issue a TTL-bounded break-glass grant (default 15 minutes). */
export function issueBreakGlassGrant(input: {
  readonly principal: IamPrincipal;
  readonly reason: string;
  readonly nowMs?: number;
  readonly ttlMs?: number;
}): BreakGlassGrant {
  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = Math.max(60_000, Math.min(input.ttlMs ?? 15 * 60_000, MAX_GRANT_TTL_MS));
  const reason = String(input.reason || "").trim();
  if (!reason || reason.length < 8) {
    throw new Error("BREAK_GLASS_REASON_REQUIRED");
  }
  const principal = input.principal;
  if (
    !hasNonEmptyString(principal?.subjectId) ||
    !hasNonEmptyString(principal?.tenantId) ||
    !Array.isArray(principal?.roles) ||
    principal.roles.length === 0
  ) {
    throw new Error("BREAK_GLASS_PRINCIPAL_INVALID");
  }
  if (!principal.roles.includes(BREAK_GLASS_ROLE)) {
    throw new Error("BREAK_GLASS_ROLE_REQUIRED");
  }
  const grantId = crypto.randomBytes(8).toString("hex");
  const expiresAtMs = nowMs + ttlMs;
  return deepFreeze({
    grantId,
    principal,
    reason,
    issuedAtMs: nowMs,
    expiresAtMs,
    sha256Receipt: attest([
      grantId,
      principal.subjectId,
      principal.tenantId,
      String(expiresAtMs),
      reason,
    ]),
  });
}

/** Structural + receipt + issuance-time TTL validation for a grant (fail-closed). */
function isGrantValid(grant: BreakGlassGrant, nowMs: number): boolean {
  const principal = grant.principal;
  if (
    !hasNonEmptyString(grant.grantId) ||
    !hasNonEmptyString(principal?.subjectId) ||
    !hasNonEmptyString(principal?.tenantId) ||
    !Array.isArray(principal?.roles) ||
    !principal.roles.includes(BREAK_GLASS_ROLE) ||
    !Number.isFinite(grant.issuedAtMs) ||
    !Number.isFinite(grant.expiresAtMs)
  ) {
    return false;
  }
  if (grant.issuedAtMs > nowMs) return false;
  const lifetimeMs = grant.expiresAtMs - grant.issuedAtMs;
  if (lifetimeMs <= 0 || lifetimeMs > MAX_GRANT_TTL_MS) return false;
  const expectedReceipt = attest([
    grant.grantId,
    principal.subjectId,
    principal.tenantId,
    String(grant.expiresAtMs),
    grant.reason,
  ]);
  return expectedReceipt === grant.sha256Receipt;
}

/** Evaluate whether a break-glass grant is still within TTL. */
export function evaluateBreakGlassGrant(
  grant: BreakGlassGrant | null | undefined,
  nowMs: number = Date.now(),
): BreakGlassEvaluation {
  if (!grant || !isGrantValid(grant, nowMs)) {
    return deepFreeze({
      active: false,
      code: "BREAK_GLASS_INVALID",
      grant: null,
      remainingMs: 0,
    });
  }
  const remainingMs = grant.expiresAtMs - nowMs;
  if (remainingMs <= 0) {
    return deepFreeze({
      active: false,
      code: "BREAK_GLASS_EXPIRED",
      grant,
      remainingMs: 0,
    });
  }
  return deepFreeze({
    active: true,
    code: "BREAK_GLASS_ACTIVE",
    grant,
    remainingMs,
  });
}
