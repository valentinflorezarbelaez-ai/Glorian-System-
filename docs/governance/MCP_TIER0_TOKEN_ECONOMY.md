# MCP Tier-0 Token Economy

**Epistemic state:** `WITHIN_TESTED_SCOPE`  
**Drivers:** LIDR Agentic Engineer Starter M6 (token economy) · fazt.dev cost/evals discipline  
**Invariant:** No new Layer-0 runtime dependencies (`dependencies: {}`).

## Why

Default agent turns must **not** load every MCP tool schema into context. The full EOS MCP catalog is large (~250+ tools). Advertising all of them on every `tools/list` wastes tokens and degrades tool-selection precision.

## Profiles

| Profile                    | Env / alias                 | Approx. count | When to use                                    |
| -------------------------- | --------------------------- | ------------- | ---------------------------------------------- |
| **essential**              | `EOS_MCP_PROFILE=essential` | 18            | Ultra-tight loops (director / verify / search) |
| **core (Tier-0, default)** | unset, `core`, `tier0`      | **≤46**       | Default agent turns                            |
| **full**                   | `EOS_MCP_PROFILE=full`      | full catalog  | Power users, dogfood, frontier tools           |

- Default is **Tier-0 `core`**. Unset / empty / unknown → `core`.
- The **full catalog remains available**; this is a gate/default profile change only.
- Bound: `CORE_TIER0_TOOL_NAMES.size ≤ 46` (contract test).

## Prefer CLI over MCP for GitHub reads

For routine GitHub **reads** (issues, PR metadata, file contents, search), prefer the **`gh` CLI** (or Cursor built-in GitHub tools) instead of expanding the EOS MCP surface with GitHub-read tools.

| Task                            | Prefer                        |
| ------------------------------- | ----------------------------- |
| List / view issues & PRs        | `gh issue …` / `gh pr …`      |
| Read file at ref                | `gh api` / git                |
| Search code                     | `gh search` / ripgrep locally |
| Mutating EOS control-plane work | EOS MCP Tier-0 tools          |

Keep `eos_github_gate` (PR gate) in Tier-0 — that is control-plane enforcement, not a substitute for `gh` reads.

## How to opt into full

```bash
# Shell / CI
export EOS_MCP_PROFILE=full

# Cursor / Antigravity mcp config (eos-system server env)
"env": { "EOS_MCP_PROFILE": "full" }
```

Installer (`scripts/install-antigravity-mcp.mjs`) and `EosAntigravityDirector.synthesizeAntigravityMcpEntry` default `EOS_MCP_PROFILE=core`.

Public HTTP entrypoints (`api/mcp.js`, `EosMcpStreamServer`) construct the underlying server with **`full`** because their allowlists include tools outside Tier-0 (e.g. `eos_spotify_shuffle`); the HTTP layer still bounds what is advertised/callable.

## Pointers

- Catalog filter: `src/mcp/eosMcpToolCatalog.ts` (`normalizeToolProfile`, `annotateAndFilterTools`)
- Tier-0 name set: `src/core/eosMcpSchemaValidator.ts` (`CORE_TIER0_TOOL_NAMES`, `ESSENTIAL_TIER0_TOOL_NAMES`)
- Contract: `test/eosMcpTier0TokenEconomy.test.mjs`
- Related: `docs/governance/AI_ENGINEER_2026_ROADMAP_GLORIAN_MAP.md` (MCP profile curation)
