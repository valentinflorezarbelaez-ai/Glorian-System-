/**
 * Big Tech Product Factory E2E Seal (Layer-0) — SPEC-185
 *
 * Authorize → deliver → scorecard → receipt. WITHIN_TESTED_SCOPE.
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { deepFreeze } from "./eosKernelPrimitives.ts";
import { evaluateMcpIamCallGate, loadMcpIamPoliciesFromProject, type McpIamGateResult } from "./eosMcpIamCallGate.ts";
import type { IamPolicyRule, IamPrincipal } from "./eosMultiTenantIamFoundation.ts";
import {
  EosProductDeliveryOrchestrator,
  type DeliveryResult,
  type DeliveryOptions,
} from "./eosProductDeliveryOrchestrator.ts";
import type { ProductManifest } from "./eosUniversalProductFoundry.ts";

export type FactoryStatus = "SUCCESS" | "BLOCKED" | "FAILED";

export interface BigTechFactoryOptions {
  readonly projectRoot?: string;
  readonly dryRun?: boolean;
  readonly principal?: IamPrincipal | null;
  readonly policies?: readonly IamPolicyRule[];
  readonly delivery?: DeliveryOptions;
}

export interface BigTechFactoryResult {
  readonly status: FactoryStatus;
  readonly reason: string | null;
  readonly dryRun: boolean;
  readonly iam: McpIamGateResult;
  readonly delivery: DeliveryResult | null;
  readonly productId: string;
  readonly epistemicState: "BIGTECH_PRODUCT_FACTORY_WITHIN_TESTED_SCOPE" | "REMEDIATION_REQUIRED" | "BLOCKED";
  readonly sha256Receipt: string;
  readonly durationMs: number;
}

const DEFAULT_POLICY_REL = path.join("docs", "governance", "iam-policies.default.json");

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Load least-privilege default pack shipped with the control plane. */
export function loadDefaultIamPolicyPack(projectRoot: string): readonly IamPolicyRule[] {
  const filePath = path.join(projectRoot, DEFAULT_POLICY_REL);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const list = Array.isArray(parsed) ? parsed : parsed?.policies;
    if (!Array.isArray(list)) return [];
    const out: IamPolicyRule[] = [];
    for (const item of list) {
      if (!isPlainRecord(item)) continue;
      if (typeof item.id !== "string" || typeof item.tenantId !== "string") continue;
      if (!Array.isArray(item.roles) || !Array.isArray(item.actions)) continue;
      const roles = item.roles.filter((role): role is string => typeof role === "string");
      const actions = item.actions.filter((action): action is string => typeof action === "string");
      if (roles.length === 0 || actions.length === 0) continue;
      out.push({
        id: item.id,
        tenantId: item.tenantId,
        roles,
        actions,
        ...(typeof item.resourcePrefix === "string" && item.resourcePrefix.length > 0
          ? { resourcePrefix: item.resourcePrefix }
          : {}),
      });
    }
    return deepFreeze(out);
  } catch {
    return [];
  }
}

const REQUIRED_FINE_PREFIXES = [
  "mcp/tools/eos_product_deliver_run",
  "mcp/tools/eos_product_foundry_create",
  "mcp/tools/eos_manage_worktree",
  "mcp/tools/eos_autonomous_heal",
] as const;

/** True when the pack is fine-grained (FR-936 / FR-944): required tools, no broad prefix. */
export function isLeastPrivilegeProductPolicyPack(policies: readonly IamPolicyRule[]): boolean {
  if (policies.length === 0) return false;
  const prefixes = new Set(policies.map((policy) => policy.resourcePrefix || ""));
  if (prefixes.has("mcp/tools/") || prefixes.has("mcp/tools")) return false;
  return REQUIRED_FINE_PREFIXES.every((required) => prefixes.has(required));
}

export function defaultFactoryPrincipal(): IamPrincipal {
  return deepFreeze({
    subjectId: "factory-dogfood",
    tenantId: "tenant-local",
    roles: ["engineer"],
  });
}

function resolvePolicies(projectRoot: string, override?: readonly IamPolicyRule[]): readonly IamPolicyRule[] {
  if (override) return override;
  const local = loadMcpIamPoliciesFromProject(projectRoot);
  if (local.length > 0) return local;
  return loadDefaultIamPolicyPack(projectRoot);
}

/**
 * Zero→product factory seal: IAM authorize product delivery, then orchestrate.
 * Defaults to dry-run. WITHIN_TESTED_SCOPE.
 */
