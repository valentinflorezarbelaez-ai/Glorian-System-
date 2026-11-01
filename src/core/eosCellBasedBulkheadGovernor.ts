/**
 * EOS SYSTEM — LAYER-0 DISTRIBUTED CELL-BASED BULKHEAD GOVERNOR (SPEC-109)
 *
 * Implements AWS Cell-Based Architecture & Meta Bulkhead Fault Domain Isolation.
 * Segments fleet workloads into autonomous, hermetically isolated cells,
 * guaranteeing bounded blast radius (<= 1/N), SHA-256 poison pill quarantine,
 * and health-aware dynamic failover draining.
 *
 * Governed by SPEC-109, PLAN-109, ADR-109.
 * 100% Layer 0 Purity — zero external runtime npm dependencies.
 */

import crypto from "node:crypto";

export type CellHealthStatus = "HEALTHY" | "DEGRADED" | "DRAINING" | "QUARANTINED";

export interface CellMetrics {
  readonly cellId: number;
  readonly name: string;
  readonly capacity: number;
  readonly inFlight: number;
  readonly totalAdmitted: number;
  readonly totalRejected: number;
  readonly totalFailures: number;
  readonly consecutiveFailures: number;
  readonly status: CellHealthStatus;
}

export interface RouteDecision {
  readonly cellId: number;
  readonly admitted: boolean;
  readonly isRerouted: boolean;
  readonly originalCellId?: number;
  readonly reason?: string;
  readonly quarantineSignature?: string;
  readonly executionToken?: string;
}

export interface GovernorConfig {
  readonly cellCount?: number;           // Default: 8 cells
  readonly cellCapacity?: number;        // Default: 100 concurrent requests per cell
  readonly maxConsecutiveFails?: number; // Default: 3 failures before poison pill quarantine
  readonly drainHeadroomRatio?: number;  // Default: 0.8 (target must be <= 80% full to absorb reroute)
}

export interface BulkheadFleetStatus {
  readonly totalCells: number;
  readonly healthyCells: number;
  readonly maxBlastRadiusPct: number;    // 100 / totalCells
  readonly totalAdmitted: number;
  readonly totalRejected: number;
  readonly totalQuarantinedSignatures: number;
  readonly cells: readonly CellMetrics[];
  readonly sha256Receipt: string;
}

interface MutableCell {
  cellId: number;
  name: string;
  capacity: number;
  inFlight: number;
  totalAdmitted: number;
  totalRejected: number;
  totalFailures: number;
  consecutiveFailures: number;
  status: CellHealthStatus;
}

export class EosCellBasedBulkheadGovernor {
  private readonly cellCount: number;
  private readonly cellCapacity: number;
  private readonly maxConsecutiveFails: number;
  private readonly drainHeadroomRatio: number;

  private readonly cells: MutableCell[] = [];
  private readonly quarantinedSignatures = new Set<string>();
  private readonly payloadFailureCounts = new Map<string, number>();

  private totalAdmitted = 0;
  private totalRejected = 0;

  constructor(config: GovernorConfig = {}) {
    this.cellCount = Math.max(2, config.cellCount ?? 8);
    this.cellCapacity = Math.max(1, config.cellCapacity ?? 100);
    this.maxConsecutiveFails = Math.max(2, config.maxConsecutiveFails ?? 3);
    this.drainHeadroomRatio = Math.min(0.95, Math.max(0.1, config.drainHeadroomRatio ?? 0.8));

    for (let i = 0; i < this.cellCount; i++) {
      this.cells.push({
        cellId: i,
        name: `cell-${i.toString().padStart(2, "0")}`,
        capacity: this.cellCapacity,
        inFlight: 0,
        totalAdmitted: 0,
        totalRejected: 0,
        totalFailures: 0,
        consecutiveFailures: 0,
        status: "HEALTHY"
      });
    }
  }

