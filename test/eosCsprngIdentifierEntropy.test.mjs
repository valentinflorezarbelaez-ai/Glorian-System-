/**
 * EOS SYSTEM — CSPRNG IDENTIFIER ENTROPY REGRESSION SUITE
 * Follow-up to the SPEC-077/080 CSPRNG hardening (commit a2c029dc):
 * execution tokens, audit IDs, SSTable names and pipeline run IDs must
 * draw entropy from the OS CSPRNG, never from Math.random().
 *
 * Each test freezes Math.random to a constant: if two identifiers issued
 * within the same millisecond still differ, their entropy cannot come from
 * the predictable PRNG path.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { EosAdaptiveConcurrencyLimiter } from "../src/core/eosAdaptiveConcurrencyLimiter.ts";
import { EosActiveKernelProcessEnforcer } from "../src/core/eosActiveKernelProcessEnforcer.ts";
import { EosLsmTreeStorageEngine } from "../src/core/eosLsmTreeStorageEngine.ts";
import { EosSovereignLoop } from "../src/core/eosSovereignLoop.ts";

function withFrozenMathRandom(fn) {
  const original = Math.random;
  Math.random = () => 0.5;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test("BDD-964: Concurrency tokens stay unique with Math.random frozen (CSPRNG entropy)", () => {
  const limiter = new EosAdaptiveConcurrencyLimiter({ initialLimit: 256, minLimit: 256, maxLimit: 256 });
  const tokens = withFrozenMathRandom(() => {
    const issued = [];
    for (let i = 0; i < 256; i++) {
      const grant = limiter.acquire();
      assert.equal(grant.granted, true);
      issued.push(grant.token);
    }
    return issued;
  });

  assert.equal(new Set(tokens).size, 256);
  for (const token of tokens) {
    assert.match(token, /^TKN-\d+-[0-9a-f]{12}$/);
  }
});

test("BDD-965: Enforcer execution IDs stay unique with Math.random frozen (audit integrity)", () => {
  const enforcer = new EosActiveKernelProcessEnforcer();
  const quotaMs = Number(process.env.EOS_ENFORCER_EXEC_QUOTA_MS || 10000);

  const ids = withFrozenMathRandom(() => {
    const receipts = [0, 1].map(() =>
      enforcer.executeConfined(process.execPath, ["-e", 'console.log("CSPRNG_ID_CHECK")'], { timeoutMs: quotaMs }),
    );
    for (const receipt of receipts) {
      assert.equal(receipt.status, "SUCCESS");
    }
    return receipts.map((receipt) => receipt.executionId);
  });

  assert.notEqual(ids[0], ids[1]);
  for (const id of ids) {
    assert.match(id, /^enf-[0-9a-z]+-[0-9a-f]{12}$/);
  }
});

test("BDD-966: SSTable IDs stay unique across same-millisecond flushes with Math.random frozen", () => {
  const engine = new EosLsmTreeStorageEngine(2);
  const tableIds = withFrozenMathRandom(() => {
    const flushed = [];
    for (let i = 0; i < 64; i++) {
      engine.put(`key:${i}`, `value:${i}`);
      const segment = engine.flushMemTable();
      assert.ok(segment);
      flushed.push(segment.tableId);
    }
    return flushed;
  });

  assert.equal(new Set(tableIds).size, 64);
  for (const tableId of tableIds) {
    assert.match(tableId, /^sst-L0-[0-9a-z]+-[0-9a-f]{12}$/);
  }
});

test("BDD-967: Sovereign pipeline run IDs stay unique with Math.random frozen (evidence receipts)", () => {
  const engine = new EosSovereignLoop();
  const runIds = withFrozenMathRandom(() => {
    const issued = [];
    for (let i = 0; i < 64; i++) {
      const context = engine.initializePipeline({
        projectId: "csprng-regression",
        title: `Identifier entropy check ${i}`,
        userPrompt: "Verify that pipeline run identifiers carry CSPRNG entropy.",
      });
      issued.push(context.runId);
    }
    return issued;
  });

  assert.equal(new Set(runIds).size, 64);
  for (const runId of runIds) {
    assert.match(runId, /^RUN-\d+-[0-9A-F]{12}$/);
  }
});
