# Big-Tech EngProd Wave-3 — 2026-11-05
<!-- Epistemic: BIG_TECH_ENGPROD_W3_WITHIN_TESTED_SCOPE · not Level-5 -->

## Shipped

| Track | Deliverable |
| --- | --- |
| Biblioteca RAG UI | `lib/hermeticRag.ts` + `SacredRagPanel` on `/biblioteca` (retrieval only) |
| Portfolio FinOps | Career evidence pack + panel signal for `FINOPS_COST_RECEIPT` |
| CWV | Optional `verify-fleet-cwv-browser.mjs` (Lighthouse if present; else SKIPPED) |
| Java smoke | **BLOCKED** — no JDK/`javac` on PATH (PermissionGate sources remain hire-signal) |

## Verify

```bash
# Biblioteca
cd ../Biblioteca-gnostica-1 && npm test
# Glorian
node scripts/generate-career-evidence-pack.mjs
node scripts/sync-career-evidence-to-portafolio.mjs
node scripts/verify-fleet-cwv-static.mjs
node scripts/verify-fleet-cwv-browser.mjs
node bin/eos.mjs turbo
```

## Non-claims

Not Level-5 · RAG does not invent sacred text · FinOps USD is estimate-only · browser CWV is optional when Lighthouse absent.
