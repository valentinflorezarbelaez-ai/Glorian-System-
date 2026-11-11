# PLAN-083: Hermetic Single-Executable Application (SEA) Binary Compiler

## Execution Architecture

1. **Layer 0 Core**: `src/core/eosHermeticSeaCompiler.ts`
   - Config generator: `sea-config.json` with entry point `bin/eos.mjs`.
   - Blob compiler: `node --experimental-sea-config sea-config.json`.
   - Binary synthesizer: Copies host runtime binary to `dist/glorian-[platform]`, injects SEA payload, sets `0o755` permissions.
   - Digital signer: Signs output binary SHA-256 with native Ed25519 asymmetric cryptography.
   - Provenance generator: Generates in-toto v1.0 / SLSA Provenance v1.0 statement.
   - Dry-run simulation mode for CI environments without disk writing.
   - Tamper-evident SHA-256 receipt.
2. **Package & Module Wiring**:
   - Subpath export `"./compiler"` in `package.json`.
   - Re-export in `src/core/index.ts`.
3. **CLI Exposition**:
   - `glorian compile [platform] [--dry-run] [--sign] [--json]` in `bin/commands/cliPlatform.mjs`.
   - Documented in `bin/commands/cliKernel.mjs`.
4. **MCP Tool Exposition**:
   - `action: "compile_sea"` on `eos_enterprise_workspace` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
5. **Quality Gate Verification**:
   - Comprehensive test suite in `test/eosHermeticSeaCompiler.test.mjs`.
   - Synchronize catalog index to 193 specs.
   - Run typecheck, lint, and tests.
   - Git commit & push.
