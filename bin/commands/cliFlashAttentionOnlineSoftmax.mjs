/**
 * @file cliFlashAttentionOnlineSoftmax.mjs
 * @description CLI handler for SPEC-318 / CHANGE-180: FlashAttention-Style
 * Online Softmax Tiling & Block-Paged Attention Kernel.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosFlashAttentionOnlineSoftmaxCore } from "../../src/core/eosFlashAttentionOnlineSoftmax.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("FLASH_ATTENTION_ONLINE_SOFTMAX_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_flash_tile(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nq = Number(parseFlagValue(args, "--nq=", "64"));
  const nk = Number(parseFlagValue(args, "--nk=", "64"));
  const headDim = Number(parseFlagValue(args, "--d=", "16"));
  const blockSizeRow = Number(parseFlagValue(args, "--br=", "16"));
  const blockSizeCol = Number(parseFlagValue(args, "--bc=", "16"));
  const isCausal = args.includes("--causal");

  const totalRowBlocks = Math.ceil(nq / blockSizeRow);
  const totalColBlocks = Math.ceil(nk / blockSizeCol);
  const totalTiles = totalRowBlocks * totalColBlocks;

  let prunedTiles = 0;
  if (isCausal) {
    for (let j = 0; j < totalColBlocks; j++) {
      const colStart = j * blockSizeCol;
      for (let i = 0; i < totalRowBlocks; i++) {
        const rowEnd = Math.min((i + 1) * blockSizeRow, nq);
        if (colStart > rowEnd - 1) {
          prunedTiles++;
        }
      }
    }
  }
  const evaluatedTiles = totalTiles - prunedTiles;
  const workingMemoryBytes = 4 * (blockSizeRow * headDim + blockSizeCol * headDim * 2 + blockSizeRow * blockSizeCol);

  const result = {
    command: "toolchain:flash:tile",
    sequenceLengthQ: nq,
    sequenceLengthK: nk,
    headDim,
    blockSizeRow,
    blockSizeCol,
    isCausal,
    totalRowBlocks,
    totalColBlocks,
    totalTiles,
    evaluatedTiles,
    prunedTiles,
    workingMemoryBytes,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== FlashAttention Tile Inspection ===");
    console.log(`Grid Dimensions     : ${totalRowBlocks} Row Blocks x ${totalColBlocks} Col Blocks`);
    console.log(`Total Tiles         : ${totalTiles} (Evaluated: ${evaluatedTiles}, Pruned: ${prunedTiles})`);
    console.log(`Working Memory      : ${workingMemoryBytes} bytes`);
  }
}

async function cmd_flash_online_softmax(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const headDim = 16;
  const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 4, blockSizeCol: 4 });
  const rowStats = {
    rowIndex: 0,
    runningMax: 2.0,
    runningSum: 5.0,
    accumulatedOutput: new Array(headDim).fill(1.5),
  };
  const scoresRow = [1.0, 3.5, 2.0, 0.5];
  const vTile = Array.from({ length: 4 }, () => new Array(headDim).fill(2.0));

  const oldMax = rowStats.runningMax;
  const oldSum = rowStats.runningSum;
  core.updateRowOnlineSoftmax(rowStats, scoresRow, vTile);

  const result = {
    command: "toolchain:flash:online-softmax",
    previousRunningMax: oldMax,
    newRunningMax: Number(rowStats.runningMax.toFixed(4)),
    previousRunningSum: oldSum,
    newRunningSum: Number(rowStats.runningSum.toFixed(4)),
    updatedAccumulatedOutputSample: Number(rowStats.accumulatedOutput[0].toFixed(4)),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== FlashAttention Online Softmax Step ===");
    console.log(`Running Max: ${oldMax} -> ${result.newRunningMax}`);
    console.log(`Running Sum: ${oldSum} -> ${result.newRunningSum}`);
  }
}

async function cmd_flash_forward(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const headDim = 16;
  const isCausal = args.includes("--causal");
  const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 16, blockSizeCol: 16, isCausal });

  const n = 32;
  const q = Array.from({ length: n }, () => new Array(headDim).fill(0.1));
  const k = Array.from({ length: n }, () => new Array(headDim).fill(0.1));
  const v = Array.from({ length: n }, () => new Array(headDim).fill(0.5));

  const res = core.forward(q, k, v);

  const result = {
    command: "toolchain:flash:forward",
    sequenceLength: n,
    headDim,
    isCausal,
    totalTiles: res.totalTiles,
    evaluatedTiles: res.evaluatedTiles,
    prunedTiles: res.prunedTiles,
    workingMemoryBytes: res.workingMemoryBytes,
    theoreticalFlops: res.theoreticalFlops,
    elapsedMs: Number(res.elapsedMs.toFixed(3)),
    outputSample: res.output[0]?.slice(0, 4),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== FlashAttention Forward Kernel ===");
    console.log(`Total Tiles     : ${res.totalTiles} (Evaluated: ${res.evaluatedTiles}, Pruned: ${res.prunedTiles})`);
    console.log(`Working Memory  : ${res.workingMemoryBytes} bytes`);
    console.log(`Execution Time  : ${result.elapsedMs} ms`);
  }
}

async function cmd_flash_parity(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const headDim = 16;
  const isCausal = args.includes("--causal");
  const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 16, blockSizeCol: 16, isCausal });

  const n = 32;
  const q = Array.from({ length: n }, (_, i) => new Array(headDim).fill((i % 5) * 0.1));
  const k = Array.from({ length: n }, (_, i) => new Array(headDim).fill((i % 3) * 0.1));
  const v = Array.from({ length: n }, (_, i) => new Array(headDim).fill((i % 7) * 0.2));

  const parity = core.verifyParity(q, k, v);

  const result = {
    command: "toolchain:flash:parity",
    isEquivalent: parity.isEquivalent,
    maxAbsoluteError: parity.maxAbsoluteError,
    relativeError: parity.relativeError,
    tolerance: parity.tolerance,
    flashOutputSample: parity.flashOutputSample,
    naiveOutputSample: parity.naiveOutputSample,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== FlashAttention Mathematical Parity Audit ===");
    console.log(`Equivalent        : ${parity.isEquivalent}`);
    console.log(`Max Absolute Error: ${parity.maxAbsoluteError}`);
    console.log(`Relative Error    : ${parity.relativeError}`);
  }
}

async function cmd_flash_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const headDim = 16;
  const core = new EosFlashAttentionOnlineSoftmaxCore({ headDim, blockSizeRow: 16, blockSizeCol: 16, isCausal: true });
  const receipt = core.audit(64);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== FlashAttention Invariant Audit ===");
    console.log(`Status        : ${receipt.auditStatus}`);
    console.log(`Max Abs Error : ${receipt.maxAbsoluteError}`);
    console.log(`Working Memory: ${receipt.workingMemoryBytes} bytes`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:flash:tile"] = cmd_flash_tile;
HANDLERS["toolchain:flash:online-softmax"] = cmd_flash_online_softmax;
HANDLERS["toolchain:flash:forward"] = cmd_flash_forward;
HANDLERS["toolchain:flash:parity"] = cmd_flash_parity;
HANDLERS["toolchain:flash:audit"] = cmd_flash_audit;

export async function handleFlashAttentionCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:flash command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
