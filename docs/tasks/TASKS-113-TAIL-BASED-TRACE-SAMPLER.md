# TASKS-113: Dynamic Tail-Based Distributed Trace Sampler

## Metadata

- **Task DAG ID**: `TASKS-113`
- **Governing Specification**: `SPEC-113`
- **Plan Reference**: `PLAN-113`
- **Status**: `COMPLETE`
- **Total Atomic Tasks**: 9

---

## Task Dependency Graph (DAG)

```text
T113.1 (Intake & Spec) ────► T113.2 (ADR-113 Plan) ────► T113.3 (Auth Level 3)
                                                                 │
                                                                 ▼
T113.6 (MCP Registration) ◄─── T113.5 (Layer 0 Core) ◄─── T113.4 (TLA+ Model)
            │
            ▼
T113.7 (Unit & Logic Tests) ───► T113.8 (Strict 7-Stage Gate) ───► T113.9 (Commit & Push)
```

---

## Detailed Task Checklist

- [x] **T113.1**: Complete formal intake and IEEE 830 EARS specifications (`INTAKE-113`, `SPEC-113`).
- [x] **T113.2**: Formalize architecture plan, ADR-113 with rejected alternatives, and data contracts (`PLAN-113`).
- [x] **T113.3**: Record Level 3 Production Implementation Authorization in `IMPLEMENTATION_AUTHORIZATION.md`.
- [x] **T113.4**: Author formal TLA+ specification (`docs/formal/TailBasedTraceSampler.tla`) and register bounded simulation in `scripts/verify-formal-tla.mjs` (Model 33).
- [x] **T113.5**: Implement pure Layer 0 engine `EosTailBasedTraceSampler` in `src/core/eosTailBasedTraceSampler.ts` with zero runtime npm dependencies.
- [x] **T113.6**: Expose MCP tools `eos_trace_span_record` and `eos_trace_sampler_status` in `src/mcp/eosMcpServer.ts` and `docs/contracts/mcp-tool-catalog.json`.
- [x] **T113.7**: Author test suite `test/eosTailBasedTraceSampler.test.mjs` verifying BDD-291 (100% Error Preservation), BDD-292 (100% Latency & Resilience Preservation), and BDD-293 (Nominal Baseline & Eviction).
- [x] **T113.8**: Execute full 7-stage strict SecDevOps gate (`npm run verify:strict`) with 0 lint errors, 0 type errors, and 0 secrets.
- [x] **T113.9**: Commit under conventional commits and push to `origin/main`.
