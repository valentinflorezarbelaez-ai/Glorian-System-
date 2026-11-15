# SPEC-277: ZERO-DOWNTIME DATABASE MIGRATION GOVERNOR & DDL SAFETY ENGINE

## 1. Metadata

- **Specification ID**: `SPEC-277`
- **Change Reference**: `CHANGE-139`
- **Component**: `EosDatabaseMigrationGovernor`
- **Status**: `PROPOSED`
- **Version**: `1.0.0`
- **Classification**: Layer 0 Sovereign Infrastructure & Reliability Core

---

## 2. Functional Requirements (EARS Syntax)

- **FR-277-01 (Event-Driven: SQL Migration Safety Linting)**:
  `WHEN` a SQL migration file is submitted for linting via `lintMigration`,
  `THE SYSTEM SHALL` parse the DDL statements and flag non-concurrent indexes (`CREATE INDEX` without `CONCURRENTLY`), invalid-less constraints (`ADD CONSTRAINT` without `NOT VALID`), and missing timeout headers with severity `HAZARDOUS_LOCK`.

- **FR-277-02 (State-Driven: Mandatory Lock Timeout Enforcement)**:
  `WHILE` evaluating migration safety,
  `THE SYSTEM SHALL` verify that migration scripts declare explicit `SET lock_timeout = '...'` and `SET statement_timeout = '...'` to prevent lock queue starvation.

- **FR-277-03 (Unwanted Condition: Exclusive Lock Detection)**:
  `IF` a migration attempts an un-isolated column type mutation (`ALTER COLUMN TYPE`), table rewrite, or direct column drop without an expand/contract deprecation marker,
  `THEN THE SYSTEM SHALL` emit `UNSAFE_DDL_DETECTED` and reject execution fail-closed.

- **FR-277-04 (Event-Driven: Expand/Contract Lifecycle Audit)**:
  `WHEN` a directory containing sequential migrations is evaluated via `auditMigrations`,
  `THE SYSTEM SHALL` assert that breaking column alterations follow the two-phase expand-then-contract protocol.

- **FR-277-05 (Event-Driven: Reversible Down-Migration Blueprint Generation)**:
  `WHEN` generating a migration execution plan via `planMigrations`,
  `THE SYSTEM SHALL` synthesize deterministic rollback (`down.sql`) templates mapping complementary reverse operations.

- **FR-277-06 (Ubiquitous: Cryptographic Audit Receipt)**:
  `THE SYSTEM SHALL` write all migration validation and audit results to `docs/evidence/MIGRATION_RECEIPT.json` sealed with a SHA-256 digest.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
SCENARIO: BDD-1437: Compliant Non-Locking SQL Migration Linting
  GIVEN a valid Postgres migration declaring lock timeouts and CREATE INDEX CONCURRENTLY
  WHEN lintMigration is executed on the SQL script
  THEN the report status SHALL be "PASS"
  AND the clean indicator SHALL be true
  AND totalHazardousLocks SHALL be 0.

SCENARIO: BDD-1438: Rejection of Non-Concurrent Index Creation
  GIVEN a migration executing "CREATE INDEX idx_user_email ON users(email)"
  WHEN lintMigration is executed on the SQL script
  THEN the report status SHALL be "HAZARD_DETECTED"
  AND the violations SHALL include "no_non_concurrent_index"
  AND the severity SHALL be "CRITICAL".

SCENARIO: BDD-1439: Rejection of Constraint Without NOT VALID
  GIVEN a migration executing "ALTER TABLE accounts ADD CONSTRAINT positive_balance CHECK (balance >= 0)"
  WHEN lintMigration is executed on the SQL script
  THEN the report status SHALL be "HAZARD_DETECTED"
  AND the violations SHALL include "require_not_valid_constraint".

SCENARIO: BDD-1440: Rejection of Missing Timeout Headers
  GIVEN a migration containing DDL statements without lock_timeout or statement_timeout
  WHEN lintMigration is executed on the SQL script
  THEN the report status SHALL be "HAZARD_DETECTED"
  AND the violations SHALL include "missing_lock_timeout".

SCENARIO: BDD-1441: Expand/Contract Sequential Lifecycle Verification
  GIVEN a directory containing paired expand (add column nullable) and contract (drop old column) migrations
  WHEN auditMigrations is executed on the directory
  THEN the report status SHALL be "PASS"
  AND the expandContractPhaseConformity SHALL be true.

SCENARIO: BDD-1442: Reversible Rollback Blueprint & SHA-256 Receipt
  GIVEN a compliant migration sequence
  WHEN planMigrations is executed
  THEN the synthesized plan SHALL generate valid down-migration stubs
  AND docs/evidence/MIGRATION_RECEIPT.json SHALL be created with a valid SHA-256 digest.
```
