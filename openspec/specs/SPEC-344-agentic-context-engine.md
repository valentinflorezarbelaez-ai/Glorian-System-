# SPEC-344: Autonomous Agentic Context Engine & Multimodal Prompt Ingestion

## 0. Intent

Agentic engineering workflows ingest diverse external materials (educational curriculum, architecture blueprints, Notion databases, API specifications, and conversational turn logs). Unchecked prompt ingestion leads to context bloat, prompt injection vulnerabilities, and token budget exhaustion. This specification defines an autonomous, pure Layer-0 Agentic Context Engine (`EosAgenticContextEngineCore`) that deterministically ingests, sanitizes, chunks, compresses, and retrieves agentic knowledge under strict token ceilings with mathematical recall verification.

Doctrine: **Law I (Specification as Supreme Truth)**, **Law V (Architectural Purity)**, and **Law VI (Absolute Security)**.

---

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO arbitrary multi-modal prompts or external corpus materials are submitted to `ingestCorpus`, EL SISTEMA tokenizes, extracts core agentic invariants, builds semantic symbol vectors, and indexes them into pure Layer-0 memory.
- **FR-2 (Ubiquitous)**: EL SISTEMA implements sliding-window semantic chunking with boundary hysteresis ensuring zero context truncation across tool calling and reasoning turns.
- **FR-3 (State-Driven)**: MIENTRAS assembling agent context under tight token budgets ($4\text{k}, 8\text{k}, 16\text{k}, 32\text{k}, 128\text{k}$), EL SISTEMA applies priority-driven compression on peripheral trivia while preserving 100% of domain invariants, EARS contracts, and type signatures.
- **FR-4 (Error / Unwanted Condition)**: SI any ingested payload contains ungrounded hallucinations, prompt injection sequences (`IGNORE PREVIOUS INSTRUCTIONS`, `<script>`, system override tags), ENTONCES EL SISTEMA isolates the segment fail-closed with `AGENTIC_CORPUS_TAINT`.
- **FR-5 (Event-Driven)**: CUANDO `auditAgenticContextEngine()` executes, EL SISTEMA verifies token preservation, semantic retrieval recall $\ge 95\%$, and emits a cryptographic evidence receipt to `docs/evidence/AGENTIC_CONTEXT_ENGINE_RECEIPT.json`.
- **FR-6 (Ubiquitous)**: EL SISTEMA exposes CLI commands `toolchain:agentic:ingest`, `toolchain:agentic:chunk`, `toolchain:agentic:compress`, `toolchain:agentic:eval`, and `toolchain:agentic:audit` with clean `--json` machine contracts.

---

## 2. Non-Functional Requirements

- **NFR-1**: 100% pure Layer-0 implementation (`dependencies: {}` in `package.json`).
- **NFR-2**: All touched and newly created modules must strictly conform to $\le 800$ lines with $\ge 12$ lines of headroom (SPEC-250).
- **NFR-3**: Ingestion and indexing must process at $> 20,000$ tokens/second on single-core V8.
- **NFR-4**: Sliding-window semantic retrieval must complete in $< 5$ milliseconds.

---

## 3. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1843 Semantic Corpus Ingestion and Tokenization
  DADO an engineering curriculum or prompt document
  CUANDO ingestCorpus executes
  ENTONCES the text is tokenized into deterministic positional n-grams
  Y semantic symbol vectors and architectural invariants are indexed.

ESCENARIO: BDD-1844 Sliding-Window Semantic Chunking with Hysteresis
  DADO a continuous multi-turn agent transcript
  CUANDO chunkCorpus executes with maxChunkTokens and overlapTokens
  ENTONCES chunks split on sentence and section boundaries without slicing words
  Y boundary hysteresis ensures contiguous semantic coherence.

ESCENARIO: BDD-1845 Priority-Driven Token Budget Compaction
  DADO an ingested corpus exceeding the target token budget
  CUANDO compressContext executes with a 4000 token limit
  ENTONCES domain invariants and type signatures are 100% preserved
  Y peripheral whitespace, filler tokens, and redundant commentary are compacted.

ESCENARIO: BDD-1846 Fail-Closed Isolation of Prompt Injections
  DADO an adversarial prompt containing "IGNORE ALL PREVIOUS INSTRUCTIONS"
  CUANDO sanitizePrompt executes
  ENTONCES the injection pattern is detected, quarantined, and throws AGENTIC_CORPUS_TAINT
  Y clean system directives are preserved uncorrupted.

ESCENARIO: BDD-1847 High-Precision Hybrid Semantic Retrieval
  DADO an indexed agentic corpus and a specific query
  CUANDO retrieveContext executes with topK=3
  ENTONCES the returned chunks achieve >= 95% semantic recall
  Y retrieval latency remains under 5 milliseconds.

ESCENARIO: BDD-1848 Deterministic Invariant Audit Receipt Emission
  DADO the agentic context engine
  CUANDO auditAgenticContextEngine executes
  ENTONCES all verification dimensions report passed
  Y a verifiable SHA-256 evidence receipt is written to docs/evidence/AGENTIC_CONTEXT_ENGINE_RECEIPT.json.
```
