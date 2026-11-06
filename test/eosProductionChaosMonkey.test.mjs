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
  const report = await EosProductionChaosMonkey.executeExperiment(
    "https://portafolio-valentin.vercel.app",
    {
      burstCount: 5,
      mockTransport: async (i) => ({ status: 200, latencyMs: 120 + i * 10 })
    }
  );

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
    const report = await EosProductionChaosMonkey.executeExperiment(
      "https://test-flaky-endpoint.internal",
      {
        burstCount: 10,
        maxErrorBudgetPercent: 5.0,
        mockTransport: async (i) => {
          // Probe 0: OK, Probe 1: 503 error (rate = 50% > 5%) -> should abort!
          return i === 0 ? { status: 200, latencyMs: 50 } : { status: 503, latencyMs: 20 };
        }
      }
    );

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
