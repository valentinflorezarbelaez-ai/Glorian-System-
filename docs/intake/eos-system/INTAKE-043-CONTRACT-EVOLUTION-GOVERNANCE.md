# INTAKE-043 — CONTRACT EVOLUTION GOVERNANCE & BREAKING-CHANGE DETECTOR
**Target Architecture**: EOS System Layer-0 (`src/core/`)  
**Mission**: Frontera 3 (Nubank Sachem & Buf Semantic Diffing / Schema Evolution Gate)  
**Governance**: SPEC-050, CHANGE-043, ADR-056, v56.0.0  
**Status**: APPROVED

---

## 1. Context & Business Intent
In enterprise architectures (such as Nubank's event-driven Clojure/Datomic microservices, Spotify's Apollo/gRPC networks, and modern Prisma/GraphQL backends), unintentional breaking changes to schemas and contracts cause severe production outages, data corruption, and client desynchronization. Nubank solved this with Sachem (schema validation that enforces monotonic expansion over breaking mutations), and Google/Buf solved this with strict backward-compatibility linters.

EOS v56.0.0 implements an in-process, zero-dependency Contract Evolution Governor (`EosContractEvolutionGovernor`).

## 2. Technical Objectives
1. **Semantic Schema Diffing**: Compare baseline (vCurrent) and candidate (vNext) schema contracts across JSON Schema, TypeScript interfaces, and SQL DDL tables.
2. **Backward-Compatibility Categorization**:
   - `COMPATIBLE_EXPANSION`: Adding optional fields, widening enums with default values, adding new endpoints/tables.
   - `BREAKING_CONTRACTION`: Deleting fields, altering data types, changing optional fields to required, removing enum variants, or altering primary keys.
   - `DANGEROUS_MUTATION`: Renaming columns without dual-write support, adding non-null columns without defaults, or modifying unique constraints.
3. **Pre-Merge Gate Enforcement**: Fail-closed rejection of unversioned breaking changes without explicit migration strategy (`BREAKING_CHANGE_REJECTED`).
4. **SQL Migration Hazard Detection**: Detect table locks, drop columns, and non-nullable additions before executing migrations against live databases.
5. **Cryptographic Attestation & Ledger Recording**: Persist schema delta receipts into `EosDurableSqliteLedger`.

## 3. Boundaries & Constraints
- **Zero Runtime Dependencies**: Layer-0 pure TypeScript.
- **Node 24 Strip-Only Compliant**: No enum syntax, no namespaces, strict parameter typing.
- **Fail-Closed Security**: Unhandled schema mutations halt deployment pipelines.
