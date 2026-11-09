/**
 * EOS SYSTEM — SPEC-075 BDD TEST SUITE
 * Active Kernel Process Enforcer & Runtime Containment
 */

import test from "node:test";
import assert from "node:assert/strict";
import { EosActiveKernelProcessEnforcer } from "../src/core/eosActiveKernelProcessEnforcer.ts";

test("BDD-225: Clean Subprocess Execution Within Quotas", () => {
  const enforcer = new EosActiveKernelProcessEnforcer();

  // Run a fast, safe node command. Quota is env-tunable because spawning a Node
  // process under full-suite parallel load is scheduler-bound, not work-bound.
  const quotaMs = Number(process.env.EOS_ENFORCER_EXEC_QUOTA_MS || 10000);
  const receipt = enforcer.executeConfined(process.execPath, ["-e", 'console.log("SAFE_EXECUTION_PASS")'], {
    timeoutMs: quotaMs,
  });

  assert.equal(receipt.status, "SUCCESS");
  assert.equal(receipt.exitCode, 0);
  assert.ok(receipt.stdout.includes("SAFE_EXECUTION_PASS"));
  assert.equal(receipt.receiptSha256.length, 64);
});

test("BDD-226: Fail-Closed Subprocess Termination on Timeout Violation", () => {
  const enforcer = new EosActiveKernelProcessEnforcer();

  // Infinite loop with tight 150ms timeout
  const receipt = enforcer.executeConfined(process.execPath, ["-e", "while(true){}"], {
    timeoutMs: 150,
  });

  assert.equal(receipt.status, "TIMEOUT_VIOLATION");
  assert.notEqual(receipt.exitCode, 0);
  assert.ok(receipt.stderr.includes("timeout"));
  assert.equal(receipt.receiptSha256.length, 64);

  // Sanitization test
  const sanitized = EosActiveKernelProcessEnforcer.sanitizeEnvironment({
    SAFE_VAR: "hello",
    AWS_SECRET_ACCESS_KEY: "forbidden-secret",
    OPENAI_API_KEY: "forbidden-token",
    PATH: "/bin",
  });
  assert.equal(sanitized.SAFE_VAR, "hello");
  assert.equal(sanitized.PATH, "/bin");
  assert.equal(sanitized.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(sanitized.OPENAI_API_KEY, undefined);
});

test("BDD-227: Non-Zero Exit, Spawn Error, and Ledger Invariants", () => {
  // 1. Non-zero exit
  const enforcer = new EosActiveKernelProcessEnforcer();
  const nonZeroReceipt = enforcer.executeConfined(process.execPath, ["-e", "process.exit(42)"]);
  assert.equal(nonZeroReceipt.status, "NON_ZERO_EXIT");
  assert.equal(nonZeroReceipt.exitCode, 42);

  // 2. Spawn error on non-existent command
  const spawnErrReceipt = enforcer.executeConfined("non_existent_binary_xyz_123_456");
  assert.equal(spawnErrReceipt.status, "SPAWN_ERROR");
  assert.equal(spawnErrReceipt.exitCode, -2);
  assert.ok(spawnErrReceipt.stderr.length > 0);

  // 3. Ledger audit integration
  let recorded = false;
  const mockLedger = {
    appendEntry(entry) {
      recorded = true;
      assert.equal(entry.category, "SECURITY_AUDIT");
      assert.equal(entry.projectId, "eos-system");
    },
  };
  const ledgerEnforcer = new EosActiveKernelProcessEnforcer(mockLedger);
  const ledgerReceipt = ledgerEnforcer.executeConfined(process.execPath, ["-e", 'console.log("LEDGER_OK")']);
  assert.equal(ledgerReceipt.status, "SUCCESS");
  assert.equal(recorded, true);

  // 4. Faulty ledger fallback
  const faultyLedger = {
    appendEntry() {
      throw new Error("Ledger disk failure");
    },
  };
  const faultyEnforcer = new EosActiveKernelProcessEnforcer(faultyLedger);
  const safeReceipt = faultyEnforcer.executeConfined(process.execPath, ["-e", 'console.log("SAFE")']);
  assert.equal(safeReceipt.status, "SUCCESS");
});
