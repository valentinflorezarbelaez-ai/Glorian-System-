# Operations Runbook

Operational procedures for the Glorian System control plane and the repositories it governs.
Every command runs locally; no step requires production credentials unless explicitly marked.

## 1. Golden signals

| Signal | Command | Expected |
|---|---|---|
| Local health and memory telemetry | `node bin/eos.mjs health` | Exit 0, memory report printed |
| Fleet quorum and endpoint inventory | `npm run fleet:mission` | `Quorum: N/N` and registry seal |
| Telemetry dashboard | `node bin/eos.mjs dashboard start --port 4321` | `/api/telemetry`, `/api/ledger`, `/api/topology` respond 200 |
| Ledger chain integrity | `node bin/eos.mjs ledger` | Chain intact, SHA-256 receipt emitted |
| Repository gate | `npm run verify:strict` | 7/7 stages pass |

The dashboard binds an ephemeral port when `--port 0` is passed; prefer that in shared or CI
environments. `EosTelemetryDashboard.DEFAULT_PORT` is 4321 and must not be hard-coded in tests.

## 2. CI is red on `main`

1. Reproduce locally: `CI=true npm run verify:strict`.
2. Identify the failing stage in the output; stages are numbered 1/7 through 7/7.
3. For test-only failures, run the affected file directly:
   `node --test test/<suite>.test.mjs`.
4. Inspect `docs/evidence/local-checks.sarif` for machine-readable findings.
5. Do not weaken assertions to pass a build. Fix the fixture, the hermeticity, or the product
   behavior. Wall-clock ceilings are hang guards, not SLAs; performance budgets belong in the
   benchmark suite.

## 3. Coverage and hygiene regressions

- Coverage floor: `npm run test:coverage`. The committed floor lives in
  `scripts/coverage-baseline.json`. Raise it after improving coverage; never lower it to pass.
- Code hygiene ratchet: `npm run hygiene`. Line ceilings and `any` budgets live in
  `scripts/code-hygiene-baseline.json`. Raise a budget only with an architecture decision record.

## 4. Deployment and rollback

Production landing sites deploy through Vercel from `main`. Before merging:

1. `npm run verify:strict` is green.
2. `npm run test:coverage` is green.
3. SARIF evidence is uploaded by the `EOS Repository CI` workflow.

Rollback uses the hosting provider's immutable deployment history:

- CLI: `vercel rollback <deployment-url>` (or the dashboard's "Promote to Production").
- Verify after rollback: `curl -sS https://<domain>/` and `npm run fleet:mission`.

Never force-push `main` to undo a release. Revert the offending commit with a new commit so the
audit trail and SARIF receipts remain intact.

## 5. Fleet repository incidents

- Inventory and health: `npm run fleet:audit`, then `npm run fleet:mission`.
- Autonomous verification: `npm run fleet:verify`.
- Isolated remediation: `npm run worktree` (or `node bin/eos.mjs worktree`) to operate in a
  throwaway worktree without touching the developer's checkout.

## 6. Secret exposure

1. Run `npm run secret-scan` to confirm scope and rotation needs.
2. Revoke and rotate the credential at the provider first; assume the value is public.
3. Remove it from history only after rotation; treat history rewriting as a separate,
   reviewed operation.
4. Follow the reporting path in [SECURITY.md](../../SECURITY.md) for anything customer-facing.

## 7. MCP control plane

- Start: `npm run mcp` (stdio) or `npm run mcp:stream` (SSE, port 3333).
- Health: `GET /health` and `GET /status` on the stream server.
- Path confinement: tool arguments resolve against `EOS_PROJECT_ROOT`, never the caller's CWD.
  Traversal outside the workspace must be rejected; regression coverage lives in
  `test/eosTier0GentlemanSynergy.test.mjs` (BDD-128).

## 8. Escalation

Use GitHub private security advisories for vulnerabilities and the issue tracker for operational
defects. Attach command output, timestamps, and the relevant SARIF or ledger receipt — never raw
credentials or customer data.
