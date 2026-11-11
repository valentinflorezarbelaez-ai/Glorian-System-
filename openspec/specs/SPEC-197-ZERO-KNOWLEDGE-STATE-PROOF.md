# SPEC-197: Zero-Knowledge Merkle State Attestation Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Product / Core Tooling
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / RFC 6962 / W3C Verifiable Credentials
- **Module**: `src/core/eosZkStateProof.ts`
- **Composes**: SPEC-192 (SLSA Supply Chain), SPEC-191 (Neuro-Symbolic Verifier), SPEC-186 (Enterprise Facade)

---

## 1. Context and Rationale

Modern regulated industries (defense, finance, aerospace, intelligence) operate under strict non-disclosure boundaries and air-gapped environments. When verifying compliance with architectural specifications, supply-chain constraints, or security gates, exposing the full repository or codebase introduces unacceptable IP leakage and security risks.

`EosZkStateProof` provides a mathematical zero-knowledge state attestation engine based on salted binary Merkle trees. An organization can prove to any client, auditor, or regulator that an exact requirement was verified and sealed into the public state root without disclosing a single line of proprietary source code.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1004 (Ubiquitous - Salted State Leaf Generation)**: `THE SYSTEM SHALL generate deterministic, salted cryptographic leaf digests for every architectural specification and compliance invariant.`

- **FR-1005 (Ubiquitous - Binary Merkle Tree Construction)**: `THE SYSTEM SHALL construct a balanced binary Merkle tree over the state leaves, yielding an immutable 64-character hex Merkle state root.`

- **FR-1006 (Event-Driven - Zero-Knowledge Inclusion Proof Synthesis)**: `WHEN an inclusion proof is requested for a specific claim or specId, THE SYSTEM SHALL generate an O(log N) audit path of sibling digests without revealing neighboring leaf pre-images.`

- **FR-1007 (Event-Driven - Constant-Time Proof Verification)**: `WHEN an inclusion proof and public Merkle root are submitted, THE SYSTEM SHALL reconstruct the candidate root in logarithmic time and verify equality with the expected root.`

- **FR-1008 (Ubiquitous - Cryptographic Proof Attestation Receipt)**: `THE SYSTEM SHALL emit a tamper-evident SHA-256 receipt containing the proof identifier, claim hash, root hash, and verification status.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1004 Binary Merkle tree generation over state leaves
  GIVEN a collection of state commitments
  WHEN buildMerkleTree is invoked
  THEN a balanced Merkle tree is computed
  AND an immutable 64-character hex Merkle root is produced

SCENARIO: BDD-1005 Zero-Knowledge selective disclosure proof generation
  GIVEN a Merkle tree containing a compliance claim for "SPEC-193"
  WHEN generateInclusionProof is executed for "SPEC-193"
  THEN an audit path of sibling digests is generated
  AND no other leaf pre-images are disclosed in the proof

SCENARIO: BDD-1006 Inclusion proof verification matching public Merkle root
  GIVEN a valid inclusion proof and the public Merkle root
  WHEN verifyProof is evaluated
  THEN verification succeeds with result=true
  AND the computed root strictly matches expectedMerkleRoot

SCENARIO: BDD-1007 Tampered proof rejection
  GIVEN an inclusion proof where a sibling digest or the claim payload is modified
  WHEN verifyProof is evaluated
  THEN verification fails with result=false

SCENARIO: BDD-1008 Cryptographic receipt generation and CLI invocation
  GIVEN the Glorian CLI
  WHEN glorian zk:prove --spec=SPEC-193 --json is executed
  THEN a valid JSON proof object is emitted with verified=true and sha256Receipt
```

---

## 4. Architectural Invariants

1. **Law I (Zero Vibe Coding)**: Merkle tree construction and path hashing are mathematically pure and deterministic.
2. **Law V (Zero Runtime Dependencies)**: Pure Node.js standard modules (`node:crypto`).
3. **Law VII (Layer-0 Isolation)**: Proof evaluation occurs strictly in memory without side-effects.
