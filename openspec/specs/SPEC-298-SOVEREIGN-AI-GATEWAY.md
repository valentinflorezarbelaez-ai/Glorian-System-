# SPEC-298: Sovereign Multi-Model AI Gateway & Adversarial Consensus Engine

- **Specification ID**: `SPEC-298`
- **Change ID**: `CHANGE-160`
- **Status**: `APPROVED`
- **Module**: `src/core/eosSovereignAiGateway.ts`
- **Tier**: Edge Coordination, Frontier AI Routing & Cognitive Consensus
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Functional Requirements (EARS Syntax)

- **FR-298-01 (Event-Driven Frontier Model Routing)**: WHEN an agent dispatches a prompt with a designated intent category (`CODE_SYNTHESIS`, `ARCHITECTURE_DESIGN`, `TRIAGE_FAST`, `DEEP_RESEARCH`, `FORMAL_REASONING`), THE SYSTEM SHALL select the optimal active frontier model provider based on configured priority, cost budget, and circuit health.
- **FR-298-02 (State-Driven Adversarial Dual-Model Consensus)**: MIENTRAS a high-stakes architectural or security decision is processed, THE SYSTEM SHALL dispatch the prompt simultaneously to two independent frontier models, synthesize their proposals, and verify agreement against `ARCHITECTURE-S0.md` constitutional invariants.
- **FR-298-03 (Error / Unwanted Condition: Provider Outage & Circuit Breaking)**: SI a model provider encounters consecutive failures or latency exceeding threshold, ENTONCES EL SISTEMA SHALL trip the provider's circuit breaker to `OPEN`, failover to the configured fallback model, and transition to `HALF_OPEN` after a cooldown period.
- **FR-298-04 (State-Driven In-Memory Semantic Prompt Cache)**: MIENTRAS incoming prompt embeddings are evaluated against cached queries, THE SYSTEM SHALL return cached responses in $< 5$ ms whenever cosine similarity exceeds the $0.96$ threshold.
- **FR-298-05 (Ubiquitous Token Budget & Cost Telemetry Tracking)**: EL SISTEMA SHALL continuously track token consumption, estimated monetary spend, and invocation latency across all model providers and persist metrics in the gateway ledger.
- **FR-298-06 (Cryptographic Proof Receipt)**: WHEN an AI gateway audit completes, THE SYSTEM SHALL emit a verification receipt at `docs/evidence/AI_GATEWAY_RECEIPT.json` sealed with a SHA-256 signature.

---

## 2. Acceptance Criteria (BDD Gherkin Syntax)

```gherkin
SCENARIO: BDD-1563 Dynamic Multi-Model Intent-Based Routing
  GIVEN a sovereign AI gateway configured with frontier providers (Gemini, Claude, GPT, Grok, DeepSeek)
  WHEN an agent requests execution for CODE_SYNTHESIS or TRIAGE_FAST
  THEN the gateway routes to the optimal model based on capability, cost tier, and latency profile
  AND attaches execution metadata including provider ID, model name, and route reason.

SCENARIO: BDD-1564 Adversarial Dual-Model Consensus and Architectural Verification
  GIVEN an architectural proposal requiring constitutional validation
  WHEN the gateway executes a dual-model consensus session with two distinct frontier models
  THEN both model outputs are collected and evaluated for semantic divergence
  AND if both outputs conform to ARCHITECTURE-S0 invariants, consensus is APPROVED
  AND if outputs diverge or breach invariants, consensus is FLAGGED_FOR_REVIEW.

SCENARIO: BDD-1565 Provider Circuit Breaker Tripping and Automatic Failover
  GIVEN an active model provider in CLOSED state
  WHEN consecutive request errors reach the failure threshold
  THEN the provider's circuit breaker trips to OPEN
  AND subsequent requests automatically failover to the designated secondary model
  AND transitions to HALF_OPEN after cooldown expiry.

SCENARIO: BDD-1566 Semantic Vector Prompt Cache Matching with Cosine Similarity
  GIVEN a prompt semantic cache containing indexed prompt embeddings
  WHEN a new prompt is submitted with cosine similarity >= 0.96 to an existing entry
  THEN the gateway returns a cache HIT in < 5ms without issuing external provider calls
  AND prompts with cosine similarity < 0.96 trigger a cache MISS and query the model.

SCENARIO: BDD-1567 Token Consumption and Spend Ledger Accounting
  GIVEN executed requests across diverse model providers
  WHEN token usage is recorded
  THEN the gateway updates prompt tokens, completion tokens, and total estimated cost in USD
  AND enforces quota caps when budget limits are reached.

SCENARIO: BDD-1568 Cryptographic AI Gateway Audit Receipt Generation
  GIVEN an audit executed via toolchain:gateway:audit or auditAiGatewayPipeline
  WHEN the audit completes
  THEN docs/evidence/AI_GATEWAY_RECEIPT.json is written
  AND contains providersAudited, routesEvaluated, consensusSessionsCount, cacheHitRatio, and a valid sha256Signature.
```
