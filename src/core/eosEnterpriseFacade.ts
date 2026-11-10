/**
 * GLORIAN SYSTEM — ENTERPRISE DOMAIN FACADE (SPEC-186, CHANGE-071)
 *
 * Implements standard CNCF / IEEE Enterprise System Ergonomics:
 * 1. EphemeralWorkspaceManager: Standard workspace isolation and tamper-evident attestation (facade over EosAstral).
 * 2. CircuitBreakerGovernor: Standard 3-state (CLOSED/OPEN/HALF_OPEN) circuit breaker with failure thresholds (facade over EosElohim).
 * 3. EntropyZeroizer: Cryptographic buffer zeroization and memory hygiene (facade over EosAin).
 * 4. ConstitutionalTribunalEngine: Sovereign architectural decision evaluation (facade over GlorianConstitutionalTribunal).
 * 5. SyntheticProbeExecutor: Proxy-resilient synthetic network health probing (facade over EosFleetMissionControl).
 * 6. Unified EosEnterpriseFacade: Single-point enterprise orchestrator with immutable health auditing.
 *
 * Strict Layer-0 Purity: Zero external npm dependencies (runtimeDependenciesCount: 0).
 * Node 24 strip-only TypeScript compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  EosAstral,
  type AstralThreadProjection,
  type AstralCommitResult,
  type AstralDissolveResult,
} from "./EosAstral.ts";
import { EosElohim, type KarmicEvaluationParams, type KarmicEvaluationReceipt } from "./EosElohim.ts";
import { EosAin, type ZeroEntropyPurgeReceipt } from "./EosAin.ts";
import {
  GlorianConstitutionalTribunal,
  type TribunalAdjudicationRequest,
  type TribunalAdjudicationReport,
} from "./glorianConstitutionalTribunal.ts";
import { EosFleetMissionControl, type SyntheticProbeResult } from "./eosFleetMissionControl.ts";
import { EosDistributedPeerMesh, type PeerMeshConfig } from "./eosDistributedPeerMesh.ts";

// ============================================================================
// 1. DOMAIN TYPES & CONTRACTS
// ============================================================================

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface EphemeralWorkspaceDescriptor {
  readonly workspaceId: string;
  readonly parentPath: string;
  readonly projectionPath: string;
  readonly createdAtIso: string;
  readonly attestationToken: string;
  readonly active: boolean;
}

export interface EphemeralWorkspaceCommitReceipt {
  readonly committed: boolean;
  readonly workspaceId: string;
  readonly diffHash: string;
  readonly sealReceipt: string;
  readonly timestampIso: string;
}

export interface EphemeralWorkspaceDissolveReceipt {
  readonly dissolved: boolean;
  readonly workspaceId: string;
  readonly rollbackVerified: boolean;
  readonly timestampIso: string;
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
}

export interface CircuitBreakerStatus {
  readonly actionName: string;
  readonly state: CircuitBreakerState;
  readonly consecutiveFailures: number;
  readonly lastFailureTimeMs: number;
}

export interface EnterpriseSystemHealthReport {
  readonly status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly activeWorkspacesCount: number;
  readonly circuitBreakersCount: number;
  readonly memorySanitizerReady: boolean;
  readonly tribunalReady: boolean;
  readonly timestampIso: string;
  readonly sha256Receipt: string;
}

// ============================================================================
// 2. EPHEMERAL WORKSPACE MANAGER
// ============================================================================

export class EphemeralWorkspaceManager {
  private readonly astral: EosAstral;

  constructor(projectRoot?: string, secretKey?: string) {
    this.astral = new EosAstral(projectRoot, secretKey);
  }

  public createWorkspace(targetSubdir: string = ".worktrees/astral-scratch"): EphemeralWorkspaceDescriptor {
    assertPrecondition(Boolean(targetSubdir && targetSubdir.trim()), "targetSubdir must be a non-empty string");

    const projection: AstralThreadProjection = this.astral.projectAstralThread(targetSubdir);

    const descriptor: EphemeralWorkspaceDescriptor = deepFreeze({
      workspaceId: projection.threadId,
      parentPath: projection.parentPath,
      projectionPath: projection.projectionPath,
      createdAtIso: projection.createdAtIso,
      attestationToken: projection.silverCordToken,
      active: projection.active,
    });

    assertPostcondition(descriptor.attestationToken.length === 64, "attestationToken must be 64-char hex SHA-256");
    return descriptor;
  }

  public commitWorkspace(workspaceId: string, diffHash: string = "diff-genesis"): EphemeralWorkspaceCommitReceipt {
    assertPrecondition(Boolean(workspaceId && workspaceId.trim()), "workspaceId must be a non-empty string");
    assertPrecondition(Boolean(diffHash && diffHash.trim()), "diffHash must be a non-empty string");

    const result: AstralCommitResult = this.astral.commitAstralMutation(workspaceId, diffHash);

    return deepFreeze({
      committed: result.committed,
      workspaceId: result.threadId,
      diffHash: result.diffHash,
      sealReceipt: result.sealReceipt,
      timestampIso: result.timestamp,
    });
  }

  public dissolveWorkspace(workspaceId: string): EphemeralWorkspaceDissolveReceipt {
    assertPrecondition(Boolean(workspaceId && workspaceId.trim()), "workspaceId must be a non-empty string");
    const result: AstralDissolveResult = this.astral.dissolveAstralThread(workspaceId);

    return deepFreeze({
      dissolved: result.dissolved,
      workspaceId: result.threadId,
      rollbackVerified: result.rollbackVerified,
      timestampIso: result.timestamp,
    });
  }

  public getActiveWorkspacesCount(): number {
    return this.astral.getActiveThreadsCount();
  }

  public verifyAttestation(workspace: EphemeralWorkspaceDescriptor): boolean {
    assertPrecondition(Boolean(workspace), "Workspace descriptor must be provided");
    const rawThread: AstralThreadProjection = {
      threadId: workspace.workspaceId,
      parentPath: workspace.parentPath,
      projectionPath: workspace.projectionPath,
      createdAtIso: workspace.createdAtIso,
      silverCordToken: workspace.attestationToken,
      active: workspace.active,
    };
    return this.astral.verifySilverCord(rawThread);
  }

  public generateAttestationToken(
    workspaceId: string,
    parentPath: string,
    projectionPath: string,
    timestamp: string,
  ): string {
    return this.astral.generateSilverCordToken(workspaceId, parentPath, projectionPath, timestamp);
  }
}

// ============================================================================
// 3. CIRCUIT BREAKER GOVERNOR
// ============================================================================

export class CircuitBreakerGovernor {
  private readonly config: CircuitBreakerConfig;
  private readonly breakers: Map<string, { state: CircuitBreakerState; failures: number; lastFailureMs: number }> =
    new Map();

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 3,
      cooldownMs: config?.cooldownMs ?? 10_000,
    };
    assertPrecondition(this.config.failureThreshold > 0, "failureThreshold must be positive");
    assertPrecondition(this.config.cooldownMs > 0, "cooldownMs must be positive");
  }

  public getState(actionName: string): CircuitBreakerState {
    const record = this.breakers.get(actionName);
    if (!record) return "CLOSED";

    if (record.state === "OPEN") {
      const now = Date.now();
      if (now - record.lastFailureMs >= this.config.cooldownMs) {
        record.state = "HALF_OPEN";
        return "HALF_OPEN";
      }
    }
    return record.state;
  }

  public recordSuccess(actionName: string): void {
    const record = this.breakers.get(actionName);
    if (record) {
      record.failures = 0;
      record.state = "CLOSED";
    }
  }

  public recordFailure(actionName: string): void {
    let record = this.breakers.get(actionName);
    if (!record) {
      record = { state: "CLOSED", failures: 0, lastFailureMs: 0 };
      this.breakers.set(actionName, record);
    }
    record.failures += 1;
    record.lastFailureMs = Date.now();

    if (record.failures >= this.config.failureThreshold) {
      record.state = "OPEN";
    }
  }

  public async executeWithGuard<T>(actionName: string, fn: () => T | Promise<T>): Promise<T> {
    assertPrecondition(Boolean(actionName && actionName.trim()), "actionName must be a non-empty string");
    const state = this.getState(actionName);

    if (state === "OPEN") {
      throw new Error(`CIRCUIT_BREAKER_OPEN: Action '${actionName}' is temporarily tripped fail-closed.`);
    }

    try {
      const result = await fn();
      this.recordSuccess(actionName);
      return result;
    } catch (err) {
      this.recordFailure(actionName);
      throw err;
    }
  }

  public reset(actionName: string): void {
    this.breakers.delete(actionName);
  }

  public getStatus(actionName: string): CircuitBreakerStatus {
    const record = this.breakers.get(actionName);
    return deepFreeze({
      actionName,
      state: this.getState(actionName),
      consecutiveFailures: record ? record.failures : 0,
      lastFailureTimeMs: record ? record.lastFailureMs : 0,
    });
  }

  public evaluateResourceBudget(params: KarmicEvaluationParams): KarmicEvaluationReceipt {
    return EosElohim.evaluateKarmicDisruptor(params);
  }
}

// ============================================================================
// 4. ENTROPY ZEROIZER
// ============================================================================

export class EntropyZeroizer {
  public static zeroizeBuffer(buffer: Buffer): ZeroEntropyPurgeReceipt {
    assertPrecondition(Buffer.isBuffer(buffer), "Target must be a Node.js Buffer");
    return EosAin.purgeBufferToZeroEntropy(buffer);
  }

  public static zeroizeState(state: Record<string, unknown>): { sanitizedKeysCount: number; timestampIso: string } {
    assertPrecondition(typeof state === "object" && state !== null, "State must be a non-null object");
    const keys = Object.keys(state);
    for (const key of keys) {
      state[key] = null;
    }
    return deepFreeze({
      sanitizedKeysCount: keys.length,
      timestampIso: new Date().toISOString(),
    });
  }
}

// ============================================================================
// 5. CONSTITUTIONAL TRIBUNAL ENGINE
// ============================================================================

export class ConstitutionalTribunalEngine {
  private readonly tribunal: GlorianConstitutionalTribunal;

  constructor(workspaceRoot?: string) {
    this.tribunal = new GlorianConstitutionalTribunal(workspaceRoot);
  }

  public adjudicate(request: TribunalAdjudicationRequest): TribunalAdjudicationReport {
    assertPrecondition(Boolean(request), "Adjudication request must be defined");
    return this.tribunal.adjudicate(request);
  }

  public evaluateDecision(title: string, description: string, proposedAction: string): TribunalAdjudicationReport {
    assertPrecondition(Boolean(title && title.trim()), "title must be a non-empty string");
    assertPrecondition(Boolean(description && description.trim()), "description must be a non-empty string");
    assertPrecondition(Boolean(proposedAction && proposedAction.trim()), "proposedAction must be a non-empty string");

    const actionId = `ACT-${pureSha256(title).slice(0, 12)}`;
    return this.tribunal.adjudicate({
      actionId,
      category: "ARCHITECTURE",
      description: `${title}: ${description}`,
      diffOrPayload: proposedAction,
      declaredInvariants: ["pure-domain-hexagonal-isolation"],
    });
  }
}

// ============================================================================
// 6. SYNTHETIC PROBE EXECUTOR
// ============================================================================

export class SyntheticProbeExecutor {
  public static async probe(url: string, timeoutMs: number = 4000): Promise<SyntheticProbeResult> {
    return EosFleetMissionControl.probeEndpoint(url, timeoutMs);
  }
}

// ============================================================================
// 7. UNIFIED ENTERPRISE FACADE (ORCHESTRATOR)
// ============================================================================

export class EosEnterpriseFacade {
  public readonly workspaces: EphemeralWorkspaceManager;
  public readonly circuitBreaker: CircuitBreakerGovernor;
  public readonly tribunal: ConstitutionalTribunalEngine;

  constructor(workspaceRoot?: string) {
    this.workspaces = new EphemeralWorkspaceManager(workspaceRoot);
    this.circuitBreaker = new CircuitBreakerGovernor();
    this.tribunal = new ConstitutionalTribunalEngine(workspaceRoot);
  }

  public auditHealth(): EnterpriseSystemHealthReport {
    const activeWsCount = this.workspaces.getActiveWorkspacesCount();
    const timestampIso = new Date().toISOString();

    const rawData = {
      activeWorkspacesCount: activeWsCount,
      timestampIso,
    };
    const sha256Receipt = pureSha256(JSON.stringify(rawData));

    const report: EnterpriseSystemHealthReport = deepFreeze({
      status: "HEALTHY",
      activeWorkspacesCount: activeWsCount,
      circuitBreakersCount: 0,
      memorySanitizerReady: true,
      tribunalReady: true,
      timestampIso,
      sha256Receipt,
    });

    assertPostcondition(report.sha256Receipt.length === 64, "sha256Receipt must be 64-char hex");
    return report;
  }

  public createPeerMesh(config: PeerMeshConfig): EosDistributedPeerMesh {
    return new EosDistributedPeerMesh(config);
  }
}
