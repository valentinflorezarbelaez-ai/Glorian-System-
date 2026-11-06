# EOS Sovereign MCP Control Plane — Antigravity Governance Protocol

You have live access to the **`eos-system`** Model Context Protocol (MCP) Control Plane via `call_mcp_tool` (`ServerName: "eos-system"`). EOS directs architectural discipline, security boundaries, formal verification, and multi-repository fleet operations across all workspaces.

## 1. Active Mission Direction (`eos_antigravity_direct`)

Before executing any non-trivial engineering mission (new features, refactors, architectural changes, security audits, performance tuning, or fleet deployments):

1. Invoke `call_mcp_tool` on `ServerName: "eos-system"`, `ToolName: "eos_antigravity_direct"` with `{ "directive": "<user task>", "target": "<project id or workspace path>" }`.
2. Respect `writeBarrierStatus`:
   - If `AUTHORIZED`, proceed along the returned `prescribedMcpDag` and load any listed `requiredSkills` (`eos-director`, `eos-sdd-pipeline`, `eos-fleet-ops`).
   - If `READ_ONLY_UNREGISTERED_TARGET`, enforce **EOS Law IV (External Write Barrier)**: perform read-only reconnaissance or ask the user before registering/mutating an unregistered external repository.

## 2. Core EOS MCP Tool Routing

Use the `eos-system` MCP server tools at the corresponding lifecycle gates:

- **Requirements & OpenSpec Gate (Law I & II)**:
  - `eos_amplify_prompt`: Convert informal requests into IEEE 830 / EARS functional requirements and BDD scenarios.
  - `eos_check_openspec`: Detect specification drift across `openspec/specs/` and `openspec/changes/`.
  - `eos_semantic_search` / `eos_hnsw_knn_search`: Query architectural doctrines, ADRs, and domain invariants.
- **Hexagonal Purity & Blast Radius (Law V)**:
  - `eos_check_architecture`: Verify Layer-0 purity (0 production dependencies, 0 circular imports).
  - `eos_get_blast_radius` / `eos_datalog_query`: Identify transitive module impact and predictive test suites.
- **Safety Consensus & Patch Validation (Law VI)**:
  - `eos_evaluate_decision` / `eos_tmr_consensus`: Evaluate high-impact architectural decisions against the Seven Inviolable Commandments.
  - `eos_validate_patch`: Scan proposed file contents for syntax errors, secret leaks, and destructive patterns.
- **Epistemic Evidence & Fleet Delivery (Law III)**:
  - `eos_turbo_verify`: Run fast in-memory credential, architecture, and inventory checks before claiming `VERIFIED`.
  - `eos_ast_analyze`: Parse real TypeScript Compiler ASTs to verify Layer-0 zero-dependency purity, Node 24 strip-only compliance, and cyclomatic complexity.
  - `eos_sqlite_ledger`: Append, FTS5-search, and cryptographically verify SHA-256 hash-chained records in the zero-dependency `node:sqlite` WAL ledger.
  - `eos_fleet_soundcheck` / `eos_mcts_tune` / `eos_canary_rollout`: Audit Spotify Soundcheck scores across the sovereign fleet, tune parameters via UCT MCTS, and validate progressive canary rollouts.
  - `eos_antigravity_doctor` / `eos_gentleman_audit`: Diagnose Antigravity MCP config, Gentleman AI stack co-governance, plugins, hooks, skills, and NTFS junction health.

## 3. Unified EOS + Gentleman AI Stack Co-Governance (`eos-gentleman-synergy`)

Google Antigravity is co-governed by **EOS System** and the **Gentleman Programming AI Stack** (`gentle-ai`, `engram`, `gga`, `context7`, and `agent-teams-lite`):

1. **Episodic Memory (`engram` MCP + `eos_sqlite_ledger`)**: Recall prior context via `mem_context` / `mem_search` at mission start and persist verified decisions via `mem_save` alongside `eos_sqlite_ledger`.
2. **Live Framework Docs (`context7` MCP)**: Resolve external library documentation via `resolve-library-id` + `query-docs` instead of relying on stale training weights.
3. **Sub-Agent SDD Orchestration (`sdd-*` + `eos-sdd-pipeline`)**: Combine Gentleman's `agent-teams-lite` phase skills (`sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`) with EOS formal EARS/BDD/TLA+ gates.
4. **Adversarial Dual Review (`judgment-day` + `gga`)**: Pair parallel blind sub-agent reviews (`judgment-day`) and Gentleman Guardian Angel (`.gga` -> `AGENTS.md`) with `eos_ast_analyze` and `npm run verify:strict`.
