# Dual IV&V Seat Handoff — Absolute-Max W4

Epistemic: `HANDOFF_READY_WITHIN_TESTED_SCOPE` · builder ≠ human verifier still open until signature.

## Purpose

Raise bus-factor ≥ 2 for Soundcheck dual attestation without self-certifying from the builder agent.

## Seat A (System Owner — prepared)

- Packet: [`EXTERNAL_IVV_AUDITOR_PACKET.md`](EXTERNAL_IVV_AUDITOR_PACKET.md)
- Preflight: [`../evidence/IVV_OWNER_PREFLIGHT_20261116.md`](../evidence/IVV_OWNER_PREFLIGHT_20261116.md)
- Receipt sign-off: [`EXTERNAL_IVV_EXECUTION_RECEIPT.md`](EXTERNAL_IVV_EXECUTION_RECEIPT.md) (`READY_FOR_OWNER_SIGNATURE`)
- Tip under test: re-run `git rev-parse --short HEAD` at signature time

## Seat B (Independent human / org — required)

| Field             | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Status            | **VACANT — nominate by 2026-12-15**                                                         |
| Role              | Independent verifier (not the coding agent that authored the tip)                           |
| Minimum gates     | Packet gates 1–10 in `EXTERNAL_IVV_AUDITOR_PACKET.md`                                       |
| Attestation class | `EXTERNAL_ORG` preferred; `OWNER_ATTESTATION` alone ≠ dual Soundcheck production A+         |
| Deliverable       | Signed block in `EXTERNAL_IVV_EXECUTION_RECEIPT.md` + tip SHA match (± tip-refresh lag ≤ 2) |

## Forbidden claims until both seats sign

`EXTERNAL_SOUNDCHECK_OK`, `FEDERAL_ATO`, `NSA_GRADE`, Level-5, multi-region SRE certification.
