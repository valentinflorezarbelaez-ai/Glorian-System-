# CHANGE-193: StreamingLLM, Attention Sinks & Infinite-Context Window Memory Compression Engine

**Specification Ref**: `SPEC-331`  
**Status**: DRAFT -> SUBMITTED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17  
**Layer**: Layer-0 TypeScript Core, Node.js 24 strip-only syntax

---

## 1. Intent & Scope

### 1.1 Intent

Introduce an in-memory, deterministic, zero-dependency StreamingLLM and Attention Sinks engine (`EosStreamingLlmCore`) that enables infinite-context streaming inference without memory exhaustion (OOM) or perplexity explosion by preserving initial attention sinks and maintaining an $O(1)$ ring-buffered local context window with dynamic RoPE positional re-indexing.

### 1.2 Scope

- **Domain Core**: `src/core/eosStreamingLlmAttentionSinks.ts`
- **Domain Types**: `src/core/eosStreamingLlmAttentionSinks.types.ts`
- **Formal Verification**: `docs/formal/StreamingLlmAttentionSinks.tla` & `docs/formal/StreamingLlmAttentionSinks.cfg` (Model 75)
- **CLI Subdispatcher**: `bin/commands/cliStreamingLlmAttentionSinks.mjs` (5 commands under `toolchain:streamllm:`)
- **CLI Wiring**: `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`
- **BDD Suite**: `test/eosStreamingLlmAttentionSinks.test.mjs` (BDD-1761..1766)
- **Evidence**: `docs/evidence/STREAMING_LLM_ATTENTION_SINKS_RECEIPT.json`

---

## 2. Invariants & Guarantees

1. **Strict Memory Boundedness**: For any stream length $T \to \infty$, physical KV memory allocation is strictly bounded by $O(K_{\text{sink}} + W_{\text{local}})$.
2. **Sink Preservation Invariant**: The initial $K_{\text{sink}}$ tokens (indices $0 \dots K_{\text{sink}}-1$) are permanently immune to eviction cycles ($\text{sinkTokens} \cap \text{evictedTokens} = \emptyset$).
3. **Perplexity Stability**: Attention sink retention preserves softmax sum normalization, keeping attention dispersion bounded ($\Delta \text{AttentionNorm} \le 10^{-4}$).
4. **RoPE Contiguity**: Position IDs within the sliding window are re-indexed contiguously to prevent out-of-distribution distance artifacts in rotary embeddings.
5. **No External Runtime Dependencies**: Pure TypeScript Layer-0, Node.js 24 strip-only syntax.
6. **Module Length**: All code strictly $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
