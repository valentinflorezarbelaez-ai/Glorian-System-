# External IV&V Verifier Stdout — Truncated Evidence

- **Run:** 2026-11-10 (independent verifier lane)
- **SHA:** `68743456debc3c8e436e44398396b074881d548b`
- **Host:** Node v24.19.0 · win32 · repo root `Glorian-System-`
- **Receipt:** `docs/assurance/EXTERNAL_IVV_EXECUTION_RECEIPT.md`

Stdout below is truncated (`…`) for binder size; full `verify:strict` output exceeded 4,800 lines (7/7 stages PASS).

---

## 1. `npm run typecheck` — exit **0**

```
> eos-system-landing@75.0.0 typecheck
> tsc --project tsconfig.typecheck.json
```

---

## 2. `node bin/eos.mjs turbo` — exit **0**

```
[EOS TURBO] Disparando Tubería de Verificación Ultrarrápida en Memoria...
Estado Epistémico    : LOCAL_CHECKS_PASSED
Tiempo Total         : 1293.555 ms
Archivos Analizados  : 1212 (0 en caché, 1011 frescos)
…
[PASS] Verificación Turbo 100% exitosa en 1293.555 ms (Exit Code 0).
```

---

## 3. `npm run mcp:verify` — exit **0**

```
✔ BDD-205: EosMcpSchemaValidator validates 100% of MCP tool definitions …
✔ BDD-206: EosMcpSchemaValidator validates edge cases, violations, and contract guard rails
ℹ tests 2 | pass 2 | fail 0 | duration_ms 1625.7465
```

---

## 4. `node scripts/verify-supply-chain.mjs` — exit **1**

```
Error: Cannot find module 'C:\Users\valen\Glorian-System-\scripts\verify-supply-chain.mjs'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1517:15)
…
  code: 'MODULE_NOT_FOUND',
Node.js v24.19.0
```

---

## 5. `npm run verify:strict` — exit **0**

```
 EOS SYSTEM — LOCAL REPOSITORY CHECKS (NO DEPLOYMENT)
✅ [PASS] Secret scan verified clean: 1317 files examined …
… (Stages 1–4.x: PASS; mutation/flaky gates skipped unless env set)
…
 LOCAL CHECKS: 7/7 STAGES PASSED | NO DEPLOYMENT OR LIVE PROBE RUN
```

Wall time ~575s for stage 7 receipt/SARIF write on verifier host.

---

## 6. `npm run ttv:golden` — exit **0**

```json
{
  "epistemicState": "GOLDEN_PATH_TTV_WITHIN_TESTED_SCOPE",
  "metrics": { "pathCount": 4, "allOk": true, "withinBudget": true },
  "sha256Receipt": "bdf76c687653601fc67546fc0bc5bdeb0b2833d5b6b6012b3e4cfefea928a6de"
}
[TTV] wrote docs/evidence/GOLDEN_PATH_TTV_RECEIPT.json
```

---

## 7. `npm run scale:proof` — exit **0**

```json
{
  "epistemicState": "BOUNDED_SCALE_PROOF_WITHIN_TESTED_SCOPE",
  "load": { "allSLAPassed": true, "withinBudget": true },
  "canary": { "cleanFinalStage": "FULL_PRODUCTION_100_PCT", "breachFinalStage": "ROLLED_BACK" },
  "ok": true
}
[SCALE] wrote docs/evidence/BOUNDED_SCALE_PROOF_RECEIPT.json
```

---

## 8. `node bin/eos.mjs platform:ops` — exit **0**

```
 EOS SYSTEM — MANUAL RÁPIDO Y ERGONOMÍA DE DESARROLLO (v68.0.0)
… (quick-reference help text emitted; no failure banners)
```

---

## 9. `npm run canary:product` — exit **0**

```json
{
  "ok": true,
  "siblingId": "performance-talent-group",
  "decision": "PROCEED_TO_NEXT_STAGE",
  "canaryHealthIndex": 100,
  "sha256": "8088de29ef5fdea446bca5b8f065fc5457a40eabec3c98d0921c2c7d7357206a"
}
```

---

## 10. `node scripts/eos-fleet-registry-sync.mjs --dry-run` — exit **0**

```
 Registry: …\docs\projects\registry.json (DRY-RUN)
 Total Projects: 9 | Seal: 218b810317a53efc...
…
 - [REGISTERED] eos-system … -> Eos-System (LEVEL_3_PRODUCTION_AUTHORIZED)
   ↳ URL: https://glorian-system.vercel.app
…
```

**IV&V assertions:** `totalFleetProjects`/listed count = 9; no `projects[].id` equal to `glorian-system-*` or containing `kegel` (production URL hostname `glorian-system.vercel.app` is expected for `eos-system`).

---

## Exit code summary

| Gate | Exit |
| ---- | ---- |
| typecheck | 0 |
| turbo | 0 |
| mcp:verify | 0 |
| verify-supply-chain.mjs | **1** |
| verify:strict | 0 |
| ttv:golden | 0 |
| scale:proof | 0 |
| platform:ops | 0 |
| canary:product | 0 |
| fleet-registry-sync (dry-run) | 0 |

**Final verifier verdict:** `REVALIDATION_REQUIRED` (gate 4).
