# CHANGE-039: ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR (v52.0.0)

* **Specification**: `SPEC-046`
* **ADR**: `ADR-052` (`PLAN-039`)
* **Type**: `CAPABILITY_ELEVATION` (Layer-0 Core + MCP Multi-Tenant Boundary + CLI)

## Summary of Delta Changes

1. **Added Layer-0 Core Engine**: `src/core/eosEnterpriseWorkspaceGovernor.ts`
   - Deep polyglot workspace & monorepo topology analyzer (`inspectWorkspace`).
   - API & schema contract discovery (`OpenAPI`, `Protobuf`, `GraphQL`, `AsyncAPI`, `JSON Schema`, `Prisma`, `SQL migrations`, `TLA+`).
   - Supply-chain & reproducibility posture evaluator (deterministic lockfiles, container/IaC manifests, CI pipelines, secret hygiene).
   - Law IV Constitutional onboarding generator (`onboardWorkspace`) confining all generated governance dossiers inside `controlPlaneRoot` (`LEVEL_1_READ_ONLY_AUDIT` default, zero writes in external target directory).
   - Multi-tenant registered workspace resolver (`resolveAuthorizedWorkspace`) enforcing `READ_ONLY` vs `WRITE_GATED` Law IV preconditions.
   - Bounded structural verification runner (`verifyWorkspace`) integrated with `EosDurableSqliteLedger`.
2. **Added Formal TLA+ Specification**: `docs/formal/EnterpriseWorkspaceGovernor.tla` and bounded JS simulation `verifyEnterpriseWorkspaceGovernorModel()` in `scripts/verify-formal-tla.mjs`.
3. **Updated MCP & CLI Control Surface**:
   - Added `eos_enterprise_workspace` to `src/mcp/eosMcpToolCatalog.ts` (`CORE_TIER0_TOOL_NAMES` + `MUTATION_CAPABLE_TOOLS`) and `src/mcp/eosMcpServer.ts`.
   - Added `eos project [list|inspect|onboard|verify]` subcommands to `bin/eos.mjs` and `project:*` npm scripts in `package.json` (`v52.0.0`).
4. **Added BDD Test Suite**: `test/eosEnterpriseWorkspaceGovernor.test.mjs` covering `BDD-138` through `BDD-142`.
