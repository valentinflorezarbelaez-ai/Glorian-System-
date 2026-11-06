# PLAN-043 & ADR-056 — CONTRACT EVOLUTION GOVERNANCE ARCHITECTURE
**Status**: ACCEPTED  
**Date**: 2026-10-30  
**Context**: SPEC-050, CHANGE-043, EOS v56.0.0  

---

## Architecture Decision Record (ADR-056)

### Context
When microservices, clients, and database schemas evolve asynchronously, subtle backward-incompatible changes (e.g. deleting a field, renaming a column, or narrowing an enum) cause runtime exceptions. Nubank Sachem and Buf CLI proved that automated semantic diffing at CI/CD time prevents breaking contract mutations.

### Decision
1. **Schema AST Representation**: Parse schema contracts into an abstract dictionary of typed fields:
   - `fieldName`: string
   - `fieldType`: string
   - `optional`: boolean
   - `defaultValue`?: unknown
2. **Semantic Diff Engine**:
   - Compare base fields vs candidate fields.
   - Categorize added fields: optional -> `COMPATIBLE_EXPANSION`; required without default -> `BREAKING_CONTRACTION`.
   - Categorize removed fields -> `BREAKING_CONTRACTION`.
   - Categorize changed fields: type widened or optional maintained -> `COMPATIBLE_EXPANSION`; type changed or optional->required -> `BREAKING_CONTRACTION`.
3. **SQL DDL Hazard Scanner**:
   - Parse `ALTER TABLE`, `DROP COLUMN`, `ADD COLUMN`, `DROP TABLE`.
   - Flag `DROP COLUMN` and `DROP TABLE` as `BREAKING_CONTRACTION`.
   - Flag `ADD COLUMN ... NOT NULL` without `DEFAULT` as `DANGEROUS_MUTATION`.
4. **Pre-Merge Gate**:
   - If `breakingChangesCount > 0` and `allowBreakingChanges !== true`: Return `gateVerdict: "REJECTED"`.
   - Otherwise: Return `gateVerdict: "APPROVED"`.
5. **Durable Ledger Recording**:
   - Persist evolution audit receipt in `EosDurableSqliteLedger`.

### Consequences
- Zero breaking changes can be merged unnoticed.
- Database migrations are pre-screened for table locking hazards.
- Zero external runtime npm dependencies.
