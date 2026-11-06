/**
 * EOS SYSTEM — SPEC-066 BDD TEST SUITE
 * Automated Statistical Canary Analysis (ACA) Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosStatisticalCanaryAuditor } from '../src/core/eosStatisticalCanaryAuditor.ts';

test('BDD-207: Mann-Whitney U Nonparametric Statistical Evaluation (Rollback on Degradation)', () => {
  // Baseline latencies around 10-12ms
  const baseline = [10, 11, 12, 11, 10, 12, 11, 10, 12, 11];
  // Canary severely degraded to 25-31ms
  const canaryDegraded = [25, 28, 30, 26, 27, 29, 31, 28, 27, 30];

  const report = EosStatisticalCanaryAuditor.auditCanaryMetric('http_p95_latency_ms', baseline, canaryDegraded);

  assert.equal(report.verdict, 'CANARY_ROLLBACK_REQUIRED');
  assert.equal(report.regressionDetected, true);
  assert.equal(report.isStatisticallySignificant, true);
  assert.ok(report.statistics.pValue < 0.001, `Expected p-value < 0.001, got ${report.statistics.pValue}`);
  assert.equal(report.sha256Receipt.length, 64);
});

test('BDD-208: Canary Health Verification Passing with Optimal Distribution', () => {
  // Baseline latencies around 20-22ms
  const baseline = [20, 21, 22, 20, 21];
  // Canary slightly improved to 18-20ms
  const canaryOptimized = [18, 19, 18, 20, 19];

  const report = EosStatisticalCanaryAuditor.auditCanaryMetric('http_p95_latency_ms', baseline, canaryOptimized);

  assert.equal(report.verdict, 'CANARY_PASS_OPTIMAL');
  assert.equal(report.regressionDetected, false);
  assert.equal(report.sha256Receipt.length, 64);

  // Verify persistence in SQLite WAL ledger
  const recordResult = EosStatisticalCanaryAuditor.recordAuditInLedger(report, ':memory:');
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});
