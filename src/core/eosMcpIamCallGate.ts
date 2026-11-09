/**
 * MCP Runtime IAM Call Gate (Layer-0) — SPEC-184 FR-931..FR-934
 *
 * Fail-closed authorization for mutating MCP tools/call requests.
 * WITHIN_TESTED_SCOPE — software ABAC at the dispatch boundary; not OIDC/SSO.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import {
  evaluateIamAccess,
  type IamDecision,
  type IamPolicyRule,
  type IamPrincipal,
} from "./eosMultiTenantIamFoundation.ts";
import { deepFreeze } from "./eosKernelPrimitives.ts";

/** JSON-RPC server error reserved for Glorian IAM deny at tools/call. */
export const MCP_IAM_DENIED_RPC_CODE = -32030;

export const MCP_IAM_ACTION = "mcp.tools.call";

/**
 * Tools that can mutate workspace state when an explicit write flag is set.
 * Kept in sync with `MUTATION_CAPABLE_TOOLS` in eosMcpToolCatalog.ts.
 */
export const MCP_MUTATION_CAPABLE_TOOLS: ReadonlySet<string> = new Set([
  "eos_autonomous_heal",
  "eos_manage_worktree",
  "eos_reconcile_state",
  "eos_spotify_scaffold",
  "eos_spotify_fleetshift_batch",
  "eos_fleet_elevate",
  "eos_universal_scaffold",
  "eos_apex_autonomous_heal",
  "eos_hnsw_index_add",
  "eos_product_foundry_create",
  "eos_product_deliver_run",
  "eos_sqlite_ledger",
  "eos_gentleman_update",
  "eos_enterprise_workspace",
  "eos_evolve_module",
  "eos_agent_topology_mesh",
  "eos_surgical_healing",
  "eos_sapfix_autoshipper",
  "eos_content_addressable_cache",
  "eos_chaos_monkey_live",
  "eos_fleet_registry_sync",
]);

const WRITE_TRUE_KEYS = ["apply", "write", "applyToDisk", "applyChanges", "autoApply"] as const;

export interface McpIamGateInput {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly meta?: Record<string, unknown> | null;
  readonly policies: readonly IamPolicyRule[];
  readonly defaultPrincipal?: IamPrincipal | null;
}

export interface McpIamGateResult {
  readonly required: boolean;
  readonly allowed: boolean;
  readonly decision: IamDecision | null;
  readonly principal: IamPrincipal | null;
  readonly resourceId: string | null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** True when the call is mutation-capable and an explicit write flag is set. */
export function mcpToolRequestsMutation(toolName: string, args: Record<string, unknown>): boolean {
  if (!MCP_MUTATION_CAPABLE_TOOLS.has(toolName)) return false;
  for (const key of WRITE_TRUE_KEYS) {
    if (args[key] === true) return true;
  }
  return args.dryRun === false;
}

function parsePrincipal(value: unknown): IamPrincipal | null {
  if (!isPlainRecord(value)) return null;
  const subjectId = typeof value.subjectId === "string" ? value.subjectId : "";
  const tenantId = typeof value.tenantId === "string" ? value.tenantId : "";
  if (!Array.isArray(value.roles)) return null;
  const roles = value.roles.filter((role): role is string => typeof role === "string");
  if (roles.length !== value.roles.length) return null;
  return { subjectId, tenantId, roles };
}

/**
 * Resolve the caller principal: args._eosIam → params._meta.iam → defaultPrincipal.
 * `_eosIam` is an envelope field and must be stripped before tool dispatch.
 */
export function resolveMcpIamPrincipal(
  args: Record<string, unknown>,
  meta: Record<string, unknown> | null | undefined,
  defaultPrincipal?: IamPrincipal | null,
): IamPrincipal | null {
  return parsePrincipal(args._eosIam) || parsePrincipal(meta?.iam) || defaultPrincipal || null;
}

export function stripMcpIamEnvelope(args: Record<string, unknown>): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(args, "_eosIam")) return args;
  const { _eosIam: _ignored, ...rest } = args;
  return rest;
}

