/**
 * @file cliWebGpuTensorAcceleration.mjs
 * @description CLI handler for SPEC-354 / CHANGE-216: Autonomous WebGPU WGSL Compute & SIMD Tensor Acceleration Engine.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosWgslShaderSynthesizer,
  EosTensorComputeGrid,
  EosSoftwareTensorEmulator,
  EosWebGpuTensorEngineCore,
} from "../../src/core/eosWebGpuTensorAcceleration.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("WEBGPU_TENSOR_ACCELERATION_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_gpu_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosWebGpuTensorEngineCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous WebGPU WGSL Compute & SIMD Tensor Acceleration Engine (SPEC-354) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Epistemic State         : ${receipt.epistemicState}`);
    console.log(`Adapter Backend         : ${receipt.adapter.backend}`);
    console.log(`Adapter Available       : ${receipt.adapter.available}`);
    console.log(`Shaders Synthesized     : ${receipt.shadersSynthesized.length} compute shaders`);
    for (const s of receipt.shadersSynthesized) {
      console.log(`  - ${s.id} (${s.lines} lines, sha256: ${s.sha256.slice(0, 12)}...)`);
    }
    console.log(`Benchmark Trials Passed : ${receipt.benchmarks.length}`);
    for (const b of receipt.benchmarks) {
      console.log(
        `  - [${b.op.toUpperCase()}] shape=[${b.shape.join("x")}] time=${b.emulatorTimeUs.toFixed(1)}us gflops=${b.emulatorGflops.toFixed(2)}`,
      );
    }
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_gpu_compile(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const positionalArgs = args.filter((a) => a !== commandContext.command && !a.startsWith("-"));
  const shaderType = positionalArgs[0] || "gemm";

  let shader;
  switch (shaderType) {
    case "relu":
    case "gelu":
    case "sigmoid":
    case "tanh":
      shader = EosWgslShaderSynthesizer.synthesizeVectorActivationShader(shaderType);
      break;
    case "covariance":
      shader = EosWgslShaderSynthesizer.synthesizeCovarianceShader(16);
      break;
    case "softmax":
      shader = EosWgslShaderSynthesizer.synthesizeSoftmaxShader();
      break;
    case "gemm":
    default:
      shader = EosWgslShaderSynthesizer.synthesizeGemmShader(16);
      break;
  }

  if (isJson) {
    console.log(JSON.stringify(shader, null, 2));
  } else {
    console.log(`=== Synthesized WGSL Shader: ${shader.id} ===`);
    console.log(`Entry Point    : ${shader.entryPoint}`);
    console.log(`Workgroup Size : ${shader.workgroupSize.x}x${shader.workgroupSize.y}x${shader.workgroupSize.z}`);
    console.log(`Bindings       : ${shader.bindings.length}`);
    console.log(`SHA-256        : ${shader.sha256}`);
    console.log("\n--- WGSL Code ---\n");
    console.log(shader.code);
  }
}

async function cmd_gpu_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const matA = EosTensorComputeGrid.createTensor([64, 64]);
  matA.data.fill(1.0);
  const matB = EosTensorComputeGrid.createTensor([64, 64]);
  matB.data.fill(0.5);

  const gemmRes = EosSoftwareTensorEmulator.gemm(matA, matB);

  const vecInput = EosTensorComputeGrid.createTensor([1, 256]);
  for (let i = 0; i < 256; i++) vecInput.data[i] = (i - 128) / 64;
  const geluRes = EosSoftwareTensorEmulator.activate(vecInput, "gelu");

  const covInput = EosTensorComputeGrid.createTensor([128, 16]);
  for (let i = 0; i < covInput.data.length; i++) covInput.data[i] = (i % 7) * 0.1;
  const covRes = EosSoftwareTensorEmulator.covariance(covInput);

  const benchResult = {
    gemm: { shape: gemmRes.shape, durationUs: gemmRes.durationMicroseconds, gflops: gemmRes.gflops },
    gelu: { shape: geluRes.shape, durationUs: geluRes.durationMicroseconds, gflops: geluRes.gflops },
    covariance: { shape: covRes.shape, durationUs: covRes.durationMicroseconds, gflops: covRes.gflops },
  };

  if (isJson) {
    console.log(JSON.stringify(benchResult, null, 2));
  } else {
    console.log("=== Pure Layer-0 SIMD Tensor Benchmark ===");
    console.log(
      `GEMM (64x64)       : ${benchResult.gemm.durationUs.toFixed(1)} us (${benchResult.gemm.gflops.toFixed(2)} GFLOPS)`,
    );
    console.log(
      `GELU (1x256)       : ${benchResult.gelu.durationUs.toFixed(1)} us (${benchResult.gelu.gflops.toFixed(2)} GFLOPS)`,
    );
    console.log(
      `Covariance (128x16): ${benchResult.covariance.durationUs.toFixed(1)} us (${benchResult.covariance.gflops.toFixed(2)} GFLOPS)`,
    );
  }
}

HANDLERS["toolchain:gpu:audit"] = cmd_gpu_audit;
HANDLERS["toolchain:gpu:compile"] = cmd_gpu_compile;
HANDLERS["toolchain:gpu:bench"] = cmd_gpu_bench;

export async function handleWebGpuTensorAccelerationCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:gpu command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
