# AI Engineer 2026 Roadmap → Glorian Map

Source: Fazt — Cómo ser AI Engineer en 2026  
Epistemic state: `WITHIN_TESTED_SCOPE` · Explicitly **not** Level-5 / not ML Researcher track

## Gaps vs Fazt roadmap (status 2026-11-09)

Ordered by product value:

1. **Cost / token truth UX** — **DONE** (FinOps receipt + Studio `/api/finops`).
2. **RAG golden path demo** — **DONE** within prior hermetic scope (retrieval-only).
3. **Tool-calling evals** — **DONE**: `test/eosMcpArgFuzzEval.test.mjs` (wrong-tool / wrong-args / enum / unexpected props) + runtime gate in `eosMcpServer` `tools/call`.
4. **Model routing policy card** — **DONE** (FinOps routing policy card polish tip-sealed earlier).
5. **LLMOps privacy lane** — **DONE**: `src/core/eosLlmOpsPrivacyLane.ts` + nightly gate in `eos-nightly-deep-gates.yml` (`EOS_LLM_PRIVACY_LANE=local|open_weight`).
6. **Portfolio evidence** — regenerate via career evidence scripts when needed.

## Big Tech improvement wave (2026-11-09)

1. Hexagonal Law V false-positive hardening (`window` ⊆ ContextWindow) + turbo 100% on disk.
2. Golden-path TTV dogfood: `npm run ttv:golden` → `docs/evidence/GOLDEN_PATH_TTV_RECEIPT.json`.
3. MCP profile curation: `EOS_MCP_PROFILE=essential` (18 tools) subset of `core` (46).
4. LLMOps privacy continuous gate in nightly CI.
5. Incident one-pager: `docs/runbooks/INCIDENT_ONE_PAGER.md`.
6. IV&V auditor packet restored + refreshed under `docs/assurance/`.
7. Bounded scale proof: `npm run scale:proof` → p99/budget/rollback receipt.
8. Multi-tenant IAM foundation: SPEC-184 + `eosMultiTenantIamFoundation.ts`.
9. **MCP runtime IAM gate** — SPEC-184 FR-931..934 + `eosMcpIamCallGate.ts` on stdio `tools/call` mutating writes (fail-closed).
10. **Big Tech Product Factory E2E** — SPEC-185 + `eosBigTechProductFactory.ts` + `npm run factory:e2e` (IAM → deliver → scorecard → receipt).
11. **IAM audit ledger** — SPEC-184 FR-935 append-only `.eos/iam-audit.jsonl` hash chain on mutating tools/call.
12. **Fine-grained IAM pack** — heal / worktree / deliver / foundry (FR-936); no broad `mcp/tools/` grant.
13. **Fleet dogfood TTV** — `npm run fleet:dogfood` → `docs/evidence/FLEET_DOGFOOD_TTV_RECEIPT.json`.
14. **Catalog freeze** — no OpenSpec ids after 185 until fleet dogfood has ≥1 AVAILABLE sibling (`docs/governance/CATALOG_FREEZE.md`).

## Mobile / touch hygiene (2026-11-09)

- Safe-area + 44px header actions sealed (`css/eos.css` + SRI `eos.css?v=15.2`).
- IDE session hook restored (`scripts/eos-ide-session-hook.mjs`) after tip-merge deletion.

## Non-goals

- Not claiming AI Researcher / PhD track
- Not claiming Level-5 / NSA_GRADE
- Not replacing Layer-0 with LangChain dependency theater (`dependencies: {}` remains law)
