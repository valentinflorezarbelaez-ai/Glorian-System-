# AI Engineer 2026 Roadmap → Glorian Map

Source: Fazt — Cómo ser AI Engineer en 2026  
Epistemic state: `WITHIN_TESTED_SCOPE` · Explicitly **not** Level-5 / not ML Researcher track

## Gaps vs Fazt roadmap (status 2026-11-09)

Ordered by product value:

1. **Cost / token truth UX** — **DONE** (FinOps receipt + Studio `/api/finops`).
2. **RAG golden path demo** — **DONE** within prior hermetic scope (retrieval-only).
3. **Tool-calling evals** — **DONE**: `test/eosMcpArgFuzzEval.test.mjs` (wrong-tool / wrong-args / enum / unexpected props) + runtime gate in `eosMcpServer` `tools/call`.
4. **Model routing policy card** — **DONE** (FinOps routing policy card polish tip-sealed earlier).
5. **LLMOps privacy lane** — **DONE**: `src/core/eosLlmOpsPrivacyLane.ts` + `docs/runbooks/LLMOPS_PRIVACY_LANE.md` (`EOS_LLM_PRIVACY_LANE=local|open_weight`).
6. **Portfolio evidence** — regenerate via career evidence scripts when needed.

## Mobile / touch hygiene (2026-11-09)

- Safe-area + 44px header actions sealed (`css/eos.css` + SRI `eos.css?v=15.2`).
- IDE session hook restored (`scripts/eos-ide-session-hook.mjs`) after tip-merge deletion.

## Non-goals

- Not claiming AI Researcher / PhD track
- Not claiming Level-5 / NSA_GRADE
- Not replacing Layer-0 with LangChain dependency theater (`dependencies: {}` remains law)
