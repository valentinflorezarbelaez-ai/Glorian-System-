# PLAN-036: ARCHITECTURE PLAN & ADRs FOR ANTIGRAVITY MCP CONTROL PLANE (v49.0.0)

## 1. Hexagonal Architecture & Boundaries
- **Layer 0 (Pure Domain & Application)**:
  - `src/core/eosAntigravityDirector.ts`: Zero external dependencies (`dependencies: {}`). Uses `eosKernelPrimitives.ts` (`assertPrecondition`, `assertPostcondition`, `deepFreeze`, `pureSha256`) to classify directives, check `docs/projects/registry.json` write barriers, synthesize portable MCP configurations, and audit Antigravity customization trees.
- **Layer 1 (Adapters — MCP, CLI & Lifecycle Hooks)**:
  - `src/mcp/eosMcpServer.ts`: Stdio JSON-RPC 2.0 adapter exposing 116 tools, 4 resources, 3 prompts, `ping`, and `initialize.instructions`.
  - `integrations/antigravity/eos-governance/`: Native Antigravity plugin bundle (`plugin.json`, `hooks.json`, `scripts/eos-hook.mjs`, `rules/AGENTS.md`).
  - `.agents/skills/`: Progressive-disclosure Antigravity operational skills (`eos-director`, `eos-sdd-pipeline`, `eos-fleet-ops`).
  - `scripts/install-antigravity-mcp.mjs` & `bin/eos.mjs`: Idempotent global installer and CLI interface.

## 2. Architectural Decision Record (ADR-049)

### Context
Antigravity supports MCP servers either in global `~/.gemini/config/mcp_config.json` or inside `plugins/<plugin>/mcp_config.json`. Meanwhile, rules, hooks, and skills are discovered from `~/.gemini/config/plugins/<plugin>/`, `~/.gemini/config/skills/`, and workspace `.agents/`.

### Decision
1. **Single Canonical Global MCP Server (`eos-system`)**: Register `eos-system` in `~/.gemini/config/mcp_config.json` with `EOS_PROJECT_ROOT` and `EOS_FLEET_*_PATH` environment variables, and **omit** `mcp_config.json` inside `integrations/antigravity/eos-governance/`. This guarantees a single Node.js stdio process and clean `eos-system` tool names across every workspace without spawning a duplicate `eos-governance_eos-system` server.
2. **Plugin Source Outside `.agents/plugins/`**: Store the global plugin bundle in `integrations/antigravity/eos-governance/` (junctioned from `~/.gemini/config/plugins/eos-governance`) while storing progressive-disclosure skills in `.agents/skills/` (junctioned from `~/.gemini/config/skills`). This avoids double-executing lifecycle hooks when working inside `Eos-System` itself while keeping zero symlinks inside the Git repository tree.
3. **Zero Per-Turn Hook Latency**: Use `SessionStart` (fires once per conversation) for control-plane context injection and lightweight Node.js `PreToolUse` (`matcher: "run_command"`) for Gamma Barrier destructive-command protection (<25ms), avoiding per-turn `PreInvocation` latency overhead.

### Rejected Alternatives
1. **Duplicating `mcp_config.json` in both `~/.gemini/config/` and `plugins/eos-governance/`**: Rejected because Antigravity spawns two separate MCP server instances (`eos-system` and `eos-governance_eos-system`), doubling memory usage and cluttering the tool namespace.
2. **Placing Unix-only `bash` hook scripts in `hooks.json`**: Rejected because Antigravity on Windows executes hook commands via `cmd /c`; invoking `node ./scripts/eos-hook.mjs` directly is 100% cross-platform (`win32`, `linux`, `darwin`).
3. **Using `PreInvocation` hooks on every model turn**: Rejected because synchronous shell spawning before every LLM turn adds unnecessary latency when `rules/AGENTS.md` + `SessionStart` + MCP `instructions` already persist full governance directives cleanly.
