import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosSurgicalSelfHealingKernel } from "../src/core/eosSurgicalSelfHealingKernel.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-167: FDIR Fault Localization and Stack Isolation", () => {
  const sampleSource = `// User formatting utility
export function formatUser(user) {
  // Extract and capitalize name
  return user.name.toUpperCase();
}
`;
  const stackTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatUser (src/users.ts:4:18)
    at Object.process (src/app.ts:12:5)`;

  const fault = EosSurgicalSelfHealingKernel.diagnoseFault(stackTrace, sampleSource);

  assert.equal(fault.filePath, "src/users.ts");
  assert.equal(fault.lineNumber, 4);
  assert.equal(fault.columnNumber, 18);
  assert.equal(fault.symbolName, "formatUser");
  assert.equal(fault.exceptionType, "TypeError");
  assert.equal(fault.targetExpression, "toUpperCase");
  assert.ok(fault.codeContextSnippet.includes("return user.name.toUpperCase();"));
  assert.ok(fault.faultId.startsWith("fault_"));
});

test("BDD-168: Minimal Guard Patch Synthesis", () => {
  const sampleSource = `export function formatUser(user) {
  return user.name.toUpperCase();
}
`;
  const stackTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatUser (src/users.ts:2:18)`;

  const fault = EosSurgicalSelfHealingKernel.diagnoseFault(stackTrace, sampleSource);
  const patch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(fault, sampleSource);

  assert.equal(patch.strategy, "NULL_CHECK_GUARD");
  assert.equal(patch.targetLineNumber, 2);
  assert.ok(patch.linesChanged <= 3);
  assert.ok(patch.patchedSource.includes("if (!user || !user.name) return \"\";"));
  assert.ok(patch.astMutationDiff.includes("NULL_CHECK_GUARD"));
  assert.ok(patch.patchId.startsWith("patch_"));
});

