# CHANGE-078: Universal Project Doctor & SDLC Acceleration Engine

## Intent

Equip Glorian System with a universal repository health doctor and SDLC accelerator capable of diagnosing any software codebase in milliseconds, scoring its maturity across 5 industry pillars (0-100), detecting plain secrets or configuration risks, and generating hardened CI/CD automation templates under zero runtime npm dependencies.

## Scope

- SPEC-193 + `src/core/eosUniversalProjectDoctor.ts`
- Barrel export in `src/core/index.ts`
- Subpath export `"./doctor"` in `package.json`
- CLI command `glorian doctor [path]` in `bin/commands/cliPlatform.mjs`
- MCP action `action: "doctor"` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`
- Verification suite in `test/eosUniversalProjectDoctor.test.mjs`

## Non-goals

- No destructive modifications to external repositories without explicit `--write-ci` flag
- Zero external runtime npm dependencies (`dependencies: {}`)

## Status

APPROVED — owner directive to accelerate development across all technologies and IDEs.
