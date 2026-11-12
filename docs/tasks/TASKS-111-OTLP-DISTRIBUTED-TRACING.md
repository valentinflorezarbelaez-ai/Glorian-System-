# TASKS-111: Implementation Task DAG for SPEC-226 (OTLP Distributed Tracing)

- **Change ID**: `CHANGE-111`
- **Spec ID**: `SPEC-226`
- **Status**: `READY_FOR_EXECUTION`

## Task Breakdown DAG

- [ ] **TASK-001**: Create types interface file `src/core/eosOtlpDistributedTracingCore.types.ts` ($\le 800$ lines).
  - _Done Criteria_: W3CTraceContext, SpanKind, StatusCode, OtlpSpan, OtlpTraceExportReport defined.
- [ ] **TASK-002**: Implement core class `src/core/eosOtlpDistributedTracingCore.ts` ($\le 800$ lines).
  - _Done Criteria_: Traceparent parser/generator, startSpan/endSpan, ring buffer, serializeToOtlpJson, pure SHA-256 receipts.
- [ ] **TASK-003**: Register subpath exports in `package.json` (`"./otlp"`, `"./trace"`) and export from `src/core/index.ts`.
  - _Done Criteria_: Clean imports resolve without build errors.
- [ ] **TASK-004**: Add Enterprise Facade handler in `src/core/eosEnterpriseFacade.ts` (`otlp_trace_create`, `otlp_trace_span`, `otlp_trace_export`).
  - _Done Criteria_: Facade dispatches and returns deep-frozen JSON telemetry reports.
- [ ] **TASK-005**: Add CLI command `eos trace:demo` and `eos trace:export` in `bin/commands/cliPlatform.mjs`.
  - _Done Criteria_: Command executes via CLI and outputs formatted OTLP JSON.
- [ ] **TASK-006**: Add MCP actions in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
  - _Done Criteria_: MCP actions callable via `eos-system`.
- [ ] **TASK-007**: Create comprehensive test suite `test/eosOtlpDistributedTracingCore.test.mjs` verifying BDD-1149..BDD-1153.
  - _Done Criteria_: 100% test pass rate with 0 regressions.
- [ ] **TASK-008**: Update Facade test `test/eosEnterpriseFacade.test.mjs` with step #38.
  - _Done Criteria_: Step 38 asserts valid OTLP trace export.
- [ ] **TASK-009**: Update documentation (`docs/DEVELOPER_GUIDE.md`, `docs/specs/openspec-catalog-index.json`).
  - _Done Criteria_: Catalog and documentation synchronized to 226 specs.
- [ ] **TASK-010**: Execute strict verification pipeline (`eos_turbo_verify`, `npm test`).
  - _Done Criteria_: All tests pass with exit code 0.
