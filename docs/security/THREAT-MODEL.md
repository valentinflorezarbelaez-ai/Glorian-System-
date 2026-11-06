# Threat Model

Scope: the Glorian System control plane (`src/`), its MCP tool surface, the local verification
pipeline, and the public landing sites. This model lists threats and the controls that exist in
the repository today; it is not an accreditation claim.

## Assets

- Control-plane source and tool contracts (`src/`, `docs/contracts/`).
- Fleet registry and per-repository authorization levels (`docs/projects/registry.json`).
- The append-only ledger and its SHA-256 chain receipts.
- CI integrity: workflow definitions, pinned actions, SARIF and provenance receipts.
- Public sites: HTML, bundles, and deployment configuration.

## Trust boundaries

1. Developer workstation → MCP server (stdio) and stream server (local HTTP).
2. Browser → static landing site and edge headers.
3. CI runner → GitHub Actions and the package registry.
4. Control plane → governed fleet repositories and hosting providers.

## STRIDE

| Threat | Scenario | Control | Evidence |
|---|---|---|---|
| Spoofing | A client reaches the MCP stream server from outside the machine | Local binding, origin allowlist, JSON-RPC contract validation | `src/mcp/eosMcpStreamServer.ts`, MCP schema suite |
| Tampering | A malicious workflow action changes behavior silently | Actions pinned to 40-hex SHAs; no floating tags | BDD-267, BDD-269, code-hygiene ratchet |
| Tampering | Tool arguments traverse outside the workspace | Paths resolve against `EOS_PROJECT_ROOT`; traversal rejected | BDD-128 (`test/eosTier0GentlemanSynergy.test.mjs`) |
| Repudiation | A change or release cannot be traced | Append-only ledger, SARIF receipts, in-toto provenance, source-inventory digest | Stage 7, `scripts/verify-supply-chain.mjs` |
| Information disclosure | A secret is committed or shipped to the browser | Secret scan in stage 1, SRI in stage 2, CSP and security headers, redacted planning output | `verify-cicd-pipeline.mjs`, `vercel.json`, `eos-honk-agent.yml` |
| Denial of service | A runaway tool or query exhausts the host | Subprocess quotas and fail-closed timeouts, adaptive concurrency and load shedding, hang guards in tests | BDD-225, BDD-226, SPEC-112 |
| Elevation of privilege | A tool or job exceeds its authority | Least-privilege workflow permissions, job timeouts, core/full tool profiles, Law IV gating | Workflows, BDD-140, `eosMcpToolCatalog.ts` |
| Elevation of privilege | A destructive shell command executes via an agent tool | Deny-list for destructive patterns | Prometheus suite (BDD-021) |

## Out of scope

- Compromise of the developer OS, the GitHub platform, or the hosting provider.
- A malicious maintainer with repository admin rights.
- Cryptographic review of the ledger hash or attestation schemes.
- External penetration testing or formal certification.

## Residual risks

1. **Repository settings are manual.** Branch protection, required status checks, secret-scanning
   push protection, and Dependabot alerts must be enabled in GitHub settings.
2. **Local provenance is self-attested.** `scripts/eos-generate-sbom.mjs` produces unsigned local
   receipts; CI adds GitHub OIDC attestation only on `main` pushes.
3. **Monolithic MCP server.** `src/mcp/eosMcpServer.ts` remains large, which raises review cost
   for changes in that file; the hygiene ratchet freezes its growth.
4. **Broad product surface.** Many demo subsystems share the control plane; security review must
   follow the data, not the module count.

## Review cadence

Revisit this model when a trust boundary, a workflow permission, or a public deployment target
changes. Security fixes follow [SECURITY.md](../../SECURITY.md).
