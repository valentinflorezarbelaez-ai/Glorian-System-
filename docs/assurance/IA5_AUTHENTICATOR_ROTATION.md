# IA-5 Authenticator Management — Fleet Index (Glorian Control Plane)
<!-- Epistemic: WITHIN_TESTED_SCOPE · Law VI · NIST SP 800-53 IA-5 · not Level-5 -->

## Purpose

Control-plane index for authenticator rotation across the AUTHORIZED fleet.
Operational detail for TaskFlow lives in the satellite runbook; this file keeps the NIST control map path resolvable inside `eos-system`.

## Primary satellite (Crud-slack / TaskFlow)

Canonical rotation procedure (fail-closed `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, server-only API keys):

- Path (fleet checkout): `../Crud-slack/docs/assurance/IA5_AUTHENTICATOR_ROTATION.md`
- Registry id: `crud-slack`
- Production URL: `https://crud-slack.vercel.app`

### Rotation checklist (operator)

1. Generate secret with CSPRNG (`crypto.randomBytes`); never commit plaintext.
2. Update host secret store (Vercel env); redeploy.
3. Invalidate sessions / bump cookie name if required.
4. Verify health + OAuth bootstraps without pasting secrets into chat or git.
5. Re-run `eos_spotify_audit` / secret-scan on Crud-slack after change.

## Control-plane authenticators

| Surface | Mechanism | Rotation |
| --- | --- | --- |
| MCP Streamable HTTP | Ephemeral bearer + session binding (SPEC-140) | Restart / new token; no long-lived plaintext in repo |
| Law VI secret scan | `scripts/eos-secret-scan.mjs` | Fail-closed on D1–D4 hits |
| Supply chain | SBOM + tip-seal provenance | `npm run tip-seal` after release commits |

## Evidence

- NIST map row IA-5 → this index + Crud-slack runbook
- Crud-slack remediation HEAD (see satellite git log for `10ee18f` Law VI wave)
- External human IV&V still required for any accreditation narrative (`docs/assurance/IVV_PLAYBOOK.md`)

## Non-claims

Not federal ATO · not NSA_GRADE · not proof that production secrets were rotated on a given calendar day without operator attestation.
