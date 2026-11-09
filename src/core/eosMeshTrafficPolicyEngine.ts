/**
 * EOS SYSTEM — SERVICE MESH TRAFFIC POLICY ENGINE (Layer 0)
 * Governed by SPEC-169 (Envoy / Istio route + mTLS authz pattern)
 *
 * Implements:
 * - Ordered route matching (path prefix, method, header predicates)
 * - Per-route policy: mTLS requirement, caller allow-list, weights split
 * - Weighted destination routing (deterministic hash on caller identity)
 * - Deny-by-default authorization posture
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface RouteMatch {
  readonly pathPrefix?: string;
  readonly method?: string;
  readonly headerEquals?: Record<string, string>;
}

export interface DestinationWeight {
  readonly cluster: string;
  readonly weight: number; // 0-100, must sum to 100 per route
}

export interface RoutePolicy {
  readonly name: string;
  readonly match: RouteMatch;
  readonly requireMTLS: boolean;
  readonly allowedPrincipals: readonly string[]; // empty = any
  readonly destinations: readonly DestinationWeight[];
}

export interface IncomingRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly principal: string;
  readonly peerVerified: boolean; // mTLS handshake success
}

export type MeshRouteDecision =
  | { kind: "ROUTE"; route: string; cluster: string }
  | { kind: "DENY"; reason: "NO_MATCH" | "MTLS_REQUIRED" | "PRINCIPAL_FORBIDDEN"; detail: string };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class EosMeshTrafficPolicyEngine {
  private readonly routes: RoutePolicy[] = [];

  addRoute(policy: RoutePolicy): void {
    const total = policy.destinations.reduce((acc, d) => acc + d.weight, 0);
    assertPrecondition(total === 100, `route ${policy.name}: weights must sum to 100, got ${total}`);
    assertPrecondition(policy.destinations.length > 0, `route ${policy.name}: at least one destination required`);
    this.routes.push(deepFreeze(policy));
  }

  /**
   * First-match-wins route evaluation, then authorization gates, then
   * deterministic weighted cluster selection based on principal identity.
   */
  route(req: IncomingRequest): MeshRouteDecision {
    for (const r of this.routes) {
      if (!this.matches(r.match, req)) continue;

      if (r.requireMTLS && !req.peerVerified) {
        const deny: MeshRouteDecision = {
          kind: "DENY",
          reason: "MTLS_REQUIRED",
          detail: `route ${r.name} requires mTLS`,
        };
        return deepFreeze(deny);
      }
      if (r.allowedPrincipals.length > 0 && !r.allowedPrincipals.includes(req.principal)) {
        const deny: MeshRouteDecision = {
          kind: "DENY",
          reason: "PRINCIPAL_FORBIDDEN",
          detail: `${req.principal} not in allow-list of ${r.name}`,
        };
        return deepFreeze(deny);
      }

      // Deterministic weighted selection: same principal always lands on same cluster
      const bucket = hashStr(`${r.name}:${req.principal}`) % 100;
      let acc = 0;
      for (const d of r.destinations) {
        acc += d.weight;
        if (bucket < acc) {
          const route: MeshRouteDecision = { kind: "ROUTE", route: r.name, cluster: d.cluster };
          return deepFreeze(route);
        }
      }
      const fallback: MeshRouteDecision = {
        kind: "ROUTE",
        route: r.name,
        cluster: r.destinations[r.destinations.length - 1].cluster,
      };
      return deepFreeze(fallback);
    }
    const noMatch: MeshRouteDecision = {
      kind: "DENY",
      reason: "NO_MATCH",
      detail: `no route for ${req.method} ${req.path}`,
    };
    return deepFreeze(noMatch);
  }

  private matches(m: RouteMatch, req: IncomingRequest): boolean {
    if (m.pathPrefix !== undefined && !req.path.startsWith(m.pathPrefix)) return false;
    if (m.method !== undefined && m.method.toUpperCase() !== req.method.toUpperCase()) return false;
    if (m.headerEquals) {
      for (const [k, v] of Object.entries(m.headerEquals)) {
        if (req.headers[k] !== v) return false;
      }
    }
    return true;
  }

  listRoutes(): readonly string[] {
    return this.routes.map((r) => r.name);
  }

  policyDigest(): string {
    return pureSha256(
      JSON.stringify(this.routes.map((r) => [r.name, r.match, r.requireMTLS, r.allowedPrincipals, r.destinations])),
    );
  }
}
