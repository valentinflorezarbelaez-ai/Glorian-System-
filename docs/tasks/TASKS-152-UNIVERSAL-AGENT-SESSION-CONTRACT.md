# TASKS-152: Universal Agent Session Contract

1. Author SPEC-152 package and Level 3 authorization entry.
   Done when openspec audit reports SPEC-152 with zero orphan links for CHANGE-087.
2. Implement `EosUniversalAgentSessionContract` with open / record / authorize.
   Done when BDD-461..463 pass.
3. Add `createRealVerificationGatePort` and scorecard floor `BLOCKED`.
   Done when BDD-464..465 pass.
4. Wire MCP tool `eos_agent_session_contract` and catalog enum.
   Done when BDD-466 passes and `npm run mcp:verify` exits 0.
5. Add `UniversalAgentSessionContract.tla` + bounded JS simulation.
   Done when `verifyUniversalAgentSessionContractModel()` is in `runAllFormalVerifications()`.
6. Run typecheck and dedicated test file with exit 0.
