/**
 * @file cliQuantizedDistributedTrainingEngine.mjs
 * @description CLI handler for SPEC-328 / CHANGE-190: FP8 / INT8 Quantized Distributed
 * Training & Mixed-Precision Gradient Scaling Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosQuantizedDistributedTrainingCore } from "../../src/core/eosQuantizedDistributedTrainingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/QUANTIZED_DISTRIBUTED_TRAINING_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_quanttrain_fp8(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "16"));
  const format = parseFlagValue(args, "--format=", "E4M3");

  const engine = new EosQuantizedDistributedTrainingCore();
  const tensor = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    tensor[i] = (i - dim / 2) * 2.5;
  }

  const encoded = engine.quantizeFP8(tensor, format);
  const decoded = engine.dequantizeFP8(encoded);
  const snr = engine.computeSNR(tensor, decoded);

  const payload = {
    command: "toolchain:quanttrain:fp8",
    format: encoded.format,
    dimension: dim,
    scale: encoded.scale,
    byteLength: encoded.data.byteLength,
    snrDb: Number(snr.toFixed(2)),
    originalSample: Array.from(tensor.slice(0, 4)),
    decodedSample: Array.from(decoded.slice(0, 4)),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== FP8 Bit-Accurate Quantization ===");
    console.log(`Format    : ${encoded.format}`);
    console.log(`Dimension : ${dim}`);
    console.log(`Scale     : ${encoded.scale.toFixed(4)}`);
    console.log(`Bytes     : ${encoded.data.byteLength}`);
    console.log(`SNR (dB)  : ${snr.toFixed(2)} dB`);
  }
}

async function cmd_quanttrain_scaling(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const windowSize = Number(parseFlagValue(args, "--window=", "8"));
  const aMax = Number(parseFlagValue(args, "--amax=", "12.5"));

  const engine = new EosQuantizedDistributedTrainingCore();
  let state = engine.createInitialDelayedScaling(windowSize, 4.0);
  state = engine.updateDelayedScaling(state, aMax, "E4M3");

  const payload = {
    command: "toolchain:quanttrain:scaling",
    windowSize,
    currentAMax: aMax,
    currentScale: state.currentScale,
    projectedScale: Number(state.projectedScale.toFixed(4)),
    isSaturated: state.isSaturated,
    historyWindow: state.historyWindow,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Delayed Scaling Factor Telemetry ===");
    console.log(`Window Size    : ${windowSize}`);
    console.log(`Current aMax   : ${aMax}`);
    console.log(`Current Scale  : ${state.currentScale}`);
    console.log(`Projected Scale: ${state.projectedScale.toFixed(4)}`);
    console.log(`Is Saturated   : ${state.isSaturated}`);
  }
}

async function cmd_quanttrain_backward(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "16"));
  const injectNan = args.includes("--nan");

  const engine = new EosQuantizedDistributedTrainingCore();
  const grads = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    grads[i] = injectNan && i === 0 ? NaN : (i + 1) * 0.1;
  }

  const lossState = engine.createInitialLossScale(32768, 100);
  const result = engine.backwardWithMixedPrecision(1.5, grads, lossState);

  const payload = {
    command: "toolchain:quanttrain:backward",
    dimension: dim,
    stepAccepted: result.stepAccepted,
    hasNonFinite: result.hasNonFinite,
    initialLossScale: lossState.lossScale,
    nextLossScale: result.nextLossScaleState.lossScale,
    lastStepSkipped: result.nextLossScaleState.lastStepSkipped,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Mixed-Precision Backward & Loss Scaling ===");
    console.log(`Step Accepted    : ${result.stepAccepted}`);
    console.log(`Has Non-Finite   : ${result.hasNonFinite}`);
    console.log(`Initial LossScale: ${lossState.lossScale}`);
    console.log(`Next LossScale   : ${result.nextLossScaleState.lossScale}`);
  }
}

async function cmd_quanttrain_bandwidth(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "64"));
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const format = parseFlagValue(args, "--format=", "E5M2");

  const engine = new EosQuantizedDistributedTrainingCore();
  const workerGradients = [];
  for (let w = 0; w < numWorkers; w++) {
    const g = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      g[i] = Math.cos((i + 1) * 0.2) * (1.0 + w * 0.1);
    }
    workerGradients.push(g);
  }

  const result = engine.simulateQuantizedAllReduce(workerGradients, format);

  const payload = {
    command: "toolchain:quanttrain:bandwidth",
    format,
    numWorkers,
    dimension: dim,
    bytesTransferred: result.bytesTransferred,
    baselineFp32Bytes: result.baselineFp32Bytes,
    baselineFp16Bytes: result.baselineFp16Bytes,
    savingsVsFp32Percent: Number(result.bandwidthSavingsVsFp32Percent.toFixed(2)),
    savingsVsFp16Percent: Number(result.bandwidthSavingsVsFp16Percent.toFixed(2)),
    maxReconstructionError: Number(result.maxReconstructionError.toFixed(6)),
    snrDb: Number(result.snrDb.toFixed(2)),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== Quantized Collective All-Reduce Bandwidth ===");
    console.log(`Workers       : ${numWorkers}`);
    console.log(`Payload Bytes : ${result.bytesTransferred} bytes`);
    console.log(`Savings vs FP32: ${payload.savingsVsFp32Percent}%`);
    console.log(`Savings vs FP16: ${payload.savingsVsFp16Percent}%`);
    console.log(`SNR (dB)      : ${payload.snrDb} dB`);
  }
}

async function cmd_quanttrain_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "128"));
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const steps = Number(parseFlagValue(args, "--steps=", "10"));

  const engine = new EosQuantizedDistributedTrainingCore();
  const receipt = engine.audit(dim, numWorkers, steps);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Quantized Distributed Training Audit ===");
    console.log(`Status        : ${receipt.status}`);
    console.log(`E4M3 Verified : ${receipt.e4m3Verified}`);
    console.log(`E5M2 Verified : ${receipt.e5m2Verified}`);
    console.log(`INT8 Verified : ${receipt.int8Verified}`);
    console.log(`Savings (FP32): ${receipt.bandwidthReductionVsFp32Percent}%`);
    console.log(`SNR (dB)      : ${receipt.reconstructionSnrDb.toFixed(2)} dB`);
    console.log(`SHA-256 Seal  : ${receipt.sha256Signature}`);
    console.log(`Receipt Saved : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:quanttrain:fp8"] = cmd_quanttrain_fp8;
HANDLERS["toolchain:quanttrain:scaling"] = cmd_quanttrain_scaling;
HANDLERS["toolchain:quanttrain:backward"] = cmd_quanttrain_backward;
HANDLERS["toolchain:quanttrain:bandwidth"] = cmd_quanttrain_bandwidth;
HANDLERS["toolchain:quanttrain:audit"] = cmd_quanttrain_audit;

export async function handleQuantizedDistributedTrainingCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:quanttrain command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
