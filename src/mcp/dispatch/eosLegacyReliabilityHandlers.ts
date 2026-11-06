/**
 * Legacy MCP dispatch handlers: reliability, canary, SLO and remediation control loops.
 * SPEC-155: tools already served by EosMcpDispatchRegistry must not be duplicated here.
 */
import type { EosLegacyToolHandler } from "./eosLegacyDispatchContext.ts";
import { globalBulkheadGovernor, globalSloGovernor, globalHedgedMesh, globalConcurrencyGovernor, globalRemediationEngine, globalKernelOrchestrator, globalTranscendenceNexus } from "./eosLegacyDispatchState.ts";
import { EosProgressiveCanaryMesh } from "../../core/eosProgressiveCanaryMesh.ts";
import { EosVercelCanaryObservability, type CanaryTelemetryInput } from "../../core/eosVercelCanaryObservability.ts";
import { type CellHealthStatus } from "../../core/eosCellBasedBulkheadGovernor.ts";
import { type SloTelemetryEvent } from "../../core/eosMultiWindowSloGovernor.ts";
import { type PriorityTier } from "../../core/eosAdaptiveConcurrencyGovernor.ts";
import { type TelemetryHealthVector } from "../../core/eosPredictiveRemediationEngine.ts";
import { type KernelSystemTelemetry } from "../../core/eosUnifiedKernelOrchestrator.ts";
import { type TranscendencePillarId } from "../../core/eosBigTechTranscendenceNexus.ts";
import { globalTraceSampler } from ".././eosMcpSharedRuntime.ts";

