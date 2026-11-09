/**
 * EOS SYSTEM — SPEC-064 BDD TEST SUITE
 * Production Chaos Monkey & Resilience Hypervisor
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosProductionChaosMonkey } from "../src/core/eosProductionChaosMonkey.ts";
import { EosDurableSqliteLedger } from "../src/core/eosDurableSqliteLedger.ts";

test("BDD-194: Live Fleet Chaos Attack Vector Execution", async () => {
  const report = await EosProductionChaosMonkey.executeExperiment("https://portafolio-valentin.vercel.app", {
    burstCount: 5,
    mockTransport: async (i) => ({ status: 200, latencyMs: 120 + i * 10 }),
  });

  assert.equal(report.epistemicVerdict, "RESILIENT_CHAOS_SURVIVED");
  assert.equal(report.probesSent, 5);
  assert.equal(report.probesSuccess, 5);
  assert.equal(report.errorCount, 0);
  assert.equal(report.emergencyAbortTriggered, false);
  assert.ok(report.avgLatencyMs >= 120);
  assert.equal(report.sha256Receipt.length, 64);
});

test("BDD-195: Error Budget Circuit Breaker Safety Trip", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-chaos-test-"));
  const ledgerPath = path.join(tmpDir, "ledger.sqlite");

  try {
    const report = await EosProductionChaosMonkey.executeExperiment("https://test-flaky-endpoint.internal", {
      burstCount: 10,
      maxErrorBudgetPercent: 5.0,
      mockTransport: async (i) => {
        // Probe 0: OK, Probe 1: 503 error (rate = 50% > 5%) -> should abort!
        return i === 0 ? { status: 200, latencyMs: 50 } : { status: 503, latencyMs: 20 };
      },
    });

    assert.equal(report.epistemicVerdict, "CIRCUIT_BREAKER_ABORTED");
    assert.equal(report.emergencyAbortTriggered, true);
    assert.ok(report.probesSent < 10, "Should abort early before 10 probes");

    // Verify Ledger persistence
    const saved = EosProductionChaosMonkey.recordReceiptInLedger(report, ledgerPath);
    assert.equal(saved, true);

    const ledger = new EosDurableSqliteLedger(ledgerPath);
    const recent = ledger.listRecent(5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].category, "SECURITY_AUDIT");
    ledger.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("BDD-196: executeExperimentSync Nominal, Synthetic, Degraded & Abort Modes", () => {
  // 1. Nominal with mockTransport
  const repNominal = EosProductionChaosMonkey.executeExperimentSync("http://localhost:3000", {
    burstCount: 3,
    mockTransport: (_i) => ({ status: 200, latencyMs: 5 }),
  });
  assert.equal(repNominal.epistemicVerdict, "RESILIENT_CHAOS_SURVIVED");
  assert.equal(repNominal.probesSent, 3);
  assert.equal(repNominal.probesSuccess, 3);

  // 2. Pure synthetic without mockTransport
  const repSim = EosProductionChaosMonkey.executeExperimentSync("http://localhost:3000", {
    burstCount: 5,
  });
  assert.equal(repSim.epistemicVerdict, "RESILIENT_CHAOS_SURVIVED");
  assert.equal(repSim.probesSent, 5);

  // 3. Circuit breaker abort
  const repAbort = EosProductionChaosMonkey.executeExperimentSync("http://localhost:3000", {
    burstCount: 10,
    maxErrorBudgetPercent: 1.0,
    mockTransport: (i) => ({ status: i === 0 ? 200 : 500, latencyMs: 10 }),
  });
  assert.equal(repAbort.epistemicVerdict, "CIRCUIT_BREAKER_ABORTED");
  assert.equal(repAbort.emergencyAbortTriggered, true);

  // 4. DEGRADED verdict (errors present but within budget)
  const repDegraded = EosProductionChaosMonkey.executeExperimentSync("http://localhost:3000", {
    burstCount: 10,
    maxErrorBudgetPercent: 50.0,
    mockTransport: (i) => ({ status: i === 0 ? 500 : 200, latencyMs: 10 }),
  });
  assert.equal(repDegraded.epistemicVerdict, "DEGRADED");

  // 5. Precondition failure
  assert.throws(() => EosProductionChaosMonkey.executeExperimentSync("ftp://invalid"), /Valid HTTP target/);
});

test("BDD-197: Async DEGRADED verdict within error budget", async () => {
  const repDegradedAsync = await EosProductionChaosMonkey.executeExperiment("https://example.com", {
    burstCount: 5,
    maxErrorBudgetPercent: 50.0,
    mockTransport: async (i) => ({ status: i === 1 ? 503 : 200, latencyMs: 20 }),
  });
  assert.equal(repDegradedAsync.epistemicVerdict, "DEGRADED");
  assert.equal(repDegradedAsync.emergencyAbortTriggered, false);
});
