import test from "node:test";
import assert from "node:assert/strict";

import { EosWebGpuTensorEngine } from "../src/core/eosWebGpuTensorEngine.ts";

test("BDD-255: Generación y despacho de shaders WGSL para multiplicación matricial GEMM (SPEC-090)", () => {
  const wgsl = EosWebGpuTensorEngine.generateGemmWgsl(64, 64, 64);

  assert.ok(wgsl.includes("@compute @workgroup_size(16, 16)"));
  assert.ok(wgsl.includes("struct MatrixUniforms"));
  assert.ok(wgsl.includes("var<storage, read> matrixA"));
  assert.ok(wgsl.includes("var<storage, read_write> matrixC"));

  const desc = EosWebGpuTensorEngine.createGemmPipelineDescriptor(32, 32, 32);
  assert.equal(desc.entryPoint, "main");
  assert.equal(desc.workgroupSize[0], 16);
  assert.equal(desc.workgroupSize[1], 16);
  assert.equal(desc.bindGroupLayout.length, 4);
});

test("BDD-256: Ejecución determinista de fallback en CPU con preservación exacta de precisión (SPEC-090)", () => {
  // A is 2x3 matrix:
  // [1, 2, 3]
  // [4, 5, 6]
  const A = new Float32Array([1, 2, 3, 4, 5, 6]);
  const dimA = { rows: 2, cols: 3 };

  // B is 3x2 matrix:
  // [7,  8]
  // [9,  1]
  // [2,  3]
  const B = new Float32Array([7, 8, 9, 1, 2, 3]);
  const dimB = { rows: 3, cols: 2 };

  // Expected C = A * B (2x2):
  // C[0,0] = 1*7 + 2*9 + 3*2 = 7 + 18 + 6 = 31
  // C[0,1] = 1*8 + 2*1 + 3*3 = 8 + 2 + 9 = 19
  // C[1,0] = 4*7 + 5*9 + 6*2 = 28 + 45 + 12 = 85
  // C[1,1] = 4*8 + 5*1 + 6*3 = 32 + 5 + 18 = 55
  const res = EosWebGpuTensorEngine.multiply(A, dimA, B, dimB);

  assert.equal(res.rows, 2);
  assert.equal(res.cols, 2);
  assert.equal(res.executionTarget, "CPU_DETERMINISTIC_FALLBACK");

  assert.equal(res.data[0], 31);
  assert.equal(res.data[1], 19);
  assert.equal(res.data[2], 85);
  assert.equal(res.data[3], 55);

  // Test ReLU activation
  const mixed = new Float32Array([-10.5, 0.0, 42.0, -0.001]);
  const activated = EosWebGpuTensorEngine.relu(mixed);
  assert.equal(activated[0], 0.0);
  assert.equal(activated[1], 0.0);
  assert.equal(activated[2], 42.0);
  assert.equal(activated[3], 0.0);
});
