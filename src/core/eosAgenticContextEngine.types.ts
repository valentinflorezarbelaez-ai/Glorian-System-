/**
 * @file eosAgenticContextEngine.types.ts
 * @description Types and domain contracts for the Autonomous Agentic Context Engine
 * & Multimodal Prompt Ingestion (SPEC-344 / CHANGE-206).
 *
 * Invariant: Pure Layer-0 interfaces, zero external runtime dependencies.
 */

export interface AgenticChunk {
  readonly id: string;
  readonly index: number;
  readonly text: string;
  readonly tokenEstimate: number;
  readonly invariants: readonly string[];
  readonly heading?: string;
}

export interface ChunkingOptions {
  readonly maxChunkTokens?: number;
  readonly overlapTokens?: number;
  readonly preserveSentences?: boolean;
}

export interface SanitizeResult {
  readonly clean: string;
  readonly tainted: boolean;
  readonly violations: readonly string[];
  readonly quarantinedSegments: readonly string[];
}

export interface IngestedCorpus {
  readonly id: string;
  readonly sourceTitle: string;
  readonly totalTokens: number;
  readonly chunks: readonly AgenticChunk[];
  readonly indexedSymbols: readonly string[];
  readonly ingestedAt: string;
}

export interface RetrievalMatch {
  readonly chunk: AgenticChunk;
  readonly score: number;
  readonly matchedKeywords: readonly string[];
}

export interface RetrievalResult {
  readonly query: string;
  readonly matches: readonly RetrievalMatch[];
  readonly recallScore: number;
  readonly latencyMs: number;
}

export interface ContextCompactionOptions {
  readonly maxTokens: number;
  readonly preserveInvariants?: boolean;
  readonly preserveContracts?: boolean;
}

export interface CompactedContextResult {
  readonly originalTokens: number;
  readonly compactedTokens: number;
  readonly compressionRatio: number;
  readonly preservedInvariantsCount: number;
  readonly text: string;
}

export interface AgenticContextAuditReceipt {
  readonly schemaVersion: "1.0.0";
  readonly spec: "SPEC-344";
  readonly timestamp: string;
  readonly totalChunksEvaluated: number;
  readonly meanRecallScore: number;
  readonly promptInjectionDefensePassed: boolean;
  readonly tokenBudgetCompactionPassed: boolean;
  readonly allPassed: boolean;
  readonly sha256: string;
}
