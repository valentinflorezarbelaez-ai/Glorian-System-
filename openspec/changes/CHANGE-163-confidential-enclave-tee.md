# CHANGE-163: Confidential Computing in Hardware TEEs (AWS Nitro / AMD SEV-SNP)

- **Change ID**: `CHANGE-163`
- **Spec Reference**: `SPEC-301`
- **Tier**: Confidential Computing, Hardware TEEs & Secret Custody (Phase 4.2)
- **Status**: `PROPOSED`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:22:00Z

---

## 1. Intent & Scope

Implement Phase 4.2 of the Master Engineering Roadmap (`ROADMAP.md`): Confidential Computing in Hardware TEEs (AWS Nitro Enclaves, AMD SEV-SNP, Intel SGX/TDX), introducing **SPEC-301**.
The engine governs hardware-enforced memory isolation, calculates Platform Configuration Registers (PCR0, PCR1, PCR2, PCR8), generates and verifies cryptographically signed remote attestation documents, seals sensitive secrets to enclave measurements via HKDF and AES-256-GCM, rejects execution upon measurement drift or payload tampering, and produces verifiable cryptographic evidence at `docs/evidence/TEE_ENCLAVE_RECEIPT.json`.

---

## 2. Delta Specification Summary

### Added Modules

- `src/core/eosConfidentialEnclaveGovernor.types.ts`: Type definitions for PCR measurements, attestation documents, hardware roots of trust, sealed secret payloads, and audit receipts.
- `src/core/eosConfidentialEnclaveGovernor.ts`: Core confidential enclave governor providing PCR computation, attestation generation/verification, HKDF hardware sealing, and anti-tamper guards.
- `bin/commands/cliConfidentialEnclave.mjs`: CLI subdispatcher for `toolchain:enclave:*`.
- `test/eosConfidentialEnclaveGovernor.test.mjs`: Full test suite covering BDD-1581..BDD-1586.
- `docs/evidence/TEE_ENCLAVE_RECEIPT.json`: Cryptographic verification receipt.

### Modified Modules

- `bin/commands/cliToolchainRouter.mjs`: Add lazy dispatch for `toolchain:enclave:`.
- `bin/commands/cliHelpCatalog.mjs`: Register 4 new CLI commands (`toolchain:enclave:attest`, `toolchain:enclave:seal`, `toolchain:enclave:unseal`, `toolchain:enclave:verify`).
- `docs/DEVELOPER_GUIDE.md`: Document CLI commands in developer guide.
- `src/core/index.ts`: Re-export types and engine.
- `IMPLEMENTATION_AUTHORIZATION.md`: Record Level 3 authorization.

---

## 3. Invariants & Guardrails

- **Law V**: Zero runtime third-party dependencies (`dependencies: {}`) using native Node.js 22.18+ / `node:crypto`.
- **SPEC-250**: File line ceiling $\le 800$ lines with $\ge 12$ lines of headroom.
- **Vercel Hobby Plan Limits**: Strictly 12/12 serverless functions in `/api/`.
- **Command Parity**: 100.00% parity verified by `hygiene:audit`.
