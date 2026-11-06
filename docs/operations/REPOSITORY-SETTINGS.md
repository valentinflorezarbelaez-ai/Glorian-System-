# Repository Settings (Required)

These settings live in GitHub, not in the repository, so they cannot be enforced by the local gate.
Apply them once per repository and review them after any ownership change.

## Branch protection for `main`

Settings → Branches → protection rule for `main`:

- Require a pull request before merging.
- Require approvals: 1.
- Require review from Code Owners (`.github/CODEOWNERS`).
- Dismiss stale approvals when new commits are pushed.
- Require status checks to pass before merging, with these required checks:
  - `Core flow smoke (ubuntu-latest)`
  - `Full Node repository checks (22)`
  - `Full Node repository checks (24)`
  - `Coverage ratchet`
  - `Go example module tests and build`
  - `Rust example crate tests and build`
- Require branches to be up to date before merging.
- Do not allow force pushes.
- Do not allow deletions.

`EOS Strict Sovereign Gate` is a reusable workflow; if it is enabled as a required check, keep its
name stable because renaming it silently removes the requirement.

## Security features

Settings → Code security:

- Dependabot alerts: enabled (configuration in `.github/dependabot.yml`).
- Dependabot security updates: enabled.
- Secret scanning: enabled.
- Secret scanning push protection: enabled.
- Private vulnerability reporting: enabled (matches `.github/ISSUE_TEMPLATE/config.yml`).

## Actions

Settings → Actions → General:

- Allow only actions pinned to a full-length commit SHA (organization policy) or review every
  `uses:` change. BDD-269 fails the build when a workflow uses a floating tag.
- Workflow permissions: read repository contents by default; workflows widen explicitly per job.

## Verification

After applying, confirm that a draft pull request shows the required checks and that a direct push
to `main` is rejected. Record the date of the change in the operations log.
