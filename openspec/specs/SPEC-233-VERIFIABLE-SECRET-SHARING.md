# SPEC-233 — Layer-0 Verifiable Secret Sharing Engine (Feldman & Pedersen VSS)

## Metadata

- **SPEC ID**: SPEC-233
- **Change ID**: CHANGE-118
- **Intake ID**: INTAKE-118
- **Status**: APPROVED
- **Version**: 1.0.0
- **Date**: 2026-11-12
- **Layer**: Layer-0 (Zero external runtime dependencies)
- **Module**: `EosVerifiableSecretSharingCore`

---

## 1. Overview

`EosVerifiableSecretSharingCore` provides a non-interactive Verifiable Secret Sharing (VSS) engine implementing
both Feldman VSS and Pedersen VSS schemes:

1. **Feldman's Homomorphic Commitments**: Dealer publishes $C_j = g^{a_j} \pmod p$ allowing participants to verify $g^{s_i} \equiv \prod (C_j)^{i^j} \pmod p$.
2. **Invalid Share Detection**: Participants can detect shares inconsistent with the public commitment package; reconstruction can exclude invalid supplied shares when enough valid shares remain. This is not identity proof or a standalone proof of malfeasance.
3. **Pedersen Dual-Generator Commitment**: Uses fixed generators $g$ and $h$ and a blinding polynomial. The commitment is information-theoretically hiding when the blinding scalar is uniform and the discrete-log relation between generators is unknown; this commitment is not itself a zero-knowledge proof.
4. **Exact Threshold Reconstruction**: Robust Lagrange interpolation over prime fields $\mathbb{F}_q$.
5. **Bounded JSON Serialization**: A dealer archive can be serialized for protected storage; `serializeForParticipant` creates a package containing one private share and the public commitments. The full archive contains all shares and must not be sent to participants.
6. **Experimental Security Status**: The implementation is not approved for production secrets pending independent cryptographic review. JavaScript BigInt is not guaranteed constant-time.

---

## 2. Functional Requirements (EARS Syntax)

**FR-233-001** (Event-Driven)
WHEN a non-empty bounded secret and parameters $2 \le k \le n \le 64$ are provided, THE SYSTEM SHALL generate a random polynomial
$f(x) = s + \sum_{j=1}^{k-1} a_j x^j \pmod q$, compute $n$ distinct participant shares $s_i = (i, f(i) \pmod q)$ for $i \in [1, n]$,
AND compute coefficient commitments $C_j = g^{a_j} \pmod p$ for $j \in [0, k-1]$.

**FR-233-002** (Event-Driven)
WHEN `verifyShare(share, commitments)` is executed by participant $i$, THE SYSTEM SHALL evaluate whether
$g^{s_i} \equiv \prod_{j=0}^{k-1} (C_j)^{i^j} \pmod p$, returning `true` IF the share is mathematically consistent,
OR `false` IF the share has been tampered with or corrupted.

**FR-233-003** (Event-Driven)
WHEN `reconstruct(shares, k, commitments)` is executed, THE SYSTEM SHALL validate bounded, distinct participant shares against the commitment package, calculate Lagrange basis
coefficients $\ell_i(0) = \prod_{j \in S, j \ne i} \frac{-j}{i - j} \pmod q$ AND reconstruct the original secret $s = \sum_{i \in S} s_i \cdot \ell_i(0) \pmod q$.

**FR-233-004** (Error / Unwanted Condition)
SI a supplied share fails verification during reconstruction, ENTONCES THE SYSTEM SHALL report its participant ID as invalid, exclude it, AND successfully reconstruct the secret IF at least $k$ valid shares remain. This result SHALL NOT be represented as proof of identity or malfeasance.

**FR-233-005** (Ubiquitous)
THE SYSTEM SHALL support Pedersen VSS with dual generators $(g, h)$ and blinding polynomials for information-theoretic hiding under the stated generator assumptions,
AND provide bounded serialization and deserialization, including a participant-specific package containing exactly one private share.

---

## 3. Non-Functional Requirements

- **NFR-233-A** Zero external runtime dependencies; `dependencies` in `package.json` must remain `{}`.
- **NFR-233-B** The implementation SHALL expose benchmarkable share-verification operations; latency targets SHALL be set only after reproducible benchmarks on supported runtimes.
- **NFR-233-C** Reconstruction SHALL reject duplicate or out-of-range shares and SHALL be benchmarked with bounded inputs.
- **NFR-233-D** Modular arithmetic SHALL use the fixed RFC 3526 MODP Group 15 parameters and native BigInt; the implementation remains experimental pending independent review.
- **NFR-233-E** Serialized input SHALL be size-bounded and schema-validated before processing.

---

## 4. BDD Acceptance Scenarios

### BDD-1184 — Feldman VSS Share Generation and Homomorphic Commitments

```gherkin
SCENARIO: Dealer splits a secret into (k, n) verifiable shares with coefficient commitments
  GIVEN a bounded non-empty secret and threshold parameters k = 3, n = 5
  WHEN dealer executes splitSecret(s, 3, 5)
  THEN exactly 5 shares MUST be generated
  AND exactly 3 public commitments C0, C1, C2 MUST be generated
  AND C0 MUST equal g^s mod p
```

### BDD-1185 — Independent Share Verification and Tamper Detection

```gherkin
SCENARIO: Participant verifies honest share and rejects corrupted share
  GIVEN valid Feldman shares and public commitments for threshold (3, 5)
  WHEN each participant i verifies their share using verifyShare(share_i, commitments)
  THEN all 5 honest shares MUST return true
  AND verifying an altered share (with modified value) MUST return false
```

### BDD-1186 — Threshold Reconstruction from Any k Valid Shares

```gherkin
SCENARIO: Any k distinct shares reconstruct the exact original secret
  GIVEN 5 valid Feldman shares for a secret
  WHEN any 3 distinct shares are chosen (e.g., shares {1, 3, 5} or {2, 3, 4})
  THEN reconstruct(chosenShares, 3, commitments) MUST return the exact original secret
  AND providing fewer than k shares MUST fail with an explicit error
```

### BDD-1187 — Invalid Share Detection and Exclusion

```gherkin
SCENARIO: Invalid supplied share is detected and filtered during reconstruction
  GIVEN 4 shares where 3 are valid and 1 fails verification against the commitments
  WHEN reconstruct(shares, 3, commitments) is executed
  THEN the invalid share's participant ID MUST be reported and excluded
  AND the original secret MUST be successfully recovered from the remaining 3 valid shares
```

### BDD-1188 — Pedersen Dual-Generator VSS and Serialization Roundtrip

```gherkin
SCENARIO: Pedersen VSS with blinding polynomial round-trips via serialization
  GIVEN a secret split via Pedersen VSS with generators g and h
  WHEN the dealer archive is serialized via serialize() and restored via deserialize()
  THEN every restored share MUST verify against the restored commitments
  AND a participant package created by serializeForParticipant() MUST contain only that participant's share
  AND reconstructed secret MUST match original
```

### BDD-1189 — Bounds and Participant-Specific Serialization

```gherkin
SCENARIO: Reject unbounded inputs and transport one private share per participant
  GIVEN a valid dealer deal and participant ID in the configured range
  WHEN serializeForParticipant(deal, participantId) is executed
  THEN the package MUST contain exactly one private share and the public commitments
  AND invalid IDs, malformed packages, duplicate shares, or inputs over configured limits MUST be rejected
```
