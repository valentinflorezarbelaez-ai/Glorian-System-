import { EosQuantizedTensorInferenceCore } from "../../src/core/eosQuantizedTensorInferenceCore.ts";

const HANDLERS = {};

async function cmd_tensor_mesh_167(commandContext) {
  const { command, args } = commandContext;
  const isJson = args.includes("--json");

  if (command === "tensor:quantize") {
    const typeArg = args.find((a) => a.startsWith("--type="));
    const sizeArg = args.find((a) => a.startsWith("--size="));

    const type = typeArg ? typeArg.split("=")[1].toUpperCase() : "Q4_0";
    const size = sizeArg ? parseInt(sizeArg.split("=")[1], 10) : 256;

    const weights = new Float32Array(size);
    for (let i = 0; i < size; i++) weights[i] = Math.sin(i * 0.1);

    let qData;
    let deq;
    if (type === "Q8_0") {
      qData = EosQuantizedTensorInferenceCore.quantizeQ8_0(weights);
      deq = EosQuantizedTensorInferenceCore.dequantizeQ8_0(qData, size);
    } else if (type === "Q4_K") {
      qData = EosQuantizedTensorInferenceCore.quantizeQ4_K(weights);
      deq = EosQuantizedTensorInferenceCore.dequantizeQ4_K(qData, size);
    } else {
      qData = EosQuantizedTensorInferenceCore.quantizeQ4_0(weights);
      deq = EosQuantizedTensorInferenceCore.dequantizeQ4_0(qData, size);
    }

    const similarity = EosQuantizedTensorInferenceCore.cosineSimilarity(weights, deq);
    const compressionRatio = (weights.byteLength / qData.byteLength).toFixed(2);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            format: type,
            originalElements: size,
            originalBytes: weights.byteLength,
            quantizedBytes: qData.byteLength,
            compressionRatio: `${compressionRatio}x`,
            fidelityCosineSimilarity: Math.round(similarity * 10000) / 10000,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN QUANTIZED TENSOR ENCODING (SPEC-224)`);
    console.log(`===============================================================`);
    console.log(`  Quantization Format  : ${type}`);
    console.log(`  Vector Length        : ${size} elements`);
    console.log(`  Original Memory      : ${weights.byteLength} bytes (Float32)`);
    console.log(`  Quantized Memory     : ${qData.byteLength} bytes (~${compressionRatio}x memory savings)`);
    console.log(`  Fidelity Similarity  : ${(similarity * 100).toFixed(2)}% cosine retention`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "tensor:matmul") {
    const rowsArg = args.find((a) => a.startsWith("--rows="));
    const colsArg = args.find((a) => a.startsWith("--cols="));
    const typeArg = args.find((a) => a.startsWith("--type="));

    const rows = rowsArg ? parseInt(rowsArg.split("=")[1], 10) : 64;
    const cols = colsArg ? parseInt(colsArg.split("=")[1], 10) : 128;
    const type = typeArg ? typeArg.split("=")[1].toUpperCase() : "Q4_0";

    const mat = new Float32Array(rows * cols);
    for (let i = 0; i < mat.length; i++) mat[i] = Math.cos(i * 0.05);

    const x = new Float32Array(cols);
    for (let i = 0; i < cols; i++) x[i] = 1.0;

    const qMat =
      type === "Q8_0"
        ? EosQuantizedTensorInferenceCore.quantizeQ8_0(mat)
        : type === "Q4_K"
          ? EosQuantizedTensorInferenceCore.quantizeQ4_K(mat)
          : EosQuantizedTensorInferenceCore.quantizeQ4_0(mat);

    const t0 = performance.now();
    const y = EosQuantizedTensorInferenceCore.quantizedMatMulVec(qMat, x, rows, cols, type);
    const elapsed = (performance.now() - t0).toFixed(2);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            format: type,
            rows,
            cols,
            matrixBytes: qMat.byteLength,
            durationMs: parseFloat(elapsed),
            outputSample: Array.from(y.slice(0, 5)),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN QUANTIZED MATRIX-VECTOR MATMUL (SPEC-224)`);
    console.log(`===============================================================`);
    console.log(`  Matrix Dimensions    : [${rows}, ${cols}] (${type})`);
    console.log(`  Input Vector         : [${cols}] (Float32)`);
    console.log(`  Output Vector        : [${rows}] (Float32)`);
    console.log(`  Duration             : ${elapsed} ms (Streaming zero-heap multiplication)`);
    console.log(
      `  Sample (y[0..4])     : [${Array.from(y.slice(0, 5))
        .map((v) => v.toFixed(3))
        .join(", ")}]`,
    );
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "tensor:embed") {
    const textArg = args.find((a) => a.startsWith("--text="));
    const dimsArg = args.find((a) => a.startsWith("--dims="));

    const text = textArg ? textArg.split("=")[1] : "Glorian sovereign post-quantum consensus";
    const dims = dimsArg ? parseInt(dimsArg.split("=")[1], 10) : 64;

    const projMat = new Float32Array(dims * (dims * 2));
    for (let i = 0; i < projMat.length; i++) projMat[i] = Math.sin(i * 0.13);
    const qProj = EosQuantizedTensorInferenceCore.quantizeQ4_0(projMat);

    const res = EosQuantizedTensorInferenceCore.embedText(text, qProj, dims, "Q4_0");

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            text: res.text,
            dimensions: res.dimensions,
            norm: Math.round(res.norm * 1000) / 1000,
            durationMs: res.durationMs,
            embeddingSample: Array.from(res.embedding.slice(0, 8)),
            receiptSha256: res.receipt.receiptSha256,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN SOVEREIGN TEXT EMBEDDING (SPEC-224)`);
    console.log(`===============================================================`);
    console.log(`  Text                 : "${res.text}"`);
    console.log(`  Embedding Dimensions : ${res.dimensions} floats (L2 Norm: ${res.norm.toFixed(4)})`);
    console.log(`  Inference Duration   : ${res.durationMs} ms`);
    console.log(
      `  Embedding Sample     : [${Array.from(res.embedding.slice(0, 6))
        .map((v) => v.toFixed(3))
        .join(", ")}...]`,
    );
    console.log(`  Receipt SHA-256      : sha256:${res.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }

  if (command === "tensor:benchmark") {
    const itersArg = args.find((a) => a.startsWith("--iterations="));
    const iterations = itersArg ? parseInt(itersArg.split("=")[1], 10) : 20;

    const bench = EosQuantizedTensorInferenceCore.benchmark(iterations);

    if (isJson) {
      console.log(JSON.stringify(bench, null, 2));
      return;
    }

    console.log(`\n===============================================================`);
    console.log(`  GLORIAN QUANTIZED TENSOR BENCHMARK (SPEC-224)`);
    console.log(`===============================================================`);
    console.log(`  Q4_0 Quantize Rate   : ${bench.q4_0QuantizeOpsPerSec} ops/sec`);
    console.log(`  Q4_0 Dequantize Rate : ${bench.q4_0DequantizeOpsPerSec} ops/sec`);
    console.log(`  Q8_0 Quantize Rate   : ${bench.q8_0QuantizeOpsPerSec} ops/sec`);
    console.log(`  Q4_K Quantize Rate   : ${bench.q4_kQuantizeOpsPerSec} ops/sec`);
    console.log(
      `  Streaming MatMul     : ${bench.matmulThroughputGFlops} GFLOPS (~${bench.averageMatMulTimeMs} ms/op)`,
    );
    console.log(`  Receipt SHA-256      : sha256:${bench.receipt.receiptSha256}`);
    console.log(`===============================================================\n`);
    return;
  }
}

HANDLERS["tensor:quantize"] = cmd_tensor_mesh_167;
HANDLERS["tensor:matmul"] = cmd_tensor_mesh_167;
HANDLERS["tensor:embed"] = cmd_tensor_mesh_167;
HANDLERS["tensor:benchmark"] = cmd_tensor_mesh_167;

export async function handleTensorCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
