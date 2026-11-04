---
name: eos-gentleman-synergy
description: Unified Co-Governance protocol uniting the EOS System MCP Control Plane (`eos-system`) with the Gentleman Programming AI Stack (`gentle-ai`, `engram`, `gga`, `context7`, and `agent-teams-lite` `sdd-*` + `judgment-day` skills) inside Google Antigravity.
---

# EOS System x Gentleman AI Stack — Unified Antigravity Co-Governance

This skill defines how **EOS System** (Supreme Constitutional Control Plane) and the **Gentleman Programming Ecosystem** (`gentle-ai`, `engram`, `gga`, `context7`, `agent-teams-lite`) operate as a single synergistic architecture inside Google Antigravity without conflicting or overwriting rules.

## 1. Division of Responsibilities (Zero Overlap, Maximum Synergy)

| Layer | Governing Component | Authoritative Role in Antigravity |
|---|---|---|
| **Constitutional Gate & Law IV Barrier** | `eos-system` MCP (`eos_antigravity_direct`) | Classifies mission profile, enforces External Write Barrier (`docs/projects/registry.json`), and prescribes MCP tool DAG. |
| **Pre-Execution Shell Guardrail** | `eos-governance` Plugin (`PreToolUse` Hook) | Blocks catastrophic commands (`rm -rf /`, `git push --force main`, `DROP DATABASE`) in `<20ms`. |
| **Episodic Cross-Session Memory** | `engram` MCP (`mem_context`, `mem_search`, `mem_save`) | Recalls decisions/bugfixes across sessions and persists structured `What / Why / Where / Learned` observations. |
| **Immutable Cryptographic Audit Ledger** | `eos-system` MCP (`eos_sqlite_ledger`) | Appends tamper-evident SHA-256 hash-chained receipts into native `node:sqlite` (`WAL` + `FTS5`). |
| **Live Framework & SDK Docs** | `context7` MCP (`resolve-library-id`, `query-docs`) | Eliminates API hallucinations when working with external libraries or frameworks. |
| **Lean Sub-Agent SDD Execution** | `agent-teams-lite` (`sdd-init` .. `sdd-archive`) + `eos-sdd-pipeline` | Delegates exploration, EARS/BDD specs, design, tasks, implementation, and verification to keep primary context lean. |
| **Compiler AST & Adversarial Review** | `eos_ast_analyze` + `judgment-day` + `gga` | Combines real TypeScript Compiler AST verification, two blind adversarial judge sub-agents, and Gentleman Guardian Angel review against `AGENTS.md`. |

## 2. End-to-End 6-Phase Co-Governance Workflow

0. **Preferred IDE Session Bind (Cursor / Antigravity — SPEC-152/153/154)**
   - On SessionStart, Glorian ensures a preferred session and aligns Gentleman Gentle-AI Stack (`eos_agent_session_contract` → `ensure` / `align_gentleman`).
   - Glorian fail-closes writes until the mandatory MCP DAG completes; Gentle AI supplies Engram memory, ODD/`gentle-ai` workflow, focused agents, GGA review, Context7 docs, and `agent-teams-lite` SDD skills.
   - **Media canon (Alan Buscaglia)**: https://gentlemanprogramming.com/ · https://github.com/Gentleman-Programming · https://www.youtube.com/@gentlemanprogramming/videos · https://www.youtube.com/@GentlemanProgrammingVods — encoded in `EosGentlemanStackBridge.EXTERNAL_CANON` / `docs/governance/GENTLEMAN_MEDIA_CANON.md`.
   - Honor Gentleman doctrine: verification over generation; requirements before code; ODD scales (inline small / delegate large); humans keep push/PR/merge.
   - Division of labor: **Glorian = constitution & gates**; **Gentle AI = memory, workflow, review**. Never replace one with the other.
1. **Recall & Direct**
   - Query `engram` (`mem_search` or `mem_context`) for relevant project history.
   - Invoke `eos_antigravity_direct` (`ServerName: "eos-system"`) to verify Law IV authorization and retrieve the mission DAG.
2. **Explore & Fetch Live Docs**
   - For unfamiliar codebases, follow `sdd-explore` via the `research` sub-agent.
   - For external libraries, query `context7` (`resolve-library-id` -> `query-docs`).
3. **Specify & Design (Zero Vibe Coding)**
   - Run `eos_amplify_prompt` (`eos-system`) together with `sdd-propose`, `sdd-spec`, `sdd-design`, and `sdd-tasks` to produce IEEE 830 EARS requirements, BDD scenarios, ADRs, and atomic task DAGs.
4. **Implement Cleanly (Layer-0 Hexagonal Purity)**
   - Follow `sdd-apply` respecting `.atl/skill-registry.md` and EOS Law V/VI/VII (0 runtime npm dependencies in Layer-0, zero secrets, English artifacts).
5. **Verify & Judge (`eos_ast_analyze` + `judgment-day` + `gga`)**
   - Call `eos_ast_analyze` and `eos_turbo_verify` on `eos-system`.
   - For critical merges, trigger `judgment-day` (two parallel blind `code-reviewer` / `self` sub-agents) and/or `gga run`.
   - Run `npm run test` (`7/7` strict verification stages).
6. **Dual Memory Seal**
   - Record the cryptographic receipt in `eos_sqlite_ledger` (`action: "record"`).
   - Save architectural learnings to `engram` (`mem_save` with `What`, `Why`, `Where`, `Learned`).
