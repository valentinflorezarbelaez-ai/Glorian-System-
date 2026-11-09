# Blameless Postmortem Template

<!-- Google SRE standard (https://sre.google/sre-book/postmortem-culture/).
     Copy this file, rename to YYYY-MM-DD-incident-title.md, and fill in.
     The goal is to learn, not to blame. Every name in this document is a
     system name, not a person name. -->

## Incident Summary

| Field       | Value                                 |
| ----------- | ------------------------------------- |
| Date        | YYYY-MM-DD                            |
| Duration    | HH:MM to HH:MM (total: Nm)            |
| Severity    | P0 / P1 / P2 / P3 / P4                |
| Impact      | <who/what was affected, blast radius> |
| Detected by | <alert / user report / dashboard>     |
| Resolved by | <action that ended the incident>      |

## Timeline

All times in UTC. Keep it factual — what happened, when, and what we did.

| Time (UTC) | Event                                     |
| ---------- | ----------------------------------------- |
| HH:MM      | Alert fired: <alert name>                 |
| HH:MM      | On-call acknowledged                      |
| HH:MM      | Investigation started: <what was checked> |
| HH:MM      | Mitigation applied: <what was done>       |
| HH:MM      | Incident resolved                         |

## Root Cause

<!-- What caused this? Be specific about the mechanism, not the person. -->

## Contributing Factors

- Factor 1
- Factor 2
- Factor 3

## What Went Well

- Detection was fast (alert within N minutes)
- Mitigation was straightforward
- Communication was clear

## What Went Poorly

- Monitoring gap: <what wasn't monitored>
- Runbook was outdated/missing for <scenario>
- Escalation path was unclear

## Action Items

| #   | Action                         | Owner  | Priority | Ticket |
| --- | ------------------------------ | ------ | -------- | ------ |
| 1   | Add alert for <condition>      | @owner | High     | #XXX   |
| 2   | Update runbook for <scenario>  | @owner | Medium   | #XXX   |
| 3   | Add test for <edge case>       | @owner | High     | #XXX   |
| 4   | Fix the root cause in <module> | @owner | Critical | #XXX   |

## Lessons Learned

<!-- What should we remember for next time? -->

## Appendix

- Links to dashboards, logs, alerts, PRs, commits.
- Screenshots of the error/impact.
