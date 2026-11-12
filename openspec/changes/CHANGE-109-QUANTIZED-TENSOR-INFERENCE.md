# CHANGE-109: Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core

## 1. Change Metadata

- **Change ID**: `CHANGE-109`
- **Spec ID**: `SPEC-224`
- **Author**: `user:valentin-florez-arbelaez`
- **Reviewers**: `Constitutional-Tribunal`, `EOS-Director`
- **Target Subsystem**: `src/core/eosQuantizedTensorInferenceCore.ts`
- **Status**: `PROPOSED`

## 2. Motivation

Enabling local sovereign inference for semantic text embeddings directly inside Glorian System without requiring Python, PyTorch, C++ shared libraries, or external GPU daemon services.

## 3. Scope of Work

- Create `src/core/eosQuantizedTensorInferenceCore.types.ts` ($\le 800$ lines).
- Create `src/core/eosQuantizedTensorInferenceCore.ts` ($\le 800$ lines) with:
  - GGUF container reader and writer.
  - Quantization algorithms: Q4_0, Q4_K, Q8_0, and IEEE-754 FP16/FP32.
  - Streaming block-wise quantized matrix-vector multiplication (`quantizedMatMulVec`).
  - Vector normalization (RMSNorm, LayerNorm) and cosine similarity.
  - Embedding pipeline with projection and pooling.
- Register subpath export `"./tensor": "./src/core/eosQuantizedTensorInferenceCore.ts"` in `package.json`.
- Export from `src/core/index.ts`.
- Add CLI commands `tensor:quantize`, `tensor:matmul`, `tensor:embed`, `tensor:benchmark` in `bin/commands/cliTensorMesh.mjs`.
- Add MCP actions `tensor_quantize`, `tensor_matmul`, `tensor_embed`.
- Add test suite `test/eosQuantizedTensorInferenceCore.test.mjs` verifying BDD-1139..BDD-1143.
- Add facade step #36 in `test/eosEnterpriseFacade.test.mjs`.
- Update `docs/DEVELOPER_GUIDE.md`, `openspec-catalog-index.json`, `AGENTS.md`.
