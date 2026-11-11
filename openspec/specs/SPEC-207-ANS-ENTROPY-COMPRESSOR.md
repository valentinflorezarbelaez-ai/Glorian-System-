# SPEC-207: Layer-0 Asymmetric Numeral Systems (ANS/rANS) Entropy Compressor

## Status

- **Status**: APPROVED
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Core / Information Theory & Lossless Compression
- **Standard**: Jarek Duda rANS (2014) / IEEE Information Theory / Shannon Entropy
- **Module**: `src/core/eosAnsEntropyCompressor.ts`

---

## 1. Context and Rationale

High-performance storage, consensus replication logs, and telemetry serialization require maximum compression ratio without introducing native C dependencies or sacrificing streaming decompression performance.

`EosAnsEntropyCompressor` implements Dr. Jarek Duda's range Asymmetric Numeral Systems (rANS) in pure TypeScript, enabling near-optimal Shannon entropy coding with zero external runtime dependencies.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-1054 (Ubiquitous - Symbol Frequency Normalization)**: `THE SYSTEM SHALL compute empirical symbol frequencies and normalize them to an exact total sum of M = 4096 ensuring every observed symbol has frequency at least 1.`

- **FR-1055 (Ubiquitous - Bounded rANS State Renormalization)**: `WHEN encoding a symbol, THE SYSTEM SHALL flush least significant bytes to a stream whenever x >= (L / f_s) * b to maintain state x within bounded interval [L, b*L - 1].`

- **FR-1056 (Ubiquitous - Exact Lossless Round-Trip Decoding)**: `WHEN decompressing an encoded stream, THE SYSTEM SHALL recover the exact original byte sequence byte-for-byte with identical SHA-256 hash.`

- **FR-1057 (Ubiquitous - Shannon Entropy & Efficiency Telemetry)**: `THE SYSTEM SHALL calculate theoretical Shannon entropy H(X) and report compression ratio, space savings, and divergence from the entropy limit.`

- **FR-1058 (Ubiquitous - Tamper-Evident Compression Receipts)**: `THE SYSTEM SHALL output immutable SHA-256 compression receipts detailing input size, compressed size, entropy, and payload integrity hashes.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-1054 Frequency table normalization and cumulative mapping
  GIVEN an arbitrary input byte buffer
  WHEN symbol frequencies are counted and normalized to total M = 4096
  THEN the sum of normalized frequencies exactly equals M
  AND cumulative frequency bounds are strictly monotonically non-decreasing.

SCENARIO: BDD-1055 rANS byte-level stream encoding and bounded state maintenance
  GIVEN a normalized frequency distribution
  WHEN symbols are encoded in reverse order using rANS transition rules
  THEN state x is renormalized to stay strictly within [L, b*L - 1]
  AND emitted bytes constitute a valid compact payload.

SCENARIO: BDD-1056 Lossless decompression and round-trip verification
  GIVEN a compressed rANS bitstream
  WHEN the decompressor iterates forward from initial state x
  THEN the exact original byte buffer is reconstructed byte-for-byte
  AND original and recovered SHA-256 digests match identically.

SCENARIO: BDD-1057 Shannon entropy calculation and compression ratio telemetry
  GIVEN skewed or repetitive data streams
  WHEN entropy analysis is executed
  THEN the computed Shannon entropy H(X) is strictly below 8 bits/symbol
  AND the compression ratio reflects entropy coding efficiency.

SCENARIO: BDD-1058 End-to-end CLI execution and cryptographic compression receipt
  GIVEN an input text or file passed to glorian compress:ans
  WHEN compression completes
  THEN the CLI outputs compressed byte length, ratio, and Shannon entropy
  AND provides an immutable SHA-256 compression receipt.
```

---

## 4. Architectural Boundaries and Invariants

1. **Law V Compliance**: Strictly zero external runtime dependencies (`"dependencies": {}`).
2. **Lossless Purity**: 100% round-trip lossless integrity across empty, single-byte, uniform, and arbitrary binary payloads.
3. **DbC Contracts**: Input validations and postcondition assertions on all compression results.
