# INTAKE-152: Universal Agent Session Contract & Product Golden Path Enforcement

- **Intake ID**: `INTAKE-152`
- **Project**: `eos-system`
- **Status**: `INTAKE_COMPLETE`
- **Date**: 2026-11-04

## Problem

MCP tools and the Product Delivery Golden Path are voluntary for IDE agents. Cursor, Antigravity, Claude Code, and VS Code can mutate `src/` without a mission receipt, without completing the prescribed MCP DAG, and without a fail-closed scorecard floor. Product delivery defaults to hermetic gate stubs that can report turbo purity without inspecting `package.json`.

## Requested outcome

1. Bind an agent session to an IDE family and a mission plan from `EosAntigravityDirector`.
2. Authorize writes only after mandatory DAG tools are recorded.
3. When product delivery materializes (`write=true` / `dryRun=false`), evaluate real Layer-0 purity from `package.json`, secret patterns, and mutation floor — not forced-exit stubs.
4. Scorecard below 80 yields `BLOCKED` with reason `SCORECARD_FLOOR`, never `PARTIAL`.
5. No Level 5, multi-host, or hot Rust-to-Wasm claims.

## Constraints

- Layer-0 only. Zero runtime npm dependencies.
- Reuse `EosAntigravityDirector.directMission` for profile and DAG classification.
