# PLAN-070: Big Tech Product Factory E2E

## Decision

Compose existing Layer-0 engines behind `eosBigTechProductFactory` rather than
rewriting Foundry. Rejected: broadening IAM to `mcp/tools/` (too coarse);
autonomous write-by-default (violates Law VI fail-closed).

## Architecture

CLI / npm / TTV → Factory → SPEC-184 IAM → EosProductDeliveryOrchestrator → receipt JSON.

## Risks

Scorecard floor may BLOCK dry-runs if gates flake; keep hermetic gate port in dry-run.
