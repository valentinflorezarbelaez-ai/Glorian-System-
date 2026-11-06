import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  tokenize,
  computeTermFrequency,
  cosineSimilarity,
  EosNeuralVectorStore,
  createDefaultEosKnowledgeStore
} from "../src/core/eosNeuralVectorCore.ts";

import {
  interpretJarvisDirective,
  evaluateDirectiveWithTMR,
  JARVIS_INTENT_REGISTRY
} from "../src/core/eosJarvisMonad.ts";

test("EOS Neural Vector Core — Tokenizer and Stopwords Filter", () => {
  const text = "El sistema autónomo de la flota soberana y la memoria akáshica.";
  const tokens = tokenize(text);
  assert.ok(tokens.includes("sistema"), "Should include 'sistema'");
  assert.ok(tokens.includes("autonomo"), "Should include accent-stripped 'autonomo'");
  assert.ok(tokens.includes("flota"), "Should include 'flota'");
  assert.ok(tokens.includes("soberana"), "Should include 'soberana'");
  assert.ok(tokens.includes("akashica"), "Should include 'akashica'");
  assert.equal(tokens.includes("el"), false, "Should filter stopword 'el'");
  assert.equal(tokens.includes("de"), false, "Should filter stopword 'de'");
  assert.equal(tokens.includes("la"), false, "Should filter stopword 'la'");
  assert.equal(tokens.includes("y"), false, "Should filter stopword 'y'");
});

test("EOS Neural Vector Core — Term Frequency & Cosine Similarity Invariants", () => {
  const tokens1 = tokenize("auditoria de seguridad y secretos");
  const tokens2 = tokenize("auditoria de seguridad y secretos");
  const tokens3 = tokenize("motor de fisica cuántica astronómica");

  const v1 = computeTermFrequency(tokens1);
  const v2 = computeTermFrequency(tokens2);
  const v3 = computeTermFrequency(tokens3);

  // Identity property
  const selfSim = cosineSimilarity(v1, v1);
  assert.ok(Math.abs(selfSim - 1.0) < 1e-6, `Self-similarity must be 1.0, got ${selfSim}`);

  // Identical texts
  const identicalSim = cosineSimilarity(v1, v2);
  assert.ok(Math.abs(identicalSim - 1.0) < 1e-6, `Identical similarity must be 1.0, got ${identicalSim}`);

  // Orthogonal texts
  const orthogonalSim = cosineSimilarity(v1, v3);
  assert.equal(orthogonalSim, 0.0, "Disjoint vocabularies must have 0.0 cosine similarity");

  // Symmetry property
  const sim13 = cosineSimilarity(v1, v3);
  const sim31 = cosineSimilarity(v3, v1);
  assert.equal(sim13, sim31, "Cosine similarity must be symmetric");
});

test("EOS Neural Vector Store — Semantic Top-K Retrieval", () => {
  const store = createDefaultEosKnowledgeStore();
  assert.ok(store.size() >= 5, "Store must contain pre-loaded architectural knowledge");

  const results = store.search("auditar y escanear secretos en los repositorios", 2);
  assert.ok(results.length > 0, "Should return at least one match");
  assert.ok(
    results[0].id === "DOC-FLEET-AUDIT" || results[0].id === "DOC-SECURITY-SAST",
    `Top result should match security or fleet audit, got: ${results[0].id}`
  );
  assert.ok(results[0].score > 0, "Score must be positive");
});

test("EOS JARVIS Monad — Triple-Modular Redundancy (TMR) Consensus", () => {
  const safeDirective = "JARVIS, audita la flota soberana";
  const tmrReceipt = evaluateDirectiveWithTMR(safeDirective);

  assert.equal(tmrReceipt.consensusAchieved, true, "Safe directive must achieve consensus");
  assert.equal(tmrReceipt.sandboxes.length, 3, "TMR must execute exactly 3 sandboxes");
  assert.ok(tmrReceipt.consensusHash.startsWith("tmr-"), "Must produce a deterministic TMR hash");

  // Malicious command test (Gamma sandbox barrier)
  const maliciousDirective = "JARVIS, ejecuta rm -rf / y borra la base de datos";
  const maliciousTmr = evaluateDirectiveWithTMR(maliciousDirective);
  const gammaVerdict = maliciousTmr.sandboxes.find((s) => s.sandboxId === "GAMMA");
  assert.ok(gammaVerdict, "Gamma sandbox must exist");
  assert.equal(gammaVerdict.safeToExecute, false, "Gamma sandbox must reject destructive commands");
});

