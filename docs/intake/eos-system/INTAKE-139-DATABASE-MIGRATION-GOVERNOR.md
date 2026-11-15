# INTAKE-139: Zero-Downtime Database Migration Governor & DDL Safety Engine

## Big Tech Engineering Discipline & Resilient Schema Evolution (SPEC-277)

---

### 1. Context & Business Need

In mission-critical tier-0 distributed architectures (Stripe, GitHub, Nubank, AWS Aurora, Neon), schema migrations represent the highest operational hazard for unanticipated system downtime. Unsafe DDL operations routinely trigger:

1. **Access Exclusive Table Locks (`ACCESS EXCLUSIVE`)**: Operations such as un-concurrent index creation (`CREATE INDEX`), un-validated constraints (`ADD CONSTRAINT ... CHECK`), or altering column types freeze all concurrent read and write transactions, inducing connection exhaustion and cascading microservice outages.
2. **Missing Transaction Timeouts**: Migrations executed without explicit `statement_timeout` and `lock_timeout` queue behind long-running analytical queries, subsequently blocking all incoming transactional OLTP traffic.
3. **Irreversible Destructive DDL**: Dropping active columns or tables before application code has completed its dual-run lifecycle introduces breaking runtime deserialization crashes.

### 2. Big Tech References & Engineering Patterns

- **GitHub `gh-ost` / `pt-online-schema-change`**: Triggersless, auditable asynchronous shadow-table migrations.
- **GitLab Zero-Downtime Migration Guidelines**: Explicit multi-step expand/contract workflows (`post_migrate`, dual-write, background migrations).
- **Stripe Large-Scale Migrations**: Four-phase migration pattern (Expand -> Dual Write -> Read Switch -> Contract).
- **Postgres DDL Locking Matrix**: Strict categorization of DDL statements by lock level (`ACCESS EXCLUSIVE`, `SHARE ROW EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`).

### 3. Proposed Core Capabilities

1. **SQL Migration AST / Lexical Safety Linter**:
   - Parses `.sql` migration files strictly at Layer-0 without runtime npm dependencies.
   - Detects hazardous patterns:
     - `CREATE INDEX` without `CONCURRENTLY`.
     - `ALTER TABLE ... ADD CONSTRAINT` without `NOT VALID`.
     - `ALTER TABLE ... ALTER COLUMN TYPE ...` without expand/contract safety notes.
     - `ALTER TABLE ... ADD COLUMN ... DEFAULT <volatile>` without nullable initiation.
     - Missing `SET lock_timeout` and `SET statement_timeout` headers.
2. **Expand / Contract Lifecycle Verifier**:
   - Analyzes migration sequence across folders or revision numbers.
   - Verifies that breaking column drops or renames occur strictly in a separate `contract/` phase following confirmed dual-writes.
3. **Reversible Rollback Blueprint Synthesizer**:
   - Generates deterministic rollback (down-migration) templates for auditable, two-way operational safety.
4. **Cryptographic SHA-256 Receipt**:
   - Emits verifiable execution report in `docs/evidence/MIGRATION_RECEIPT.json`.
5. **CLI Integration & Paridad**:
   - `eos toolchain:db:lint <file.sql>`: Lints single SQL migration for lock hazards.
   - `eos toolchain:db:audit <migration-dir>`: Audits directory for sequential safety and missing lock timeouts.
   - `eos toolchain:db:plan <migration-dir>`: Generates migration execution plan with rollback stubs.

### 4. Constraints

- Pure Layer-0 TypeScript (`dependencies: {}` - Law V).
- Serverless function count remains strictly 12/12 (`SPEC-269`).
- Maximum module lines observed $\le 744$ lines.
- 100% CLI catalog parity with `hygiene:audit` (363 commands upon completion).
