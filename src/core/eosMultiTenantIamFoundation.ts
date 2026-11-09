/**
 * Multi-Tenant IAM Foundation (Layer-0) — SPEC-184
 * Minimal fail-closed ABAC: tenant isolation + subject/action/resource.
 * WITHIN_TESTED_SCOPE — software policy only; not IdP / OIDC / SSO product.
 *
 * Zero external runtime dependencies.
 */

import { createHash } from "node:crypto";
import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

export type IamDecisionCode =
  | "ALLOW"
  | "DENY_TENANT_MISMATCH"
  | "DENY_NO_POLICY"
  | "DENY_ACTION_NOT_PERMITTED"
  | "DENY_INVALID_INPUT";

export interface IamPrincipal {
  readonly subjectId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
}

export interface IamResource {
  readonly resourceId: string;
  readonly tenantId: string;
  readonly classification?: string;
}

export interface IamPolicyRule {
  readonly id: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly actions: readonly string[];
  readonly resourcePrefix?: string;
}

export interface IamAccessRequest {
  readonly principal: IamPrincipal;
  readonly action: string;
  readonly resource: IamResource;
}

export interface IamDecision {
  readonly ok: boolean;
  readonly code: IamDecisionCode;
  readonly reason: string;
  readonly matchedPolicyId: string | null;
  readonly sha256Receipt: string;
}

function attest(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Evaluate a single ABAC request against registered tenant-scoped policies.
 * Cross-tenant access is always DENY_TENANT_MISMATCH (fail-closed).
 */
export function evaluateIamAccess(request: IamAccessRequest, policies: readonly IamPolicyRule[]): IamDecision {
  const principal = request?.principal;
  const resource = request?.resource;
  const action = String(request?.action || "")
    .trim()
    .toLowerCase();

  if (
    !principal ||
    !resource ||
    !isNonEmpty(principal.subjectId) ||
    !isNonEmpty(principal.tenantId) ||
    !isNonEmpty(resource.resourceId) ||
    !isNonEmpty(resource.tenantId) ||
    !action
  ) {
    return deepFreeze({
      ok: false,
      code: "DENY_INVALID_INPUT",
      reason: "IAM request missing required principal, action, or resource fields.",
      matchedPolicyId: null,
      sha256Receipt: attest(["INVALID", action || "none"]),
    });
  }

  if (principal.tenantId !== resource.tenantId) {
    return deepFreeze({
      ok: false,
      code: "DENY_TENANT_MISMATCH",
      reason: `Principal tenant '${principal.tenantId}' cannot access resource tenant '${resource.tenantId}'.`,
      matchedPolicyId: null,
      sha256Receipt: attest(["TENANT", principal.tenantId, resource.tenantId, action]),
    });
  }

  const roleSet = new Set(principal.roles.map((r) => String(r).toLowerCase()));
  const tenantPolicies = policies.filter((p) => p.tenantId === principal.tenantId);

  if (tenantPolicies.length === 0) {
    return deepFreeze({
      ok: false,
      code: "DENY_NO_POLICY",
      reason: `No IAM policies registered for tenant '${principal.tenantId}'.`,
      matchedPolicyId: null,
      sha256Receipt: attest(["NO_POLICY", principal.tenantId, action]),
    });
  }

  for (const policy of tenantPolicies) {
    const roleOk = policy.roles.some((r) => roleSet.has(String(r).toLowerCase()));
    const actionOk = policy.actions.map((a) => a.toLowerCase()).includes(action);
    const prefix = policy.resourcePrefix || "";
    const resourceOk = prefix.length === 0 || resource.resourceId.startsWith(prefix);
    if (roleOk && actionOk && resourceOk) {
      return deepFreeze({
        ok: true,
        code: "ALLOW",
        reason: `Policy '${policy.id}' grants '${action}' on '${resource.resourceId}'.`,
        matchedPolicyId: policy.id,
        sha256Receipt: attest(["ALLOW", policy.id, principal.subjectId, action, resource.resourceId]),
      });
    }
  }

  return deepFreeze({
    ok: false,
    code: "DENY_ACTION_NOT_PERMITTED",
    reason: `No matching policy grants '${action}' for subject '${principal.subjectId}'.`,
    matchedPolicyId: null,
    sha256Receipt: attest(["DENY_ACTION", principal.tenantId, principal.subjectId, action]),
  });
}

export class EosMultiTenantIamFoundation {
  private readonly policies: IamPolicyRule[] = [];

  public registerPolicy(rule: IamPolicyRule): void {
    assertPrecondition(isNonEmpty(rule.id), "policy id required");
    assertPrecondition(isNonEmpty(rule.tenantId), "policy tenantId required");
    assertPrecondition(rule.roles.length > 0, "policy roles required");
    assertPrecondition(rule.actions.length > 0, "policy actions required");
    this.policies.push(deepFreeze({ ...rule }));
  }

  public evaluate(request: IamAccessRequest): IamDecision {
    return evaluateIamAccess(request, this.policies);
  }

  public listPolicies(): readonly IamPolicyRule[] {
    return deepFreeze(this.policies.slice());
  }
}
