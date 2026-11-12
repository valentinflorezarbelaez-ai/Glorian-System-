# CHANGE-112: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65)

- **Change ID**: `CHANGE-112`
- **Spec ID**: `SPEC-227`
- **Title**: Layer-0 Post-Quantum Digital Signature Algorithm (NIST FIPS 204 ML-DSA-65 / Dilithium) Core Engine
- **Status**: `PROPOSED`
- **Target Subsystem**: `src/core/eosPostQuantumMlDsaCore.ts`
- **Related Specs**: `SPEC-221` (ML-KEM-768), `SPEC-219` (FROST Threshold Signatures), `SPEC-086` (SecDevOps Guard), `SPEC-057` (Samael Nexus)

## 1. Intent & Scope

Provide a standalone, sovereign, Layer-0 Pure TypeScript implementation of the NIST FIPS 204 Module-Lattice Digital Signature Algorithm (ML-DSA-65).
Enables post-quantum quantum-resistant code attestation, release artifact signing, git commit sealing, and sovereign identity verification across all 9 fleet repositories without relying on third-party cryptographic npm packages.

## 2. Deliverables

1. `openspec/specs/SPEC-227-POST-QUANTUM-ML-DSA.md`: Formal specification with EARS requirements (FR-1154..FR-1158) and Gherkin BDD scenarios (BDD-1154..BDD-1158).
2. `docs/plans/PLAN-112-POST-QUANTUM-ML-DSA.md`: Architecture design and ADR-227.
3. `docs/tasks/TASKS-112-POST-QUANTUM-ML-DSA.md`: Atomic implementation task DAG.
4. `src/core/eosPostQuantumMlDsaCore.types.ts`: Clean interface definitions and types.
5. `src/core/eosPostQuantumMlDsaCore.ts`: Core cryptographic implementation.
6. `bin/commands/cliMlDsaMesh.mjs`: CLI subcommands dispatch.
7. `test/eosPostQuantumMlDsaCore.test.mjs`: Comprehensive BDD unit test suite.
8. Registration in `src/core/index.ts`, `cliPlatform.mjs`, `eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.
9. Documentation update in `docs/DEVELOPER_GUIDE.md` (Module 42).
