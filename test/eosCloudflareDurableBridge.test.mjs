/**
 * BDD Test Suite for SPEC-297 / CHANGE-159:
 * Cloudflare Durable Objects Persistent State & Actor Mesh
 *
 * Verifies BDD-1557..BDD-1562.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  EdgeSqliteStorageEngine,
  DurableActorLifecycleManager,
  SemanticPromptVectorCache,
  EdgeControlPlaneBridge,
  auditDurableObjectsPipeline,
} from "../src/core/eosCloudflareDurableBridge.ts";

describe("SPEC-297: Cloudflare Durable Objects Persistent State & Actor Mesh", () => {
  // BDD-1557
  test("BDD-1557: Stateful Actor Lifecycle Transitions and WebSocket Hibernation", () => {
    const manager = new DurableActorLifecycleManager();
    const actorId = "actor-worker-99";

    // 1. Initial spawn
    const snap1 = manager.spawnActor(actorId);
    assert.equal(snap1.actorId, actorId);
    assert.equal(snap1.status, "INITIALIZED");
    assert.equal(snap1.activeWebSockets, 1);
    assert.equal(snap1.messageCount, 0);

    // 2. Dispatch message activates actor
    const snap2 = manager.dispatchMessage(actorId, {
      sender: "coordinator",
      payload: { command: "INDEX_WORKSPACE" },
    });
    assert.equal(snap2.status, "ACTIVE");
    assert.equal(snap2.messageCount, 1);

    // 3. Hibernate actor
    const snap3 = manager.hibernateActor(actorId);
    assert.equal(snap3.status, "HIBERNATED");
    assert.equal(snap3.activeWebSockets, 1); // WebSocket connection retained in hibernation

    // 4. Subsequent message wakes actor back to ACTIVE without lost messages
    const snap4 = manager.dispatchMessage(actorId, {
      sender: "peer-agent",
      payload: { result: "AST_READY" },
    });
    assert.equal(snap4.status, "ACTIVE");
    assert.equal(snap4.messageCount, 2);

    // 5. Terminate actor
    const snap5 = manager.terminateActor(actorId);
    assert.equal(snap5.status, "TERMINATED");
    assert.equal(snap5.activeWebSockets, 0);
  });

  // BDD-1558
  test("BDD-1558: Transactional Embedded Edge Storage with Rollback", () => {
    const storage = new EdgeSqliteStorageEngine();

    storage.put("user_session", { userId: "valentin", tier: "SOVEREIGN" });
    storage.put("balance", 1000);

    assert.equal(storage.size(), 2);
    assert.equal(storage.get("balance"), 1000);

    // Atomic transaction rollback
    let errorCaught = false;
    try {
      storage.transaction((txn) => {
        txn.put("balance", 500);
        txn.put("mutation_in_progress", true);
        throw new Error("Simulated storage constraint violation");
      });
    } catch {
      errorCaught = true;
    }

    assert.equal(errorCaught, true);
    assert.equal(storage.get("balance"), 1000); // Restored
    assert.equal(storage.get("mutation_in_progress"), undefined); // Not committed

    // Successful transaction
    storage.transaction((txn) => {
      txn.put("balance", 1250);
      txn.put("verified", true);
    });

    assert.equal(storage.get("balance"), 1250);
    assert.equal(storage.get("verified"), true);
  });

  // BDD-1559
  test("BDD-1559: Semantic Vector Prompt Cache Matching with Cosine Similarity", () => {
    const cache = new SemanticPromptVectorCache();

    cache.put("How to configure zero runtime dependencies in Node.js 22", {
      guideline: "Use node: built-ins and type-stripping",
    });

    // Exact or near-identical prompt
    const hit = cache.match("How to configure zero runtime dependencies in Node.js 22", 0.96);
    assert.equal(hit.hit, true);
    assert.ok(hit.similarity >= 0.96);
    assert.ok(hit.response);
    assert.ok(hit.latencyMs < 5); // Sub-5ms SLA

    // Different prompt
    const miss = cache.match("What is the recipe for chocolate cake?", 0.96);
    assert.equal(miss.hit, false);
    assert.ok(miss.similarity < 0.96);
  });

  // BDD-1560
  test("BDD-1560: Cache Eviction, TTL Expiration, and Invalidation", () => {
    const cache = new SemanticPromptVectorCache();

    // Insert entry with 10ms TTL
    cache.put("Ephemeral token prompt", { token: "abc" }, 10);
    assert.equal(cache.size(), 1);

    // Explicit purge
    cache.purge("Ephemeral token prompt");
    assert.equal(cache.size(), 0);

    // Expired TTL check
    cache.put("Short lived entry", { val: 42 }, 1); // 1ms TTL
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait 10ms
    }

    const matchAfterExpire = cache.match("Short lived entry", 0.96);
    assert.equal(matchAfterExpire.hit, false);

    const evicted = cache.evictExpired();
    assert.equal(evicted, 1);
    assert.equal(cache.size(), 0);
  });

  // BDD-1561
  test("BDD-1561: HMAC-SHA256 Authenticated Edge Bridge Dispatch", () => {
    const secret = "super-secret-edge-key-2026";
    const payload = { action: "REPLICATE_STATE", actorId: "actor-77", version: 1 };

    const signed = EdgeControlPlaneBridge.signRequest(payload, secret);

    assert.ok(signed.signature.length === 64);
    assert.equal(signed.keyId, "glorian-edge-primary");
    assert.ok(typeof signed.timestamp === "number");

    // Valid verification
    const isValid = EdgeControlPlaneBridge.verifyRequest(signed, secret);
    assert.equal(isValid, true);

    // Tampered payload
    const tampered = { ...signed, payload: { ...payload, version: 2 } };
    const isTamperedValid = EdgeControlPlaneBridge.verifyRequest(tampered, secret);
    assert.equal(isTamperedValid, false);

    // Expired timestamp
    const expired = { ...signed, timestamp: Date.now() - 100_000 };
    const isExpiredValid = EdgeControlPlaneBridge.verifyRequest(expired, secret, 50_000);
    assert.equal(isExpiredValid, false);
  });

  // BDD-1562
  test("BDD-1562: Cryptographic Durable Objects Audit Receipt Generation", async () => {
    const receipt = await auditDurableObjectsPipeline(process.cwd());

    assert.equal(receipt.specId, "SPEC-297");
    assert.equal(receipt.changeId, "CHANGE-159");
    assert.equal(receipt.actorsSpawned, 1);
    assert.equal(receipt.transactionsAudited, 1);
    assert.equal(receipt.cacheHitRate, 1.0);
    assert.equal(receipt.edgeBridgeVerified, true);
    assert.ok(receipt.sha256Signature.length === 64);

    const receiptPath = path.join(process.cwd(), "docs", "evidence", "DURABLE_OBJECTS_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.specId, "SPEC-297");
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
