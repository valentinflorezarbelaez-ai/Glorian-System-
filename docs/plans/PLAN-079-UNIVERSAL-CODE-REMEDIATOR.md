# PLAN-079: Universal Code Remediation & Modernizer Engine

## Execution Architecture

1. **Layer 0 Core**: `src/core/eosUniversalCodeRemediator.ts`
   - Inspects target path or consumes `DoctorReport` from `EosUniversalProjectDoctor`.
   - Stack-specific `.gitignore` templates (Rust, Go, Python, Node, Java, Flutter, C/C++).
   - Stack-specific test scaffolds (`test/smoke.test.js`, `tests/test_smoke.py`, `tests/smoke_test.go`, `tests/smoke_test.rs`).
   - Governance files (`README.md`, `LICENSE`).
   - Hardened CI workflow injection via `EosUniversalProjectDoctor.generateHardenedCiWorkflow`.
   - Pure postcondition validation and tamper-evident SHA-256 receipt generation.
2. **Package & Module Wiring**:
   - Subpath export `"./remediator"` in `package.json`.
   - Re-export in `src/core/index.ts`.
3. **CLI Exposition**:
   - `glorian fix [path] [--dry-run]` / `glorian heal:repo [path]` in `bin/commands/cliPlatform.mjs`.
4. **MCP Tool Exposition**:
   - `action: "remediate"` on `eos_enterprise_workspace` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
5. **Quality Gate Verification**:
   - Full BDD suite `test/eosUniversalCodeRemediator.test.mjs`.
   - Update `docs/specs/openspec-catalog-index.json` to 189 specs.
   - `tsc` and `eslint` check.
