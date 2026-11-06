# Incident Response Policy

This policy applies to the Glorian System control plane, its public landing sites, and the fleet
repositories it operates. It is sized for a small team: one person may hold several roles, but the
roles and the sequence stay explicit.

## 1. Severity

| Severity | Definition | Response |
|---|---|---|
| SEV1 | Customer-facing outage, data loss, or confirmed secret exposure | Mitigate immediately, notify stakeholders, freeze deploys |
| SEV2 | Major feature unavailable or error budget exhausted | Mitigate within the same working day |
| SEV3 | Degraded performance or a single non-critical service down | Next working day |
| SEV4 | Cosmetic defect or internal tooling issue | Normal backlog |

When unsure, start one severity higher and downgrade after triage.

## 2. Roles

- **Incident Commander (IC)**: owns the timeline and decisions; does not debug.
- **Operations Lead**: runs mitigation commands from the [runbook](RUNBOOK.md).
- **Communications Lead**: posts status updates and owns the external message.
- **Scribe**: records timestamps, hypotheses, and actions in the incident issue.

## 3. Lifecycle

1. **Detect**: CI failure, fleet mission quorum drop, dashboard alert, or user report.
2. **Triage**: assign severity, open an incident issue, name the IC.
3. **Mitigate**: stop the bleeding first (rollback, disable the path, rotate the credential).
   Diagnosis can wait; restoration cannot.
4. **Communicate**: first update within 30 minutes for SEV1/SEV2, then at every material change.
5. **Resolve**: confirm golden signals are nominal and the gate is green before closing.
6. **Postmortem**: blameless review within five business days for SEV1/SEV2. Record contributing
   factors, detection gaps, and owned action items with dates.

## 4. Error budget policy

Service level objectives and multi-window burn-rate evaluation are implemented in
`src/core/eosMultiWindowSloGovernor.ts` and exercised by the SPEC-110 suite. The policy is:

- While the budget is healthy, feature work proceeds normally.
- When a burn-rate window fires, reliability work takes priority over new features until the
  budget recovers.
- When the budget is exhausted, only fixes, rollbacks, and reliability changes merge to `main`.
- Thresholds are code, not prose: change them through a reviewed commit and an ADR, never by
  editing a dashboard.

## 5. Evidence and secrecy

- Attach SARIF receipts (`docs/evidence/local-checks.sarif`), ledger receipts, and command output.
- Never paste credentials, tokens, customer payloads, or private keys into an incident issue.
- If a secret may have leaked, rotate it before investigating how it leaked.
- Security vulnerabilities follow the private advisory process in [SECURITY.md](../../SECURITY.md).

## 6. Postmortem template

```
## Summary
One paragraph: impact, duration, and current status.

## Timeline (UTC)
- HH:MM detected
- HH:MM mitigated
- HH:MM resolved

## Impact
Users, services, and data affected; error budget consumed.

## Contributing factors
Technical and organizational factors. No individual blame.

## What went well
Detection, tooling, or communication that helped.

## Action items
| Action | Owner | Due date | Tracking issue |
|---|---|---|---|
```
