# EOS Intake & Context Record: INTAKE-194 (SPEC-332 / CHANGE-194)

## 1. Context & Business Intent

- **System**: Glorian System (Control Plane & Layer-0 Core Engine)
- **Domain**: High-Performance Distributed LLM Serving, Disaggregated Inference & KV Handoff
- **Objective**: Implement a pure Layer-0 TypeScript Disaggregated Prefill and Decode (PD Separation) Engine (`EosDisaggregatedPrefillDecodeCore`) with zero external runtime dependencies, solving head-of-line blocking in concurrent LLM serving by physically decoupling compute-bound prompt prefill from memory-bandwidth-bound autoregressive decoding.
- **Reference Architectures**:
  - DistServe (Zhong et al., OSDI 2024: "Disaggregating Prefill and Decoding for Goodput-Oriented LLM Serving")
  - Splitwise (Patel et al., ISCA 2024: "Efficient generative LLM serving using separated prefill and decode phases")
  - Mooncake (Kimi / Moonshot AI 2024: "KCache-centric disaggregated architecture for LLM serving")
  - vLLM Disaggregated Prefill & Chunked Prefill Serving Architecture (2024)

## 2. Core Functional Requirements

1. **Disaggregated Node Roles**: Strict logical and physical separation between Prefill Worker Nodes (compute-bound, high FLOP/s, tensor parallel prefill) and Decode Worker Nodes (memory-bandwidth-bound, high KV cache capacity, low TPOT).
2. **Chunked Prefill Scheduling**: Decompose long prompt prefills ($T > B_{\text{chunk}}$) into deterministic micro-chunks of size $B_{\text{chunk}}$ (e.g., 512 tokens), interleaving prefill computation with ongoing decode steps to eliminate decode pipeline bubbles and head-of-line blocking.
3. **Zero-Copy KV Cache Transfer & Handoff**: Once prompt prefill completes on the prefill node, generate a cryptographically verified KV page migration descriptor that serializes paged KV tensors and securely transfers ownership to the target decode node.
4. **SLA Isolation & Telemetry (TTFT vs TPOT)**: Enforce independent SLA scheduling policies:
   - Prefill SLA: Time To First Token (TTFT $\le 150$ ms).
   - Decode SLA: Time Per Output Token (TPOT $\le 15$ ms/token).
5. **Dynamic Worker Load Balancing**: Monitor queue depth and KV cache utilization across prefill and decode worker pools, dynamically steering incoming requests based on token length and worker saturation.
6. **Leslie Lamport TLA+ Formal Verification (Model 76)**: Formally prove absence of deadlocks, absence of head-of-line blocking for decode requests, and strict KV page transfer conservation.

## 3. Epistemic Status & Constraints

- **Epistemic State**: `INTAKE_RECORDED`
- **Dependencies**: `dependencies: {}` (Zero external npm packages)
- **Module Size**: $\le 800$ lines, $\ge 12$ lines headroom (`SPEC-250`)
- **CLI Parity**: 100% catalog parity verified by `hygiene:audit`
