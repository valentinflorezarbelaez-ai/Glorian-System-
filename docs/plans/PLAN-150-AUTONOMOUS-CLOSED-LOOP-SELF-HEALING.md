# PLAN-150: Autonomous Closed-Loop Self-Healing & AST Mutation Engine (Level 5 Foundation)

## Architecture Overview
The Autonomous Closed-Loop Self-Healing Engine implements a deterministic 5-stage state machine:
```text
  [1. ANOMALY CAPTURE] ──► [2. CAUSAL ISOLATION] ──► [3. AST SYNTHESIS] ──► [4. SANDBOX EVAL] ──► [5. PROMOTION & SEAL]
       (Test/OTel/Linter)       (Knowledge Graph)          (SapFix Templates)       (Hermetic VM/Wasm)        (SQLite WAL Ledger)
```

---

## Architectural Decision Records (ADRs)

### ADR-0193: Pure Layer-0 AST Manipulation vs Heavy External AST Parsers
- **Context**: Autonomous patch synthesis requires parsing, inspecting, and mutating source code syntax trees. External tools like Babel, ts-morph, or ESLint CLI bring dozens of transitives npm dependencies violating Law V (`runtimeDependenciesCount: 0`).
- **Decision**: Implement a lightweight, deterministic pattern-based AST parser and surgical replacer in pure native TypeScript using regex-anchored token scanners and standard JavaScript block balancers.
- **Rejected Alternatives**:
  - *ts-morph / @babel/core*: Rejected due to heavy runtime footprint (15+ MB node_modules) and transitive security vulnerabilities.
  - *Full LLM rewrite of entire file*: Rejected due to non-deterministic formatting drift, hallucination risk, and loss of unrelated comments.

### ADR-0194: Hermetic Execution in Isolated Memory Sandbox vs Direct Workspace Modification
- **Context**: When evaluating candidate patches, running tests directly on the target workspace could corrupt files if a patch introduces infinite loops or file deletions.
- **Decision**: Candidate mutations are tested in an isolated sandbox context using `node:vm` or ephemeral scratch memory buffers. Only upon 100% test pass rate are files atomically written to disk using `safeWriteFileSync`.
- **Rejected Alternatives**:
  - *In-place git stash & pop*: Rejected due to slow disk I/O, race conditions on concurrent agents, and git lock file contention.
  - *Mocked test verification*: Rejected because mocked verification cannot guarantee actual behavioral correctness in the real runtime environment.

### ADR-0195: Closed-Loop Telemetry & OpenTelemetry Span Propagation
- **Context**: Self-healing events must be visible in real time across the control plane cockpit and exportable via OTLP.
- **Decision**: Wrap every stage of the healing loop in an OpenTelemetry span using `EosOtelTraceEngine` (SPEC-149), recording each candidate attempt, duration, memory usage, and result status.
- **Rejected Alternatives**:
  - *Console logs only*: Rejected due to lack of structured distributed context and inability to calculate healing duration percentiles.
