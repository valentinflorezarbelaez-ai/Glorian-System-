# TASKS-086: Layer-0 HNSW Vector Search Engine Checklist

- [x] Create INTAKE-086, CHANGE-086, SPEC-201, PLAN-086
- [x] Register Level-3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`
- [ ] Implement `src/core/eosHnswVectorIndex.ts`
- [ ] Export in `src/core/index.ts` and `"./vector"` in `package.json`
- [ ] Implement CLI commands `glorian vector:index` and `glorian vector:search` in `bin/commands/cliPlatform.mjs`
- [ ] Update help in `bin/commands/cliKernel.mjs`
- [ ] Wire MCP actions `vector_index` and `vector_search` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`
- [ ] Implement test suite `test/eosHnswVectorIndex.test.mjs` (100% passing)
- [ ] Synchronize catalog index to 196 specs
- [ ] Typecheck (`tsc`) and Lint (`eslint`) passing
- [ ] Git commit and push to `origin/main`