test("BDD-169: Closed-Loop In-Memory Sandbox Verification (HEALED_VERIFIED)", () => {
  const sampleSource = `export function formatUser(user) {
  return user.name.toUpperCase();
}
`;
  const stackTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatUser (src/users.ts:2:18)`;

  const fault = EosSurgicalSelfHealingKernel.diagnoseFault(stackTrace, sampleSource);
  const patch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(fault, sampleSource);

  const verification = EosSurgicalSelfHealingKernel.verifyInSandbox({
    originalSource: sampleSource,
    patch,
    regressionTestCode: `
      assert.strictEqual(typeof formatUser, 'function');
      assert.strictEqual(formatUser({ name: 'alice' }), 'ALICE');
    `
  });

  assert.equal(verification.status, "PASS");
  assert.equal(verification.targetFunctionPass, true);
  assert.equal(verification.zeroRegressionPreserved, true);
  assert.ok(verification.executionTimeMs >= 0);
  assert.equal(verification.errors.length, 0);
});

test("BDD-170: Zero-Regression Rejection Barrier (Fail-Closed)", () => {
  const sampleSource = `export function calculateTotal(cart) {
  return cart.items.reduce((acc, i) => acc + i.price, 0);
}
`;
  const stackTrace = `TypeError: Cannot read properties of undefined (reading 'reduce')
    at calculateTotal (src/cart.ts:2:21)`;

  const fault = EosSurgicalSelfHealingKernel.diagnoseFault(stackTrace, sampleSource);
  const patch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(fault, sampleSource);

  // Intentionally define a regression test that expects an exact numeric behavior that the mock patch fails
  const breakingRegressionTest = `
    const cart = { items: [{ price: 10 }, { price: 20 }] };
    const res = calculateTotal(cart);
    assert.strictEqual(res, 30);
    // Simulate regression invariant failure
    throw new Error("CONTRACT_INVARIANT_VIOLATION: Prior behavior altered by patch!");
  `;

  const verification = EosSurgicalSelfHealingKernel.verifyInSandbox({
    originalSource: sampleSource,
    patch,
    regressionTestCode: breakingRegressionTest
  });

  assert.equal(verification.status, "FAIL");
  assert.equal(verification.zeroRegressionPreserved, false);
  assert.ok(verification.errors.some(e => e.includes("CONTRACT_INVARIANT_VIOLATION")));

  // Run full healing cycle and assert REGRESSION_REJECTED verdict
  const cycleResult = EosSurgicalSelfHealingKernel.executeHealingCycle({
    stackTrace,
    sourceCode: sampleSource,
    regressionTestCode: breakingRegressionTest,
    reason: "Zero regression check"
  });

  assert.equal(cycleResult.verdict, "REGRESSION_REJECTED");
  assert.equal(cycleResult.verification.zeroRegressionPreserved, false);
  assert.ok(cycleResult.sha256Receipt.length === 64);
});

test("BDD-171: Cryptographic Self-Healing Receipt and Durable SQLite Ledger Entry", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-healing-ledger-test-"));
  try {
    const sampleSource = `export function formatUser(user) {
  return user.name.toUpperCase();
}
`;
    const stackTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatUser (src/users.ts:2:18)`;

    const cycleResult = EosSurgicalSelfHealingKernel.executeHealingCycle({
      stackTrace,
      sourceCode: sampleSource,
      regressionTestCode: `
        assert.strictEqual(typeof formatUser, 'function');
        assert.strictEqual(formatUser({ name: 'bob' }), 'BOB');
      `,
      reason: "Automated FDIR healing for null user reference"
    });

    assert.equal(cycleResult.verdict, "HEALED_VERIFIED");
    assert.equal(cycleResult.verification.zeroRegressionPreserved, true);
    assert.equal(cycleResult.sha256Receipt.length, 64);

    // Record in durable SQLite WAL ledger
    const recorded = EosSurgicalSelfHealingKernel.recordReceiptInLedger(cycleResult, tempDir);
    assert.equal(recorded, true);

    const ledger = new EosDurableSqliteLedger(EosDurableSqliteLedger.defaultLedgerPath(tempDir));
    try {
      const recent = ledger.listRecent(5);
      const found = recent.find(e => e.payload && e.payload.sha256Receipt === cycleResult.sha256Receipt);

      assert.ok(found, "Receipt must be recorded and retrievable from SQLite WAL ledger");
      assert.equal(found.category, "SECURITY_AUDIT");
      assert.ok(found.title.includes("HEALED_VERIFIED"));
      assert.ok(found.title.includes(cycleResult.fault.filePath));
    } finally {
      ledger.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("BDD-172: MCP Dispatch of eos_surgical_healing via EosMcpServer", () => {
  const server = new EosMcpServer(projectRoot);

  // 1. Verify tool registration in catalog
  const toolsRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  });

  assert.ok(!toolsRes.error);
  const toolNames = toolsRes.result.tools.map(t => t.name);
  assert.ok(toolNames.includes("eos_surgical_healing"));

  const sampleSource = `export function greet(person) {\n  return person.name.toLowerCase();\n}\n`;
  const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'toLowerCase')\n    at greet (src/greet.ts:2:16)`;

  // 2. Invoke diagnose action
  const diagRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "eos_surgical_healing",
      arguments: {
        action: "diagnose",
        stackTrace: sampleTrace,
        sourceCode: sampleSource
      }
    }
  });

  assert.ok(!diagRes.error);
  const diagData = JSON.parse(diagRes.result.content[0].text);
  assert.equal(diagData.symbolName, "greet");
  assert.equal(diagData.lineNumber, 2);
  assert.equal(diagData.filePath, "src/greet.ts");

  // 3. Invoke patch action
  const patchRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_surgical_healing",
      arguments: {
        action: "patch",
        stackTrace: sampleTrace,
        sourceCode: sampleSource
      }
    }
  });

  assert.ok(!patchRes.error);
  const patchData = JSON.parse(patchRes.result.content[0].text);
  assert.equal(patchData.strategy, "NULL_CHECK_GUARD");
  assert.ok(patchData.patchedSource.includes("if (!person || !person.name) return \"\";"));

  // 4. Invoke heal_cycle action
  const cycleRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "eos_surgical_healing",
      arguments: {
        action: "heal_cycle",
        stackTrace: sampleTrace,
        sourceCode: sampleSource,
        regressionTestCode: `assert.strictEqual(typeof greet, 'function');`,
        reason: "MCP integration test of NASA FDIR + Meta SapFix"
      }
    }
  });

  assert.ok(!cycleRes.error);
  const cycleData = JSON.parse(cycleRes.result.content[0].text);
  assert.equal(cycleData.verdict, "HEALED_VERIFIED");
  assert.equal(cycleData.zeroRegressionPreserved, true);
  assert.equal(cycleData.sha256Receipt.length, 64);
});