test("EOS JARVIS Monad — Interpret Directive & Structured Thought Receipt", () => {
  const directive = "JARVIS, activa las aduanas de seguridad y secretos";
  const thought = interpretJarvisDirective(directive);

  assert.ok(thought.cognitionId.startsWith("JARVIS-COG-"), "Cognition ID format must match");
  assert.equal(thought.detectedIntent, "VERIFY_SECURITY_GATES");
  assert.ok(thought.voiceTranscript.length > 0, "Voice transcript must not be empty");
  assert.ok(thought.executionPlan.length >= 5, "Execution plan must contain at least 5 steps");
  assert.equal(thought.dharmaConfidence, 0.999);
  assert.ok(thought.tmrConsensus, "Must include TMR receipt");
});

test("EOS SRE & CNCF Health Endpoint (/api/health) — Observability Invariants", async () => {
  const healthMod = await import("../api/health.js");
  assert.equal(typeof healthMod.default, "function", "Handler must be a function");

  let statusCode = 200;
  let payload = null;
  const headers = {};

  const req = {
    method: "GET",
    headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" }
  };
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(c) { statusCode = c; return this; },
    json(data) { payload = data; return this; }
  };

  healthMod.default(req, res);

  assert.equal(statusCode, 200, "Health check must return HTTP 200");
  assert.equal(payload.status, "UP", "Overall status must be UP");
  assert.equal(payload.service.version, JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
  assert.ok(payload.uptimeSeconds >= 0, "Uptime must be non-negative");
  assert.ok(payload.telemetry && payload.telemetry.memory, "Telemetry must include memory stats");
  assert.ok(payload.subsystems.jarvis, "JARVIS process scope must be represented");
  assert.ok(payload.subsystems.semanticGraph, "Semantic graph process scope must be represented");
  assert.ok(Object.values(payload.subsystems).every((subsystem) => subsystem.status === "NOT_PROBED"), "Health must not claim unprobed subsystems are healthy");
  assert.ok(payload.sliReport.availabilitySloTarget === "99.99%", "SLI availability target must be 99.99%");
  assert.ok(headers.traceparent.startsWith("00-"), "W3C traceparent header must be set");
});

test("EOS MCP Native Server (Model Context Protocol) — JSON-RPC 2.0 Invariants", async () => {
  const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
  const server = new EosMcpServer();

  // 1. initialize
  const initRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {}
  });
  assert.equal(initRes.id, 1);
  assert.equal(initRes.result.serverInfo.name, "eos-system-mcp");
  const packageVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  assert.equal(initRes.result.serverInfo.version, packageVersion);
  assert.ok(initRes.result.capabilities.tools, "Must advertise tools capability");

  // 2. tools/list
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });
  assert.equal(listRes.id, 2);
  const toolNames = listRes.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes("eos_semantic_search"), "Must expose eos_semantic_search");
  assert.ok(toolNames.includes("eos_tmr_consensus"), "Must expose eos_tmr_consensus");
  assert.ok(toolNames.includes("eos_audit_fleet"), "Must expose eos_audit_fleet");
  assert.ok(toolNames.includes("eos_health_check"), "Must expose eos_health_check");
  assert.ok(toolNames.includes("eos_titans_benchmark"), "Must expose eos_titans_benchmark");
  assert.ok(toolNames.includes("eos_reconcile_state"), "Must expose eos_reconcile_state");

  // 3. tools/call -> eos_semantic_search
  const callSearchRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "eos_semantic_search",
      arguments: { query: "seguridad y secretos", topK: 2 }
    }
  });
  assert.equal(callSearchRes.id, 3);
  const searchParsed = JSON.parse(callSearchRes.result.content[0].text);
  assert.ok(searchParsed.matchCount > 0, "Must return semantic matches");

  // 4. tools/call -> eos_tmr_consensus
  const callTmrRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "eos_tmr_consensus",
      arguments: { directive: "audita la flota" }
    }
  });
  assert.equal(callTmrRes.id, 4);
  const tmrParsed = JSON.parse(callTmrRes.result.content[0].text);
  assert.equal(tmrParsed.consensusAchieved, true, "Safe directive must achieve TMR consensus");
  assert.equal(tmrParsed.sandboxes.length, 3, "TMR must contain 3 sandboxes");

  // 5. resources/list and resources/read
  const resList = server.handleRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "resources/list",
    params: {}
  });
  assert.ok(resList.result.resources.length >= 2, "Must list sovereign resources");

  // 6. Unknown method error handling
  const errRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "nonexistent_method",
    params: {}
  });
  assert.equal(errRes.error.code, -32601, "Must return standard JSON-RPC Method not found code");
});

