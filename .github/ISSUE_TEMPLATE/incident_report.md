---
name: Incident Report
about: Report a production incident or near-miss for blameless postmortem
title: "[P0/P1/P2]: "
labels: ["incident", "triage"]
---

## Incident Summary

**Severity**: P0 (total outage) / P1 (major degradation) / P2 (minor) / P3 (cosmetic)
**Impact**: Who/what is affected and blast radius
**Started**: YYYY-MM-DD HH:MM UTC
**Detected by**: Alert name / user report / dashboard
**Duration**: N minutes

## What Happened

<!-- Factual timeline. No blame — system names, not people names. -->

## Current Status

- [ ] Incident is ongoing
- [ ] Mitigation applied (system is functional but root cause not fixed)
- [ ] Fully resolved

## Impact Metrics

| Metric                | Value |
| --------------------- | ----- |
| Users affected        |       |
| Requests failed       |       |
| Error rate peak       |       |
| Latency p99 peak      |       |
| Error budget consumed |       |

## Related

- Postmortem: <!-- link to docs/postmortems/YYYY-MM-DD-*.md -->
- Alert: <!-- link to alert definition -->
- PR that caused it: <!-- link -->
- PR that fixed it: <!-- link -->