const handlers: Record<string, EosLegacyToolHandler> = {
  "eos_canary_rollout": (ctx, args, onProgress) => {
    const versionTarget = String(args.versionTarget || "v50.0.0");
    const previousVersion = String(args.previousVersion || "v49.0.0");
    const mesh = new EosProgressiveCanaryMesh(versionTarget, previousVersion);
    const telemetry = Array.isArray(args.telemetry)
      ? args.telemetry
      : [
          { stage: "CANARY_1_PCT", sampleRequests: 10000, failedRequests: 0, p99LatencyMs: 45, baselineP99LatencyMs: 44 },
          { stage: "CANARY_5_PCT", sampleRequests: 50000, failedRequests: 1, p99LatencyMs: 46, baselineP99LatencyMs: 44 },
          { stage: "CANARY_25_PCT", sampleRequests: 250000, failedRequests: 2, p99LatencyMs: 47, baselineP99LatencyMs: 44 },
          { stage: "FULL_PRODUCTION_100_PCT", sampleRequests: 1000000, failedRequests: 5, p99LatencyMs: 48, baselineP99LatencyMs: 44 }
        ];
    return mesh.executeRollout(telemetry as any);
  },

  "eos_canary_telemetry_evaluate": (ctx, args, onProgress) => {
    const input: CanaryTelemetryInput = {
      deploymentId: String(args.deploymentId || ""),
      environment: args.environment === "preview" ? "preview" : "production",
      stage: String(args.stage || "CANARY_1_PCT") as any,
      errorRate5xx: Number(args.errorRate5xx ?? 0),
      latencyP99Ms: Number(args.latencyP99Ms ?? 0),
      requestCount: Number(args.requestCount ?? 0),
      criticalErrorThreshold: args.criticalErrorThreshold !== undefined ? Number(args.criticalErrorThreshold) : undefined
    };
    return EosVercelCanaryObservability.evaluateMetrics(input);
  },

  "eos_cell_bulkhead_route": (ctx, args, onProgress) => {
    const partitionKey = String(args.partitionKey || "default-fleet-task");
    const payload = args.payload;
    return globalBulkheadGovernor.route(partitionKey, payload);
  },

  "eos_cell_bulkhead_status": (ctx, args, onProgress) => {
    if (args.cellId !== undefined && args.setStatus !== undefined) {
      const cellId = Number(args.cellId);
      const status = String(args.setStatus) as CellHealthStatus;
      globalBulkheadGovernor.setCellStatus(cellId, status);
    }
    const metrics = globalBulkheadGovernor.getMetrics();
    if (args.cellId !== undefined) {
      const filteredCell = metrics.cells.find(c => c.cellId === Number(args.cellId));
      return {
        ...metrics,
        targetCell: filteredCell ?? null
      };
    }
    return metrics;
  },

  "eos_slo_burn_rate_evaluate": (ctx, args, onProgress) => {
    const serviceId = String(args.serviceId || "default-service");
    if (Array.isArray(args.events)) {
      globalSloGovernor.ingestBatch(serviceId, args.events as SloTelemetryEvent[]);
    }
    const evalTs = args.evaluationTimestamp !== undefined ? Number(args.evaluationTimestamp) : undefined;
    return globalSloGovernor.evaluateService(serviceId, evalTs);
  },

  "eos_slo_budget_status": (ctx, args, onProgress) => {
    if (args.serviceId) {
      const serviceId = String(args.serviceId);
      if (args.checkDeploymentAllowed) {
        return globalSloGovernor.isDeploymentAllowed(serviceId);
      }
      return globalSloGovernor.evaluateService(serviceId);
    }
    return {
      totalServices: globalSloGovernor.getAllServiceStatuses().length,
      services: globalSloGovernor.getAllServiceStatuses()
    };
  },

  "eos_hedge_request_execute": (ctx, args, onProgress) => {
    const endpointId = String(args.endpointId || "default-endpoint");
    const deadlineMs = args.deadlineMs !== undefined ? Number(args.deadlineMs) : undefined;
    const hedgingDelayMs = args.hedgingDelayMs !== undefined ? Number(args.hedgingDelayMs) : undefined;
    const primaryDelay = Math.max(0, Number(args.simulatedPrimaryDelayMs ?? 20));
    const hedgedDelay = Math.max(0, Number(args.simulatedHedgedDelayMs ?? 15));

    return globalHedgedMesh.executeHedgedSync({
      endpointId,
      deadlineMs,
      hedgingDelayMs,
      simulatedPrimaryDelayMs: primaryDelay,
      simulatedHedgedDelayMs: hedgedDelay
    });
  },

  "eos_hedge_metrics_status": (ctx, args, onProgress) => {
    if (args.endpointId && args.recordSampleLatencyMs !== undefined) {
      globalHedgedMesh.recordSample(String(args.endpointId), Number(args.recordSampleLatencyMs));
    }
    if (args.endpointId) {
      const endpointId = String(args.endpointId);
      return {
        endpointId,
        stats: globalHedgedMesh.getEndpointStats(endpointId),
        meshMetrics: globalHedgedMesh.getMetrics()
      };
    }
    return globalHedgedMesh.getMetrics();
  },

  "eos_concurrency_evaluate": (ctx, args, onProgress) => {
    const priority = String(args.priority || "NORMAL") as PriorityTier;
    const waitMs = args.queueWaitMs !== undefined ? Number(args.queueWaitMs) : 0;
    const decision = globalConcurrencyGovernor.tryAcquire(priority, waitMs);

    if (decision.admitted && args.releaseAfterSimulatedRttMs !== undefined) {
      globalConcurrencyGovernor.release(Number(args.releaseAfterSimulatedRttMs));
    }

    return decision;
  },

  "eos_concurrency_status": (ctx, args, onProgress) => {
    if (args.reset) {
      globalConcurrencyGovernor.reset();
    }
    if (args.recordLatencyMs !== undefined) {
      globalConcurrencyGovernor.recordLatency(Number(args.recordLatencyMs));
    }
    return globalConcurrencyGovernor.getStatus();
  },

  "eos_trace_sampler_status": (ctx, args, onProgress) => {
    if (args.reset) {
      globalTraceSampler.reset();
    }
    if (args.evictStale) {
      globalTraceSampler.evictStaleTraces();
    }
    return globalTraceSampler.getStatus();
  },

  "eos_remediation_correlate_execute": (ctx, args, onProgress) => {
    const vector: TelemetryHealthVector = {
      burnRate5m: args.burnRate5m !== undefined ? Number(args.burnRate5m) : 0,
      burnRate1h: args.burnRate1h !== undefined ? Number(args.burnRate1h) : 0,
      concurrencyGradient: args.concurrencyGradient !== undefined ? Number(args.concurrencyGradient) : 1.0,
      concurrencyInFlightRatio: args.concurrencyInFlightRatio !== undefined ? Number(args.concurrencyInFlightRatio) : 0,
      traceErrorRate: args.traceErrorRate !== undefined ? Number(args.traceErrorRate) : 0,
      traceP99LatencyMs: args.traceP99LatencyMs !== undefined ? Number(args.traceP99LatencyMs) : 0,
      hedgeRequestRatio: args.hedgeRequestRatio !== undefined ? Number(args.hedgeRequestRatio) : 0,
      queueDelayMs: args.queueDelayMs !== undefined ? Number(args.queueDelayMs) : 0,
    };
    return globalRemediationEngine.evaluateAndRemediate(vector);
  },

  "eos_remediation_engine_status": (ctx, args, onProgress) => {
    if (args.reset) {
      globalRemediationEngine.reset();
    }
    return globalRemediationEngine.getStatus();
  },

  "eos_kernel_orchestrator_reconcile": (ctx, args, onProgress) => {
    const telemetry: Partial<KernelSystemTelemetry> = {};
    if (args.fleetSoundcheckScore !== undefined) telemetry.fleetSoundcheckScore = Number(args.fleetSoundcheckScore);
    if (args.sloErrorBudgetConsumptionPct !== undefined) telemetry.sloErrorBudgetConsumptionPct = Number(args.sloErrorBudgetConsumptionPct);
    if (args.predictiveHazardSeverityPct !== undefined) telemetry.predictiveHazardSeverityPct = Number(args.predictiveHazardSeverityPct);
    if (args.concurrencyHeadroomPct !== undefined) telemetry.concurrencyHeadroomPct = Number(args.concurrencyHeadroomPct);
    if (args.syntheticSocketBacklog !== undefined) telemetry.syntheticSocketBacklog = Number(args.syntheticSocketBacklog);
    if (args.virtualPagePressurePct !== undefined) telemetry.virtualPagePressurePct = Number(args.virtualPagePressurePct);
    return globalKernelOrchestrator.reconcile(telemetry);
  },

  "eos_kernel_orchestrator_status": (ctx, args, onProgress) => {
    if (args.reset) {
      globalKernelOrchestrator.reset();
    }
    return globalKernelOrchestrator.getStatus();
  },

  "eos_transcendence_execute": (ctx, args, onProgress) => {
    const pillar = args.pillar ? (String(args.pillar).toUpperCase() as TranscendencePillarId) : undefined;
    return globalTranscendenceNexus.executeMasterNexus(pillar);
  },

  "eos_transcendence_status": (ctx, args, onProgress) => {
    if (args.reset) {
      globalTranscendenceNexus.reset();
    }
    return globalTranscendenceNexus.getStatus();
  },
};

export const RELIABILITY_LEGACY_HANDLERS: Readonly<Record<string, EosLegacyToolHandler>> = Object.freeze(handlers);
