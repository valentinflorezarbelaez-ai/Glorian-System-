/**
 * EOS SYSTEM — CONSISTENT HASHING & EDGE RATE LIMITING TEST SUITE
 * Validates SPEC-036, FR-103..FR-106, BDD-094..BDD-097
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EosConsistentHashRing } from "../src/core/eosConsistentHashRing.ts";
import { EosAntiEntropyMerkleSync } from "../src/core/eosAntiEntropyMerkleSync.ts";
import { EosTokenBucketRateLimiter } from "../src/core/eosTokenBucketRateLimiter.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

describe("SPEC-036: Amazon Dynamo Consistent Hashing & Cloudflare Rate Limiting", () => {
  describe("BDD-094: Uniform Consistent Hash Ring with Virtual Nodes", () => {
    it("distributes 1,000 keys balanced across 3 physical nodes (64 vnodes each)", () => {
      const ring = new EosConsistentHashRing(["node-us", "node-eu", "node-ap"], 64);
      assert.equal(ring.getPhysicalNodeCount(), 3);
      assert.equal(ring.getTotalVnodeCount(), 3 * 64);

      const keys = Array.from({ length: 1000 }, (_, i) => `account-partition-key-${i}`);
      const distribution = ring.getDistribution(keys);

      const counts = Object.values(distribution);
      for (const count of counts) {
        const ratio = count / 1000;
        // Each node gets between 20% and 45% (ideal is 33.3%)
        assert.ok(ratio >= 0.2 && ratio <= 0.45, `Expected balanced ratio between 0.20 and 0.45, got ${ratio}`);
      }
    });

    it("minimizes key migrations when adding a fourth node", () => {
      const ring = new EosConsistentHashRing(["node-1", "node-2", "node-3"], 32);
      const keys = Array.from({ length: 500 }, (_, i) => `item-key-${i}`);
      const initialAssignments = keys.map((k) => ring.getNode(k));

      // Add 4th node
      ring.addNode("node-4", 32);
      assert.equal(ring.getPhysicalNodeCount(), 4);

      let migratedCount = 0;
      for (let i = 0; i < keys.length; i++) {
        const newAssignment = ring.getNode(keys[i]);
        if (newAssignment !== initialAssignments[i]) {
          migratedCount++;
          // Migrated keys MUST be assigned to the new node
          assert.equal(newAssignment, "node-4");
        }
      }

      // Expected migration is around 1/4 (25%) of keys (+/- 10%)
      const migrationRatio = migratedCount / keys.length;
      assert.ok(migrationRatio > 0.1 && migrationRatio < 0.4, `Migration ratio was ${migrationRatio}`);
    });
  });

  describe("BDD-095: Preference List with Distinct Physical Nodes", () => {
    it("generates preference list with R distinct physical nodes", () => {
      const ring = new EosConsistentHashRing(["storage-east", "storage-west", "storage-eu"], 32);
      const preference = ring.getPreferenceList("customer-uuid-8849102", 3);

      assert.equal(preference.length, 3);
      const uniqueNodes = new Set(preference);
      assert.equal(uniqueNodes.size, 3);
    });

    it("removes physical node cleanly and adjusts preference list", () => {
      const ring = new EosConsistentHashRing(["node-A", "node-B", "node-C"], 16);
      ring.removeNode("node-B");
      assert.equal(ring.getPhysicalNodeCount(), 2);

      const pref = ring.getPreferenceList("random-key-xyz", 3);
      assert.equal(pref.length, 2);
      assert.ok(!pref.includes("node-B"));
    });
  });

  describe("BDD-096: Fast Divergence Detection via Anti-Entropy Merkle Trees", () => {
    it("reports inSync: true when replicas contain identical key-value facts", () => {
      const replicaA = new EosAntiEntropyMerkleSync(16);
      const replicaB = new EosAntiEntropyMerkleSync(16);

      for (let i = 0; i < 50; i++) {
        replicaA.put(`metric-${i}`, `val-${i * 10}`);
        replicaB.put(`metric-${i}`, `val-${i * 10}`);
      }

      const treeA = replicaA.buildMerkleTree();
      const treeB = replicaB.buildMerkleTree();

      assert.equal(treeA.hash, treeB.hash);

      const diff = EosAntiEntropyMerkleSync.compareTrees(treeA, treeB);
      assert.equal(diff.inSync, true);
      assert.equal(diff.divergentRanges.length, 0);
    });

    it("isolates divergent bucket ranges when state drifts in replica", () => {
      const replicaA = new EosAntiEntropyMerkleSync(16);
      const replicaB = new EosAntiEntropyMerkleSync(16);

      for (let i = 0; i < 50; i++) {
        replicaA.put(`metric-${i}`, `val-${i * 10}`);
        replicaB.put(`metric-${i}`, `val-${i * 10}`);
      }

      // Mutate one key on replica B
      replicaB.put("metric-25", "MUTATED_VALUE");

      const treeA = replicaA.buildMerkleTree();
      const treeB = replicaB.buildMerkleTree();

      assert.notEqual(treeA.hash, treeB.hash);

      const diff = EosAntiEntropyMerkleSync.compareTrees(treeA, treeB);
      assert.equal(diff.inSync, false);
      assert.ok(diff.divergentRanges.length >= 1);
    });
  });

  describe("BDD-097: Cloudflare Microsecond Token-Bucket Rate Limiter", () => {
    it("allows burst up to capacity and rejects subsequent calls", () => {
      const limiter = new EosTokenBucketRateLimiter({
        capacity: 10,
        refillPerSecond: 20,
      });

      // Consume 10 burst tokens
      for (let i = 0; i < 10; i++) {
        const res = limiter.consume("client-ip-127.0.0.1", 1);
        assert.equal(res.granted, true);
      }

      // 11th request immediately rejected
      const rejected = limiter.consume("client-ip-127.0.0.1", 1);
      assert.equal(rejected.granted, false);
      assert.ok(rejected.retryAfterSeconds > 0);
    });

    it("handles multiple client keys independently", () => {
      const limiter = new EosTokenBucketRateLimiter({
        capacity: 5,
        refillPerSecond: 10,
      });

      // Exhaust client A
      for (let i = 0; i < 5; i++) {
        assert.equal(limiter.consume("clientA").granted, true);
      }
      assert.equal(limiter.consume("clientA").granted, false);

      // Client B has full bucket
      assert.equal(limiter.consume("clientB").granted, true);
    });
  });

  describe("BDD-098: Multi-Channel MCP Dispatching (Consistent Hashing & Rate Limiter)", () => {
    const server = new EosMcpServer();

    it("dispatches eos_hash_ring_lookup via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-ring-1",
        method: "tools/call",
        params: {
          name: "eos_hash_ring_lookup",
          arguments: {
            key: "account-user-123",
            nodes: ["node-us", "node-eu", "node-sa"],
            replicas: 2,
          },
        },
      });
      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.ok(parsed.primaryNode);
      assert.equal(parsed.preferenceList.length, 2);
    });

    it("dispatches eos_merkle_sync_diff via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-merkle-1",
        method: "tools/call",
        params: {
          name: "eos_merkle_sync_diff",
          arguments: {},
        },
      });
      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(typeof parsed.inSync, "boolean");
      assert.ok(Array.isArray(parsed.divergentRanges));
    });

    it("dispatches eos_token_bucket_check via MCP", () => {
      const res = server.handleRequest({
        jsonrpc: "2.0",
        id: "req-tb-1",
        method: "tools/call",
        params: {
          name: "eos_token_bucket_check",
          arguments: {
            clientId: "test-client",
            capacity: 5,
            refillPerSecond: 10,
          },
        },
      });
      assert.equal(res.jsonrpc, "2.0");
      const parsed = JSON.parse(res.result.content[0].text);
      assert.equal(parsed.granted, true);
      assert.equal(typeof parsed.remainingTokens, "number");
    });
  });
});
