# Big-Tech EngProd Wave — 2026-11-05
<!-- Epistemic: BIG_TECH_ENGPROD_WITHIN_TESTED_SCOPE · not Level-5 · not employment claim -->

## Operating pattern (how Big Tech ships)

| Pattern | This wave |
| --- | --- |
| Google SRE / Spotify Soundcheck | Seal dirty trees → fleet average 100 |
| AWS FinOps / cost truth | `FINOPS_COST_RECEIPT` on Mission Golden Path (SPEC-156 FR-514) |
| Platform AuthZ (Spotify) | Java `PermissionGate` least-privilege lab |
| LLMOps evals | Hermetic FinOps / wrong-tool budget tests |
| Progressive delivery | `eos_canary_rollout` v75.1.0-engprod-wave → 100% |
| Evidence over claims | tip-seal + turbo + BDD exit 0 |

## Shipped

1. Mission Golden Path emits mandatory FinOps cost receipt (tier, est USD, attestation).
2. Java AuthZ lab: creators / team / partner / agent fail-closed allowlists.
3. Hermetic FinOps tool-routing eval suite.
4. Spotify Golden Paths hire-signal map committed.
5. Aberamentho Absolute harvest script sealed for git health.

## Explicit non-claims

- Not Level-5 / NSA_GRADE / federal ATO
- FinOps USD figures are **estimates**, not live provider invoices
- Java lab is hire-signal practice, not Spotify production AuthZ

## Verify

```bash
node --test test/eosMissionGoldenPath.test.mjs test/eosToolCallingFinOpsEval.test.mjs
node bin/eos.mjs turbo
# Java
cd labs/java-music-expression && javac -d out ... && java -cp out com.glorian.authz.PermissionGateSmoke
```