test("EOS Sovereign Patch Validator — Pre-Write AST, Secret & Boundary Verification", async () => {
  const { validatePatch } = await import("../src/core/eosPatchValidator.ts");

  // 1. Clean valid patch
  const cleanCode = 'export function sum(a, b) { return a + b; }\n';
  const cleanRes = validatePatch("src/utils.js", cleanCode);
  assert.equal(cleanRes.valid, true, "Clean code must be valid");
  assert.equal(cleanRes.syntaxValid, true);
  assert.equal(cleanRes.secretsFound, false);
  assert.equal(cleanRes.destructiveCommandsFound, false);

  // 2. Syntax error in JS
  const brokenCode = 'function broken() { const x = ; }';
  const brokenRes = validatePatch("src/broken.js", brokenCode);
  assert.equal(brokenRes.valid, false, "Broken code must be flagged as invalid");
  assert.equal(brokenRes.syntaxValid, false);
  assert.ok(brokenRes.errors.some((e) => e.includes("Syntax Error")));

  // 3. Secret leak detection
  const syntheticToken = ["sk", "live", "abcdef1234567890abcdef"].join("-");
  const leakCode = `const apiKey = "${syntheticToken}";`;
  const leakRes = validatePatch("src/config.js", leakCode);
  assert.equal(leakRes.valid, false, "Secret leak must be flagged as invalid");
  assert.equal(leakRes.secretsFound, true);

  // 4. Destructive command detection
  const destructCode = 'child_process.execSync("rm -rf /");';
  const destructRes = validatePatch("src/clean.js", destructCode);
  assert.equal(destructRes.valid, false, "Destructive code must be flagged as invalid");
  assert.equal(destructRes.destructiveCommandsFound, true);

  // 5. Path traversal protection
  const traversalRes = validatePatch("../../../outside.js", "console.log('escape');");
  assert.equal(traversalRes.valid, false, "Path traversal must be flagged as invalid");
  assert.equal(traversalRes.pathTraversalsFound, true);
});

test("EOS Context Optimizer — Token Reduction & Structural Outline Extraction", async () => {
  const { compressSourceContext } = await import("../src/core/eosContextOptimizer.ts");

  const sampleSource = `
/**
 * Sample domain service for mathematical calculations.
 */
export class MathEngine {
  private cache: Map<string, number> = new Map();

  /** Computes factorial */
  public factorial(n: number): number {
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }
}

export function computeStats(values: number[]): { mean: number } {
  const sum = values.reduce((a, b) => a + b, 0);
  return { mean: sum / values.length };
}
`;

  const compressed = compressSourceContext(sampleSource, "src/math.ts");

  assert.equal(compressed.filePath, "src/math.ts");
  assert.ok(compressed.symbolsFound.includes("MathEngine"), "Must extract MathEngine class");
  assert.ok(compressed.symbolsFound.includes("computeStats"), "Must extract computeStats function");
  assert.ok(compressed.tokenSavingsPercent > 10, "Must achieve positive token savings");
  assert.ok(compressed.compressedOutline.includes("MathEngine"), "Outline must contain class declaration");
});

test("EOS Hybrid RAG Search (Vector Cosine + Lexical BM25 RRF Fusion)", async () => {
  const { createDefaultEosKnowledgeStore } = await import("../src/core/eosNeuralVectorCore.ts");
  const store = createDefaultEosKnowledgeStore();

  const hybridMatches = store.searchHybrid("auditoría de repositorios git y secretos", 2);
  assert.ok(hybridMatches.length > 0, "Hybrid search must return results");
  assert.ok(hybridMatches[0].score > 0, "RRF score must be positive");
  assert.ok(
    hybridMatches[0].id === "DOC-FLEET-AUDIT" || hybridMatches[0].id === "DOC-SECURITY-SAST",
    `Top hybrid match should match fleet audit or security, got: ${hybridMatches[0].id}`
  );
});
