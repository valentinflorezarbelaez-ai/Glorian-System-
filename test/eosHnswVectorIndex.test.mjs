/**
 * EOS SYSTEM — LAYER-0 HNSW VECTOR SEARCH ENGINE TEST SUITE
 * Governed by SPEC-201, CHANGE-086, ADR-086, BDD-1024..BDD-1028 (v71.0.0)
 *
 * Validates multi-layer HNSW graph indexing, metric distance computations,
 * subword hashing embedding projections, approximate nearest neighbor search,
 * state serialization / deserialization, and CLI execution with receipts.
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EosHnswVectorIndex } from "../src/core/eosHnswVectorIndex.ts";

describe("EosHnswVectorIndex (SPEC-201 / BDD-1024..BDD-1028)", () => {
  it("BDD-1024: Multi-layer HNSW graph vector insertion", () => {
    const index = new EosHnswVectorIndex({
      dimension: 4,
      metric: "cosine",
      M: 4,
      efConstruction: 8,
      seed: 42,
    });

    assert.equal(index.size(), 0);

    // Insert 5 test vectors
    index.insert("v1", [1.0, 0.0, 0.0, 0.0], { label: "first" });
    index.insert("v2", [0.0, 1.0, 0.0, 0.0], { label: "second" });
    index.insert("v3", [0.0, 0.0, 1.0, 0.0], { label: "third" });
    index.insert("v4", [0.0, 0.0, 0.0, 1.0], { label: "fourth" });
    index.insert("v5", [0.7071, 0.7071, 0.0, 0.0], { label: "diagonal" });

    assert.equal(index.size(), 5);

    // Overwriting existing ID
    index.insert("v1", [1.0, 0.0, 0.0, 0.0], { label: "updated_first" });
    assert.equal(index.size(), 5);
  });

  it("BDD-1025: Approximate nearest neighbor search accuracy and ranking", () => {
    const index = new EosHnswVectorIndex({
      dimension: 4,
      metric: "cosine",
      M: 8,
      efConstruction: 16,
      efSearch: 16,
      seed: 1234,
    });

    index.insert("doc_red", [1.0, 0.0, 0.0, 0.0], { color: "red" });
    index.insert("doc_green", [0.0, 1.0, 0.0, 0.0], { color: "green" });
    index.insert("doc_blue", [0.0, 0.0, 1.0, 0.0], { color: "blue" });
    index.insert("doc_yellow", [0.9, 0.9, 0.0, 0.0], { color: "yellow" });

    // Search near "doc_red"
    const results = index.search([0.95, 0.05, 0.0, 0.0], 2);

    assert.ok(results.length <= 2);
    assert.equal(results[0].id, "doc_red");
    assert.ok(results[0].similarityScore > 0.95);
    assert.ok(results[0].distance >= 0);
  });

  it("BDD-1026: Autonomous code embedding projection and semantic retrieval", () => {
    const index = new EosHnswVectorIndex({ dimension: 64, metric: "cosine" });

    // Embed and index 3 code snippets
    index.indexCodeSnippet(
      "crypto_sign",
      "function signQuantumReceipt(message, secretKey) { return mlDsaSign(message); }",
    );
    index.indexCodeSnippet("db_pool", "async function getPostgresClient(poolConfig) { return pool.connect(); }");
    index.indexCodeSnippet(
      "auth_jwt",
      "function verifyJsonWebToken(bearerToken, secret) { return jwt.verify(bearerToken); }",
    );

    assert.equal(index.size(), 3);

    // Semantic search for cryptography
    const cryptoMatches = index.searchCode("quantum cryptographic signature and keys", 1);
    assert.equal(cryptoMatches.length, 1);
    assert.equal(cryptoMatches[0].id, "crypto_sign");
    assert.ok(cryptoMatches[0].similarityScore > 0.2);

    // Semantic search for database
    const dbMatches = index.searchCode("postgres database connection pool", 1);
    assert.equal(dbMatches.length, 1);
    assert.equal(dbMatches[0].id, "db_pool");
  });

  it("BDD-1027: Deterministic index serialization and restoration", () => {
    const original = new EosHnswVectorIndex({ dimension: 8, metric: "euclidean", M: 4 });
    original.insert("node_a", [1, 2, 3, 4, 5, 6, 7, 8], { meta: "alpha" });
    original.insert("node_b", [8, 7, 6, 5, 4, 3, 2, 1], { meta: "beta" });

    const serialized = original.serialize();
    assert.equal(serialized.version, "HNSW_V71");
    assert.equal(serialized.dimension, 8);
    assert.equal(serialized.metric, "euclidean");
    assert.equal(serialized.nodes.length, 2);
    assert.equal(serialized.sha256Checksum.length, 64);

    // Deserialize into fresh instance
    const restored = EosHnswVectorIndex.deserialize(serialized);
    assert.equal(restored.size(), 2);
    assert.equal(restored.dimension, 8);
    assert.equal(restored.metric, "euclidean");

    const searchRes = restored.search([1, 2, 3, 4, 5, 6, 7, 8], 1);
    assert.equal(searchRes[0].id, "node_a");
    assert.equal(searchRes[0].distance, 0);
  });

  it("BDD-1028: CLI invocation and cryptographic receipt", () => {
    // 1. glorian vector:index
    const indexOutput = execFileSync(
      "node",
      ["bin/eos.mjs", "vector:index", "test_item", "function add(x, y) { return x + y; }", "--json"],
      {
        encoding: "utf8",
      },
    );
    const indexParsed = JSON.parse(indexOutput);
    assert.equal(indexParsed.action, "vector:index");
    assert.equal(indexParsed.id, "test_item");
    assert.equal(indexParsed.dimension, 64);
    assert.equal(indexParsed.sha256Receipt.length, 64);

    // 2. glorian vector:search
    const searchOutput = execFileSync("node", ["bin/eos.mjs", "vector:search", "jwt verify token", "--k=2", "--json"], {
      encoding: "utf8",
    });
    const searchParsed = JSON.parse(searchOutput);
    assert.ok(searchParsed.matches.length > 0);
    assert.equal(searchParsed.matches[0].id, "core/auth");
    assert.equal(searchParsed.sha256Receipt.length, 64);
  });
});