export function runBigTechProductFactory(
  manifest: ProductManifest,
  options: BigTechFactoryOptions = {},
): BigTechFactoryResult {
  const t0 = performance.now();
  const projectRoot = options.projectRoot ?? process.cwd();
  const dryRun = options.dryRun !== false;
  const policies = resolvePolicies(projectRoot, options.policies);
  const principal = options.principal === undefined ? defaultFactoryPrincipal() : options.principal;

  const iamArgs: Record<string, unknown> = {
    write: dryRun ? false : true,
    dryRun,
    name: manifest.name,
  };
  // Force mutation detection for IAM even on dry-run authorize of the deliver tool:
  // factory always authorizes the deliver capability; materialization still respects dryRun.
  iamArgs.apply = true;

  const iam = evaluateMcpIamCallGate({
    toolName: "eos_product_deliver_run",
    args: iamArgs,
    meta: principal ? { iam: principal } : null,
    policies,
    defaultPrincipal: principal,
  });

  if (iam.required && !iam.allowed) {
    const sha256Receipt = crypto
      .createHash("sha256")
      .update(`FACTORY:IAM_DENIED:${manifest.id}:${iam.decision?.sha256Receipt || "none"}`)
      .digest("hex");
    return deepFreeze({
      status: "BLOCKED",
      reason: "IAM_DENIED",
      dryRun,
      iam,
      delivery: null,
      productId: manifest.id,
      epistemicState: "BLOCKED",
      sha256Receipt,
      durationMs: Number((performance.now() - t0).toFixed(3)),
    });
  }

  const delivery = EosProductDeliveryOrchestrator.deliverProduct(manifest, {
    ...options.delivery,
    dryRun,
    projectRoot,
    enforceGates: options.delivery?.enforceGates !== false,
  });

  let status: FactoryStatus = "SUCCESS";
  let reason: string | null = null;
  let epistemicState: BigTechFactoryResult["epistemicState"] = "BIGTECH_PRODUCT_FACTORY_WITHIN_TESTED_SCOPE";

  if (delivery.status === "FAILED") {
    status = "FAILED";
    reason = delivery.reason ?? "DELIVERY_FAILED";
    epistemicState = "REMEDIATION_REQUIRED";
  } else if (delivery.status === "BLOCKED") {
    status = "BLOCKED";
    reason = delivery.reason ?? "DELIVERY_BLOCKED";
    epistemicState = "BLOCKED";
  } else if (delivery.status !== "SUCCESS") {
    status = "FAILED";
    reason = delivery.reason ?? delivery.status;
    epistemicState = "REMEDIATION_REQUIRED";
  }

  const sha256Receipt = crypto
    .createHash("sha256")
    .update(
      `FACTORY:${manifest.id}:${status}:${iam.decision?.sha256Receipt || "NA"}:${delivery.sha256Receipt}:${dryRun}`,
    )
    .digest("hex");

  return deepFreeze({
    status,
    reason,
    dryRun,
    iam,
    delivery,
    productId: manifest.id,
    epistemicState,
    sha256Receipt,
    durationMs: Number((performance.now() - t0).toFixed(3)),
  });
}

export function writeBigTechFactoryReceipt(
  projectRoot: string,
  result: BigTechFactoryResult,
  outputRelPath: string = path.join("docs", "evidence", "BIGTECH_PRODUCT_FACTORY_RECEIPT.json"),
): string {
  const target = path.join(projectRoot, outputRelPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const payload = {
    epistemicState: result.epistemicState,
    generatedAt: new Date().toISOString(),
    status: result.status,
    reason: result.reason,
    dryRun: result.dryRun,
    productId: result.productId,
    iamCode: result.iam.decision?.code ?? "NOT_REQUIRED",
    iamReceipt: result.iam.decision?.sha256Receipt ?? null,
    deliveryStatus: result.delivery?.status ?? null,
    deliveryReceipt: result.delivery?.sha256Receipt ?? null,
    scorecardScore: result.delivery?.scorecard?.score ?? null,
    scorecardGrade: result.delivery?.scorecard?.grade ?? null,
    durationMs: result.durationMs,
    sha256Receipt: result.sha256Receipt,
  };
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return target;
}

export function buildDemoLedgerManifest(): ProductManifest {
  return deepFreeze({
    id: "demo-ledger-mvp",
    name: "Demo Ledger MVP",
    domain: "fintech-ledger",
    description: "Big Tech Product Factory dogfood ledger",
    tier: "MVP",
    platforms: ["distributed-backend", "web"],
    entities: ["LedgerEntry", "Account"],
    commands: ["PostEntry", "ReconcileBooks"],
    compliance: ["SLSA_4"],
  });
}
