# TASKS-084: Post-Quantum Cryptography Implementation Checklist

- [x] Create INTAKE-084, CHANGE-084, SPEC-199, PLAN-084
- [x] Register Level-3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`
- [x] Implement `src/core/eosPostQuantumCryptography.ts`
- [x] Export in `src/core/index.ts` and `"./post-quantum"` in `package.json`
- [x] Implement CLI commands `glorian pq:kem`, `glorian pq:sign`, `glorian pq:verify` in `bin/commands/cliPlatform.mjs`
- [x] Update help in `bin/commands/cliKernel.mjs`
- [x] Wire MCP actions `pq_kem`, `pq_verify` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`
- [x] Implement test suite `test/eosPostQuantumCryptography.test.mjs` (100% passing)
- [x] Synchronize catalog index to 194 specs
- [x] Typecheck (`tsc`) and Lint (`eslint`) passing
- [x] Git commit and push to `origin/main`
