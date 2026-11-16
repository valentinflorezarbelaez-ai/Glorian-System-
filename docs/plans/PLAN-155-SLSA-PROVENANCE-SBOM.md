# PLAN-155: SLSA Level 3/4 Attestations, In-Toto Provenance & Cryptographic SBOM Governor

- **Plan ID**: `PLAN-155`
- **Change ID**: `CHANGE-155`
- **Spec Reference**: `SPEC-293`
- **Status**: `APPROVED`
- **Target Module**: `src/core/eosSlsaProvenanceGovernor.ts`
- **Tier**: Software Supply Chain Security & SLSA Provenance
- **Owner**: `user:valentin-florez-arbelaez`

---

## 1. Architectural Strategy

The SLSA Provenance and SBOM Governor establishes mathematical software supply chain security for Glorian System, certifying that artifacts, codebases, and verification results originate from authentic, tamper-proof sources without relying on heavy external binary toolchains (Syft, Cosign).

### Pure Layer-0 Architecture (Law V)

1. **In-Process SBOM Generator (`EosSbomGenerator`)**:
   - Synthesizes industry-compliant **CycloneDX v1.5** and **SPDX 2.3** JSON documents.
   - Extracts component inventories from repository packages and build outputs.
   - Computes deterministic SHA-256 content hashes using native `node:crypto`.
2. **In-Toto v1 Statement & SLSA v1.0 Provenance Attestor (`EosSlsaAttestor`)**:
   - Assembles in-toto v1 Statement envelopes (`https://in-toto.io/Statement/v1`).
   - Generates SLSA v1.0 Provenance predicates (`https://slsa.dev/provenance/v1`).
   - Captures `buildDefinition` (builder ID, source repository URI, git commit digest, entry points).
   - Captures `runDetails` (execution invocation ID, timestamps, verification receipts, byproducts).
3. **Dead Simple Signing Envelope (DSSE) Engine (`EosDsseSigner`)**:
   - Implements standard DSSE Pre-Authentication Encoding (PAE):
     $$\text{PAE}(\text{type}, \text{payload}) = \text{"DSSEv1 "} + \text{len}(\text{type}) + \text{" "} + \text{type} + \text{" "} + \text{len}(\text{payload}) + \text{" "} + \text{payload}$$
   - Generates and uses native Ed25519 asymmetric cryptographic key pairs via `node:crypto`.
   - Produces DSSE envelope structures with base64 payload and signatures.
   - Performs fail-closed signature validation and payload tamper detection.
4. **SLSA Level Evaluator & Policy Gate (`evaluateSlsaLevel`)**:
   - Evaluates SLSA Levels 1, 2, and 3 according to OpenSSF SLSA v1.0 specification criteria.
   - Verifies isolated build, tamper-resistance, cryptographic signatures, and source traceability.
5. **Cryptographic Provenance Audit Receipt**:
   - Persists execution metadata, attested artifacts, and SHA-256 seal at `docs/evidence/SLSA_PROVENANCE_RECEIPT.json`.

---

## 2. Component Design & Interfaces

```typescript
export interface SbomComponent {
  name: string;
  version: string;
  purl?: string;
  type: "library" | "application" | "file";
  sha256: string;
  license?: string;
}

export interface CycloneDxDocument {
  bomFormat: "CycloneDX";
  specVersion: "1.5";
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    component: {
      name: string;
      version: string;
      type: string;
    };
  };
  components: SbomComponent[];
}

export interface SpdxDocument {
  spdxVersion: "SPDX-2.3";
  dataLicense: "CC0-1.0";
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: string[];
  };
  packages: Array<{
    SPDXID: string;
    name: string;
    versionInfo: string;
    checksums: Array<{ algorithm: "SHA256"; checksumValue: string }>;
    licenseConcluded?: string;
  }>;
}

export interface InTotoStatement {
  _type: "https://in-toto.io/Statement/v1";
  subject: Array<{
    name: string;
    digest: Record<string, string>;
  }>;
  predicateType: "https://slsa.dev/provenance/v1";
  predicate: SlsaV1Predicate;
}

export interface SlsaV1Predicate {
  buildDefinition: {
    buildType: string;
    externalParameters: Record<string, any>;
    internalParameters?: Record<string, any>;
    resolvedDependencies?: Array<{
      uri: string;
      digest: Record<string, string>;
    }>;
  };
  runDetails: {
    builder: {
      id: string;
      version?: string;
    };
    metadata: {
      invocationId: string;
      startedOn: string;
      finishedOn: string;
    };
    byproducts?: Array<{
      name: string;
      digest: Record<string, string>;
    }>;
  };
}

export interface DsseEnvelope {
  payload: string; // base64
  payloadType: string;
  signatures: Array<{
    keyid: string;
    sig: string; // base64
  }>;
}
```

---

## 3. Rejected Alternatives & Tradeoffs

- **Invoking External CLI (Syft / Cosign)**: Rejected because it violates Law V (zero external runtime dependencies and air-gapped execution reproducibility).
- **RSA-2048 Signatures**: Rejected in favor of Ed25519 due to constant-time execution, 32-byte public keys, and resistance to side-channel timing attacks.
- **Custom Non-Standard Envelope**: Rejected in favor of the in-toto DSSE standard to maintain interoperability with Sigstore, Tekton, and GitHub Actions attestations.
