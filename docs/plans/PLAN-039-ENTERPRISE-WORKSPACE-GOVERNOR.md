# PLAN-039 & ADR-052: ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR & MULTI-TENANT LAW IV BOUNDARY

* **Status**: `APPROVED` (`99/100` via `eos_evaluate_decision`)
* **Specification**: `SPEC-046-ENTERPRISE-WORKSPACE-GOVERNOR.md`
* **Milestone**: `EOS v52.0.0`

---

## 1. Architectural Decision Record — ADR-052

### Context
EOS `v51.0.0` achieved autonomous self-governance, native `node:sqlite` WAL cryptographic auditability, real TypeScript token-AST analysis, and unattended evergreen Gentleman AI stack updates. However, governing external Tier-0 enterprise codebases (polyglot monorepos with dozens of internal services, OpenAPI/Protobuf/GraphQL contracts, and strict supply-chain controls) required:
1. Deep monorepo & contract topology discovery beyond shallow single-package heuristics.
2. Automated Law IV Constitutional onboarding that never pollutes external repositories during intake/audit.
3. Multi-tenant registered project resolution inside `EosMcpServer` without weakening `BDD-128` path confinement against arbitrary filesystem traversal.

### Decision
Implement `EosEnterpriseWorkspaceGovernor` as a pure Layer-0 TypeScript module (`0` external runtime npm dependencies) with three strictly isolated responsibilities:
1. **Read-Only Polyglot Monorepo & Contract Scanner (`inspectWorkspace`)**:
   - Traverses up to depth `6` and `4,000` files using `fs.lstatSync` (skipping all symlinks and heavy build/vendor directories).
   - Parses `package.json` workspaces, `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `Cargo.toml` `[workspace]`, `go.work`, `pyproject.toml`, `melos.yaml`, `settings.gradle*`, and `MODULE.bazel` to build a deterministic `WorkspaceMember` graph.
   - Catalogs formal interface contracts (`openapi`, `protobuf`, `graphql`, `asyncapi`, `json_schema`, `prisma`, `sql_migration`, `tla_plus`) and deterministic lockfiles.
2. **Control-Plane-Confined Law IV Onboarding (`onboardWorkspace`)**:
   - Writes governance artifacts (`docs/intake/<id>/`, `docs/specs/<id>/`, `docs/audits/<id>/`, `docs/projects/registry.json`) **only** inside `controlPlaneRoot` (`Eos-System`), never inside `targetPath`.
   - Sets initial authorization to `LEVEL_1_READ_ONLY_AUDIT`, preserving human sovereignty for `LEVEL_2` / `LEVEL_3` write elevation.
3. **Multi-Tenant Registered Workspace Boundary (`resolveAuthorizedWorkspace`)**:
   - Resolves `eos-system` or any `projectId` registered in `docs/projects/registry.json` via its portable `localPathEnv` or `localPath`.
   - Enforces `READ_ONLY` confinement vs `WRITE_GATED` 6-precondition Law IV verification.

### Rejected Alternatives
1. **Rejected Alternative A — Disabling `EosMcpServer` Path Confinement to Allow Arbitrary Host Paths**:
   - *Reason Rejected*: Violates Law IV & Law VI by allowing prompt-injected MCP tool calls to traverse arbitrary host directories (`C:\Windows`, `~/.ssh`, etc.). Confining MCP tools to `controlPlaneRoot` + explicitly registered/authorized workspace roots preserves Zero-Trust containment.
2. **Rejected Alternative B — Auto-Granting `LEVEL_3_PRODUCTION_AUTHORIZED` During Automated Onboarding**:
   - *Reason Rejected*: Directly violates Law IV (`OWNER_APPROVAL` + `IMPLEMENTATION_AUTHORIZED` must be explicitly granted by the human Principal Architect, never self-escalated by an agent).
3. **Rejected Alternative C — Adding External YAML / Protobuf / OpenAPI npm Parser Dependencies**:
   - *Reason Rejected*: Violates Law V (`0` external runtime npm dependencies in Layer-0). Lightweight deterministic Layer-0 lexical/JSON structural parsers inspect workspace globs and contract headers with zero supply-chain attack surface.
