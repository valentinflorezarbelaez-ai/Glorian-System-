import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  EosQuantizedTensorInferenceCore,
  GGUF_MAGIC,
  GGUF_VERSION,
} from "../src/core/eosQuantizedTensorInferenceCore.ts";
import { dispatchPhase7FrontierActionExt } from "../src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts";

test("BDD-1139: GGUF Binary Serialization and Roundtrip Parsing", () => {
  const t1Data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const t2Data = new Uint8Array([10, 20, 30, 40]);

  const t1 = {
    name: "layer.weight",
    shape: [4, 2],
    ggmlType: "Q4_0",
    rawData: t1Data,
    tensorSha256: "hash-1",
  };
  const t2 = {
    name: "layer.bias",
    shape: [4],
    ggmlType: "F32",
    rawData: t2Data,
    tensorSha256: "hash-2",
  };

  const metadata = {
    arch: "llama",
    quantization: "Q4_0",
  };

  const ggufBuffer = EosQuantizedTensorInferenceCore.writeGguf([t1, t2], metadata);
  assert.ok(ggufBuffer.length > 32);

  const view = new DataView(ggufBuffer.buffer, ggufBuffer.byteOffset, ggufBuffer.byteLength);
  assert.strictEqual(view.getUint32(0, true), GGUF_MAGIC);
  assert.strictEqual(view.getUint32(4, true), GGUF_VERSION);

  const container = EosQuantizedTensorInferenceCore.readGguf(ggufBuffer);
  assert.strictEqual(container.version, GGUF_VERSION);
  assert.strictEqual(container.tensorCount, 2);
  assert.strictEqual(container.metadata.arch, "llama");
  assert.strictEqual(container.metadata.quantization, "Q4_0");

  assert.strictEqual(container.tensors[0].name, "layer.weight");
  assert.deepStrictEqual(Array.from(container.tensors[0].shape), [4, 2]);
  assert.deepStrictEqual(Array.from(container.tensors[0].rawData), Array.from(t1Data));

  assert.strictEqual(container.tensors[1].name, "layer.bias");
  assert.deepStrictEqual(Array.from(container.tensors[1].shape), [4]);
  assert.deepStrictEqual(Array.from(container.tensors[1].rawData), Array.from(t2Data));
});

test("BDD-1140: Q4_0, Q4_K, and Q8_0 Quantization Accuracy", () => {
  const size = 256;
  const weights = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    weights[i] = Math.sin(i * 0.05);
  }

  // 1. Q4_0 (32 weights per 18B block)
  const q4Data = EosQuantizedTensorInferenceCore.quantizeQ4_0(weights);
  assert.strictEqual(q4Data.length, (size / 32) * 18);
  const deq4 = EosQuantizedTensorInferenceCore.dequantizeQ4_0(q4Data, size);
  const simQ4 = EosQuantizedTensorInferenceCore.cosineSimilarity(weights, deq4);
  assert.ok(simQ4 > 0.99, `Q4_0 cosine similarity ${simQ4} must exceed 0.99`);

  // 2. Q8_0 (32 weights per 34B block)
  const q8Data = EosQuantizedTensorInferenceCore.quantizeQ8_0(weights);
  assert.strictEqual(q8Data.length, (size / 32) * 34);
  const deq8 = EosQuantizedTensorInferenceCore.dequantizeQ8_0(q8Data, size);
  const simQ8 = EosQuantizedTensorInferenceCore.cosineSimilarity(weights, deq8);
  assert.ok(simQ8 > 0.999, `Q8_0 cosine similarity ${simQ8} must exceed 0.999`);

  // 3. Q4_K (256 weights per 144B block)
  const q4KData = EosQuantizedTensorInferenceCore.quantizeQ4_K(weights);
  assert.strictEqual(q4KData.length, (size / 256) * 144);
  const deq4K = EosQuantizedTensorInferenceCore.dequantizeQ4_K(q4KData, size);
  const simQ4K = EosQuantizedTensorInferenceCore.cosineSimilarity(weights, deq4K);
  assert.ok(simQ4K > 0.99, `Q4_K cosine similarity ${simQ4K} must exceed 0.99`);
});

