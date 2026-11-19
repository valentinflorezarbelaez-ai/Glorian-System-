/**
 * Glorian System — Database Migration Governor Test Suite
 * Governed by SPEC-277 / CHANGE-139
 *
 * Verifies BDD-1437 through BDD-1442.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosDatabaseMigrationGovernor } from "../src/core/eosDatabaseMigrationGovernor.ts";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const COMPLIANT_MIGRATION_DIR = path.join(ROOT, "templates/db/glorian-enterprise-migrations");

describe("SPEC-277: Database Migration Governor & DDL Safety Engine", () => {
  // -------------------------------------------------------------------------
  // BDD-1437: Compliant Non-Locking SQL Migration Linting
  // -------------------------------------------------------------------------
  it("BDD-1437: validates compliant SQL migration declaring lock timeouts and concurrent index", () => {
    const compliantSql = `
      SET lock_timeout = '2s';
      SET statement_timeout = '5s';
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_org ON users(org_id);
    `;

    const report = EosDatabaseMigrationGovernor.lintMigration(compliantSql, {
      targetName: "compliant_index.sql",
    });

    assert.equal(report.status, "PASS");
    assert.equal(report.clean, true);
    assert.equal(report.totalHazardousLocks, 0);
    assert.equal(report.violations.length, 0);
    assert.equal(typeof report.latencyMs, "number");
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1438: Rejection of Non-Concurrent Index Creation
  // -------------------------------------------------------------------------
  it("BDD-1438: rejects non-concurrent index creation with CRITICAL lock violation", () => {
    const nonConcurrentSql = `
      SET lock_timeout = '2s';
      SET statement_timeout = '5s';
      CREATE INDEX idx_users_email ON users(email);
    `;

    const report = EosDatabaseMigrationGovernor.lintMigration(nonConcurrentSql);

    assert.equal(report.status, "HAZARD_DETECTED");
    assert.equal(report.clean, false);
    assert.ok(report.totalHazardousLocks >= 1);
    assert.ok(report.violations.some((v) => v.rule === "no_non_concurrent_index" && v.severity === "CRITICAL"));
  });

  // -------------------------------------------------------------------------
  // BDD-1439: Rejection of Constraint Without NOT VALID
  // -------------------------------------------------------------------------
  it("BDD-1439: rejects table constraint addition without NOT VALID clause", () => {
    const blockingConstraintSql = `
      SET lock_timeout = '2s';
      SET statement_timeout = '5s';
      ALTER TABLE accounts ADD CONSTRAINT positive_balance CHECK (balance >= 0);
    `;

    const report = EosDatabaseMigrationGovernor.lintMigration(blockingConstraintSql);

    assert.equal(report.status, "HAZARD_DETECTED");
    assert.equal(report.clean, false);
    assert.ok(report.violations.some((v) => v.rule === "require_not_valid_constraint" && v.severity === "HIGH"));
  });

  // -------------------------------------------------------------------------
  // BDD-1440: Rejection of Missing Timeout Headers
  // -------------------------------------------------------------------------
  it("BDD-1440: rejects DDL migrations lacking lock_timeout or statement_timeout headers", () => {
    const noTimeoutsSql = `
      CREATE TABLE IF NOT EXISTS test_orders (id UUID PRIMARY KEY);
    `;

    const report = EosDatabaseMigrationGovernor.lintMigration(noTimeoutsSql);

    assert.equal(report.status, "HAZARD_DETECTED");
    assert.equal(report.clean, false);
    assert.ok(report.violations.some((v) => v.rule === "missing_lock_timeout"));
    assert.ok(report.violations.some((v) => v.rule === "missing_statement_timeout"));
  });

  // -------------------------------------------------------------------------
  // BDD-1441: Expand/Contract Sequential Lifecycle Verification
  // -------------------------------------------------------------------------
  it("BDD-1441: audits sequential migrations in template directory verifying zero hazards", () => {
    const report = EosDatabaseMigrationGovernor.auditMigrations(COMPLIANT_MIGRATION_DIR);

    assert.equal(report.status, "PASS");
    assert.equal(report.clean, true);
    assert.equal(report.totalViolations, 0);
    assert.ok(report.filesAudited >= 3, `Expected at least 3 files, got ${report.filesAudited}`);
    assert.equal(report.expandContractPhaseConformity, true);
    assert.equal(typeof report.sha256Receipt, "string");
  });

  // -------------------------------------------------------------------------
  // BDD-1442: Reversible Rollback Blueprint & SHA-256 Receipt
  // -------------------------------------------------------------------------
  it("BDD-1442: generates deterministic down-migration blueprints and evidence receipt", () => {
    const report = EosDatabaseMigrationGovernor.planMigrations(COMPLIANT_MIGRATION_DIR);

    assert.equal(report.status, "PASS");
    assert.equal(report.clean, true);
    assert.ok(report.executionOrder.length >= 3);
    assert.ok(report.totalSteps >= 3);

    // Verify generated down-migration stubs
    const downKeys = Object.keys(report.downMigrations);
    assert.ok(downKeys.length >= 3);

    // 002_add_email_expand has CREATE INDEX CONCURRENTLY idx_users_email -> down should have DROP INDEX CONCURRENTLY
    const down002 = report.downMigrations["002_add_email_expand.sql"];
    assert.ok(down002, "Expected down migration for 002");
    assert.ok(down002.includes("DROP INDEX CONCURRENTLY IF EXISTS idx_users_email"));
    assert.ok(down002.includes("ALTER TABLE users DROP COLUMN IF EXISTS email"));

    // Verify receipt on disk
    const receiptPath = resolveEvidencePath("MIGRATION_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath), "Expected receipt file to be created");
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.sha256Receipt, report.sha256Receipt);
  });

  // -------------------------------------------------------------------------
  // BDD-1443: Mathematical LIFO Rollback Reversibility Proving
  // -------------------------------------------------------------------------
  it("BDD-1443: proves exact inverse LIFO ordering and rejects asymmetric rollback", () => {
    const upSql = `
      SET lock_timeout = '2s';
      SET statement_timeout = '5s';
      CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(32);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
    `;

    // 1. Synthesize down migration
    const downSql = EosDatabaseMigrationGovernor.synthesizeDownMigration(upSql);
    const validRev = EosDatabaseMigrationGovernor.verifyRollbackReversibility(upSql, downSql);

    assert.equal(validRev.reversible, true);
    assert.equal(validRev.forwardOperationsCount, 3);
    assert.equal(validRev.reverseOperationsCount, 3);
    assert.equal(validRev.unhandledForwardOperations.length, 0);
    assert.equal(validRev.matchedPairs.length, 3);

    // Verify LIFO order: index dropped first, then column, then table
    assert.equal(validRev.matchedPairs[0].actionType, "CREATE_INDEX");
    assert.equal(validRev.matchedPairs[1].actionType, "ADD_COLUMN");
    assert.equal(validRev.matchedPairs[2].actionType, "CREATE_TABLE");

    // 2. Asymmetric / incomplete down migration must fail reversibility proof
    const incompleteDown = `
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `;
    const invalidRev = EosDatabaseMigrationGovernor.verifyRollbackReversibility(upSql, incompleteDown);
    assert.equal(invalidRev.reversible, false);
    assert.ok(invalidRev.unhandledForwardOperations.length > 0);
  });
});
