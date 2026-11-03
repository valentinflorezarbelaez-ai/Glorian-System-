/**
 * test/eosHybridVectorKnowledge.test.mjs
 *
 * SPEC-141: Distributed Vector Memory & Hybrid Search Engine (Big Tech Standard)
 * Verification of BDD-377 through BDD-381.
 * ZERO runtime dependencies — 100% Layer-0 Pure.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  EosHybridKnowledgeEngine,
  getDefaultHybridKnowledgeEngine
} from "../src/core/eosHybridKnowledgeEngine.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("BDD-377: Inicialización Persistente y Modo WAL de SQLite Vectorial", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-vector-test-"));
  const dbFile = path.join(tempDir, "knowledge.sqlite");

  try {
    const engine = new EosHybridKnowledgeEngine(process.cwd(), dbFile);
    const stats = engine.getStats();

    assert.equal(stats.isMemory, false, "Engine should report non-memory persistence");
    assert.equal(stats.totalDocuments, 0, "Clean database should start with 0 documents");
    assert.equal(stats.vectorCount, 0, "Clean database should start with 0 vectors");

    // Verify file exists on disk
    assert.ok(fs.existsSync(dbFile), "SQLite database file must be materialized on disk");

    engine.close();
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
});

test("BDD-378: Proyección Determinista de Embeddings Vectoriales Layer-0", async (t) => {
  const engine = new EosHybridKnowledgeEngine(process.cwd(), ":memory:");

  try {
    const textA = "Modern MCP Streamable HTTP transport supporting dual application/json and text/event-stream";
    const textB = "Modern MCP Streamable HTTP transport supporting dual application/json and text/event-stream";
    const textC = "Arbitrary audio equalizer DSP biquad filter with lookahead peak limiter";

    const vecA = engine.generateDenseEmbedding(textA);
    const vecB = engine.generateDenseEmbedding(textB);
    const vecC = engine.generateDenseEmbedding(textC);

    assert.equal(vecA.length, EosHybridKnowledgeEngine.VECTOR_DIMENSIONS, "Vector length must be exactly 64");
    assert.equal(vecA.length, vecB.length);

    // Bit-for-bit identity check
    for (let i = 0; i < vecA.length; i++) {
      assert.equal(vecA[i], vecB[i], `Vector element ${i} must match bit-for-bit`);
    }

    // Unit sphere normalization check: ||v|| = 1.0 (tolerance 1e-5)
    let sumSqA = 0;
    for (let i = 0; i < vecA.length; i++) {
      sumSqA += vecA[i] * vecA[i];
    }
    const normA = Math.sqrt(sumSqA);
    assert.ok(Math.abs(normA - 1.0) < 1e-5, `L2 norm must equal 1.0, got ${normA}`);

    // Semantic cosine distance check: similar text must have higher similarity than unrelated text
    const simAB = engine.cosineSimilarity(vecA, vecB);
    const simAC = engine.cosineSimilarity(vecA, vecC);

    assert.ok(Math.abs(simAB - 1.0) < 1e-5, "Cosine similarity of identical vectors must be 1.0");
    assert.ok(simAB > simAC, `Similar text similarity (${simAB}) must exceed dissimilar text (${simAC})`);
    assert.ok(simAC < 0.6, `Dissimilar text similarity must remain low, got ${simAC}`);
  } finally {
    engine.close();
  }
});

test("BDD-379: Recuperación Híbrida mediante Reciprocal Rank Fusion (RRF)", async (t) => {
  const engine = new EosHybridKnowledgeEngine(process.cwd(), ":memory:");

  try {
    engine.indexDocument({
      docId: "SPEC-140",
      filePath: "openspec/specs/SPEC-140-MCP-STREAMABLE-HTTP-TRANSPORT.md",
      category: "SPEC",
      title: "SPEC-140: Modern MCP Streamable HTTP Transport & Architectural Split",
      content: "Defines the dual-model Streamable HTTP transport with timing-safe 256-bit CSPRNG session IDs, ring buffer replay via Last-Event-ID, and LRU eviction."
    });

    engine.indexDocument({
      docId: "SPEC-139",
      filePath: "openspec/specs/SPEC-139-SUPPLY-CHAIN-SLSA3-ATTESTATION.md",
      category: "SPEC",
      title: "SPEC-139: Supply Chain SLSA Level 3 & CycloneDX SBOM Verification",
      content: "Implements deterministic CycloneDX v1.5 JSON SBOM synthesis, in-toto Statement v1 with SLSA Provenance, and fail-closed SHA-256 checks."
    });

    engine.indexDocument({
      docId: "SPEC-024",
      filePath: "openspec/specs/SPEC-024-AUDIO-DSP.md",
      category: "SPEC",
      title: "SPEC-024: Audio DSP Kernel & ITU-R BS.1770 Lookahead Limiter",
      content: "Direct Form II Transposed Biquad filters, harmonic mixing Camelot wheel, and audio loudness normalizer."
    });

    const start = performance.now();
    const results = engine.search("streamable http session last-event-id", {
      topK: 3,
      mode: "hybrid"
    });
    const latencyMs = performance.now() - start;

    assert.ok(results.length >= 1, "Should return at least 1 match");
    assert.equal(results[0].id, "SPEC-140", "Top result must be SPEC-140 for streamable transport query");
    assert.ok(results[0].score > 0, "RRF score must be strictly positive");
    assert.ok(latencyMs < 50.0, `Hybrid retrieval must execute rapidly, took ${latencyMs}ms`);
  } finally {
    engine.close();
  }
});

test("BDD-380: Indexación Incremental con Atestación de Contenido SHA-256", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-corpus-test-"));
  const subDir = path.join(tempDir, "openspec", "specs");
  fs.mkdirSync(subDir, { recursive: true });

  const file1 = path.join(subDir, "SPEC-001.md");
  const file2 = path.join(subDir, "SPEC-002.md");

  fs.writeFileSync(file1, "# SPEC-001: Core Architecture\n\nSpecification ID: `SPEC-001`\nPure Layer-0 fundamentals.");
  fs.writeFileSync(file2, "# SPEC-002: Memory Vault\n\nSpecification ID: `SPEC-002`\nZeroized cryptographic memory vault.");

  const engine = new EosHybridKnowledgeEngine(tempDir, ":memory:");

  try {
    // First indexing run
    const report1 = engine.indexCorpus({ directories: [subDir] });
    assert.equal(report1.indexedCount, 2, "First run must index both documents");
    assert.equal(report1.skippedCount, 0, "First run should skip 0 documents");
    assert.equal(report1.totalDocuments, 2, "Total documents must be 2");

    // Second indexing run (no changes)
    const report2 = engine.indexCorpus({ directories: [subDir] });
    assert.equal(report2.indexedCount, 0, "Second run with no changes must index 0 documents");
    assert.equal(report2.skippedCount, 2, "Second run must skip both unchanged documents");
    assert.ok(report2.durationMs < 100.0, `No-op incremental scan should be fast, took ${report2.durationMs}ms`);

    // Mutate file1
    fs.writeFileSync(file1, "# SPEC-001: Core Architecture Mutated\n\nSpecification ID: `SPEC-001`\nMutated content.");

    // Third indexing run (only file1 changed)
    const report3 = engine.indexCorpus({ directories: [subDir] });
    assert.equal(report3.indexedCount, 1, "Mutated run must index exactly 1 changed document");
    assert.equal(report3.skippedCount, 1, "Mutated run must skip the 1 unchanged document");

    const doc1 = engine.getDocument("SPEC-001");
    assert.equal(doc1?.title, "SPEC-001: Core Architecture Mutated");
  } finally {
    engine.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
});

test("BDD-381: Integración y Exposición en Herramienta MCP eos_semantic_search", async (t) => {
  const server = new EosMcpServer(process.cwd());

  // Direct dispatch of eos_semantic_search
  const response = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-semantic-01",
    method: "tools/call",
    params: {
      name: "eos_semantic_search",
      arguments: {
        query: "supply chain slsa sbom provenance",
        mode: "hybrid",
        topK: 5
      }
    }
  });

  assert.ok(response.result, "MCP response must have a result object");
  assert.ok(Array.isArray(response.result.content), "MCP result must have content array");
  assert.ok(response.result.content[0]?.text, "content[0] must have text property");

  const parsed = JSON.parse(response.result.content[0].text);
  assert.ok(typeof parsed.matchCount === "number", "matchCount must be a number");
  assert.ok(Array.isArray(parsed.matches), "matches must be an array");
  assert.ok(parsed.matchCount >= 0, "matchCount must be >= 0");

  // Verify empty query handling (failsafe)
  const emptyResp = await server.handleRequest({
    jsonrpc: "2.0",
    id: "req-semantic-empty",
    method: "tools/call",
    params: {
      name: "eos_semantic_search",
      arguments: {
        query: ""
      }
    }
  });

  assert.ok(emptyResp.result, "Empty query must return valid result object");
  const emptyParsed = JSON.parse(emptyResp.result.content[0].text);
  assert.equal(emptyParsed.matchCount, 0, "Empty query must return 0 matches");
});
