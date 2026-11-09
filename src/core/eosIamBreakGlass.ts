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

function attest(parts: readonly string[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Issue a TTL-bounded break-glass grant (default 15 minutes). */
export function issueBreakGlassGrant(input: {
  readonly principal: IamPrincipal;
  readonly reason: string;
  readonly nowMs?: number;
  readonly ttlMs?: number;
}): BreakGlassGrant {
  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = Math.max(60_000, Math.min(input.ttlMs ?? 15 * 60_000, 60 * 60_000));
  const reason = String(input.reason || "").trim();
  if (!reason || reason.length < 8) {
    throw new Error("BREAK_GLASS_REASON_REQUIRED");
  }
  const grantId = crypto.randomBytes(8).toString("hex");
  const expiresAtMs = nowMs + ttlMs;
  return deepFreeze({
    grantId,
    principal: input.principal,
    reason,
    issuedAtMs: nowMs,
    expiresAtMs,
    sha256Receipt: attest([
      grantId,
      input.principal.subjectId,
      input.principal.tenantId,
      String(expiresAtMs),
      reason,
    ]),
  });
}

/** Evaluate whether a break-glass grant is still within TTL. */
export function evaluateBreakGlassGrant(
  grant: BreakGlassGrant | null | undefined,
  nowMs: number = Date.now(),
): BreakGlassEvaluation {
  if (!grant || !grant.principal?.subjectId || !grant.expiresAtMs) {
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
