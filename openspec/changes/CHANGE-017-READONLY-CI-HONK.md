# OPENSPEC CHANGE PROPOSAL: READ-ONLY CI AND HONK PLAN (CHANGE-017)

## 1. Metadata
- **Status**: `IMPLEMENTED_UNVERIFIED`
- **Authorization**: Local repository changes requested by the project owner; no workflow was dispatched and no external write was performed.
- **Impacted Specifications**: `SPEC-012-SPOTIFY-AGENTIC-FACTORY.md`, `SPEC-022-SAFE-AGENT-HARNESS.md`
- **Modules Targeted**:
  - `.github/workflows/eos-honk-agent.yml`
  - `.github/workflows/eos-sovereign-cicd.yml`
  - `.github/dependabot.yml`
  - `bin/eos.mjs`
  - `scripts/verify-cicd-pipeline.mjs`
  - `package.json`

## 2. Description
Remove issue-comment execution and repository write permissions from Honk automation. Convert it to manual, read-only plan generation, pass directives through an environment variable, redact directive and metadata output, disable persisted checkout credentials, and remove commit/push/PR commands. Pin GitHub Actions to verified full commit SHAs and configure Dependabot to maintain action updates. Run repository CI on Node 22 and 24 with a bounded job timeout. Skip symlink/special-file entries and cap file count and byte volume in the repository inventory scanner. Correct package and workflow labels to describe implemented local capabilities.

## 3. Acceptance Criteria
- The Honk workflow runs only by manual dispatch from `main`; it has no `issue_comment` trigger, no write permissions, no persisted checkout credentials, and no commit, push, or PR steps.
- Untrusted workflow input is passed through an environment variable and redacted from logs.
- GitHub Actions dependencies use full commit SHAs and Dependabot checks for updates.
- CI checks Node 22 and Node 24 under a finite job timeout; the configured verification pipeline remains the source of checks.
- Repository scanning skips symbolic links and special files and fails before reading beyond its file/byte limits.
- JavaScript syntax, JSON, workflow structure, and whitespace checks pass. Full test suites and GitHub-hosted workflow runs are not executed during this local change.
