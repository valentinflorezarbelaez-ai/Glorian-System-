# PLAN-160: Sovereign Multi-Model AI Gateway & Adversarial Consensus Engine

- **Plan ID**: `PLAN-160`
- **Change ID**: `CHANGE-160`
- **Spec Reference**: `SPEC-298`
- **Tier**: Edge Coordination, Frontier AI Routing & Cognitive Consensus
- **Status**: `APPROVED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15T22:15:00Z

---

## 1. Architectural Strategy & ADRs

### ADR-160-01: Zero-Dependency Frontier Model Abstraction

- **Context**: In multi-agent engineering, calling AI APIs often relies on third-party SDKs (`@google/genai`, `@anthropic-ai/sdk`, `openai`), which would introduce dozens of npm dependencies and violate **Law V**.
- **Decision**: Implement a native Layer-0 HTTP/JSON abstraction using Node.js built-in `fetch` or `node:https`. Standardize request/response structures into a unified `ModelPromptRequest` and `ModelCompletionResponse`.
- **Alternatives Considered & Rejected**:
  - _Installing vendor SDKs_: Rejected due to Law V violation (zero runtime npm dependencies).
  - _Hardcoding single vendor (Gemini or OpenAI)_: Rejected due to vendor lock-in and lack of cognitive diversity for consensus.

### ADR-160-02: Adversarial Dual-Model Consensus Protocol

- **Context**: Autonomous coding agents can suffer from confirmation bias or shared training vulnerabilities. Single-model reviews fail to catch edge-case architectural drift.
- **Decision**: For critical mutations (marked `CRITICAL` or `ARCHITECTURE`), query two different model families concurrently (e.g. Gemini 1.5/2.0 Pro and Claude 3.5 Sonnet / GPT-4o), compute the semantic agreement score, and pass both through a deterministic invariant validator checking against `ARCHITECTURE-S0.md` axioms.
- **Alternatives Considered & Rejected**:
  - _Single model self-reflection_: Rejected because self-reflection frequently reinforces initial hallucinations.
  - _Human-in-the-loop for every prompt_: Rejected as unscalable for fast CI/CD and automated refactoring pipelines.

### ADR-160-03: Sliding-Window Circuit Breaker & Failover Matrix

- **Context**: AI API providers experience transient 429 (rate limit), 503 (overloaded), or elevated latency periods.
- **Decision**: Implement a three-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) per provider. If consecutive errors $\ge 3$ or latency exceeds threshold (e.g. 10,000 ms), mark `OPEN` for a cooldown duration (e.g. 30 seconds), automatically re-routing traffic to fallback frontier models.
- **Alternatives Considered & Rejected**:
  - _Blind retries with exponential backoff_: Rejected because waiting on an overloaded provider stalls agent execution; immediate failover preserves throughput.

### ADR-160-04: Sub-5ms Semantic Vector Prompt Cache

- **Context**: Repetitive queries (e.g. lint checks, test analysis, recurring triage prompts) incur redundant latency and token costs.
- **Decision**: Maintain an in-memory normalized scalar vector embedding cache. Compute cosine similarity against existing prompts. If $\cos(\theta) \ge 0.96$, return cached completion with $< 5$ ms latency.

---

## 2. Component Layout & Module Structure

```text
src/core/
  ├── eosSovereignAiGateway.types.ts  (~120 lines) -> Provider, Route, Consensus, Circuit, Cache types
  └── eosSovereignAiGateway.ts        (~390 lines) -> Gateway core engine, routing, consensus, circuits, cache

bin/commands/
  └── cliAiGateway.mjs                (~140 lines) -> CLI subcommands (route, consensus, circuit, audit)

test/
  └── eosSovereignAiGateway.test.mjs  (~200 lines) -> BDD-1563..BDD-1568 verification
```

---

## 3. Strict Quality Gates

- Line count ceiling: All modules $\le 800$ lines, with $\ge 12$ lines of headroom.
- Type safety: 100% strict TypeScript typing without `any` loopholes.
- Zero npm dependencies: Pure Node.js standard library.
