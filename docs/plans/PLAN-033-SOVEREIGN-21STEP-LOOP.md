# PLAN-033: 21-STEP AUTONOMOUS SOVEREIGN ENGINEERING LOOP ENGINE

## 1. Architectural Strategy

- **Layer**: Core Domain & Autonomous Orchestration (Layer 0).
- **Module**: `src/core/eosSovereignLoop.ts`.
- **Integration**:
  - Subcommands in `bin/eos.mjs` (`eos loop`, `eos pipeline`).
  - Native tools in `src/mcp/eosMcpServer.ts` (`eos_sovereign_loop_run`, `eos_sovereign_loop_status`).
  - Unit & resilience test suite `test/eosSovereignLoop.test.mjs`.
  - CI/CD 7-stage master gate.

## 2. Invariants & Security

- Zero external runtime npm dependencies (`dependencies: {}` in `package.json`).
- Pure Layer-0 deterministic execution.
- Strict gate compliance: No implementation before intake, specs, plan, tasks, and auth.
