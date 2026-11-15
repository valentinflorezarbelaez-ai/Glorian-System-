# CHANGE-139: Zero-Downtime Database Migration Governor (SPEC-277)

## 1. Metadata

- **Change ID**: `CHANGE-139`
- **Specification ID**: `SPEC-277`
- **Domain**: Cloud Database Reliability, DDL Safety & Lock Mitigation
- **Status**: `PROPOSED`
- **Target Release**: `v75.0.0`
- **Author**: Glorian Control Plane Core Team

## 2. Intent & Scope

Introduces sovereign database migration governance for Postgres and Neon environments:

- Lexical AST analysis of `.sql` migration files to detect operations taking exclusive table locks (`ACCESS EXCLUSIVE`).
- Enforcement of `CONCURRENTLY` on index creation, `NOT VALID` on constraint addition, and explicit `lock_timeout` / `statement_timeout`.
- Verification of Expand/Contract lifecycle across staged schema evolutions.
- Deterministic down-migration generation for reversibility.
- CLI commands: `toolchain:db:lint`, `toolchain:db:audit`, `toolchain:db:plan`.

## 3. Invariants Preserved

- `dependencies: {}` maintained (pure Layer-0 TypeScript).
- Exactly 12/12 serverless functions in `/api/`.
- All modules strictly $\le 744$ lines.
- Cryptographic SHA-256 verifiable receipts in `docs/evidence/MIGRATION_RECEIPT.json`.
