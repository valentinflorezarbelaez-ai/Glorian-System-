# INTAKE-185: Tensor Parallel Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence Parallelism & Ring Attention

**Reference**: `SPEC-323` / `CHANGE-185`  
**System Target**: Glorian System Control Plane (`eos-system`)  
**Domain**: Distributed Deep Learning / Tensor Parallelism / Transformer Attention  
**Author**: Valentin Florez Arbelaez & EOS Autonomous Architecture Engine  
**Status**: APPROVED  
**Date**: 2026-11-17

---

## 1. Context & Business Intent

In frontier transformer models (e.g. LLaMA-3, Mistral, GPT-4, Gemini), self-attention constitutes one of the largest computational and memory bottlenecks. While MLP blocks can be sharded via Column and Row parallel linear layers (`SPEC-321`), the attention mechanism introduces multi-head structures, grouped query ratios (GQA), activation memory bottlenecks in LayerNorm/RMSNorm, and quadratic scaling over sequence lengths.

To achieve linear speedups and support ultra-long context windows across multi-GPU distributed clusters, the Glorian System requires a sovereign Layer-0 **Tensor Parallel Attention Engine** (`EosTensorParallelAttentionCore`) implementing:

1. **Multi-Head (MHA) and Grouped-Query Attention (GQA) Sharding**:
   - Query ($W_Q$), Key ($W_K$), and Value ($W_V$) head sharding across $P$ tensor parallel workers.
   - For GQA with $H_Q$ query heads and $H_{KV}$ key-value heads ($H_Q > H_{KV}$), heads are partitioned proportionally such that each worker computes attention over $H_Q / P$ query heads and $H_{KV} / P$ key-value heads with zero inter-worker communication during projection.
2. **Local FlashAttention Online Softmax Evaluation**:
   - Local evaluation of head attention using online softmax rescaling (`SPEC-318`) without materializing full $S \times S$ attention matrices.
3. **Row-Parallel Output Projection ($W_O$) with Single All-Reduce Barrier**:
   - Local output projection $O^{(p)} = A^{(p)} W_O^{(p)}$ partitioned row-wise.
   - A single collective All-Reduce (`SPEC-320`) $O = \sum_p O^{(p)}$ to reconstruct the unified multi-head attention output.
4. **Sequence Parallelism Integration**:
   - Sharding sequence activations $S / P$ across LayerNorm and Dropout layers, removing activation replication overhead.
5. **Ring Attention for Ultra-Long Sequence Lengths**:
   - P2P circular shifting of Key and Value blocks across workers in a ring topology while Query blocks remain stationary, computing exact self-attention across distributed sequence lengths $S \gg S_{local}$.

---

## 2. Invariant Criteria & Quality Guarantees

1. **Head Conservation Invariant**: $\sum_{p=0}^{P-1} H_Q^{(p)} = H_Q$ and $\sum_{p=0}^{P-1} H_{KV}^{(p)} = H_{KV}$.
2. **Single All-Reduce Synchronization Invariant**: Exactly 1 collective All-Reduce per forward attention pass.
3. **Mathematical Equivalence Invariant**: Output of distributed TP-MHA/GQA matches monolithic central attention within $\epsilon \le 10^{-5}$.
4. **Ring Attention Exactness Invariant**: Ring Attention with $K, V$ circular passes produces identical attention outputs to centralized attention over the full sequence.
5. **Zero External Runtime Dependencies**: Pure TypeScript Layer-0 module (`dependencies: {}`).
6. **Module Headroom Invariant (`SPEC-250`)**: Maximum file length $\le 800$ lines with $\ge 12$ lines headroom.