/**
 * Evaluate whether a tools/call may proceed. Read-only and plan-only calls
 * return required=false. Mutating writes always produce an IAM decision.
 */
export function evaluateMcpIamCallGate(input: McpIamGateInput): McpIamGateResult {
  const toolName = String(input.toolName || "").trim();
  const args = input.args || {};

  if (!mcpToolRequestsMutation(toolName, args)) {
    return deepFreeze({
      required: false,
      allowed: true,
      decision: null,
      principal: null,
      resourceId: null,
    });
  }

  const resourceId = `mcp/tools/${toolName}`;
  const principal = resolveMcpIamPrincipal(args, input.meta, input.defaultPrincipal);

  if (!principal) {
    const decision = evaluateIamAccess(
      {
        principal: { subjectId: "", tenantId: "", roles: [] },
        action: MCP_IAM_ACTION,
        resource: { resourceId, tenantId: "unknown" },
      },
      input.policies,
    );
    return deepFreeze({
      required: true,
      allowed: false,
      decision,
      principal: null,
      resourceId,
    });
  }

  const decision = evaluateIamAccess(
    {
      principal,
      action: MCP_IAM_ACTION,
      resource: { resourceId, tenantId: principal.tenantId },
    },
    input.policies,
  );

  return deepFreeze({
    required: true,
    allowed: decision.ok && decision.code === "ALLOW",
    decision,
    principal,
    resourceId,
  });
}

export function mcpIamDeniedRpcError(
  decision: IamDecision,
  toolName: string,
): {
  code: number;
  message: string;
  data: Record<string, unknown>;
} {
  return {
    code: MCP_IAM_DENIED_RPC_CODE,
    message: `IAM denied: ${decision.code}`,
    data: {
      code: decision.code,
      reason: decision.reason,
      toolName,
      sha256Receipt: decision.sha256Receipt,
      matchedPolicyId: decision.matchedPolicyId,
    },
  };
}

export type McpIamAuthorization =
  | {
      readonly ok: true;
      readonly dispatchArgs: Record<string, unknown>;
      readonly iamRequired: boolean;
      readonly iamCode: string;
    }
  | {
      readonly ok: false;
      readonly error: { code: number; message: string; data: Record<string, unknown> };
    };

/** Single entry for EosMcpServer tools/call: deny or return stripped dispatch args. */
export function authorizeMcpToolsCall(input: McpIamGateInput): McpIamAuthorization {
  const gate = evaluateMcpIamCallGate(input);
  if (gate.required && (!gate.allowed || !gate.decision)) {
    return deepFreeze({
      ok: false,
      error: mcpIamDeniedRpcError(
        gate.decision || {
          ok: false,
          code: "DENY_INVALID_INPUT",
          reason: "IAM decision missing.",
          matchedPolicyId: null,
          sha256Receipt: "0".repeat(64),
        },
        input.toolName,
      ),
    });
  }
  return deepFreeze({
    ok: true,
    dispatchArgs: stripMcpIamEnvelope(input.args || {}),
    iamRequired: gate.required,
    iamCode: gate.decision?.code || "NOT_REQUIRED",
  });
}

function parsePolicyList(value: unknown): IamPolicyRule[] {
  if (!Array.isArray(value)) return [];
  const out: IamPolicyRule[] = [];
  for (const item of value) {
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
  return out;
}

/** Load tenant policies from `.eos/iam-policies.json` when present; else empty (deny). */
export function loadMcpIamPoliciesFromProject(projectRoot: string): readonly IamPolicyRule[] {
  const filePath = path.join(projectRoot, ".eos", "iam-policies.json");
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const list = Array.isArray(parsed) ? parsed : parsed?.policies;
    return deepFreeze(parsePolicyList(list));
  } catch {
    return [];
  }
}

/** Optional default principal from EOS_MCP_IAM_PRINCIPAL_JSON (local dogfood only). */
export function loadMcpIamPrincipalFromEnv(env: NodeJS.ProcessEnv = process.env): IamPrincipal | null {
  const raw = env.EOS_MCP_IAM_PRINCIPAL_JSON;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  try {
    return parsePrincipal(JSON.parse(raw));
  } catch {
    return null;
  }
}
