# PLAN-139: Database Migration Governor & DDL Safety Implementation

## Zero-Downtime Schema Evolution & Lock Mitigation (SPEC-277)

---

### 1. Architectural Strategy

- **Layer-0 SQL Lexer/Scanner**: Implements an in-memory lexical parser in `src/core/eosDatabaseMigrationGovernor.ts` that tokenizes SQL statements, strips comments (`--` and `/* ... */`), and extracts DDL commands (`CREATE INDEX`, `ALTER TABLE`, `DROP COLUMN`, `SET lock_timeout`, `SET statement_timeout`).
- **Hazard Rules Matrix**:
  - `CREATE INDEX` $\rightarrow$ must have `CONCURRENTLY`.
  - `ALTER TABLE ... ADD CONSTRAINT` $\rightarrow$ must specify `NOT VALID` (unless validating an existing constraint with `VALIDATE CONSTRAINT`).
  - `SET lock_timeout` $\rightarrow$ must be present at the top of transactional migration files to prevent query queue cascading.
  - `ALTER TABLE ... DROP COLUMN` $\rightarrow$ flagged with `HIGH_RISK_DROP` requiring an explicit `--allow-drop` flag or contract phase marker.
- **Rollback Generator**:
  - `CREATE INDEX CONCURRENTLY idx ON tbl(...)` $\rightarrow$ `DROP INDEX CONCURRENTLY IF EXISTS idx;`
  - `ALTER TABLE tbl ADD COLUMN col type` $\rightarrow$ `ALTER TABLE tbl DROP COLUMN IF EXISTS col;`
  - `CREATE TABLE tbl (...)` $\rightarrow$ `DROP TABLE IF EXISTS tbl CASCADE;`
- **CLI Subcommand Delegation**:
  - Created in `bin/commands/cliDatabase.mjs` (estimated ~130 lines).
  - Wired into `bin/commands/cliDevOps.mjs` via `toolchain:db:` delegation, preserving line headroom ($< 750$ lines).

### 2. File Invariants

- `src/core/eosDatabaseMigrationGovernor.ts` ($\le 380$ lines).
- `bin/commands/cliDatabase.mjs` ($\le 140$ lines).
- `test/eosDatabaseMigrationGovernor.test.mjs` ($\le 250$ lines).
- Enterprise template in `templates/db/glorian-enterprise-migrations/` (`001_initial_schema.sql`, `002_add_email_index.sql`).
