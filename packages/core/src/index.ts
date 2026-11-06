// AGI Harness
export { EosAgiCore, EosAxiomMemory } from "../../../src/core/eosAgiCore.ts";
export type { ThoughtBranch, AgiSolveResult, AgiSolveOptions, AgiProgressEvent, AgiProgressEventType, AxiomMemory, BranchVerdict } from "../../../src/core/eosAgiCore.ts";

export { EosMultiModelRouter } from "../../../src/core/eosMultiModelRouter.ts";
export type { RouterConfig, ModelConfig, TaskType, ModelMessage, ModelCallResult, BranchGenerationRequest } from "../../../src/core/eosMultiModelRouter.ts";
export { CLAUDE_OPUS, CLAUDE_SONNET, CLAUDE_HAIKU, GEMINI_PRO, GEMINI_FLASH, DEEPSEEK_CODER, DEFAULT_ROUTER_CONFIG } from "../../../src/core/eosMultiModelRouter.ts";

export { EosDynamicToolForge } from "../../../src/core/eosDynamicToolForge.ts";
export type { ForgedTool, ForgeRequest, ForgeResult, ForgedToolInvocationResult } from "../../../src/core/eosDynamicToolForge.ts";

// Consulting
export { EosConsultantCore } from "../../../src/core/eosConsultantCore.ts";
export type { ConsultingRequest, ConsultingDeliverable, EngagementType, TechStack } from "../../../src/core/eosConsultantCore.ts";

// Context & Drift
export { EosContextWindowManager } from "../../../src/core/eosContextWindowManager.ts";
export type { AssembledContext, ContextFile, ContextWindowOptions } from "../../../src/core/eosContextWindowManager.ts";

export { EosSpecDriftDetector } from "../../../src/core/eosSpecDriftDetector.ts";
export type { SpecDriftReport, DriftViolation, DriftSeverity } from "../../../src/core/eosSpecDriftDetector.ts";

// MCP
export { EosToolRegistry, ToolNotFoundError, ToolExecutionError } from "../../../src/mcp/eosToolRegistry.ts";
export type { ToolHandler, ToolContext } from "../../../src/mcp/eosToolRegistry.ts";

// Logger
export { EosLogger, logger, createLogger } from "../../../src/core/eosLogger.ts";
export type { LogLevel } from "../../../src/core/eosLogger.ts";

// Primitives
export { Ok, Err, assertPrecondition, assertPostcondition, assertInvariant, deepFreeze, ContractError } from "../../../src/core/eosKernelPrimitives.ts";
export type { Result } from "../../../src/core/eosKernelPrimitives.ts";

// Feature Flags
export { EosFeatureFlags, isEnabled } from "../../../src/core/eosFeatureFlags.ts";
export type { FeatureFlag, FlagConfig } from "../../../src/core/eosFeatureFlags.ts";

// Diff Patcher
export { parseDiff, applyDiff, generateDiff } from "../../../src/core/eosDiffPatcher.ts";
export type { ParsedDiff, PatchResult, DiffHunk, DiffLine } from "../../../src/core/eosDiffPatcher.ts";

// API Rate Limiting
export { withRateLimit } from "../../../src/core/eosApiRateLimit.ts";
export type { RateLimitConfig } from "../../../src/core/eosApiRateLimit.ts";

// Plugin Loader
export { EosPluginLoader } from "../../../src/core/eosPluginLoader.ts";
export type { LoadedPlugin, PluginLoadResult } from "../../../src/core/eosPluginLoader.ts";

// Design System
export { validateCssAgainstTokens, validateHtmlAgainstTokens, ALLOWED_COLORS, getTokenSystemSummary } from "../../../src/core/eosDesignTokens.ts";
export type { DesignViolation } from "../../../src/core/eosDesignTokens.ts";
export { architecturalGrid, telemetryHeader, spotlightPanel, codeBlock, consoleTrace, generatePrimitivesCSS } from "../../../src/core/eosDesignPrimitives.ts";

// Enterprise: Secrets, Tracing, LSP, Worker Tribunal
export { EosSecretsManager, secrets } from "../../../src/core/eosSecretsManager.ts";
export type { SecretProviderType } from "../../../src/core/eosSecretsManager.ts";
export { EosTracer, tracer } from "../../../src/core/eosTracer.ts";
export type { Span, SpanStatus, SpanKind, TracerConfig } from "../../../src/core/eosTracer.ts";
export { EosWorkerTribunal } from "../../../src/core/eosWorkerTribunal.ts";
export type { TribunalResult, WorkerTribunalOptions } from "../../../src/core/eosWorkerTribunal.ts";
export { computeDiagnosticsForFile, writeDiagnosticsFile, startLspServer } from "../../../src/core/eosLspDiagnostics.ts";
export type { Diagnostic, DiagnosticSeverity, EosDiagnosticsResult } from "../../../src/core/eosLspDiagnostics.ts";

// Pipeline
export { EosPipeline } from "../../../src/core/eosPipeline.ts";
export type { PipelineRequest, PipelineResult } from "../../../src/core/eosPipeline.ts";