test("BDD-1141: Streaming Block MatMul without Full Matrix Allocation", () => {
  const rows = 32;
  const cols = 64;
  const matWeights = new Float32Array(rows * cols);
  for (let i = 0; i < matWeights.length; i++) {
    matWeights[i] = Math.cos(i * 0.03);
  }
  const x = new Float32Array(cols);
  for (let i = 0; i < cols; i++) {
    x[i] = 1.0;
  }

  // Reference FP32 matmul
  const expected = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let sum = 0.0;
    for (let c = 0; c < cols; c++) {
      sum += matWeights[r * cols + c] * x[c];
    }
    expected[r] = sum;
  }

  // Streaming Q4_0 matmul
  const qMat4 = EosQuantizedTensorInferenceCore.quantizeQ4_0(matWeights);
  const actualQ4 = EosQuantizedTensorInferenceCore.quantizedMatMulVec(qMat4, x, rows, cols, "Q4_0");
  assert.strictEqual(actualQ4.length, rows);

  const simMatMul = EosQuantizedTensorInferenceCore.cosineSimilarity(expected, actualQ4);
  assert.ok(simMatMul > 0.99, `Quantized MatMul cosine similarity ${simMatMul} must exceed 0.99`);

  // Streaming Q8_0 matmul
  const qMat8 = EosQuantizedTensorInferenceCore.quantizeQ8_0(matWeights);
  const actualQ8 = EosQuantizedTensorInferenceCore.quantizedMatMulVec(qMat8, x, rows, cols, "Q8_0");
  const simMatMul8 = EosQuantizedTensorInferenceCore.cosineSimilarity(expected, actualQ8);
  assert.ok(simMatMul8 > 0.999, `Q8_0 MatMul cosine similarity ${simMatMul8} must exceed 0.999`);
});

test("BDD-1142: Semantic Embedding Generation and Cosine Similarity", () => {
  const dims = 64;
  const projMat = new Float32Array(dims * (dims * 2));
  for (let i = 0; i < projMat.length; i++) {
    projMat[i] = Math.sin(i * 0.17);
  }
  const qProj = EosQuantizedTensorInferenceCore.quantizeQ4_0(projMat);

  const textA = "Glorian sovereign post-quantum consensus";
  const textB = "Glorian sovereign post-quantum consensus";
  const textC = "Chocolate chip cookie baking recipe instructions";

  const embA = EosQuantizedTensorInferenceCore.embedText(textA, qProj, dims);
  const embB = EosQuantizedTensorInferenceCore.embedText(textB, qProj, dims);
  const embC = EosQuantizedTensorInferenceCore.embedText(textC, qProj, dims);

  assert.strictEqual(embA.dimensions, dims);
  assert.ok(Math.abs(embA.norm - 1.0) < 0.05, "Embedding vector must be approximately unit norm");

  // Identical texts must yield identical embeddings
  const simAB = EosQuantizedTensorInferenceCore.cosineSimilarity(embA.embedding, embB.embedding);
  assert.ok(simAB > 0.9999, `Identical texts similarity must be ~1.0, got ${simAB}`);

  // Divergent texts must yield distinct embeddings
  const simAC = EosQuantizedTensorInferenceCore.cosineSimilarity(embA.embedding, embC.embedding);
  assert.ok(
    simAC < simAB,
    `Divergent text similarity (${simAC}) must be lower than identical text similarity (${simAB})`,
  );
});

test("BDD-1143: Universal CLI and MCP Dispatch with Ledger Receipt", () => {
  // CLI tensor:quantize
  const qOutput = execSync("node bin/eos.mjs tensor:quantize --size=128 --json", {
    encoding: "utf-8",
  });
  const qJson = JSON.parse(qOutput);
  assert.strictEqual(qJson.format, "Q4_0");
  assert.strictEqual(qJson.originalElements, 128);
  assert.ok(qJson.fidelityCosineSimilarity > 0.99);

  // CLI tensor:embed
  const embedOutput = execSync('node bin/eos.mjs tensor:embed --text="sovereign consensus" --json', {
    encoding: "utf-8",
  });
  const embedJson = JSON.parse(embedOutput);
  assert.strictEqual(embedJson.text, "sovereign consensus");
  assert.strictEqual(embedJson.dimensions, 64);
  assert.ok(embedJson.receiptSha256.length === 64);

  // MCP Dispatch
  const fakeDeps = {};
  const mcpQuantize = dispatchPhase7FrontierActionExt("tensor_quantize", { size: 128 }, fakeDeps);
  assert.strictEqual(mcpQuantize.action, "tensor_quantize");
  assert.strictEqual(mcpQuantize.elements, 128);

  const mcpMatMul = dispatchPhase7FrontierActionExt("tensor_matmul", { rows: 32, cols: 64 }, fakeDeps);
  assert.strictEqual(mcpMatMul.action, "tensor_matmul");
  assert.strictEqual(mcpMatMul.rows, 32);

  const mcpEmbed = dispatchPhase7FrontierActionExt("tensor_embed", { text: "layer-0 AI" }, fakeDeps);
  assert.strictEqual(mcpEmbed.action, "tensor_embed");
  assert.strictEqual(mcpEmbed.text, "layer-0 AI");
  assert.ok(mcpEmbed.receipt.receiptSha256.length === 64);
});
