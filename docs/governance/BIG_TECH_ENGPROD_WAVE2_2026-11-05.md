# Big-Tech EngProd Wave-2 — 2026-11-05
<!-- Epistemic: BIG_TECH_ENGPROD_W2_WITHIN_TESTED_SCOPE · not Level-5 -->

## Shipped

| Track | Deliverable |
| --- | --- |
| RAG golden path | `eosFleetRagGoldenPath` + hermetic BDD (Biblioteca/Spotify fixtures) |
| FinOps cockpit | `api/finops.js` + Studio Console FinOps receipt panel |
| CWV deepen | 7 static signals · pass ≥4/7 · ≥70% fleet |
| Portfolio sync | Regenerated evidence pack + `careerEvidence.ts` |
| Canary | `v75.2.0-engprod-w2` → 100% |

## Verify

```bash
node --test test/eosFleetRagGoldenPath.test.mjs
node scripts/demo-fleet-rag-golden-path.mjs "Pistis Sophia"
node scripts/verify-fleet-cwv-static.mjs
node scripts/generate-career-evidence-pack.mjs
node scripts/sync-career-evidence-to-portafolio.mjs
node bin/eos.mjs turbo
```

## Still open (wave-3)

- Live browser Lighthouse CWV (not static markup)
- Wire RAG into Biblioteca production UI (Law IV product change)
- JDK install for Java PermissionGate smoke
- FinOps receipt row in employer portfolio panel (beyond sync signals)

## Non-claims

Not Level-5 · FinOps USD is estimate-only · RAG does not call an LLM generator.
