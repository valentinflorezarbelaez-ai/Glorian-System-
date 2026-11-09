/**
 * EOS SYSTEM — SPEC-060 BDD TEST SUITE
 * Autonomous Meta-Grade SapFix PR & Auto-Merge Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosSapFixAutoshipper } from "../src/core/eosSapFixAutoshipper.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-185: Autonomous Worktree Creation and Fault Isolation", async () => {
  const fault = {
    faultId: "FAULT-882",
    targetFilePath: "src/sample/processor.js",
    failingLine: 4,
    errorMessage: "Cannot read properties of undefined (reading 'length')",
    offendingExpression: "data",
    mockOriginalContent: "function execute(data) {\n  const x = 1;\n  const y = 2;\n  return data.length;\n}\n",
  };

  const report = await EosSapFixAutoshipper.executeCycle(fault);

  assert.equal(report.faultId, "FAULT-882");
  assert.ok(report.branchName.startsWith("fix/sapfix-auto-fault-882-"));
  assert.equal(report.targetFile, "src/sample/processor.js");
  assert.equal(report.patchApplied, true);
});

test("BDD-186: Surgical Patch Application and Hermetic Verification", async () => {
  const fault = {
    faultId: "FAULT-901",
    targetFilePath: "src/core/transform.js",
    failingLine: 3,
    errorMessage: "Cannot read properties of null (reading 'value')",
    offendingExpression: "data",
    mockOriginalContent: "function execute(data) {\n  const a = 10;\n  return data.value;\n}\n",
  };

  const report = await EosSapFixAutoshipper.executeCycle(fault);

  assert.equal(report.status, "PR_READY");
  assert.equal(report.verificationPassed, true);
  assert.ok(report.diffSummary.includes("if (!data) return undefined;"));
  assert.ok(report.sha256Receipt.length === 64);
});

test("BDD-187: Autonomous PR Manifest Generation and Ledger Attestation", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sapfix-ledger-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const fault = {
      faultId: "FAULT-999",
      targetFilePath: "src/api/handler.js",
      failingLine: 2,
      errorMessage: "Cannot read properties of undefined",
      offendingExpression: "req",
      mockOriginalContent: "function execute(req) {\n  return req.headers;\n}\n",
    };

    const report = await EosSapFixAutoshipper.executeCycle(fault);

    // Verify PR manifest content
    assert.ok(report.prTitle.includes("fix(fdir): auto-remediate FAULT-999"));
    assert.ok(report.prBodyMarkdown.includes("EOS Autonomous SapFix Remediation Manifest"));
    assert.ok(report.prBodyMarkdown.includes("Cryptographic SHA-256 Receipt"));
    assert.ok(report.prBodyMarkdown.includes(`sha256:${report.sha256Receipt}`));

    // Verify Ledger persistence
    const saved = EosSapFixAutoshipper.recordReceiptInLedger(report, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const entries = ledger.listRecent(5);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].category, "VERIFICATION_RECEIPT");
    assert.equal(entries[0].title.includes("FAULT-999"), true);
    assert.equal(entries[0].payload.sha256Receipt, report.sha256Receipt);
    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks on Windows
    }
  }
});

test("BDD-188: Read File From Disk and Fallback Mock Code", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sapfix-disk-test-"));
  try {
    const existingFile = path.join(tmpDir, "calculator.js");
    fs.writeFileSync(existingFile, "function execute(data) {\n  return data.total;\n}\n", "utf8");

    // Test reading existing file via absolute path and customBranchPrefix
    const fault1 = {
      faultId: "FAULT-101",
      targetFilePath: existingFile,
      failingLine: 2,
      errorMessage: "Cannot read properties of null",
      // offendingExpression omitted to test fallback to 'data'
    };

    const report1 = await EosSapFixAutoshipper.executeCycle(fault1, tmpDir, {
      customBranchPrefix: "fix/custom-prefix",
    });

    assert.ok(report1.branchName.startsWith("fix/custom-prefix-fault-101-"));
    assert.equal(report1.status, "PR_READY");

    // Test non-existing file (triggers fallback mock)
    const fault2 = {
      faultId: "FAULT-102",
      targetFilePath: "nonexistent/module.js",
      failingLine: 2,
      errorMessage: "Cannot read properties of undefined",
    };

    const report2 = await EosSapFixAutoshipper.executeCycle(fault2, tmpDir);
    assert.equal(report2.status, "REGRESSION_REJECTED");
    assert.equal(report2.targetFile, "nonexistent/module.js");
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-189: Regression Rejection & Ledger Security Audit Category", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sapfix-rejection-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.db");

  try {
    // Code that will fail verification even after patch because it introduces unhandled error
    const fault = {
      faultId: "FAULT-REJECTED",
      targetFilePath: "src/broken.js",
      failingLine: 1,
      errorMessage: "Generic error",
      mockOriginalContent: "function execute() { throw new TypeError('Cannot read properties of undefined'); }",
    };

    const report = await EosSapFixAutoshipper.executeCycle(fault);
    assert.equal(report.status, "REGRESSION_REJECTED");
    assert.equal(report.verificationPassed, false);
    assert.ok(report.prBodyMarkdown.includes("REGRESSION DETECTED"));

    // Verify recordReceiptInLedger with .db path and non-PR_READY status (category: SECURITY_AUDIT)
    const saved = EosSapFixAutoshipper.recordReceiptInLedger(report, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const entries = ledger.listRecent(5);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].category, "SECURITY_AUDIT");
    ledger.close();

    // Verify recordReceiptInLedger with directory path
    const savedInDir = EosSapFixAutoshipper.recordReceiptInLedger(report, tmpDir);
    assert.equal(savedInDir, true);

    // Verify recordReceiptInLedger error catch block with null report
    const failed = EosSapFixAutoshipper.recordReceiptInLedger(null, tmpDir);
    assert.equal(failed, false);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-190: SapFix Precondition Validations", () => {
  // Missing faultId
  assert.throws(() => EosSapFixAutoshipper.executeCycle({}), /faultId is required/);

  // Missing targetFilePath
  assert.throws(() => EosSapFixAutoshipper.executeCycle({ faultId: "F1" }), /targetFilePath is required/);

  // Invalid failingLine
  assert.throws(
    () => EosSapFixAutoshipper.executeCycle({ faultId: "F1", targetFilePath: "a.js", failingLine: 0 }),
    /failingLine must be positive/,
  );
  assert.throws(
    () => EosSapFixAutoshipper.executeCycle({ faultId: "F1", targetFilePath: "a.js", failingLine: -5 }),
    /failingLine must be positive/,
  );
});
