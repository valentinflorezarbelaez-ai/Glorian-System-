# Big-Tech Operating Doctrine Wave (2026-11-04)

Epistemic: `BIG_TECH_HARDENING_WITHIN_TESTED_SCOPE` — **not** Level 5.

Maps how AWS / Microsoft / Apple / SpaceX / DARPA / e-Estonia operate into this wave’s executable remediations.

| Org pattern | EOS / fleet action this wave |
|---|---|
| AWS Secrets Manager / NSA zero plaintext | Crud `api/_db.js`: env-only `DATABASE_URL`, fail-closed, no embedded conn strings |
| Apple / Microsoft modular service boundaries | SPEC-155 T7a: purge dead MCP god-file switch arms for Phase-1/2 registry tools (−201 LOC) |
| SpaceX flight software: one authority path | Registry-first MCP dispatch; unreachable duplicates deleted |
| Spotify Soundcheck / Google SRE gates | Deepened landing gates (scripts + gitignore + deploy surface) for ATP/Donaciones/Portafolio/Biblioteca |
| DARPA IV&V / NASA evidence | Hermetic `verify-strict` + turbo + Soundcheck before ship claims |
| e-Estonia digital transparency | Career evidence pack remains employer-readable without private fleet deep links |

## Explicit non-claims
- Not a vendor production controller for AWS/Azure/GCP
- Not military clearance or SIGINT capability
- Not absolute perfection

## Verify
```bash
node --test test/eosMcpUtilityModularization.test.mjs
node bin/eos.mjs turbo
# Crud: node scripts/verify-strict.mjs
```
