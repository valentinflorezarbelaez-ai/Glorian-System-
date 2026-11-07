# ARCHITECTURE PLAN & ADR-032: APEX MODEL ROUTER, TOKEN COMPRESSOR & GO AUTONOMOUS HEALER

- **Document ID**: `PLAN-018`
- **ADR Number**: `ADR-032`
- **Target Version**: `v33.0.0`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148 / Nubank Hexagonal Architecture / Spotify Golden Path

---

## 1. CONTEXT & PROBLEM STATEMENT

As software systems become increasingly driven by heterogeneous AI frontier models, relying on a single model or uncompressed context leads to excessive token costs, rate limits, latency bottlenecks, and suboptimal code quality.
Furthermore, manual intervention for fixing mechanical errors, syntax bugs, or broken invariants degrades engineering velocity.

EOS System requires a unified, Layer-0 sovereign subsystem that:

1. Intelligently routes tasks to the best-suited model based on cognitive strengths and FinOps budgets.
2. Compresses context by 70-85% prior to dispatch.
3. Provides an autonomous closed-loop self-healing mechanism that isolates root causes and verifies patches with Exit Code 0.
4. Executes high-throughput token and telemetry workloads natively in Go with zero allocations.

---

## 2. DECISION DRIVERS

1. **Model Specialization**: Different models possess distinct cognitive superpowers; forcing all tasks through one model produces mediocre efficiency.
2. **FinOps Discipline**: Token usage must be compressed aggressively without losing type safety or architectural invariants.
3. **Resilience & Self-Healing**: Systems must self-diagnose and self-repair (NASA FDIR Level 4).
4. **Extreme Performance in Go**: Go provides ideal concurrency (goroutines, CSP channels) and ultra-small binaries for the high-scale nervous system.

---

## 3. ARCHITECTURE DESIGN & ADR-032

### Component Diagram (Hexagonal Isolation)

```text
┌───────────────────────────────────────────────────────────────┐
│               Ingress (CLI / MCP / Web UI / REST)             │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│         EOS Apex Model Router & Token Squeezer (L0 Core)      │
│  - Task Capability Matrix (Gemini/Claude/GPT/DeepSeek/Grok)   │
│  - AST Context Squeezer (70-85% Token Pruning)                │
│  - Closed-Loop FDIR Autonomous Healer (SapFix Pattern)        │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
┌───────────────▼───────────────┐ ┌─────────────▼───────────────┐
│ Native Go Orchestrator Engine │ │ Pure L0 TypeScript Fallback │
│  - Goroutine Worker Pool      │ │  - 0 External Runtime Deps  │
│  - SIMD Byte Scanner          │ │  - Deterministic Hashes     │
│  - CNCF Probes (/healthz)     │ │  - Merkle Attestation       │
└───────────────────────────────┘ └─────────────────────────────┘
```

### Alternatives Considered & Rejected

1. _LangChain / LlamaIndex_: Rejected due to massive dependency trees, heavy Python runtime, and violation of Layer-0 purity (`dependencies: {}`).
2. _Blind Whole-File Context Injection_: Rejected due to high token costs and prompt dilution.
3. _Manual Patching_: Rejected due to developer friction and slower incident recovery.

---

## 4. INVARIANTS & CONSTITUTIONAL GATES

1. **Layer-0 Purity**: Zero external npm runtime dependencies.
2. **Deterministic Attestation**: Every routing decision, compression pass, and healing run emits a SHA-256 Merkle receipt.
3. **Exit Code 0 Verification**: Autonomous healing must re-verify against the test suite; unverified patches are immediately reverted.
