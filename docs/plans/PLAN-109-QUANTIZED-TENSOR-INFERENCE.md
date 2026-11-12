# PLAN-109: Implementation Plan for Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core

- **Change ID**: `CHANGE-109`
- **Spec ID**: `SPEC-224`
- **Component**: `eos-system-control-plane`
- **Owner**: `user:valentin-florez-arbelaez`
- **Target**: `src/core/eosQuantizedTensorInferenceCore.ts`

## 1. Phase 1: Contract-Driven Architecture & Types

- Define `GgmlType`, `GgufMetadataValue`, `GgufHeader`, `GgufTensorInfo`, `QuantizedTensor`, `MatMulResult`, `EmbeddingResult`, `TensorReceipt`.
- Ensure strict compliance with Node 24 strip-only TS (no enums, no namespaces).
- Target file: `src/core/eosQuantizedTensorInferenceCore.types.ts` ($\le 800$ lines).

## 2. Phase 2: Core Engine Implementation

- Core class `EosQuantizedTensorInferenceCore`:
  - FP16 conversion (`floatToHalf`, `halfToFloat`).
  - Quantization routines:
    - `quantizeQ4_0(weights: Float32Array): Uint8Array`
    - `dequantizeQ4_0(data: Uint8Array, length: number): Float32Array`
    - `quantizeQ8_0(weights: Float32Array): Uint8Array`
    - `dequantizeQ8_0(data: Uint8Array, length: number): Float32Array`
    - `quantizeQ4_K(weights: Float32Array): Uint8Array`
    - `dequantizeQ4_K(data: Uint8Array, length: number): Float32Array`
  - Block-wise MatMul:
    - `quantizedMatMulVec(qMatrix: Uint8Array, x: Float32Array, rows: number, cols: number, type: GgmlType): Float32Array`
  - Vector operations:
    - `rmsNorm(x: Float32Array, weight?: Float32Array, eps?: number): Float32Array`
    - `cosineSimilarity(u: Float32Array, v: Float32Array): number`
  - GGUF Parser & Writer:
    - `writeGguf(tensors: QuantizedTensor[], metadata?: Record<string, string>): Uint8Array`
    - `readGguf(buffer: Uint8Array): { tensors: QuantizedTensor[], metadata: Record<string, string> }`
  - Embedding Generator:
    - `embedText(text: string, projectionMatrix: Uint8Array, dims: number): Float32Array`
- Target file: `src/core/eosQuantizedTensorInferenceCore.ts` ($\le 800$ lines).

## 3. Phase 3: CLI, Subpath Export & MCP Integration

- Export `"./tensor"` in `package.json` and in `src/core/index.ts`.
- Create `bin/commands/cliTensorMesh.mjs` with subcommands:
  - `tensor:quantize`
  - `tensor:matmul`
  - `tensor:embed`
  - `tensor:benchmark`
- Wire CLI into `cliPlatform.mjs` and `cliKernel.mjs`.
- Register MCP actions `tensor_quantize`, `tensor_matmul`, `tensor_embed` in `src/mcp/tools/eosMcpPhase7EnterpriseFrontierHandlersExt.ts`.

## 4. Phase 4: Test Suite & Quality Verification

- Create `test/eosQuantizedTensorInferenceCore.test.mjs` verifying BDD-1139..BDD-1143.
- Add step #36 in `test/eosEnterpriseFacade.test.mjs` (ensure file remains $\le 800$ lines).
- Run `npm run typecheck`, `npm run lint`, `npx prettier --write`.
- Regenerate catalog index (`totalSpecs: 219`) and refresh freeze gate.
- Commit, seal pin, and push to GitHub.
