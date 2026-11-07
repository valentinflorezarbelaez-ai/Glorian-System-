# SPEC-144: Native Protobuf Wire-Format Agent Contract Engine

## Status

- **Status**: APPROVED
- **Date**: 2026-11-07
- **Author**: Valentín Flórez Arbeláez (Architect & Owner)
- **Lifecycle Tier**: Production
- **Standard**: IEEE 830 / ISO/IEC/IEEE 29148 / EOS Agent Constitution

---

## 1. Context and Rationale

Inter-agent communication in the EOS swarm, the BFT consensus nodes, and the Hrana replication stream all benefit from a strict binary contract rather than ad-hoc JSON. `EosProtobufContractEngine` (`src/core/eosProtobufContractEngine.ts`) implements the Protocol Buffers proto3 wire format natively using only `node:buffer` and `node:crypto`, matching the Binary Inter-Agent Contracts scope declared in the module header.

The engine supports the four proto3 wire types (0 varint, 1 fixed-64, 2 length-delimited, and 5 fixed-32) across the standard scalar, string, bytes, embedded-message, enum, and repeated field shapes. Encoding is schema-driven: a registered `ContractSchema` names each field's tag, wire type, and logical type, and the encoder writes the combined tag/wire-type key followed by the encoded value, omitting absent fields and expanding repeated ones.

The codec is intentionally self-contained under Law V: it relies only on Node built-ins and the `eosKernelPrimitives.ts` helpers (`assertPrecondition`, `deepFreeze`, `pureSha256`). Every encoded payload carries a deterministic SHA-256 digest, and each schema exposes a stable 16-character fingerprint so contract changes can be versioned and diffed.

---

## 2. Functional Requirements (EARS Syntax)

- **FR-531 (Ubiquitous - Zero-Dependency Wire Format)**: `The system shall encode and decode proto3 wire-format payloads using only Node built-in modules, with no external runtime dependency.`
- **FR-532 (Event-Driven - Schema Registration)**: `When a schema whose field tags all fall within 1..536870911 is registered, the system shall store a frozen descriptor keyed by its name.`
- **FR-533 (Event-Driven - Object Encoding)**: `When a plain object is encoded against a registered schema, the system shall emit a tag/wire-type key and value for each present field, omit undefined and null fields, and expand repeated fields into multiple entries.`
- **FR-534 (State-Driven - Length-Delimited Decoding)**: `While decoding string, bytes, or embedded-message fields, the system shall read a varint length prefix and slice exactly that many bytes.`
- **FR-535 (Unwanted Condition - Unknown Fields)**: `If a decoded field tag is absent from the schema, then the system shall skip the field according to its wire type without failing.`
- **FR-536 (Ubiquitous - Deterministic Fingerprint and Digest)**: `The system shall expose a stable 16-character schema fingerprint and a deterministic SHA-256 digest of each encoded payload.`

---

## 3. Acceptance Criteria (BDD Gherkin)

```gherkin
SCENARIO: BDD-531 String, integer, and boolean roundtrip
GIVEN a registered schema with string, int32, and bool fields
WHEN an object is encoded and then decoded against that schema
THEN the decoded string, integer, and boolean values equal the originals
AND the encoded payload reports a positive byte size and a 64-character digest
```

```gherkin
SCENARIO: BDD-532 Bytes and double roundtrip
GIVEN a registered schema with a bytes field and a double field
WHEN a byte array and a floating-point value are encoded and decoded
THEN the decoded byte array equals the original bytes exactly
AND the decoded double matches the original within floating-point tolerance
```

```gherkin
SCENARIO: BDD-533 Repeated fields and zigzag-encoded negatives
GIVEN a schema with a repeated string field and a schema with a sint32 field
WHEN a repeated list and a negative signed value are encoded and decoded
THEN the decoded list preserves order and content
AND the decoded signed integer equals the negative original
```

```gherkin
SCENARIO: BDD-534 Unknown field skipping and stable identity
GIVEN a payload encoded under one schema but decoded under a schema lacking those tags
WHEN the payload is decoded
THEN unknown tags are skipped without throwing
AND the schema fingerprint is a stable 16-character string
AND the registered schemas are listed in sorted order
```

---

## 4. Architecture Decision Records (ADRs)

- **ADR-144-1: Hand-written proto3 wire codec instead of a protobuf runtime**

  - _Context_: Using a protobuf runtime library would breach Law V and add a large third-party surface to a security-sensitive contract boundary.
  - _Decision_: Implement varint, zigzag, fixed-width, and length-delimited encoding and decoding directly against the proto3 specification using only Node built-ins.
  - _Consequence_: The codec is auditable, dependency-free, and deterministic; the trade-off is that schema compilation (`.proto` parsing) must be expressed as in-code descriptors.

- **ADR-144-2: Deterministic schema fingerprint for contract versioning**
  - _Context_: A silent field-tag change would corrupt binary compatibility between agents without any compile-time signal.
  - _Decision_: Derive a stable 16-character fingerprint from the canonical `tag:name:wireType:type` field list so any contract change alters the fingerprint.
  - _Consequence_: Contract drift becomes observable and diffable; the trade-off is that renames or reorderings also change the fingerprint even when wire-compatible.

---

## 5. Atomic Task DAG

1. [x] **TASK-144-1**: Author this specification (EARS requirements, BDD scenarios, ADR) and link it to the module header.
2. [x] **TASK-144-2**: Implement `EosProtobufContractEngine` (`src/core/eosProtobufContractEngine.ts`) with schema registration and the varint/zigzag primitives.
3. [x] **TASK-144-3**: Implement value encoding/decoding for every supported field type plus unknown-field skipping and schema fingerprints.
4. [x] **TASK-144-4**: Add `test/eosProtobufContractEngine.test.mjs` covering every BDD scenario (roundtrips, repeated fields, negatives, unknown fields, fingerprints).
