# TASKS-088: Layer-0 WebAssembly Bytecode Decompiler & Formal Prover (SPEC-203)

- [ ] Task 1: Append `AUTH-2026-11-10-WASM-DECOMPILER-PROVER-203` to `IMPLEMENTATION_AUTHORIZATION.md`.
- [ ] Task 2: Implement `src/core/eosWasmBytecodeDecompilerProver.ts`.
- [ ] Task 3: Export `./wasm-prover` in `package.json` and re-export in `src/core/index.ts`.
- [ ] Task 4: Implement CLI commands `wasm:decompile` and `wasm:prove` in `bin/commands/cliPlatform.mjs` and update help in `bin/commands/cliKernel.mjs`.
- [ ] Task 5: Wire MCP actions `wasm_decompile` and `wasm_prove` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
- [ ] Task 6: Implement test suite `test/eosWasmBytecodeDecompilerProver.test.mjs` (BDD-1034..BDD-1038).
- [ ] Task 7: Add test case #15 in `test/eosEnterpriseFacade.test.mjs`.
- [ ] Task 8: Update `docs/DEVELOPER_GUIDE.md` with Módulo 18.
- [ ] Task 9: Update `docs/specs/openspec-catalog-index.json` to 198 specs.
- [ ] Task 10: Run full quality gates and push to `origin/main`.
