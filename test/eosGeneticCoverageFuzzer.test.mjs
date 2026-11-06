/**
 * EOS SYSTEM — SPEC-072 BDD TEST SUITE
 * Continuous Genetic Coverage-Guided Fuzzing Daemon
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosGeneticCoverageFuzzer } from '../src/core/eosGeneticCoverageFuzzer.ts';

test('BDD-219: Corpus Evolution on Novel Execution Fingerprint Discovery', () => {
  const fuzzer = new EosGeneticCoverageFuzzer([{ count: 10, prefix: 'abc' }]);

  // Target function produces distinct state outputs based on input values
  const targetFn = (input) => {
    if (!input || typeof input !== 'object') return 'invalid';
    const c = Number(input.count) || 0;
    if (c > 1000) return 'high';
    if (c < 0) return 'negative';
    return 'normal';
  };

  const report = fuzzer.fuzzTarget(targetFn, 100);

  assert.equal(report.totalCycles, 100);
  assert.ok(report.finalCorpusSize >= report.initialCorpusSize);
  assert.ok(report.uniqueStatesDiscovered >= 2);
  assert.equal(report.crashesCount, 0);
  assert.equal(report.sha256Receipt.length, 64);
});

test('BDD-220: Deterministic Crash Capture and SHA-256 Incident Receipt', () => {
  const fuzzer = new EosGeneticCoverageFuzzer([100]);

  // Target function intentionally throws on boundary condition
  const fragileTarget = (num) => {
    if (typeof num === 'number' && (num === -1 || num === 0 || isNaN(num))) {
      throw new Error(`CRITICAL_ZERO_DAY_BUG: Illegal boundary value ${num}`);
    }
    return { ok: true, val: num };
  };

  const report = fuzzer.fuzzTarget(fragileTarget, 80);

  assert.ok(report.crashesCount > 0, 'Expected at least 1 boundary crash captured');
  const firstCrash = report.crashes[0];
  assert.ok(firstCrash.errorMessage.includes('CRITICAL_ZERO_DAY_BUG'));
  assert.equal(firstCrash.crashReceiptSha256.length, 64);

  // Verify persistence in SQLite WAL ledger
  const recordResult = fuzzer.recordCampaignInLedger(report, ':memory:');
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});
