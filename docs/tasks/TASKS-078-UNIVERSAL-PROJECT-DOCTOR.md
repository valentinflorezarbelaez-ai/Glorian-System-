# TASKS-078: Universal Project Doctor & SDLC Acceleration Engine

- [x] Author INTAKE-078, CHANGE-078, SPEC-193, PLAN-078, and TASKS-078
- [x] Record Level 3 authorization in IMPLEMENTATION_AUTHORIZATION.md
- [ ] Implement `src/core/eosUniversalProjectDoctor.ts`
- [ ] Export in `src/core/index.ts`
- [ ] Wire subpath export `"./doctor"` in `package.json`
- [ ] Wire CLI command `glorian doctor` in `bin/commands/cliPlatform.mjs`
- [ ] Wire MCP action `action: "doctor"` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`
- [ ] Author test suite in `test/eosUniversalProjectDoctor.test.mjs`
- [ ] Run test suite and verify 100% pass
- [ ] Synchronize catalog index
