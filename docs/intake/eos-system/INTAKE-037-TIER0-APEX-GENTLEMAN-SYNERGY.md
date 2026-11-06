# INTAKE-037: EOS TIER-0 PRINCIPAL HARDENING & GENTLEMAN AI STACK CO-GOVERNANCE (v50.0.0)

## 1. Stakeholder & Context
- **Owner & Principal Architect**: Valentín Flórez Arbeláez
- **Target Control Plane**: `c:\Users\valen\Eos-System` (`eos-system`) + Google Antigravity Global Runtime (`C:\Users\valen\.gemini\config\`)
- **Date**: 2026-10-30
- **Directive**:
  1. Elevate EOS System to maximum Big Tech Tier-0 engineering rigor by remediating the highest-priority Principal Engineer audit findings: 100% MCP path confinement (eliminating `process.cwd()` leakage in `eos_refactor_audit` / `eos_refactor_execute`), modular MCP `2025-03-26` `ToolAnnotations` with `core` vs `full` tool profiles, zero-dependency durable persistence via Node's native `node:sqlite` (`WAL` + `FTS5`), and real TypeScript Compiler AST analysis (`ts.createProgram`).
  2. Install, wire, and co-govern the complete **Gentleman Programming AI Stack** (`gentle-ai` `v4.3.1`, `engram` `v3.2.1`, `gentleman-guardian-angel` / `gga` `v2.10.1`, `context7` MCP, and `agent-teams-lite` SDD + `judgment-day` skills) alongside **EOS System** inside Google Antigravity without clobbering the EOS Constitution.

## 2. Reconnaissance Findings
- **Local Workstation Binaries**:
  - `go` `go1.27.1 windows/amd64`: Installed (`>= 1.25.10` required by `gentle-ai/v4`).
  - `engram` `3.2.1`: Installed at `C:\Users\valen\AppData\Local\engram\bin\engram.exe` and registered in `mcp_config.json`.
  - `context7`: Registered and active in Antigravity MCP.
  - `gentle-ai` (`v4.3.1`): Module `github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai` ready for native source build via `go install`.
  - `gga` (`v2.10.1`): Repository `Gentleman-Programming/gentleman-guardian-angel` installs `~/bin/gga` + `~/bin/gga.bat` on Windows via Git Bash.
  - `agent-teams-lite`: Official Apache-2.0 pure-Markdown skill suite (`sdd-init`..`sdd-archive`, `judgment-day`, `skill-registry`, `branch-pr`, `issue-creation`, `go-testing`).
- **Node Runtime Capabilities**:
  - `node:sqlite` (`DatabaseSync` with `WAL` and `FTS5`) verified operational in Node `v24.21.0` with `0` external npm dependencies.
