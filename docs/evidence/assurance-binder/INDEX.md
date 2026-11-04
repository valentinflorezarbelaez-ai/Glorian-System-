# Assurance Binder Index (Wave B)

Continuous evidence pack for external IV&V. Paths are relative to repository root.

| Slot | Artifact | Role |
|---|---|---|
| B-01 | `docs/evidence/sbom.cdx.json` | CycloneDX SBOM |
| B-02 | `docs/evidence/provenance.intoto.jsonl` | in-toto SLSA provenance |
| B-03 | `docs/evidence/local-checks.sarif` | Static/local check SARIF |
| B-04 | `docs/evidence/fleet-audit.sarif` | Fleet audit SARIF |
| B-05 | `docs/assurance/NIST_800_53_CONTROL_MAP.md` | Control coverage map |
| B-06 | `docs/assurance/IVV_PLAYBOOK.md` | Auditor re-run protocol |
| B-07 | `docs/evidence/EVD-SPEC-146-WAVE-A.json` | Formal TCB seal |
| B-08 | `docs/evidence/EVD-SPEC-146-WAVE-B.json` | NIST binder seal |
| B-09 | `docs/evidence/EVD-SPEC-146-WAVE-C.json` | Adversarial + tip-seal |
| B-10 | `docs/formal/McpStreamableSecurity.tla` | TCB formal model |
| B-11 | `docs/releases/EOS_FREEZE_GATE_STATUS.md` | Ladder / freeze SSOT |
| B-12 | `docs/evidence/EVD-SPEC-147-WAVE-A.json` | PDO Connect seal |
| B-13 | `docs/evidence/EVD-SPEC-147-WAVE-B.json` | PDO Gates seal |
| B-14 | `docs/evidence/EVD-SPEC-147-WAVE-C.json` | PDO Dogfood + tip-seal |
| B-15 | `docs/products/demo-ledger-mvp/` | Hermetic Golden Path dogfood |

**Binder rule**: Verifier regenerates B-01..B-04 via scripts before trusting timestamps.
