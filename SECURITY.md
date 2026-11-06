# Security Policy

## Supported versions

Security fixes target the latest `main` and the current major release line. The project requires Node.js 22 or newer.

## Reporting a vulnerability

Do not open a public issue for a vulnerability.

1. Use GitHub's private vulnerability reporting (Security → Advisories → Report a vulnerability) in this repository.
2. If private reporting is unavailable, email the maintainer at valentinflorezarbelaez@gmail.com with a minimal reproduction, affected path, and impact.

Please include the affected commit, the command or endpoint involved, and whether the issue requires local access.

## Response expectations

This is a single-maintainer project, so targets are best effort:

- Acknowledgement within 3 business days.
- Triage and severity assessment within 7 business days.
- Fix or documented mitigation for critical issues within 30 days.

## Scope

In scope:

- The Node.js CLI (`bin/eos.mjs`), core modules under `src/core/`, and the MCP servers under `src/mcp/`.
- The Vercel deployment configuration and HTTP handlers under `api/`.
- CI workflows and release scripts.

Out of scope:

- Simulated or bounded demonstration features explicitly labelled as simulations.
- Vulnerabilities that require a compromised local machine, leaked credentials, or disabling documented safeguards.
- Reports without a reproducible impact.

## Security design

- Zero runtime npm dependencies (`dependencies: {}`).
- Secret scanning runs in the local gate and in CI.
- GitHub Actions are pinned to full commit SHAs.
- CodeQL SARIF results are uploaded from the CI gate.
- The repository must never contain plaintext credentials; use environment variables or the platform secret store.
