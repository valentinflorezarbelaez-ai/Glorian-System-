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
    mockOriginalContent: "function execute(data) {\n  const x = 1;\n  const y = 2;\n  return data.length;\n}\n"
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
    mockOriginalContent: "function execute(data) {\n  const a = 10;\n  return data.value;\n}\n"
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
      mockOriginalContent: "function execute(req) {\n  return req.headers;\n}\n"
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
