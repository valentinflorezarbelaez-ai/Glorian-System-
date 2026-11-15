/**
 * EOS SYSTEM — SHARDED VECTOR INDEX & QUANTIZATION CLI (Layer 0)
 * Governed by SPEC-283, CHANGE-145
 */

import fs from "node:fs";
import path from "node:path";
import { EosVectorQuantizationGovernor } from "../../src/core/eosVectorQuantizationGovernor.ts";

export const HANDLERS = {};

async function cmd_toolchain_vector_quantize(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/vectors/sample-embeddings.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rawList = Array.isArray(items) ? items : [items];
  const first = rawList[0];
  const { quantized, scale, offset } = EosVectorQuantizationGovernor.quantizeSQ8(first.values);
  const dequantized = EosVectorQuantizationGovernor.dequantizeSQ8(quantized, scale, offset);

  let mse = 0;
  for (let i = 0; i < first.values.length; i++) {
    const diff = first.values[i] - dequantized[i];
    mse += diff * diff;
  }
  mse /= first.values.length;

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          id: first.id,
          dimension: first.values.length,
          scale,
          offset,
          mse: Math.round(mse * 100000) / 100000,
          compressionRatio: "4.0x",
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" 🧮 GLORIAN SYSTEM — SCALAR QUANTIZATION SQ8 (SPEC-283)");
  console.log("======================================================================");
  console.log(` Target ID       : ${first.id}`);
  console.log(` Dimensions      : ${first.values.length}`);
  console.log(` Scale Factor    : ${scale.toFixed(6)}`);
  console.log(` Dynamic Offset  : ${offset.toFixed(6)}`);
  console.log(` Quantization MSE: ${mse.toFixed(6)}`);
  console.log(` Compression     : 4.0x (32-bit FP32 -> 8-bit SQ8)`);
  console.log("======================================================================");
}

async function cmd_toolchain_vector_index(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/vectors/sample-embeddings.json";

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rawList = Array.isArray(items) ? items : [items];
  const index = EosVectorQuantizationGovernor.buildIndex(rawList);
  const receiptPath = path.join(root, "docs/evidence/VECTOR_INDEX_RECEIPT.json");
  const receipt = EosVectorQuantizationGovernor.generateReceipt(index, receiptPath);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          indexId: index.indexId,
          dimension: index.dimension,
          totalVectors: index.totalVectors,
          shardsCount: Object.keys(index.shards).length,
          receiptPath: "docs/evidence/VECTOR_INDEX_RECEIPT.json",
          receiptSha256: receipt.sha256Signature,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("======================================================================");
  console.log(" ⚡ GLORIAN SYSTEM — SHARDED VECTOR INDEX (SPEC-283)");
  console.log("======================================================================");
  console.log(` Index ID        : ${index.indexId}`);
  console.log(` Total Vectors   : ${index.totalVectors}`);
  console.log(` Dimension       : ${index.dimension}`);
  console.log(` Shards Count    : ${Object.keys(index.shards).length}`);
  Object.keys(index.shards).forEach((shard) => {
    console.log(`   Shard [${shard}] : ${index.shards[shard].length} vectors`);
  });
  console.log(` Receipt Path    : ${receiptPath}`);
  console.log(` Signature       : ${receipt.sha256Signature}`);
  console.log("======================================================================");
}

async function cmd_toolchain_vector_search(commandContext) {
  const { args, root, printBanner } = commandContext;
  printBanner();
  const isJson = args.includes("--json");
  const fileArg = args.slice(1).find((a) => !a.startsWith("-")) || "templates/vectors/sample-embeddings.json";

  const topArg = args.find((a) => a.startsWith("--top="));
  const topK = topArg ? parseInt(topArg.split("=")[1], 10) : 3;

  const partArg = args.find((a) => a.startsWith("--partition="));
  const partitionFilter = partArg ? partArg.split("=")[1] : undefined;

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(root, fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const items = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rawList = Array.isArray(items) ? items : [items];
  const index = EosVectorQuantizationGovernor.buildIndex(rawList);
  const query = rawList[0].values;
  const results = EosVectorQuantizationGovernor.searchKnn(index, query, topK, partitionFilter);

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("======================================================================");
  console.log(" 🎯 GLORIAN SYSTEM — k-NN VECTOR SEARCH (SPEC-283)");
  console.log("======================================================================");
  console.log(` Query Reference : ${rawList[0].id}`);
  console.log(` Top-K Limit     : ${topK}`);
  if (partitionFilter) console.log(` Partition Filter: ${partitionFilter}`);
  console.log(" Results:");
  results.forEach((res, idx) => {
    console.log(`   Rank ${idx + 1}: [${res.partition}] ${res.id} — Score: ${res.score.toFixed(4)}`);
  });
  console.log("======================================================================");
}

HANDLERS["toolchain:vector:quantize"] = cmd_toolchain_vector_quantize;
HANDLERS["toolchain:vector:index"] = cmd_toolchain_vector_index;
HANDLERS["toolchain:vector:search"] = cmd_toolchain_vector_search;

export async function handleVectorCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
