/**
 * EOS SYSTEM — SPEC-075 BDD TEST SUITE
 * Active Kernel Process Enforcer & Runtime Containment
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosActiveKernelProcessEnforcer } from '../src/core/eosActiveKernelProcessEnforcer.ts';

test('BDD-225: Clean Subprocess Execution Within Quotas', () => {
  const enforcer = new EosActiveKernelProcessEnforcer();

  // Run a fast, safe node command
  const receipt = enforcer.executeConfined(process.execPath, ['-e', 'console.log("SAFE_EXECUTION_PASS")'], {
    timeoutMs: 3000
  });

  assert.equal(receipt.status, 'SUCCESS');
  assert.equal(receipt.exitCode, 0);
  assert.ok(receipt.stdout.includes('SAFE_EXECUTION_PASS'));
  assert.equal(receipt.receiptSha256.length, 64);
});

test('BDD-226: Fail-Closed Subprocess Termination on Timeout Violation', () => {
  const enforcer = new EosActiveKernelProcessEnforcer();

  // Infinite loop with tight 150ms timeout
  const receipt = enforcer.executeConfined(process.execPath, ['-e', 'while(true){}'], {
    timeoutMs: 150
  });

  assert.equal(receipt.status, 'TIMEOUT_VIOLATION');
  assert.notEqual(receipt.exitCode, 0);
  assert.ok(receipt.stderr.includes('timeout'));
  assert.equal(receipt.receiptSha256.length, 64);

  // Sanitization test
  const sanitized = EosActiveKernelProcessEnforcer.sanitizeEnvironment({
    SAFE_VAR: 'hello',
    AWS_SECRET_ACCESS_KEY: 'forbidden-secret',
    OPENAI_API_KEY: 'forbidden-token',
    PATH: '/bin'
  });
  assert.equal(sanitized.SAFE_VAR, 'hello');
  assert.equal(sanitized.PATH, '/bin');
  assert.equal(sanitized.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(sanitized.OPENAI_API_KEY, undefined);
});
