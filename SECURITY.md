# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Glorian System, please report it
responsibly via GitHub's [private vulnerability reporting](https://github.com/valentin-florez-arbelaez/Glorian-System/security/advisories/new).

**Do NOT open a public issue for security-sensitive findings.**

## Scope

| Category                              | Covered |
| ------------------------------------- | ------- |
| Layer-0 core engine (`src/core/`)     | Yes     |
| MCP server (`src/mcp/`)               | Yes     |
| CLI binary (`bin/`)                   | Yes     |
| CI/CD pipeline (`.github/workflows/`) | Yes     |
| Dockerfile / K8s manifests            | Yes     |
| Documentation, specs, examples        | No      |

## Our Commitments

- Acknowledge receipt within **48 hours**.
- Provide a fix timeline assessment within **5 business days**.
- Coordinate responsible disclosure (maximum 90-day deadline).
- Credit researchers who responsibly disclose (upon request).

## Invariants (7 Inviolable Laws)

The runtime enforces architectural invariants at every gate:

1. **Law I** — No deployment authority without local evidence.
2. **Law II** — No secrets in source control (secret-scan gate).
3. **Law III** — No external runtime dependencies (Layer-0 purity).
4. **Law IV** — Read-only fleet boundary (no writes to sibling repos).
5. **Law V** — Zero production runtime dependencies.
6. **Law VI** — Cryptographic receipt for every quality assertion.
7. **Law VII** — Deterministic, reproducible local verification.

Violations of these laws are caught automatically by the 7-stage CI gate.
