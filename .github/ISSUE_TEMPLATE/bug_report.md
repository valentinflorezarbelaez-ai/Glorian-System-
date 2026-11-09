---
name: Bug Report
about: Report a defect in a core engine, CLI, MCP server, or CI pipeline
title: "[bug]: "
labels: ["bug", "triage"]
---

## Summary

<!-- One or two sentences describing the unexpected behavior. -->

## Reproduction

<!-- Minimal, deterministic steps. No external network or wall-clock dependence (Law VII). -->

1. Run `node bin/eos.mjs ...`
2. Observe ...

## Expected

<!-- What should have happened? -->

## Actual

<!-- What actually happened? Include the exit code and relevant output. -->

## Environment

- **Node.js**: <!-- `node -v` -->
- **OS**: <!-- e.g. Windows 11 / Ubuntu 24.04 -->
- **Glorian System version**: <!-- `git describe --tags` or commit hash -->

## Law Violation (if applicable)

<!-- If this bug represents a violation of one of the 7 Inviolable Laws, name it. -->

- [ ] Law I — No deployment authority without local evidence
- [ ] Law II — No secrets in source control
- [ ] Law III — No external runtime dependencies
- [ ] Law IV — Read-only fleet boundary
- [ ] Law V — Zero production runtime dependencies
- [ ] Law VI — Cryptographic receipt for every quality assertion
- [ ] Law VII — Deterministic, reproducible local verification
