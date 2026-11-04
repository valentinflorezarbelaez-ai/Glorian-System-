# PLAN-147: Product Delivery Orchestrator (ADR)

## Decision
Adopt a Layer-0 `EosProductDeliveryOrchestrator` that composes existing Foundry and Sovereign Loop engines, injects a `VerificationGatePort` for fail-closed gates, and emits a `ProductQualityScorecard`. Process I/O adapters remain at CLI/MCP boundaries; hermetic in-process gates satisfy Layer-0 purity for unit tests and dry-run.

## Rejected Alternatives
- **Rewrite CI inside Foundry**: Rejected — duplicates `verify-cicd-pipeline.mjs`.
- **Immediate satellite scaffolding**: Rejected — Law IV External Write Barrier.
- **Optional soft gates**: Rejected — violates fail-closed constitution.
