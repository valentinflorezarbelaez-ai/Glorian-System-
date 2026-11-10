# TASKS-079: Universal Code Remediation Engine Checklist

- [x] Create INTAKE-079, CHANGE-079, SPEC-194, PLAN-079
- [x] Register Level-3 Authorization in `IMPLEMENTATION_AUTHORIZATION.md`
- [ ] Implement `src/core/eosUniversalCodeRemediator.ts`
- [ ] Export in `src/core/index.ts` and `"./remediator"` in `package.json`
- [ ] Implement CLI command `glorian fix [path]` in `bin/commands/cliPlatform.mjs`
- [ ] Wire MCP action `remediate` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`
- [ ] Implement test suite `test/eosUniversalCodeRemediator.test.mjs` (100% passing)
- [ ] Synchronize catalog index to 189 specs
- [ ] Typecheck (`tsc`) and Lint (`eslint`) passing
- [ ] Git commit and push to `origin/main`