  /**
   * Computes a 32-bit FNV-1a hash of the partition key for deterministic O(1) sharding.
   */
  public static computeFnv1a32(key: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * Computes SHA-256 fingerprint for poison pill detection.
   */
  public static computePayloadSignature(payload: unknown): string {
    if (payload === undefined || payload === null) {
      return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // Empty hash
    }
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Routes an incoming request to an autonomous cell using consistent partition hashing,
   * evaluating poison pill quarantine, cell health status, and failover headroom.
   */
  public route(partitionKey: string, payload?: unknown): RouteDecision {
    const signature = EosCellBasedBulkheadGovernor.computePayloadSignature(payload);

    // Step 1: Poison Pill Immunity Check
    if (this.quarantinedSignatures.has(signature)) {
      this.totalRejected++;
      return {
        cellId: -1,
        admitted: false,
        isRerouted: false,
        reason: "REJECTED_POISON_PILL: Payload matches quarantined toxic signature",
        quarantineSignature: signature
      };
    }

    // Step 2: Deterministic Cell Mapping via FNV-1a 32-bit consistent hash
    const hash = EosCellBasedBulkheadGovernor.computeFnv1a32(partitionKey);
    const primaryCellId = hash % this.cellCount;
    const primaryCell = this.cells[primaryCellId];

    // Step 3: Admission into Primary Cell if HEALTHY and has capacity
    if (primaryCell.status === "HEALTHY" && primaryCell.inFlight < primaryCell.capacity) {
      primaryCell.inFlight++;
      primaryCell.totalAdmitted++;
      this.totalAdmitted++;
      const executionToken = `${primaryCell.name}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`;
      return {
        cellId: primaryCellId,
        admitted: true,
        isRerouted: false,
        executionToken
      };
    }

    // Step 4: Health-Aware Failover Rerouting to adjacent warm cell
    // Search adjacent cells in ring order that are HEALTHY and below the drainHeadroomRatio
    const maxAllowedInFlight = Math.floor(this.cellCapacity * this.drainHeadroomRatio);
    for (let offset = 1; offset < this.cellCount; offset++) {
      const candidateId = (primaryCellId + offset) % this.cellCount;
      const candidateCell = this.cells[candidateId];

      if (candidateCell.status === "HEALTHY" && candidateCell.inFlight < maxAllowedInFlight) {
        candidateCell.inFlight++;
        candidateCell.totalAdmitted++;
        this.totalAdmitted++;
        const executionToken = `${candidateCell.name}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`;
        return {
          cellId: candidateId,
          admitted: true,
          isRerouted: true,
          originalCellId: primaryCellId,
          reason: `REROUTED_FAILOVER: Primary cell-${primaryCellId.toString().padStart(2, "0")} is ${primaryCell.status} or saturated`,
          executionToken
        };
      }
    }

    // Step 5: System Overload Shedding (Protective Bulkhead)
    primaryCell.totalRejected++;
    this.totalRejected++;
    return {
      cellId: primaryCellId,
      admitted: false,
      isRerouted: false,
      reason: "SHED_LOAD_OVERLOAD: All target and failover cells have reached capacity limits"
    };
  }

  /**
   * Records a successful execution in the specified cell, updating health metrics.
   */
  public recordSuccess(cellId: number): void {
    const cell = this.cells[cellId];
    if (!cell) return;

    if (cell.inFlight > 0) {
      cell.inFlight--;
    }
    cell.consecutiveFailures = 0;

    // Self-heal: recover DEGRADED cells if healthy responses resume
    if (cell.status === "DEGRADED") {
      cell.status = "HEALTHY";
    }
  }

  /**
   * Records a failed execution in the specified cell.
   * If repeated consecutive failures occur on the same payload, triggers global poison pill quarantine.
   */
  public recordFailure(cellId: number, payload?: unknown): { quarantined: boolean; signature?: string } {
    const cell = this.cells[cellId];
    if (!cell) return { quarantined: false };

    if (cell.inFlight > 0) {
      cell.inFlight--;
    }
    cell.totalFailures++;
    cell.consecutiveFailures++;

    if (cell.consecutiveFailures >= this.maxConsecutiveFails && cell.status === "HEALTHY") {
      cell.status = "DEGRADED";
    }

    // Check payload toxicity
    if (payload !== undefined && payload !== null) {
      const sig = EosCellBasedBulkheadGovernor.computePayloadSignature(payload);
      const fails = (this.payloadFailureCounts.get(sig) ?? 0) + 1;
      this.payloadFailureCounts.set(sig, fails);

      if (fails >= this.maxConsecutiveFails) {
        this.quarantinedSignatures.add(sig);
        return { quarantined: true, signature: sig };
      }
    }

    return { quarantined: false };
  }

  /**
   * Sets cell operational status (e.g. for maintenance draining or chaos testing).
   */
  public setCellStatus(cellId: number, status: CellHealthStatus): boolean {
    const cell = this.cells[cellId];
    if (!cell) return false;
    cell.status = status;
    return true;
  }

  /**
   * Checks if a payload signature is already in the immune quarantine ledger.
   */
  public isQuarantined(payload: unknown): boolean {
    const sig = EosCellBasedBulkheadGovernor.computePayloadSignature(payload);
    return this.quarantinedSignatures.has(sig);
  }

  /**
   * Clears the poison pill quarantine ledger.
   */
  public clearQuarantine(): void {
    this.quarantinedSignatures.clear();
    this.payloadFailureCounts.clear();
  }

  /**
   * Returns complete metrics, blast radius guarantees, and cryptographic proof of bulkhead status.
   */
  public getMetrics(): BulkheadFleetStatus {
    const healthyCount = this.cells.filter((c) => c.status === "HEALTHY").length;
    const maxBlastRadiusPct = Number((100 / this.cellCount).toFixed(2));

    const snapshot = {
      totalCells: this.cellCount,
      healthyCells: healthyCount,
      maxBlastRadiusPct,
      totalAdmitted: this.totalAdmitted,
      totalRejected: this.totalRejected,
      totalQuarantinedSignatures: this.quarantinedSignatures.size,
      cells: this.cells.map((c) => ({
        cellId: c.cellId,
        name: c.name,
        capacity: c.capacity,
        inFlight: c.inFlight,
        totalAdmitted: c.totalAdmitted,
        totalRejected: c.totalRejected,
        totalFailures: c.totalFailures,
        consecutiveFailures: c.consecutiveFailures,
        status: c.status
      }))
    };

    const receipt = crypto
      .createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");

    return Object.freeze({
      ...snapshot,
      sha256Receipt: receipt
    });
  }
}
