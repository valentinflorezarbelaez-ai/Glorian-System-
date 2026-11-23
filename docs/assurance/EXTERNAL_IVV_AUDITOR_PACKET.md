# External IV&V Auditor Packet — Glorian / Eos-System

<!-- Epistemic: READY_FOR_EXTERNAL_HUMAN_IVV · WITHIN_TESTED_SCOPE · builder ≠ verifier -->
<!-- Forbidden outputs: NSA_GRADE · AEROSPACE_CERTIFIED · FEDERAL_ATO · Level-5 -->
<!-- Refreshed: 2026-11-10 (residuals wave — pair with EXTERNAL_IVV_EXECUTION_RECEIPT.md) -->

## Purpose

Hand this packet to an **independent human verifier**. Builder claims are inputs only.
Accepted seal label after independent re-run: `*_WITHIN_TESTED_SCOPE` only.

## Preconditions

1. Clean `main` on Glorian (`git status` empty) or release tag.
2. Node.js ≥ 24 on verifier machine.
3. Working directory = repository root of `Eos-System`.

## Mandatory re-execution (all exit 0)

```bash
npm run typecheck
node bin/eos.mjs turbo
npm run mcp:verify
node scripts/verify-supply-chain.mjs
npm run verify:strict
node --test test/eosPlatformOpsCeiling.test.mjs test/eosLlmOpsPrivacyLane.test.mjs test/eosMultiTenantIamFoundation.test.mjs
npm run ttv:golden
npm run scale:proof
npm run llmops:privacy
node bin/eos.mjs platform:ops
```

Optional (ops excellence, not accreditation blockers):

```bash
npm run fleet:cwv-static
# Default Tier-0: EOS_MCP_PROFILE=core (~46). Opt-in full or essential — docs/governance/MCP_TIER0_TOKEN_ECONOMY.md
```

## Binder checklist

| #   | Artifact                     | Path                                               |
| --- | ---------------------------- | -------------------------------------------------- |
| 1   | Binder index                 | `docs/evidence/assurance-binder/INDEX.md`          |
| 2   | Peak Assurance IV&V playbook | `docs/assurance/IVV_PLAYBOOK.md`                   |
| 3   | Platform ceiling checklist   | `docs/assurance/PLATFORM_IVV_CEILING_CHECKLIST.md` |
| 4   | NIST IA-5 index              | `docs/assurance/IA5_AUTHENTICATOR_ROTATION.md`     |
| 5   | Incident one-pager           | `docs/runbooks/INCIDENT_ONE_PAGER.md`              |
| 6   | Golden-path TTV receipt      | `docs/evidence/GOLDEN_PATH_TTV_RECEIPT.json`       |
| 7   | Bounded scale proof          | `docs/evidence/BOUNDED_SCALE_PROOF_RECEIPT.json`   |
| 8   | SBOM                         | `docs/evidence/sbom.cdx.json`                      |
| 9   | Freeze gate                  | `docs/releases/EOS_FREEZE_GATE_STATUS.md`          |
| 10  | Provenance HEAD bind         | `docs/evidence/provenance.intoto.jsonl`            |
| 11  | Fleet production SLO         | `docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json`  |
| 12  | Soundcheck dual attestation  | `docs/assurance/SOUNDCHECK_DUAL_ATTESTATION.md`    |
| 13  | ATO-lite NIST packet         | `docs/assurance/ATO_LITE_NIST.md`                  |
| 14  | Incident honesty ledger      | `docs/evidence/INCIDENT_LEDGER.jsonl`              |

### Additional mandatory commands (2026-11-16 remediations)

```bash
node scripts/verify-supply-chain.mjs   # provenance commitSha MUST equal git rev-parse HEAD
npm run fleet:dogfood
npm run fleet:slo
npm run incident:drill
```

## Anti-self-certification rules

- Do not accept MCP narrative alone as accreditation.
- Require independent re-run of gates above with captured stdout.
- Any claim of `NSA_GRADE` / `AEROSPACE_CERTIFIED` / federal ATO without external letter is **REJECT**.
- Soundcheck 100 alone is **INTERNAL_SOUNDCHECK** until `SOUNDCHECK_DUAL_ATTESTATION.md` is satisfied.
