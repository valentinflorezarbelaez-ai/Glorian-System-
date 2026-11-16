# ATO-Lite — NIST-aligned readiness packet (Glorian)

<!-- Epistemic: ATO_LITE_WITHIN_TESTED_SCOPE · NOT FEDERAL_ATO · NOT FedRAMP · NOT Level-5 -->

## Purpose

Give government / consortium auditors a **plain-English** starter package that maps Glorian controls to NIST SP 800-53 families without claiming an Authority to Operate.

## System boundary

- **In scope**: Glorian control plane (Layer-0 Node), MCP stdio/HTTP allowlisted tools, 9 registered fleet production URLs on Vercel.
- **Out of scope**: Multi-region SRE, air-gapped national deploy, classified networks, personnel clearance.

## Roles (bus factor ≠ 1 target)

| Role                       | Duty                                    | Current state                                  |
| -------------------------- | --------------------------------------- | ---------------------------------------------- |
| System Owner               | Accept risk, authorize Level 2/3 writes | Named owner in IMPLEMENTATION_AUTHORIZATION.md |
| Builder / EngProd          | Spec → code → tip-seal                  | Agent + owner                                  |
| External IV&V Verifier     | Re-run packet; VETO power               | Packet ready; human seat open                  |
| On-call                    | Incident one-pager + rollback           | `docs/runbooks/INCIDENT_ONE_PAGER.md`          |
| Security Officer (interim) | Secret scan, IAM deny-by-default        | Automated gates + owner                        |

**Gap (honest)**: single-human owner remains the residual bus-factor risk until a second named IV&V verifier is recorded in `docs/assurance/EXTERNAL_IVV_EXECUTION_RECEIPT.md`.

## Control map (selected)

| NIST family | Glorian control                               | Evidence                                        |
| ----------- | --------------------------------------------- | ----------------------------------------------- |
| CM-2/CM-3   | OpenSpec + freeze pin + tip-refresh           | `docs/releases/EOS_FREEZE_GATE_STATUS.md`       |
| SA-10/SA-11 | SBOM + SLSA provenance bound to HEAD          | `docs/evidence/provenance.intoto.jsonl`         |
| SI-2/SI-10  | Secret scan D1–D4, input bounds, SSRF shield  | `npm run secret-scan`                           |
| AC-2/AC-3   | MCP IAM call gate fail-closed                 | SPEC-184 / `eosMcpIamCallGate`                  |
| AU-2/AU-6   | SQLite WAL ledger + incident ledger           | `.eos/` + `docs/evidence/INCIDENT_LEDGER.jsonl` |
| CP-2/CP-9   | Incident one-pager + Vercel rollback          | `docs/runbooks/INCIDENT_ONE_PAGER.md`           |
| CA-2/CA-7   | External IV&V packet + continuous local gates | `docs/assurance/EXTERNAL_IVV_AUDITOR_PACKET.md` |
| RA-3/RA-5   | Threat model below + Dependabot policy        | this file + `DEPENDABOT_MAJOR_POLICY.md`        |

## Threat model (concise)

1. **Prompt/tool abuse via MCP** → mitigated by IAM gate + schema fuzz + mutation allowlist.
2. **Secret exfiltration in commits/UI** → secret-scan fail-closed; Law VI no plaintext.
3. **Supply-chain drift** → CycloneDX + provenance HEAD bind; `verify-supply-chain.mjs`.
4. **Fleet sibling compromise** → Law IV external write barrier; registry authorization levels.
5. **Single-owner key loss** → residual risk; require second IV&V seat before FEDERAL_ATO claims.

## Forbidden documentation practices

- Absolute machine paths (`C:\Users\...`) in committed evidence (Law VI).
- Self-certifying `FEDERAL_ATO`, `NSA_GRADE`, or Level-5 labels.
- Soundcheck 100 without external IV&V attestation field.

## Exit criteria toward a real ATO track

1. Named external verifier completes `EXTERNAL_IVV_AUDITOR_PACKET.md` with signed receipt.
2. Independent pen-test summary filed under `docs/assurance/` (scope: MCP + production URLs).
3. Bus-factor ≥ 2 for on-call + IV&V.
4. Continuous monitoring of fleet production SLO receipts for ≥ 30 days.
