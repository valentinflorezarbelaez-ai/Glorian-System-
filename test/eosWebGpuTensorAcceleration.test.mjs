/**
 * @file eosWebGpuTensorAcceleration.test.mjs
 * @description Automated test suite for SPEC-354 / CHANGE-216: Autonomous WebGPU WGSL Compute & SIMD Tensor Acceleration Engine.
 *
 * Verifies BDD-1903 through BDD-1908:
 * - BDD-1903: WGSL Shared Memory GEMM Tiling Compilation
 * - BDD-1904: 4-Lane Vector SIMD Activation Kernel Synthesis
 * - BDD-1905: Bit-Exact Pure Layer-0 Software Tensor Execution (GEMM)
 * - BDD-1906: Tensor Compute Grid Strided Memory Layout and Tile Padding
 * - BDD-1907: Covariance Reduction and Numerically Stable Softmax
 * - BDD-1908: Dual-Mode Capability Probing & Formal Audit Receipt
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import {
  EosWgslShaderSynthesizer,
  EosTensorComputeGrid,
  EosSoftwareTensorEmulator,
  EosWebGpuTensorEngineCore,
} from "../src/core/eosWebGpuTensorAcceleration.ts";

test("BDD-1903: WGSL Shared Memory GEMM Tiling Compilation", () => {
  const shader = EosWgslShaderSynthesizer.synthesizeGemmShader(16);

  assert.equal(shader.id, "wgsl-gemm-16x16");
  assert.equal(shader.entryPoint, "main");
  assert.deepEqual(shader.workgroupSize, { x: 16, y: 16, z: 1 });
  assert.equal(shader.bindings.length, 4);

  // Validate shared memory tile declarations and barriers
  assert.ok(shader.code.includes("var<workgroup> tileA: array<array<f32, 16>, 16>;"));
  assert.ok(shader.code.includes("var<workgroup> tileB: array<array<f32, 16>, 16>;"));
  assert.ok(shader.code.includes("workgroupBarrier();"));
  assert.ok(shader.code.includes("@compute @workgroup_size(16, 16, 1)"));

  // Checksum format validation
  assert.equal(typeof shader.sha256, "string");
  assert.equal(shader.sha256.length, 64);

  // Invalid tile dimension rejection
  assert.throws(() => EosWgslShaderSynthesizer.synthesizeGemmShader(0), {
    message: /PRECONDITION_FAILED/,
  });
  assert.throws(() => EosWgslShaderSynthesizer.synthesizeGemmShader(32), {
    message: /PRECONDITION_FAILED/,
  });
});

test("BDD-1904: 4-Lane Vector SIMD Activation Kernel Synthesis", () => {
  const activations = ["relu", "gelu", "sigmoid", "tanh"];

  for (const act of activations) {
    const shader = EosWgslShaderSynthesizer.synthesizeVectorActivationShader(act);
    assert.equal(shader.id, `wgsl-vector-${act}-vec4`);
    assert.equal(shader.entryPoint, "main");
    assert.deepEqual(shader.workgroupSize, { x: 64, y: 1, z: 1 });
    assert.equal(shader.bindings.length, 2);
    assert.ok(shader.code.includes("array<vec4<f32>>"));

    if (act === "gelu") {
      assert.ok(shader.code.includes("0.044715"));
      assert.ok(shader.code.includes("0.7978845608028654"));
    } else if (act === "relu") {
      assert.ok(shader.code.includes("max(v, vec4<f32>(0.0))"));
    }
  }
});

test("BDD-1905: Bit-Exact Pure Layer-0 Software Tensor Execution (GEMM)", () => {
  // A: 2x3 matrix
  // [1, 2, 3]
  // [4, 5, 6]
  const a = EosTensorComputeGrid.createTensor([2, 3], [1, 2, 3, 4, 5, 6]);

  // B: 3x2 matrix
  // [7, 8]
  // [9, 1]
  // [2, 3]
  const b = EosTensorComputeGrid.createTensor([3, 2], [7, 8, 9, 1, 2, 3]);

  // Expected C: 2x2
  // Row 0: [1*7 + 2*9 + 3*2, 1*8 + 2*1 + 3*3] = [7+18+6, 8+2+9] = [31, 19]
  // Row 1: [4*7 + 5*9 + 6*2, 4*8 + 5*1 + 6*3] = [28+45+12, 32+5+18] = [85, 55]
  const res = EosSoftwareTensorEmulator.gemm(a, b);

  assert.equal(res.op, "gemm");
  assert.deepEqual(res.shape, [2, 2]);
  assert.equal(res.executionMode, "emulator");
  assert.equal(res.flopCount, 2 * 2 * 2 * 3); // 24 FLOPs
  assert.ok(res.durationMicroseconds > 0);
  assert.ok(res.gflops >= 0);
  assert.equal(res.checksumSha256.length, 64);

  assert.equal(res.data[0], 31);
  assert.equal(res.data[1], 19);
  assert.equal(res.data[2], 85);
  assert.equal(res.data[3], 55);

  // Incompatible dimensions check
  const badB = EosTensorComputeGrid.createTensor([2, 2], [1, 2, 3, 4]);
  assert.throws(() => EosSoftwareTensorEmulator.gemm(a, badB), {
    message: /INVARIANT_VIOLATION/,
  });
});

test("BDD-1906: Tensor Compute Grid Strided Memory Layout and Tile Padding", () => {
  // Original shape: 10x12
  const original = EosTensorComputeGrid.createTensor([10, 12]);
  for (let i = 0; i < 120; i++) {
    original.data[i] = i * 0.5;
  }

  // Pad to tile dimension 16
  const { padded, padRows, padCols } = EosTensorComputeGrid.padTensor2D(original, 16);
  assert.equal(padRows, 6);
  assert.equal(padCols, 4);
  assert.deepEqual(padded.shape, [16, 16]);
  assert.equal(padded.data.length, 256);

  // Check top-left corner values
  assert.equal(padded.data[0], 0);
  assert.equal(padded.data[1], 0.5);

  // Unpad and verify round-trip identity
  const unpadded = EosTensorComputeGrid.unpadTensor2D(padded, [10, 12]);
  assert.deepEqual(unpadded.shape, [10, 12]);
  assert.equal(unpadded.data.length, 120);

  for (let i = 0; i < 120; i++) {
    assert.equal(unpadded.data[i], original.data[i]);
  }
});

test("BDD-1907: Covariance Reduction and Numerically Stable Softmax", () => {
  // Covariance: 4 samples, 2 features
  // Feature 0: [2, 4, 6, 8] -> mean 5
  // Feature 1: [1, 2, 3, 4] -> mean 2.5
  const sampleData = [2, 1, 4, 2, 6, 3, 8, 4];
  const tensor = EosTensorComputeGrid.createTensor([4, 2], sampleData);

  const covRes = EosSoftwareTensorEmulator.covariance(tensor);
  assert.equal(covRes.op, "covariance");
  assert.deepEqual(covRes.shape, [2, 2]);

  // Var(F0) = ( (-3)^2 + (-1)^2 + 1^2 + 3^2 ) / 3 = (9+1+1+9)/3 = 20/3 = 6.6667
  // Var(F1) = ( (-1.5)^2 + (-0.5)^2 + 0.5^2 + 1.5^2 ) / 3 = (2.25 + 0.25 + 0.25 + 2.25)/3 = 5/3 = 1.6667
  // Cov(F0, F1) = ( (-3)*(-1.5) + (-1)*(-0.5) + 1*0.5 + 3*1.5 ) / 3 = (4.5 + 0.5 + 0.5 + 4.5)/3 = 10/3 = 3.3333
  const var0 = covRes.data[0];
  const cov01 = covRes.data[1];
  const cov10 = covRes.data[2];
  const var1 = covRes.data[3];

  assert.ok(Math.abs(var0 - 20 / 3) < 1e-4);
  assert.ok(Math.abs(var1 - 5 / 3) < 1e-4);
  assert.ok(Math.abs(cov01 - 10 / 3) < 1e-4);
  assert.ok(Math.abs(cov10 - 10 / 3) < 1e-4); // Symmetry

  // Softmax
  const logits = EosTensorComputeGrid.createTensor([2, 3], [1, 2, 3, 10, 10, 10]);
  const smRes = EosSoftwareTensorEmulator.softmax(logits);
  assert.equal(smRes.op, "softmax");
  assert.deepEqual(smRes.shape, [2, 3]);

  // Row 0 sum should be 1.0
  const row0Sum = smRes.data[0] + smRes.data[1] + smRes.data[2];
  assert.ok(Math.abs(row0Sum - 1.0) < 1e-5);
  assert.ok(smRes.data[2] > smRes.data[1] && smRes.data[1] > smRes.data[0]);

  // Row 1 (equal logits) should be ~1/3 each
  const row1Sum = smRes.data[3] + smRes.data[4] + smRes.data[5];
  assert.ok(Math.abs(row1Sum - 1.0) < 1e-5);
  assert.ok(Math.abs(smRes.data[3] - 1 / 3) < 1e-5);
  assert.ok(Math.abs(smRes.data[4] - 1 / 3) < 1e-5);
  assert.ok(Math.abs(smRes.data[5] - 1 / 3) < 1e-5);
});

test("BDD-1908: Dual-Mode Capability Probing & Formal Audit Receipt", () => {
  const caps = EosWebGpuTensorEngineCore.getAdapterCapabilities();
  assert.equal(typeof caps.available, "boolean");
  assert.ok(["webgpu", "layer0-software"].includes(caps.backend));
  assert.ok(caps.maxBufferSize > 0);
  assert.ok(caps.maxComputeWorkgroupStorageSize > 0);

  const receipt = EosWebGpuTensorEngineCore.audit(process.cwd());
  assert.equal(receipt.specId, "SPEC-354");
  assert.equal(receipt.changeId, "CHANGE-216");
  assert.equal(receipt.verdict, "CONFORMANT");
  assert.equal(receipt.epistemicState, "PRODUCTION_READY_WITHIN_TESTED_SCOPE");
  assert.equal(receipt.shadersSynthesized.length, 5);
  assert.equal(receipt.benchmarks.length, 4);

  const receiptPath = resolveEvidencePath("WEBGPU_TENSOR_ACCELERATION_RECEIPT.json", process.cwd());
  assert.ok(fs.existsSync(receiptPath));
  const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  assert.equal(saved.specId, "SPEC-354");
  assert.equal(saved.verdict, "CONFORMANT");
});
