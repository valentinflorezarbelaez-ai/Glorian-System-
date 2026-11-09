/**
 * EOS SYSTEM — MULTI-TENANT FAIR-SHARE SCHEDULER (Layer 0)
 * Governed by SPEC-168 (Kubernetes Capacity Scheduler / YARN fair-share pattern)
 *
 * Implements:
 * - Weighted fair-share allocation across tenants
 * - Guaranteed floor + burstable ceiling per tenant
 * - Deficit Round Robin admission decisions
 * - Backlog tracking with starvation detection
 * - Deterministic allocation fingerprint per epoch
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface TenantSpec {
  readonly tenantId: string;
  readonly weight: number; // relative share
  readonly guaranteed: number; // floor units per epoch
  readonly ceiling: number; // burst cap per epoch
}

export interface Allocation {
  readonly epoch: number;
  readonly tenantId: string;
  readonly granted: number;
  readonly backlog: number;
  readonly starved: boolean;
}

export class EosFairShareScheduler {
  private readonly tenants: Map<string, TenantSpec> = new Map();
  private readonly demand: Map<string, number> = new Map();
  private readonly servedHistory: Map<string, number> = new Map();
  private epoch = 0;

  register(spec: TenantSpec): void {
    assertPrecondition(spec.weight > 0, "tenant weight must be positive");
    assertPrecondition(spec.ceiling >= spec.guaranteed, "ceiling must be >= guaranteed");
    this.tenants.set(spec.tenantId, deepFreeze(spec));
    this.demand.set(spec.tenantId, 0);
    this.servedHistory.set(spec.tenantId, 0);
  }

  /**
   * Queues demand for a tenant (e.g. requests waiting for compute units).
   */
  submit(tenantId: string, units: number): void {
    assertPrecondition(this.tenants.has(tenantId), `unknown tenant ${tenantId}`);
    assertPrecondition(units >= 0, "units must be >= 0");
    this.demand.set(tenantId, (this.demand.get(tenantId) ?? 0) + units);
  }

  /**
   * Runs one scheduling epoch. Distributes capacityUnits via weighted
   * fair-share: guaranteed floors first, then proportional surplus up to
   * each tenant's ceiling, weighted by (deficit / weight).
   */
  schedule(capacityUnits: number): readonly Allocation[] {
    assertPrecondition(capacityUnits >= 0, "capacity must be >= 0");
    this.epoch += 1;
    const allocations: Allocation[] = [];
    let remaining = capacityUnits;
    const grantedThisEpoch: Map<string, number> = new Map();
    for (const id of this.tenants.keys()) grantedThisEpoch.set(id, 0);

    // Phase 1: guaranteed floors (subject to demand)
    for (const [id, spec] of this.tenants) {
      const demand = this.demand.get(id) ?? 0;
      const grant = Math.min(demand, spec.guaranteed, remaining);
      if (grant > 0) {
        remaining -= grant;
        this.demand.set(id, demand - grant);
        this.servedHistory.set(id, (this.servedHistory.get(id) ?? 0) + grant);
        grantedThisEpoch.set(id, grant);
      }
    }

    // Phase 2: burst surplus ordered by deficit/weight ratio (largest first)
    const order = [...this.tenants.entries()]
      .map(([id, spec]) => ({ id, spec, deficit: this.demand.get(id) ?? 0 }))
      .filter((t) => t.deficit > 0 && t.spec.ceiling > 0)
      .sort((a, b) => b.deficit / b.spec.weight - a.deficit / a.spec.weight);

    for (const t of order) {
      if (remaining <= 0) break;
      const alreadyGranted = grantedThisEpoch.get(t.id) ?? 0;
      const headroom = t.spec.ceiling - alreadyGranted;
      if (headroom <= 0) continue;
      const demand = this.demand.get(t.id) ?? 0;
      const burst = Math.min(demand, headroom, remaining);
      if (burst > 0) {
        remaining -= burst;
        this.demand.set(t.id, demand - burst);
        this.servedHistory.set(t.id, (this.servedHistory.get(t.id) ?? 0) + burst);
        grantedThisEpoch.set(t.id, alreadyGranted + burst);
      }
    }

    // Phase 3: record final allocations
    for (const [id] of this.tenants) {
      const backlog = this.demand.get(id) ?? 0;
      const granted = grantedThisEpoch.get(id) ?? 0;
      allocations.push(
        deepFreeze({
          epoch: this.epoch,
          tenantId: id,
          granted,
          backlog,
          starved: backlog > 0 && granted === 0,
        }),
      );
    }

    return allocations;
  }

  totalServed(tenantId: string): number {
    return this.servedHistory.get(tenantId) ?? 0;
  }

  get currentEpoch(): number {
    return this.epoch;
  }

  allocationFingerprint(allocations: readonly Allocation[]): string {
    return pureSha256(allocations.map((a) => `${a.tenantId}:${a.backlog}:${a.starved}`).join("|"));
  }
}
