/**
 * @file eosDisaggregatedPrefillDecode.test.mjs
 * @description BDD test suite for SPEC-332 / CHANGE-194: Disaggregated Prefill & Decode
 * Serving Engine (PD Separation, Chunked Prefill & Zero-Copy KV Transfer) (BDD-1767..1772).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EosDisaggregatedPrefillDecodeCore } from "../src/core/eosDisaggregatedPrefillDecode.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/DISAGGREGATED_PREFILL_DECODE_RECEIPT.json");

test("SPEC-332 / CHANGE-194: Disaggregated Prefill & Decode Serving Engine", async (t) => {
  await t.test("BDD-1767: Chunked Prefill Decomposition & Sequential Micro-Batches", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 256, 16, 32);
    const tokens = [];
    for (let i = 0; i < 1024; i++) tokens.push(100 + i);

    engine.submitRequest("req_1024", tokens, 16);

    const chunkHistory = [];
    let migration = null;

    for (let c = 0; c < 4; c++) {
      const res = engine.stepChunkedPrefill("p_worker_0");
      assert.strictEqual(res.chunks.length, 1);
      chunkHistory.push(res.chunks[0]);
      if (res.migration) {
        migration = res.migration;
      }
    }

    assert.strictEqual(chunkHistory.length, 4, "Must decompose into exactly 4 chunks");
    assert.strictEqual(chunkHistory[0].startToken, 0);
    assert.strictEqual(chunkHistory[0].tokenCount, 256);
    assert.strictEqual(chunkHistory[0].completed, false);

    assert.strictEqual(chunkHistory[3].startToken, 768);
    assert.strictEqual(chunkHistory[3].tokenCount, 256);
    assert.strictEqual(chunkHistory[3].completed, true);

    assert.ok(migration !== null, "Final chunk must emit migration descriptor");
    assert.strictEqual(migration.totalTokens, 1024);
    assert.strictEqual(migration.totalPages, 64); // 1024 / 16 = 64 pages
  });

  await t.test("BDD-1768: Physical Node Role Decoupling (Prefill vs Decode)", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);
    const pNodes = engine.getPrefillNodes();
    const dNodes = engine.getDecodeNodes();

    assert.strictEqual(pNodes.length, 2);
    assert.strictEqual(dNodes.length, 4);

    for (const p of pNodes) {
      assert.strictEqual(p.role, "PREFILL_WORKER");
    }
    for (const d of dNodes) {
      assert.strictEqual(d.role, "DECODE_WORKER");
    }
  });

  await t.test("BDD-1769: Zero-Copy Paged KV Cache Migration with SHA-256 Checksum", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 256, 16, 32);
    const tokens = [];
    for (let i = 0; i < 512; i++) tokens.push(200 + i);

    engine.submitRequest("req_mig", tokens, 16);

    let migration = null;
    while (!migration) {
      const res = engine.stepChunkedPrefill("p_worker_0");
      if (res.migration) migration = res.migration;
    }

    assert.ok(migration.migrationChecksumSha256.length === 64);
    const mountRes = engine.migrateKvCache(migration);

    assert.strictEqual(mountRes.success, true);
    assert.strictEqual(mountRes.status, "KV_MIGRATION_MOUNTED_SUCCESSFULLY");
    assert.strictEqual(mountRes.mountedPages, 32); // 512 / 16 = 32 pages
  });

  await t.test("BDD-1770: Elimination of Head-of-Line Blocking and Latency Isolation", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);

    // Setup active decode request
    const shortTokens = [1, 2, 3, 4];
    engine.submitRequest("active_decode", shortTokens, 4);
    const resPrefill = engine.stepChunkedPrefill("p_worker_0");
    engine.migrateKvCache(resPrefill.migration);

    // Start generating tokens on decode worker
    const targetDecode = resPrefill.migration.targetNodeId;
    const step1 = engine.stepDecode(targetDecode);
    assert.strictEqual(step1.generatedCount, 1);

    // Inject heavy prompt into prefill queue
    const heavyPrompt = [];
    for (let i = 0; i < 2048; i++) heavyPrompt.push(1000 + i);
    engine.submitRequest("heavy_prefill", heavyPrompt, 4);

    // Active decode step continues unaffected with zero HoL blocking
    const step2 = engine.stepDecode(targetDecode);
    assert.strictEqual(step2.generatedCount, 1, "Decode must progress without waiting for prefill");

    const metrics = engine.getClusterMetrics();
    assert.strictEqual(metrics.headOfLineBlockingDetected, false);
  });

  await t.test("BDD-1771: Cryptographic Integrity Rejection upon KV Cache Payload Tampering", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);
    const tokens = [10, 20, 30, 40];
    engine.submitRequest("tamper_test", tokens, 4);
    const prefillRes = engine.stepChunkedPrefill("p_worker_0");

    const legitimateMigration = prefillRes.migration;

    // Tamper with the migration checksum
    const tamperedMigration = {
      ...legitimateMigration,
      migrationChecksumSha256: "bad0000000000000000000000000000000000000000000000000000000000bad",
    };

    const rejectRes = engine.migrateKvCache(tamperedMigration);
    assert.strictEqual(rejectRes.success, false);
    assert.strictEqual(rejectRes.status, "KV_MIGRATION_INTEGRITY_VIOLATION");
    assert.strictEqual(rejectRes.mountedPages, 0);
  });

  await t.test("BDD-1772: Invariant Audit & Cryptographic Receipt Generation", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);
    const receipt = engine.audit(6, 256, 4);

    assert.strictEqual(receipt.specRef, "SPEC-332");
    assert.strictEqual(receipt.noHeadOfLineBlocking, true);
    assert.strictEqual(receipt.kvIntegrityVerified, true);
    assert.strictEqual(receipt.slaIsolationVerified, true);
    assert.strictEqual(receipt.status, "DISAGGREGATED_PREFILL_DECODE_VERIFIED");
    assert.strictEqual(receipt.sha256Signature.length, 64);

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });

  await t.test("Edge Case: Prompt Smaller Than Chunk Budget", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 512, 16, 32);
    engine.submitRequest("tiny_req", [1, 2, 3], 4);

    const res = engine.stepChunkedPrefill("p_worker_0");
    assert.strictEqual(res.chunks.length, 1);
    assert.strictEqual(res.chunks[0].completed, true);
    assert.ok(res.migration !== null);
  });

  await t.test("Edge Case: Unknown Node ID Bounds", () => {
    const engine = new EosDisaggregatedPrefillDecodeCore(2, 4, 128, 16, 32);
    assert.throws(() => engine.stepChunkedPrefill("invalid_p_node"), /Unknown prefill node/);
    assert.throws(() => engine.stepDecode("invalid_d_node"), /Unknown decode node/);
  });
});
