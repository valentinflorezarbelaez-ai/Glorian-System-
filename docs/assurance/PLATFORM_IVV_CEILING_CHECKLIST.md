# Platform IV&V Ceiling Checklist (LADDER-16)

Auditor-facing readiness for sovereign ceiling tip-seal. Builder ≠ Verifier (NASA IV&V).

## Required evidence

1. Peak Assurance binder — `docs/evidence/assurance-binder/INDEX.md` + EVD-146 WAVE-C
2. Product Delivery EVD-147 WAVE-C + dogfood `docs/products/demo-ledger-mvp`
3. Platform Ops EVD-148 WAVE-C + this checklist
4. Freeze SSOT — Active ladder LADDER-16 tip-sealed
5. Re-run: `node --test test/eosPlatformOpsCeiling.test.mjs` exit 0
6. Re-run: `node bin/eos.mjs platform:ops` → `ceilingMet: true`
7. Fleet pulse control plane PRISTINE A+

## Forbidden self-claims

Do **not** accept or issue: `NSA_GRADE`, `AEROSPACE_CERTIFIED`, `FEDERAL_ATO`, `ABSOLUTE_UNIVERSAL_PERFECTION`.

Accepted tip-seal label: `SOVEREIGN_CEILING_10_OF_10_WITHIN_TESTED_SCOPE`.
