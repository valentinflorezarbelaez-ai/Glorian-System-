# CHANGE-084: Post-Quantum Cryptographic Key Encapsulation & Lattice Signatures (NIST FIPS 203/204)

- **Change ID**: `CHANGE-084`
- **Spec**: `SPEC-199`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosPostQuantumCryptography.ts`:
     - Class `EosPostQuantumCryptography`:
       - `generateMlKemKeyPair(level?: MlKemLevel): MlKemKeyPair`
       - `encapsulateMlKem(publicKeyHex: string): MlKemCiphertextResult`
       - `decapsulateMlKem(ciphertextHex: string, privateKeyHex: string): { sharedSecretHex: string }`
       - `generateHybridKemKeyPair(): HybridKemKeyPair`
       - `encapsulateHybridKem(publicKey: HybridKemPublicKey): HybridKemResult`
       - `decapsulateHybridKem(ciphertext: HybridKemCiphertext, privateKey: HybridKemPrivateKey): { sharedSecretHex: string }`
       - `generateMlDsaKeyPair(): MlDsaKeyPair`
       - `signMlDsa(message: Buffer | string, signingKeyHex: string): { signatureHex: string }`
       - `verifyMlDsa(message: Buffer | string, signatureHex: string, verificationKeyHex: string): boolean`
       - `signHybrid(message: Buffer | string, privateKeys: HybridSignaturePrivateKey): HybridSignatureResult`
       - `verifyHybrid(message: Buffer | string, signature: HybridSignatureResult, publicKeys: HybridSignaturePublicKey): boolean`
2. **Package Exports**:
   - Add `"./post-quantum": "./src/core/eosPostQuantumCryptography.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian pq:kem [--hybrid] [--json]`
   - `glorian pq:sign <mensaje> [--hybrid] [--json]`
   - `glorian pq:verify <mensaje> <firma> <clave> [--hybrid] [--json]`
4. **MCP Actions**:
   - `action: "pq_kem"`
   - `action: "pq_verify"`
5. **Testing**:
   - `test/eosPostQuantumCryptography.test.mjs` (BDD-1014..BDD-1018).
