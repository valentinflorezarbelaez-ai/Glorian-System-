# PLAN-046: Native GitHub Actions PR Gate & Check-Runs Attestation Bot

## Architecture Decision Record: ADR-059
- **Title**: Native GitHub Actions Check-Runs Client & Fail-Closed Pre-Merge Barrier
- **Status**: ACCEPTED
- **Context**: EOS requires automated enforcement in GitHub Pull Requests without relying on third-party marketplace actions that might leak repository source or tokens.
- **Decision**:
  1. Implement `EosGithubPrGate` in `src/core/eosGithubPrGate.ts` using Node's native `node:https`, `node:fs`, and `node:crypto`.
  2. Implement an official GitHub Actions workflow in `.github/workflows/eos-gate.yml` running on `ubuntu-latest` with Node 24.
  3. Format Check-Run objects matching GitHub's `POST /repos/{owner}/{repo}/check-runs` specification with rich Markdown text.
  4. Block merge whenever `EosContractEvolutionGovernor` detects breaking contractions or any of the 7 SecDevOps stages fails.
  5. Scribe every PR gate verification into the durable SQLite WAL ledger.
- **Consequences**:
  - Full Tier-0 enterprise CI/CD integration with 0 external npm dependencies.
  - Fail-closed security prevents broken interfaces or vulnerable PRs from merging.
