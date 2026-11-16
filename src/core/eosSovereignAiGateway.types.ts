/**
 * Sovereign Multi-Model AI Gateway & Adversarial Consensus Engine Types
 *
 * SPEC-298 / CHANGE-160 (Phase 3.4)
 * Strict Zero Runtime Dependencies (Law V)
 */

export type ModelProviderId = "google-gemini" | "anthropic-claude" | "openai-gpt" | "xai-grok" | "deepseek-r1";

export type TaskIntentCategory =
  "CODE_SYNTHESIS" | "ARCHITECTURE_DESIGN" | "TRIAGE_FAST" | "DEEP_RESEARCH" | "FORMAL_REASONING";

export type GatewayCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type ConsensusVerdict = "APPROVED" | "FLAGGED_FOR_REVIEW" | "REJECTED";

export interface ModelRouteConfig {
  intent: TaskIntentCategory;
  primaryProvider: ModelProviderId;
  primaryModel: string;
  fallbackProvider: ModelProviderId;
  fallbackModel: string;
  maxTokens: number;
  costPer1kTokens: number;
  targetLatencyMs: number;
}

export interface GatewayCircuitBreakerStatus {
  provider: ModelProviderId;
  state: GatewayCircuitState;
  consecutiveFailures: number;
  failureThreshold: number;
  lastFailureTime: number | null;
  cooldownDurationMs: number;
}

export interface ModelPromptRequest {
  requestId: string;
  intent: TaskIntentCategory;
  prompt: string;
  embedding?: number[];
  temperature?: number;
  maxTokens?: number;
  requireConsensus?: boolean;
}

export interface ModelCompletionResponse {
  requestId: string;
  provider: ModelProviderId;
  model: string;
  completion: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cached: boolean;
  estimatedCostUsd: number;
}

export interface ConsensusSession {
  sessionId: string;
  prompt: string;
  modelA: {
    provider: ModelProviderId;
    model: string;
    response: string;
    latencyMs: number;
  };
  modelB: {
    provider: ModelProviderId;
    model: string;
    response: string;
    latencyMs: number;
  };
  divergenceScore: number;
  invariantCheckPassed: boolean;
  invariantsEvaluated: string[];
  verdict: ConsensusVerdict;
  synthesisSummary: string;
}

export interface SemanticCacheEntry {
  promptKey: string;
  vector: number[];
  completion: string;
  provider: ModelProviderId;
  model: string;
  createdAt: number;
  ttlMs: number;
}

export interface GatewayMetrics {
  totalRequests: number;
  cachedRequests: number;
  cacheHitRatio: number;
  totalTokensConsumed: number;
  totalEstimatedCostUsd: number;
  consensusSessionsRun: number;
  circuitBreakerTrips: number;
}

export interface AiGatewayReceipt {
  timestampIso: string;
  specRef: string;
  providersAudited: ModelProviderId[];
  routesEvaluated: number;
  consensusSessionsCount: number;
  cacheHitRatio: number;
  totalCostUsd: number;
  sha256Signature: string;
}
