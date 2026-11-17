# CHANGE-194: Disaggregated Prefill & Decode Serving Engine (PD Separation, Chunked Prefill & Zero-Copy KV Transfer)

## 1. Intent & Scope

Traditional unified LLM serving colocation executes prompt prefill and token decoding on the identical GPU/worker cluster. Because prefill is compute-bound with quadratic attention complexity $\mathcal{O}(T^2)$ while decode is memory-bandwidth-bound with autoregressive $\mathcal{O}(1)$ step generation, co-locating them causes severe head-of-line (HoL) blocking: incoming long prompts freeze ongoing generation across dozens of streams, causing tail latency (TPOT) spikes of up to $10\times$.

`CHANGE-194` introduces `EosDisaggregatedPrefillDecodeCore`, establishing:

1. Physical and logical decoupling of Prefill Nodes ($W_{\text{prefill}}$) and Decode Nodes ($W_{\text{decode}}$).
2. Deterministic Chunked Prefill scheduling with configurable chunk budget $B_{\text{chunk}}$.
3. Zero-copy Paged KV Cache handoff with SHA-256 integrity verification before decoding resumption.
4. Independent SLA control for TTFT (Time To First Token) and TPOT (Time Per Output Token).
5. Formal TLA+ Model 76 mathematical proof with Leslie Lamport's TLC model checker.

## 2. Impacted Components

- `src/core/eosDisaggregatedPrefillDecode.ts`: Core Layer-0 disaggregated PD serving engine.
- `src/core/eosDisaggregatedPrefillDecode.types.ts`: Domain schemas, node states, and KV transfer descriptors.
- `src/core/index.ts`: Module exports.
- `bin/commands/cliDisaggregatedPrefillDecode.mjs`: CLI subdispatcher under prefix `toolchain:distpd:`.
- `bin/commands/cliToolchainRouter.mjs`: Router registration.
- `bin/commands/cliHelpCatalog.mjs`: Help catalog entries.
- `docs/DEVELOPER_GUIDE.md`: Developer guide and alphabetical index updates.
- `docs/formal/DisaggregatedPrefillDecode.tla` & `.cfg`: Formal TLA+ specification and model configuration.
- `scripts/run-tlc.mjs`: TLC runner registry.
- `test/eosDisaggregatedPrefillDecode.test.mjs`: BDD test suite (BDD-1767..1772).

## 3. Risk Assessment

- **Risk 1**: KV cache serialization overhead across nodes.
  - _Mitigation_: Zero-copy block metadata descriptor transfer and contiguous memory buffer slicing.
- **Risk 2**: Worker pool queue starvation under asymmetric traffic.
  - _Mitigation_: Dynamic role shedding and queue watermarking to route short prompts directly to decode nodes when prefill pool is saturated.
