# External IV&V Auditor Packet — Glorian / Eos-System

<!-- Epistemic: READY_FOR_EXTERNAL_HUMAN_IVV · WITHIN_TESTED_SCOPE · builder ≠ verifier -->
<!-- Forbidden outputs: NSA_GRADE · AEROSPACE_CERTIFIED · FEDERAL_ATO · Level-5 -->

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
node --test test/eosPlatformOpsCeiling.test.mjs test/eosControlPlaneHealthProbes.test.mjs
node bin/eos.mjs platform:ops
node bin/eos.mjs fleet:pulse
```

Optional (ops excellence, not accreditation blockers):

```bash
npm run fleet:cwv-static
npm run fleet:cwv-browser
# Java hire-signal (portable JDK ok):
# javac/java against labs/java-music-expression → PermissionGateSmoke PASS
```

## Binder checklist

| #   | Artifact                     | Path                                                           |
| --- | ---------------------------- | -------------------------------------------------------------- |
| 1   | Binder index                 | `docs/evidence/assurance-binder/INDEX.md`                      |
| 2   | Peak Assurance IV&V playbook | `docs/assurance/IVV_PLAYBOOK.md`                               |
| 3   | Platform ceiling checklist   | `docs/assurance/PLATFORM_IVV_CEILING_CHECKLIST.md`             |
| 4   | NIST IA-5 index              | `docs/assurance/IA5_AUTHENTICATOR_ROTATION.md`                 |
| 5   | SBOM                         | `docs/evidence/sbom.cdx.json`                                  |
| 6   | Provenance                   | `docs/evidence/provenance.intoto.jsonl`                        |
| 7   | Big Tech Max seal            | `docs/governance/BIG_TECH_MAX_SOFTWARE_DOCTRINE_2026-11-05.md` |

## Anti-self-certification rules

- Reject narrative-only PASS without terminal exit 0 capture.
- Reject any claim of NSA_GRADE / AEROSPACE_CERTIFIED / federal ATO without external letter.
- Verifier must record their own stdout hashes into a new EVD; do not reuse builder receipts as proof of independence.

## Handoff status

`READY_FOR_EXTERNAL_HUMAN_IVV` — packet complete within tested scope; **accreditation remains pending human verifier**.
