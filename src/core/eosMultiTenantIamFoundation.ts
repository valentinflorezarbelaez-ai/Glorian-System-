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
  "ALLOW" | "DENY_TENANT_MISMATCH" | "DENY_NO_POLICY" | "DENY_ACTION_NOT_PERMITTED" | "DENY_INVALID_INPUT";

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

function normalizeTokenList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const token = item.trim().toLowerCase();
    if (token.length === 0) return null;
    out.push(token);
  }
  return out;
}

function isSafeResourceToken(value: string): boolean {
  if (value.length === 0 || value.includes("\\") || value.includes("//")) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isSafePrefix(prefix: string): boolean {
  if (prefix.length === 0) return true;
  const trimmed = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return isSafeResourceToken(trimmed);
}

function resourceMatchesPrefix(resourceId: string, prefix: string): boolean {
  if (prefix.length === 0) return true;
  if (resourceId === prefix) return true;
  const boundary = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return resourceId.startsWith(boundary);
}

function deny(code: IamDecisionCode, reason: string, receiptParts: readonly string[]): IamDecision {
  return deepFreeze({
    ok: false,
    code,
    reason,
    matchedPolicyId: null,
    sha256Receipt: attest(receiptParts),
  });
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
  const roles = normalizeTokenList(principal?.roles);

  if (
    !principal ||
    !resource ||
    !isNonEmpty(principal.subjectId) ||
    !isNonEmpty(principal.tenantId) ||
    !isNonEmpty(resource.resourceId) ||
    !isNonEmpty(resource.tenantId) ||
    !action ||
    !roles ||
    !Array.isArray(policies)
  ) {
    return deny(
      "DENY_INVALID_INPUT",
      "IAM request missing required principal, roles, action, resource, or policy list.",
      ["INVALID", action || "none"],
    );
  }

  if (!isSafeResourceToken(resource.resourceId)) {
    return deny("DENY_INVALID_INPUT", "Resource identifier is not a safe path token.", [
      "INVALID_RESOURCE",
      principal.tenantId,
      action,
    ]);
  }

  if (principal.tenantId !== resource.tenantId) {
    return deny(
      "DENY_TENANT_MISMATCH",
      `Principal tenant '${principal.tenantId}' cannot access resource tenant '${resource.tenantId}'.`,
      ["TENANT", principal.tenantId, resource.tenantId, action],
    );
  }

  const parsedPolicies: Array<{
    id: string;
    tenantId: string;
    roles: readonly string[];
    actions: readonly string[];
    resourcePrefix: string;
  }> = [];

  for (const policy of policies) {
    const policyRoles = normalizeTokenList(policy?.roles);
    const policyActions = normalizeTokenList(policy?.actions);
    const prefix = policy?.resourcePrefix ?? "";
    if (
      !policy ||
      !isNonEmpty(policy.id) ||
      !isNonEmpty(policy.tenantId) ||
      !policyRoles ||
      !policyActions ||
      typeof prefix !== "string" ||
      !isSafePrefix(prefix)
    ) {
      return deny("DENY_INVALID_INPUT", "IAM policy list contains a malformed or unsafe rule.", [
        "INVALID_POLICY",
        principal.tenantId,
        action,
      ]);
    }
    parsedPolicies.push({
      id: policy.id,
      tenantId: policy.tenantId,
      roles: policyRoles,
      actions: policyActions,
      resourcePrefix: prefix,
    });
  }

  const roleSet = new Set(roles);
  const tenantPolicies = parsedPolicies.filter((p) => p.tenantId === principal.tenantId);

  if (tenantPolicies.length === 0) {
    return deny("DENY_NO_POLICY", `No IAM policies registered for tenant '${principal.tenantId}'.`, [
      "NO_POLICY",
      principal.tenantId,
      action,
    ]);
  }

  for (const policy of tenantPolicies) {
    const roleOk = policy.roles.some((role) => roleSet.has(role));
    const actionOk = policy.actions.includes(action);
    const resourceOk = resourceMatchesPrefix(resource.resourceId, policy.resourcePrefix);
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

  return deny(
    "DENY_ACTION_NOT_PERMITTED",
    `No matching policy grants '${action}' for subject '${principal.subjectId}'.`,
    ["DENY_ACTION", principal.tenantId, principal.subjectId, action],
  );
}

export class EosMultiTenantIamFoundation {
  private readonly policies: IamPolicyRule[] = [];

  public registerPolicy(rule: IamPolicyRule): void {
    assertPrecondition(isNonEmpty(rule.id), "policy id required");
    assertPrecondition(isNonEmpty(rule.tenantId), "policy tenantId required");
    assertPrecondition(normalizeTokenList(rule.roles) !== null, "policy roles required");
    assertPrecondition(normalizeTokenList(rule.actions) !== null, "policy actions required");
    const prefix = rule.resourcePrefix ?? "";
    assertPrecondition(
      typeof prefix === "string" && isSafePrefix(prefix),
      "policy resourcePrefix is not a safe path prefix",
    );
    this.policies.push(deepFreeze({ ...rule, resourcePrefix: prefix.length > 0 ? prefix : undefined }));
  }

  public evaluate(request: IamAccessRequest): IamDecision {
    return evaluateIamAccess(request, this.policies);
  }

  public listPolicies(): readonly IamPolicyRule[] {
    return deepFreeze(this.policies.slice());
  }
}
