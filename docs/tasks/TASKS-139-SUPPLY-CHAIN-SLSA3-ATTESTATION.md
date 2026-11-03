# TASKS-139: Atomic Task DAG — Supply Chain SLSA Level 3 & CycloneDX SBOM Verification

## Task DAG
```text
Task 1: Elevate src/core/eosSlsaProvenanceSbom.ts with Dynamic Metadata & Full Inventory
  ↳ Task 2: Create scripts/eos-generate-sbom.mjs (CycloneDX v1.5 + In-toto v1)
    ↳ Task 3: Create scripts/verify-supply-chain.mjs (Fail-Closed Bit-for-Bit Validator)
      ↳ Task 4: Add supply-chain-attestation Job in .github/workflows/eos-sovereign-cicd.yml
        ↳ Task 5: Author Adversarial Test Suite test/eosSlsa3SupplyChain.test.mjs
          ↳ Task 6: Execute verify:strict, Record EVD-SPEC-139.json, Commit & Push
```

### Task 1: Elevate `src/core/eosSlsaProvenanceSbom.ts`
- **Goal**: Read dynamic version from `package.json`, target canonical `Glorian-System-` repository, and scan entrypoints (`bin/eos.mjs`, `index.html`, `src/index.ts`, `src/core/*.ts`).
- **Done Criteria**: `generateCycloneDxSbom()` and `generateSlsaProvenance()` produce dynamically versioned reports with zero hardcoded `66.0.0`.

### Task 2: Create `scripts/eos-generate-sbom.mjs`
- **Goal**: CLI script to emit `docs/evidence/sbom.cdx.json` and `docs/evidence/provenance.intoto.jsonl`.
- **Done Criteria**: Both files are generated and persisted with valid JSON formatting.

### Task 3: Create `scripts/verify-supply-chain.mjs`
- **Goal**: CLI script that reads `sbom.cdx.json` and `provenance.intoto.jsonl` and validates that file hashes match on-disk bytes.
- **Done Criteria**: Returns exit code 0 on clean match, exit code 1 on mismatch or missing files.

### Task 4: Add `supply-chain-attestation` in `.github/workflows/eos-sovereign-cicd.yml`
- **Goal**: CI job running on `push` to `main` with `permissions: { contents: read, id-token: write, attestations: write }`.
- **Done Criteria**: Validated workflow file syntax.

### Task 5: Author Adversarial Test Suite
- **Goal**: `test/eosSlsa3SupplyChain.test.mjs` verifying BDD-369, BDD-370, BDD-371.
- **Done Criteria**: Passes cleanly with `node --test test/eosSlsa3SupplyChain.test.mjs`.

### Task 6: Strict Verification & Push
- **Goal**: Run `verify-cicd-pipeline.mjs`, generate `docs/evidence/EVD-SPEC-139.json`, commit, and push.
- **Done Criteria**: Exit code 0, 7/7 stages passing.
