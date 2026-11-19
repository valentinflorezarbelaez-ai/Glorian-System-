# PLAN-206: Autonomous Agentic Context Engine & Multimodal Prompt Ingestion (`SPEC-344`)

- **Change ID**: `CHANGE-206`
- **Spec ID**: `SPEC-344`
- **Status**: `PLAN_APPROVED`
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & ADRs

### ADR-206-001: Zero-Dependency Positional N-Gram & BM25 Scoring vs External Embeddings

- **Context**: Agent context ingestion cannot rely on external neural embeddings APIs or heavyweight PyTorch/Rust native extensions that violate Layer-0 purity.
- **Decision**: Implement deterministic character/subword n-gram hashing and BM25 term saturation scoring with Cosine similarity projection in pure TypeScript.
- **Alternatives Rejected**:
  - `openai-embeddings` / `@xenova/transformers`: Rejected due to external dependencies, model downloading latency (>500MB), and non-hermeticity.
  - Naive substring search: Rejected due to inability to rank semantic relevance or measure recall.
- **Consequences**: Deterministic execution, $< 5$ms retrieval latency, zero runtime dependencies.

### ADR-206-002: Fail-Closed Prompt Injection Scanner

- **Context**: Ingesting raw notion notes, external curricula, or third-party web content exposes autonomous agents to prompt injection attacks.
- **Decision**: Multi-pattern regex and entropy anomaly detector scanning for system directive overrides, boundary delimiter escapes, and privilege escalation patterns.
- **Consequences**: Immediate isolation of contaminated payloads with `AGENTIC_CORPUS_TAINT`.

---

## 2. Component Design & Interfaces

- `src/core/eosAgenticContextEngine.types.ts`:
  - `AgenticChunk`: `id`, `text`, `tokenEstimate`, `invariants`, `metadata`.
  - `ChunkingOptions`: `maxChunkTokens`, `overlapTokens`, `preserveSentences`.
  - `IngestedCorpus`: `id`, `sourceTitle`, `totalTokens`, `chunks`, `indexedSymbols`.
  - `RetrievalResult`: `query`, `topChunks`, `recallScore`, `latencyMs`.
  - `AgenticContextAuditReceipt`: `spec`, `timestamp`, `recallScore`, `injectionDefensePassed`, `allPassed`, `sha256`.

- `src/core/eosAgenticContextEngine.ts`:
  - `estimateTokens(text: string): number`
  - `sanitizePrompt(text: string): { clean: string; tainted: boolean; violations: string[] }`
  - `chunkText(text: string, options?: ChunkingOptions): AgenticChunk[]`
  - `ingestCorpus(id: string, text: string, options?: ChunkingOptions): IngestedCorpus`
  - `retrieveContext(corpus: IngestedCorpus, query: string, topK?: number): RetrievalResult`
  - `compressContext(text: string, maxTokens: number): string`
  - `auditAgenticContextEngine(root?: string): AgenticContextAuditReceipt`
