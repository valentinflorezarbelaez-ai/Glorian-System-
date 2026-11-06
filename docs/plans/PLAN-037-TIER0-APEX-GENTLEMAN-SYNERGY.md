# PLAN-037: ARCHITECTURE PLAN & ADR-050 — EOS v50.0.0 TIER-0 & GENTLEMAN STACK CO-GOVERNANCE

## ADR-050: Co-Governance Federation Between EOS Control Plane and Gentleman AI Stack

### Context
1. A Principal Engineer audit of EOS (`v49.0.0`) identified four high-leverage technical upgrades to reach Tier-0 institutional rigor:
   - Eliminate `process.cwd()` dependence and enforce `resolveProjectPath()` across 100% of path-accepting MCP tools.
   - Mitigate 114-tool LLM catalog dilution via MCP `2025-03-26` `ToolAnnotations` and `core` / `full` profiles.
   - Replace ephemeral in-memory state with zero-dependency durable SQLite (`node:sqlite` `WAL` + `FTS5`) hash-chained persistence.
   - Upgrade regex static checks with real TypeScript Compiler AST inspection (`ts.createSourceFile`).
2. The Architect also requires the full **Gentleman Programming AI Ecosystem** (`gentle-ai` v4.3.1, `engram` v3.2.1, `gga` v2.10.1, `context7`, and `agent-teams-lite` SDD + `judgment-day` skills) installed and connected alongside EOS inside Google Antigravity.

### Decision
1. **Non-Destructive Co-Governance Architecture (EOS as Supreme Constitutional Gate + Gentle AI as Episodic Memory & Sub-Agent Execution Mesh)**:
   - Running `gentle-ai install --agent antigravity` blindly would risk overwriting `~/.gemini/config/AGENTS.md` (the EOS Constitution) or replacing `~/.gemini/config/skills` (our NTFS junction to `c:\Users\valen\Eos-System\.agents\skills`).
   - Instead, we compile and install `gentle-ai` (`v4.3.1`) and `gga` (`v2.10.1`) cleanly onto User `PATH` (`~/go/bin` and `~/bin`), keep `engram` (`v3.2.1`) and `context7` wired in `mcp_config.json`, place `.gga` + `.atl/skill-registry.md` in the repository root, and vendor the Apache-2.0 `agent-teams-lite` skill suite directly alongside `eos-director`, `eos-sdd-pipeline`, `eos-fleet-ops`, and `eos-gentleman-synergy` inside `.agents/skills/` (which immediately exposes all 18 skills globally to Antigravity!).
2. **Zero-Dependency Durable SQLite Ledger (`node:sqlite`)**:
   - Use Node.js built-in `node:sqlite` (`DatabaseSync`) with `WAL` + `FTS5` to persist cryptographic mission and audit receipts without adding a single package to `package.json` `"dependencies"`.
3. **Compiler AST Analyzer (`ts.createSourceFile`)**:
   - Dynamically load `typescript` from the locked dev toolchain (falling back cleanly if absent) so `src/core/` retains zero runtime third-party imports while providing true AST verification during development, MCP audits, and CI.

### Rejected Alternatives
- **Alternative A (Add `better-sqlite3` or `drizzle-orm` to `dependencies`)**: Rejected — violates EOS Law V (`0` external runtime dependencies) and adds native C++ gyp rebuild fragility across Windows/Linux/macOS.
- **Alternative B (Allow `gentle-ai` wizard to overwrite `~/.gemini/config/AGENTS.md`)**: Rejected — would erase or conflict with the Seven Inviolable Commandments; federating them through `eos-gentleman-synergy` and `EosGentlemanStackBridge` gives Antigravity 100% of both ecosystems with zero conflict.
