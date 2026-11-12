# SPEC-224: Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core

## 1. Specification Metadata

- **Specification ID**: `SPEC-224`
- **Change ID**: `CHANGE-109`
- **Title**: Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core for Sovereign Local Embeddings
- **Status**: `APPROVED`
- **Target Subsystem**: `src/core/eosQuantizedTensorInferenceCore.ts`
- **Related Specs**: `SPEC-191` (Neuro-Symbolic Verifier), `SPEC-201` (HNSW Vector Index), `SPEC-208` (Reverse Mode Autodiff)

## 2. Mathematical Foundation & Protocol Design

- **GGUF Container Format**:
  - Magic: `0x46554747` (`"GGUF"` ASCII little-endian), Version 3.
  - Header: tensor count, metadata key-value count, string tables, tensor info headers (dimensions, offset, GGML type).
- **GGML Quantization Formats**:
  - `Q4_0`: 32 weights per block. 2 bytes FP16 delta scale $d$, 16 bytes containing 32 4-bit unsigned nibbles $q_i \in [0, 15]$. Dequantized: $w_i = (q_i - 8) \cdot d$. Total size: 18 bytes / 32 weights (4.5 bits/weight).
  - `Q8_0`: 32 weights per block. 2 bytes FP16 delta scale $d$, 32 bytes containing 32 8-bit signed integers $q_i \in [-128, 127]$. Dequantized: $w_i = q_i \cdot d$. Total size: 34 bytes / 32 weights (8.5 bits/weight).
  - `Q4_K`: 256 weights per super-block. Super-block FP16 scale $d$ and minimum $d_{\min}$, 6-bit sub-block scales/mins, 128 bytes containing 256 4-bit nibbles. Total size: 144 bytes / 256 weights (4.5 bits/weight).
  - `FP16`: IEEE-754 half precision (1 sign, 5 exponent, 10 mantissa) with full denormalized float conversion.
- **Quantized Matrix-Vector Multiplication**:
  - Computes $y = W \cdot x$ directly over block streams without materializing dequantized matrices in memory:
    $y_r = \sum_{b=0}^{B-1} d_b \cdot \sum_{i=0}^{31} (q_{b, i} - 8) \cdot x_{32b + i}$.
- **Vector Operations & Semantic Similarity**:
  - RMSNorm: $\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{d}\sum x_i^2 + \epsilon}} \odot \gamma$.
  - Cosine Similarity: $\text{cos}(u, v) = \frac{\sum u_i v_i}{\sqrt{\sum u_i^2} \sqrt{\sum v_i^2}}$.

## 3. Functional Requirements (IEEE 830 EARS)

### FR-1139: GGUF Container Parser and Serializer

- **Requirement**: The system SHALL parse and serialize GGUF v3 binary files, extracting metadata key-value pairs, tensor descriptors (names, dimensions, offsets), and raw tensor buffers without external libraries.

### FR-1140: Multi-Precision Quantization & Dequantization

- **Requirement**: The system SHALL implement symmetric and asymmetric quantization/dequantization for Q4_0, Q4_K, Q8_0, and IEEE-754 FP16 formats with bounded roundoff error $< 0.05$ relative error.

### FR-1141: Block-Wise Quantized Matrix-Vector Multiplication

- **Requirement**: The system SHALL perform block-wise matrix-vector multiplication $y = W \cdot x$ directly on quantized byte buffers in streaming fashion without allocating full FP32 weight matrices in memory.

### FR-1142: Transformer Vector Normalization and Cosine Ranking

- **Requirement**: The system SHALL execute RMSNorm, LayerNorm, mean-pooling, and cosine similarity ranking over high-dimensional dense embeddings with numerical stability.

### FR-1143: Universal CLI, MCP Integration and Ledger Receipts

- **Requirement**: The system SHALL expose CLI subcommands `tensor:quantize`, `tensor:matmul`, `tensor:embed`, `tensor:benchmark`, register MCP actions `tensor_quantize`, `tensor_matmul`, `tensor_embed`, and produce verifiable SHA-256 execution receipts into the SQLite WAL Ledger.

## 4. Behavior-Driven Development Scenarios (Gherkin)

```gherkin
Feature: Layer-0 Quantized GGUF/Q4_K Integer Tensor Inference Core

  Scenario: BDD-1139 GGUF Binary Serialization and Roundtrip Parsing
    Given an embedding tensor of shape [128, 64] with metadata keys
    When serializing the tensor into GGUF v3 binary container format
    Then the header magic matches 0x46554747 and parsing restores identical tensor dimensions and metadata.

  Scenario: BDD-1140 Q4_0, Q4_K, and Q8_0 Quantization Accuracy
    Given a vector of 256 random floating-point weights in range [-1.0, 1.0]
    When quantizing into Q4_0, Q8_0, and Q4_K block formats and dequantizing back
    Then the cosine similarity between original and reconstructed vectors is > 0.99.

  Scenario: BDD-1141 Streaming Block MatMul without Full Matrix Allocation
    Given a quantized weight matrix W [64, 128] in Q4_0 format and input vector x [128]
    When executing quantizedMatMulVec directly on the quantized byte buffer
    Then output vector y matches FP32 reference matmul within relative error < 0.05.

  Scenario: BDD-1142 Semantic Embedding Generation and Cosine Similarity
    Given two textual sentences with projection into a 64-dimensional embedding space
    When normalizing vectors via RMSNorm and computing cosine similarity
    Then identical sentences yield similarity 1.0 and divergent sentences yield lower similarity.

  Scenario: BDD-1143 Universal CLI and MCP Dispatch with Ledger Receipt
    Given the Glorian CLI and MCP control plane
    When invoking tensor:quantize and tensor:matmul commands
    Then valid JSON results with SHA-256 execution receipts are recorded.
```

## 5. Architecture Decision Record (ADR-224)

- **Context**: Local AI features (code embedding, semantic deduplication, HNSW indexing) currently depend on external Python/ONNX environments, compromising Layer-0 purity.
- **Decision**: Implement a pure TypeScript GGUF / Q4_K quantized integer tensor inference engine directly on Node.js typed arrays (`DataView`, `Float32Array`, `Uint8Array`).
- **Alternatives Discarded**:
  - _llama.cpp bindings via node-addon-api_: Violates EOS Law I (zero external dependencies) and requires native C++ build tools.
  - _ONNX Runtime Node_: Requires multi-megabyte binary blob dependencies and external C++ shared libraries.
  - _Unquantized Float32 only_: Requires $4\times$ to $8\times$ more memory, prohibiting local sovereign execution of multi-megabyte embedding models in constrained environments.
- **Consequences**: Enables 100% pure, dependency-free local AI embeddings with $4\times$ memory reduction.
