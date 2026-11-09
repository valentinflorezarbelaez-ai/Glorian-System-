# Independent Verification & Validation (IV&V) Playbook — Peak Assurance

**Audience**: External human auditor (NASA IV&V style: BUILDER != VERIFIER)  
**System**: Glorian / EOS Control Plane (`eos-system`)  
**Epistemic rule**: Builder artifacts are inputs; verifier must re-run commands and refuse narrative-only claims.

## 1. Preconditions

1. Clean git tree on `main` (or release tag).
2. Node.js >= 24.
3. Working directory = repository root.

## 2. Mandatory Re-execution (Verifier)

```bash
npm run typecheck
node bin/eos.mjs turbo
npm run mcp:verify
node scripts/verify-supply-chain.mjs
node scripts/verify-formal-tla.mjs
npm run verify:strict
node --test test/eosPeakAssuranceTcb.test.mjs
node scripts/eos-peak-assurance-adversarial.mjs
```

All must exit **0**. Capture stdout hashes into the binder.

## 3. Receipt Checklist

| Artifact     | Path                                        |
| ------------ | ------------------------------------------- |
| SBOM         | `docs/evidence/sbom.cdx.json`               |
| Provenance   | `docs/evidence/provenance.intoto.jsonl`     |
| SARIF        | `docs/evidence/local-checks.sarif`          |
| Wave A EVD   | `docs/evidence/EVD-SPEC-146-WAVE-A.json`    |
| Wave B EVD   | `docs/evidence/EVD-SPEC-146-WAVE-B.json`    |
| Wave C EVD   | `docs/evidence/EVD-SPEC-146-WAVE-C.json`    |
| NIST map     | `docs/assurance/NIST_800_53_CONTROL_MAP.md` |
| Binder index | `docs/evidence/assurance-binder/INDEX.md`   |

## 4. Anti-Self-Certification

- Do not accept `eos_military_shield_audit` alone as accreditation.
- Require independent re-run of gates above.
- Any claim of `NSA_GRADE` / `AEROSPACE_CERTIFIED` / federal ATO without external letter is **REJECT**.

## 5. Pass Criteria for HIGH_ASSURANCE_CANDIDATE

- TCB BDD-410..415 PASS
- Formal `McpStreamableSecurity` simulation PASS
- NIST subset coverage >= 80% with 0 GAP on AC/IA/SC TCB rows
- Adversarial campaign: 0 critical unfixed
- Fleet soundcheck quorum authorized; control plane A+ when tree clean
