# AUDIT-DONACIONES-001: Control-Plane Fleet Baseline Audit

## 1. Audit Metadata

- **Audit ID**: `AUDIT-DONACIONES-001`
- **Project ID**: `donaciones`
- **Status**: `AUDIT_COMPLETE`
- **Epistemic State**: `AUDIT_EXECUTED` · `WITHIN_TESTED_SCOPE`
- **Date**: `2026-11-09`
- **Auditor plane**: Glorian control plane (read-only vs sibling; Law IV)

---

## 2. Evidence Collected

| Check                                                           | Result | Notes                                                                                |
| --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Remote                                                          | PASS   | `https://github.com/valentinflorezarbelaez-ai/Donaciones.git`                        |
| HEAD pin                                                        | PASS   | `2f45b0ab86c70e00066d6d442690c446942d3cf4`                                           |
| Static markers                                                  | PASS   | `index.html` + `vercel.json` present; no `package.json` (expected)                   |
| Security headers in `vercel.json`                               | PASS   | CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, Permissions-Policy           |
| Plaintext secret patterns in `index.html`/`app.js`/`styles.css` | PASS   | No `api_key` / `Bearer` / `sk-` matches in scanned sources                           |
| Production URL allowlist                                        | PASS   | `https://donaciones-drab.vercel.app` (`.vercel.app`)                                 |
| Fleet live probe (control plane `/api/fleet?probe=1`)           | PASS   | `productionProbe=HEALTHY` observed post-#614 tip                                     |
| Dogfood path                                                    | PASS   | After static checkout fix, `FLOW_INSPECT:donaciones` → `SUCCESS` with workspace root |

## 3. Residual Risks (not blockers for AUDIT_COMPLETE)

1. Intermittent local DNS resolution to `donaciones-drab.vercel.app` on some Windows resolvers — cron/CI probes remain source of truth.
2. Sibling may contain `.env.local` untracked — never ingest into control-plane commits (Law VI).
3. Authorization remains `LEVEL_1_READ_ONLY` until owner promotes after this audit + intake/spec seal — **no write barrier lift**.

## 4. Verdict

`AUDIT_COMPLETE` for control-plane onboarding hygiene. Does **not** certify donation product UX, payment integrity, or Level 2 write authorization.
