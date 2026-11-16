/**
 * EOS SYSTEM — NEURAL VECTOR CORE TESTS
 * Tests for tokenize, computeTermFrequency, cosineSimilarity, denseCosineSimilarity,
 * EosNeuralVectorStore, createDefaultEosKnowledgeStore
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  computeTermFrequency,
  cosineSimilarity,
  denseCosineSimilarity,
  EosNeuralVectorStore,
  createDefaultEosKnowledgeStore,
} from "../src/core/eosNeuralVectorCore.ts";

// ============================================================================
// tokenize
// ============================================================================

test("tokenize removes English stopwords", () => {
  const tokens = tokenize("the quick brown fox");
  assert.ok(!tokens.includes("the"));
  assert.ok(tokens.includes("quick"));
});

test("tokenize removes Spanish stopwords", () => {
  const tokens = tokenize("el gato negro en la casa");
  assert.ok(!tokens.includes("el"));
  assert.ok(!tokens.includes("en"));
  assert.ok(!tokens.includes("la"));
  assert.ok(tokens.includes("gato"));
  assert.ok(tokens.includes("negro"));
  assert.ok(tokens.includes("casa"));
});

test("tokenize is case-insensitive", () => {
  const tokens = tokenize("Hello WORLD");
  assert.ok(tokens.includes("hello"));
  assert.ok(tokens.includes("world"));
});

test("tokenize removes accents", () => {
  const tokens = tokenize("café résumé");
  assert.ok(tokens.includes("cafe"));
  assert.ok(tokens.includes("resume"));
});

test("tokenize filters tokens with length <= 1", () => {
  const tokens = tokenize("a b I the test");
  assert.ok(!tokens.includes("a"));
  assert.ok(!tokens.includes("b"));
  assert.ok(tokens.includes("test"));
});

test("tokenize empty string returns empty array", () => {
  const tokens = tokenize("");
  assert.deepEqual(tokens, []);
});

test("tokenize null returns empty array", () => {
  const tokens = tokenize(null);
  assert.deepEqual(tokens, []);
});

test("tokenize undefined returns empty array", () => {
  const tokens = tokenize(undefined);
  assert.deepEqual(tokens, []);
});

test("tokenize removes punctuation", () => {
  const tokens = tokenize("hello, world! test...");
  assert.ok(tokens.includes("hello"));
  assert.ok(tokens.includes("world"));
  assert.ok(tokens.includes("test"));
});

test("tokenize preserves numbers", () => {
  const tokens = tokenize("test 123 value");
  assert.ok(tokens.includes("123"));
});

test("tokenize preserves hyphens and underscores", () => {
  const tokens = tokenize("well-known test_case");
  assert.ok(tokens.includes("well-known"));
  assert.ok(tokens.includes("test_case"));
});

// ============================================================================
// computeTermFrequency
// ============================================================================

test("computeTermFrequency empty tokens returns empty map", () => {
  const tf = computeTermFrequency([]);
  assert.equal(tf.size, 0);
});

test("computeTermFrequency counts correctly", () => {
  const tf = computeTermFrequency(["hello", "world", "hello"]);
  assert.ok(tf.has("hello"));
  assert.ok(tf.has("world"));
  assert.ok(tf.get("hello") > tf.get("world"));
});

test("computeTermFrequency L2 normalization", () => {
  const tf = computeTermFrequency(["a", "b", "a", "c"]);
  let sumSq = 0;
  for (const v of tf.values()) sumSq += v * v;
  assert.ok(Math.abs(sumSq - 1.0) < 1e-6);
});

test("computeTermFrequency single token", () => {
  const tf = computeTermFrequency(["only"]);
  assert.equal(tf.size, 1);
  assert.equal(tf.get("only"), 1.0);
});

// ============================================================================
// cosineSimilarity
// ============================================================================

test("cosineSimilarity identical vectors returns 1", () => {
  const v = new Map([
    ["a", 1],
    ["b", 2],
  ]);
  const score = cosineSimilarity(v, v);
  assert.ok(Math.abs(score - 1.0) < 1e-6);
});

test("cosineSimilarity no intersection returns 0", () => {
  const v1 = new Map([["a", 1]]);
  const v2 = new Map([["b", 1]]);
  const score = cosineSimilarity(v1, v2);
  assert.equal(score, 0);
});

test("cosineSimilarity empty vector returns 0", () => {
  const v1 = new Map([["a", 1]]);
  const v2 = new Map();
  const score = cosineSimilarity(v1, v2);
  assert.equal(score, 0);
});

test("cosineSimilarity both empty returns 0", () => {
  const score = cosineSimilarity(new Map(), new Map());
  assert.equal(score, 0);
});

test("cosineSimilarity score between 0 and 1", () => {
  const v1 = new Map([
    ["a", 0.5],
    ["b", 0.5],
  ]);
  const v2 = new Map([
    ["a", 1],
    ["b", 0],
  ]);
  const score = cosineSimilarity(v1, v2);
  assert.ok(score >= 0);
  assert.ok(score <= 1);
});

test("cosineSimilarity partial overlap", () => {
  const v1 = new Map([
    ["a", 1],
    ["b", 1],
  ]);
  const v2 = new Map([
    ["a", 1],
    ["c", 1],
  ]);
  const score = cosineSimilarity(v1, v2);
  assert.ok(score >= 0);
  assert.ok(score <= 1);
});

// ============================================================================
// denseCosineSimilarity
// ============================================================================

test("denseCosineSimilarity identical arrays returns 1", () => {
  const a = new Float64Array([1, 2, 3]);
  const score = denseCosineSimilarity(a, a);
  assert.ok(Math.abs(score - 1.0) < 1e-6);
});

test("denseCosineSimilarity length mismatch returns 0", () => {
  const a = new Float64Array([1, 2]);
  const b = new Float64Array([1, 2, 3]);
  const score = denseCosineSimilarity(a, b);
  assert.equal(score, 0);
});

test("denseCosineSimilarity empty arrays returns 0", () => {
  const a = new Float64Array(0);
  const b = new Float64Array(0);
  const score = denseCosineSimilarity(a, b);
  assert.equal(score, 0);
});

test("denseCosineSimilarity orthogonal vectors returns 0", () => {
  const a = new Float64Array([1, 0]);
  const b = new Float64Array([0, 1]);
  const score = denseCosineSimilarity(a, b);
  assert.ok(Math.abs(score) < 1e-6);
});

test("denseCosineSimilarity score between 0 and 1", () => {
  const a = new Float64Array([1, 2]);
  const b = new Float64Array([3, 4]);
  const score = denseCosineSimilarity(a, b);
  assert.ok(score >= 0);
  assert.ok(score <= 1);
});

// ============================================================================
// EosNeuralVectorStore
// ============================================================================

test("EosNeuralVectorStore addDocument increases size", () => {
  const store = new EosNeuralVectorStore();
  assert.equal(store.size(), 0);
  store.addDocument("doc1", "hello world");
  assert.equal(store.size(), 1);
});

test("EosNeuralVectorStore search returns results", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world test");
  store.addDocument("doc2", "foo bar baz");
  const results = store.search("hello world");
  assert.ok(results.length > 0);
  assert.equal(results[0].id, "doc1");
});

test("EosNeuralVectorStore search sorted by score descending", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world hello world");
  store.addDocument("doc2", "hello once");
  const results = store.search("hello world");
  assert.ok(results[0].score >= results[1].score);
});

test("EosNeuralVectorStore search topK limits results", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "alpha beta gamma");
  store.addDocument("doc2", "alpha delta epsilon");
  store.addDocument("doc3", "alpha zeta eta");
  const results = store.search("alpha", 2);
  assert.ok(results.length <= 2);
});

test("EosNeuralVectorStore search empty query returns empty", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world");
  const results = store.search("");
  assert.equal(results.length, 0);
});

test("EosNeuralVectorStore searchHybrid returns results", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world test");
  store.addDocument("doc2", "foo bar baz");
  const results = store.searchHybrid("hello world");
  assert.ok(results.length > 0);
});

test("EosNeuralVectorStore searchHybrid sorted by score descending", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world hello world");
  store.addDocument("doc2", "hello once");
  const results = store.searchHybrid("hello world");
  if (results.length > 1) {
    assert.ok(results[0].score >= results[1].score);
  }
});

test("EosNeuralVectorStore clear resets size", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello");
  store.clear();
  assert.equal(store.size(), 0);
});

test("EosNeuralVectorStore getDocument returns document", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "hello world", { tag: "test" });
  const doc = store.getDocument("doc1");
  assert.ok(doc);
  assert.equal(doc.id, "doc1");
  assert.equal(doc.text, "hello world");
  assert.equal(doc.metadata?.tag, "test");
});

test("EosNeuralVectorStore getDocument undefined for missing id", () => {
  const store = new EosNeuralVectorStore();
  const doc = store.getDocument("nonexistent");
  assert.equal(doc, undefined);
});

test("EosNeuralVectorStore addDocument updates existing", () => {
  const store = new EosNeuralVectorStore();
  store.addDocument("doc1", "original text");
  store.addDocument("doc1", "updated text");
  assert.equal(store.size(), 1);
  const doc = store.getDocument("doc1");
  assert.equal(doc.text, "updated text");
});

// ============================================================================
// createDefaultEosKnowledgeStore
// ============================================================================

test("createDefaultEosKnowledgeStore has 6 documents", () => {
  const store = createDefaultEosKnowledgeStore();
  assert.equal(store.size(), 6);
});

test("createDefaultEosKnowledgeStore search for fleet returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("flota soberana auditoría");
  assert.ok(results.length > 0);
});

test("createDefaultEosKnowledgeStore search for security returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("seguridad SAST credenciales");
  assert.ok(results.length > 0);
});

test("createDefaultEosKnowledgeStore search for kernel returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("Linux kernel VFS");
  assert.ok(results.length > 0);
});

test("createDefaultEosKnowledgeStore search for nanosecond returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("nanosegundos L1 cache");
  assert.ok(results.length > 0);
});

test("createDefaultEosKnowledgeStore search for memory returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("memoria akáshica conocimiento");
  assert.ok(results.length > 0);
});

test("createDefaultEosKnowledgeStore search results have metadata", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.search("flota");
  assert.ok(results.length > 0);
  assert.ok(results[0].metadata);
  assert.ok(results[0].metadata.domain);
});

test("createDefaultEosKnowledgeStore searchHybrid returns results", () => {
  const store = createDefaultEosKnowledgeStore();
  const results = store.searchHybrid("seguridad OWASP");
  assert.ok(results.length > 0);
});
