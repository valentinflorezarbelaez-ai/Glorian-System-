# CLAUDE.md — Local Project Notes
<!-- Generated from local metadata; no vendor, CI, or production integration was queried. -->

## Locally available command examples (not executed by this generator)
- Full Strict SecDevOps Gate (canonical 7-stage): `npm run verify:strict` → `node bin/eos.mjs verify`
- Unit & Chaos Tests: `node --test test/*.test.mjs`
- Go Canonical Format: `gofmt -s -w .`
- Go Unit Tests: `go test -v ./...`
- Go Race Condition Detector: `go test -race ./...`
- Go Memory Allocation Benchmark: `go test -bench=. -benchmem ./...`
- Go Titan Native Benchmark: `node bin/eos.mjs go benchmark`
- Honk Local Draft: `node bin/eos.mjs honk "<directive>"` (plan only; no files changed)
- Xirp Context Sync: `node bin/eos.mjs xirp sync`
- Modern Web Guidance install (agent skill, outside Layer-0): `npx -y modern-web-guidance@latest install`
- Modern Web Guidance fail-closed gate: `npm run mwg:gate`
- Modern Web Guidance search/retrieve: `npx -y modern-web-guidance@latest search "<query>"` then `retrieve "<id>"`

## Frontend / client-side JS (agentic engineers)
- Skill path: `.agents/skills/modern-web-guidance/SKILL.md` (mandatory first for HTML/CSS/client JS).
- Runbook: `docs/runbooks/modern-web-guidance.md`
- Registry: `.atl/skill-registry.md` compact rules for `modern-web-guidance`
- Never add MWG to `package.json` dependencies; keep `src/core/` at `dependencies: {}`.

## MCP Tier-0 (token economy)
- Default: `EOS_MCP_PROFILE=core` (~46 tools). Full catalog: `EOS_MCP_PROFILE=full`.
- Prefer `gh` for GitHub reads. Details: `docs/governance/MCP_TIER0_TOKEN_ECONOMY.md`.

## Layer-0 dependency policy
- Policy: `docs/governance/DEPENDENCY_POLICY_L0.md`
- Formal SoT: `openspec/specs/SPEC-002-HEXAGONAL-L0.md` (SPEC-001 Law V).
- Keep `package.json` `dependencies: {}`; `src/core/` may import only `node:` builtins and other `src/core/` modules (`npm run boundary:check`).

## Code & Architecture Standards
These are repository notes, not verified vendor standards. Review requirements and run matching checks before applying them.
