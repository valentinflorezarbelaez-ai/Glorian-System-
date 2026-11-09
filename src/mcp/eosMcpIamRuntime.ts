/**
 * MCP IAM runtime state (policies, default principal, break-glass).
 * Extracted from EosMcpServer to keep the size ratchet under ceiling.
 */

import {
  authorizeMcpToolsCall,
  loadMcpIamPoliciesFromProject,
  loadMcpIamPrincipalFromEnv,
  type McpIamAuthorization,
} from "../core/eosMcpIamCallGate.ts";
import { loadBreakGlassGrantFromProject, type BreakGlassGrant } from "../core/eosIamBreakGlass.ts";
import type { IamPolicyRule, IamPrincipal } from "../core/eosMultiTenantIamFoundation.ts";

export class EosMcpIamRuntime {
  private policies: readonly IamPolicyRule[] = [];
  private defaultPrincipal: IamPrincipal | null = null;
  private breakGlassGrant: BreakGlassGrant | null = null;

  constructor(projectRoot: string) {
    this.policies = loadMcpIamPoliciesFromProject(projectRoot);
    this.defaultPrincipal = loadMcpIamPrincipalFromEnv();
    this.breakGlassGrant = loadBreakGlassGrantFromProject(projectRoot);
  }

  configurePolicies(policies: readonly IamPolicyRule[]): void {
    this.policies = policies.slice();
  }

  configureDefaultPrincipal(principal: IamPrincipal | null): void {
    this.defaultPrincipal = principal;
  }

  configureBreakGlassGrant(grant: BreakGlassGrant | null): void {
    this.breakGlassGrant = grant;
  }

  authorizeToolsCall(input: {
    readonly toolName: string;
    readonly args: Record<string, unknown>;
    readonly meta?: Record<string, unknown> | null;
  }): McpIamAuthorization {
    return authorizeMcpToolsCall({
      toolName: input.toolName,
      args: input.args,
      meta: input.meta,
      policies: this.policies,
      defaultPrincipal: this.defaultPrincipal,
      breakGlassGrant: this.breakGlassGrant,
    });
  }
}
