# TASKS-163: Confidential Computing in Hardware TEEs (AWS Nitro / AMD SEV-SNP)

- **Tasks ID**: `TASKS-163`
- **Change ID**: `CHANGE-163`
- **Spec Reference**: `SPEC-301`
- **Tier**: Confidential Computing, Hardware TEEs & Secret Custody (Phase 4.2)
- **Status**: `READY`
- **Owner**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-16T09:22:00Z

---

## Task Dependency Graph (DAG)

```text
[TASK-163-01: Types Definition]
       │
       ▼
[TASK-163-02: Core Enclave Governor Implementation]
       │
       ▼
[TASK-163-03: Core Re-export & Typecheck]
       │
       ▼
[TASK-163-04: CLI Subdispatcher Implementation]
       │
       ▼
[TASK-163-05: CLI Router, Catalog & Developer Guide Registration]
       │
       ▼
[TASK-163-06: Test Suite (BDD-1581..BDD-1586)]
       │
       ▼
[TASK-163-07: Tip Refresh & Pre-Push Gate Sealing]
```

---

## Detailed Task Breakdown

### TASK-163-01: Types Definition

- Create `src/core/eosConfidentialEnclaveGovernor.types.ts`.
- Define `EnclavePcrRegisters`, `EnclaveAttestationDocument`, `EnclaveVerificationResult`, `SealedPayload`, `EnclaveAuditReceipt`.
- Done Criteria: Clean compilation under `tsc --noEmit`.

### TASK-163-02: Core Enclave Governor Implementation

- Create `src/core/eosConfidentialEnclaveGovernor.ts`.
- Implement `EosConfidentialEnclaveGovernor` class:
  - `computePcrRegisters(definition)`: Computes PCR0, PCR1, PCR2, PCR8.
  - `generateAttestationDocument(enclave, nonce)`: Signs attestation with Root-of-Trust.
  - `verifyAttestationDocument(attestation, baselinePcrs, expectedNonce)`: Cryptographic verification of RoT signature, nonce freshness, and PCR equality.
  - `sealSecret(plaintext, pcrs, rootSecret)`: HKDF key derivation + AES-256-GCM encryption.
  - `unsealSecret(sealedPayload, pcrs, rootSecret)`: GCM authentication check + decryption.
  - `auditConfidentialEnclavePipeline(options)`: Writes `docs/evidence/TEE_ENCLAVE_RECEIPT.json`.
- Done Criteria: Under 800 lines with $\ge 12$ lines headroom, 0 external dependencies.

### TASK-163-03: Core Re-export & Typecheck

- Export in `src/core/index.ts`.
- Run `npm run typecheck` to verify 0 errors.

### TASK-163-04: CLI Subdispatcher Implementation

- Create `bin/commands/cliConfidentialEnclave.mjs`.
- Implement subcommands: `toolchain:enclave:attest`, `toolchain:enclave:seal`, `toolchain:enclave:unseal`, `toolchain:enclave:verify`.

### TASK-163-05: CLI Router, Catalog & Developer Guide Registration

- Update `bin/commands/cliToolchainRouter.mjs` with lazy import for `toolchain:enclave:`.
- Register 4 commands in `bin/commands/cliHelpCatalog.mjs`.
- Add documentation in `docs/DEVELOPER_GUIDE.md`.
- Verify 100.00% parity with `node bin/eos.mjs hygiene:audit`.

### TASK-163-06: Test Suite (BDD-1581..BDD-1586)

- Create `test/eosConfidentialEnclaveGovernor.test.mjs`.
- Test all 6 BDD scenarios (PCR calculation, attestation generation/verification, secret sealing/unsealing, drift rejection, receipt generation).
- Run `node --test test/eosConfidentialEnclaveGovernor.test.mjs` and confirm 100% pass.

### TASK-163-07: Tip Refresh & Pre-Push Gate Sealing

- Run `node scripts/tip-refresh.mjs`.
- Stage, commit, seal pin, and push to `origin/main`.
