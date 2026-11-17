# CHANGE-192: Tree-Structured Speculative Decoding, Multi-Candidate Rejection Sampling & Dynamic Draft-Target Verification Engine

**Specification Ref**: `SPEC-330`  
**Status**: DRAFT -> SUBMITTED  
**Author**: Valentin Florez Arbelaez  
**Created**: 2026-11-17  
**Layer**: Layer-0 TypeScript Core, Node.js 24 strip-only syntax

---

## 1. Intent & Scope

### 1.1 Intent

Introduce an in-memory, deterministic, zero-dependency Tree-Structured Speculative Decoding engine (`EosTreeSpeculativeDecodingCore`) to accelerate LLM auto-regressive generation by verifying multi-candidate tree hypotheses in a single target model forward pass without any output distribution distortion.

### 1.2 Scope

- **Domain Core**: `src/core/eosTreeSpeculativeDecoding.ts`
- **Domain Types**: `src/core/eosTreeSpeculativeDecoding.types.ts`
- **Formal Verification**: `docs/formal/TreeSpeculativeDecoding.tla` & `docs/formal/TreeSpeculativeDecoding.cfg` (Model 74)
- **CLI Subdispatcher**: `bin/commands/cliTreeSpeculativeDecoding.mjs` (5 commands under `toolchain:specdec:`)
- **CLI Wiring**: `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md`
- **BDD Suite**: `test/eosTreeSpeculativeDecoding.test.mjs` (BDD-1755..1760)
- **Evidence**: `docs/evidence/TREE_SPECULATIVE_DECODING_RECEIPT.json`

---

## 2. Invariants & Guarantees

1. **Strictly Guaranteed Forward Progress**: Every target model forward pass yields $\ge 1$ final accepted token (even under 100% rejection, the residual sampler produces 1 valid token).
2. **Zero Distributional Shift**: The acceptance/rejection criteria enforces $D_{KL}(P_{\text{spec}} \parallel P_{\text{target}}) = 0.0$ for any draft model distribution.
3. **Causal Tree Mask Ancestry Invariant**: Binary attention mask $M_{i, j} = 1 \iff \text{node}_j \in \text{Ancestors}(\text{node}_i) \cup \{\text{node}_i\}$.
4. **Memory & Runtime Safety**: Tree size strictly bounded by `maxTreeNodes`, preventing buffer overrun or memory allocation spikes.
5. **No External Runtime Dependencies**: Pure TypeScript Layer-0, Node.js 24 strip-only syntax.
6. **Module Length**: All code strictly $\le 800$ lines with $\ge 12$ lines headroom (`SPEC-250`).
