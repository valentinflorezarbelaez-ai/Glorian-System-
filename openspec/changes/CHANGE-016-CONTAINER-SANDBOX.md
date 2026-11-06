# OPENSPEC CHANGE PROPOSAL: BOUNDED LOCAL CONTAINER SANDBOX (CHANGE-016)

## 1. Metadata
- **Status**: `IMPLEMENTED_UNVERIFIED`
- **Authorization**: Local repository changes requested by the project owner; no commit, push, image pull, or deployment performed.
- **Impacted Specs**: `SPEC-003`, `SPEC-022`
- **Modules Targeted**:
  - `src/core/eosContainerSandbox.ts`
  - `bin/eos.mjs`
  - `package.json`
  - `README.md`

## 2. Description
Add an opt-in Docker command runner for a registered non-primary Git worktree. Require a local Linux container engine with the built-in seccomp profile, cgroup v2 with resource controllers, plus a locally available digest-pinned image. Stage a bounded copy outside the repository from tracked and non-ignored files; omit Git internals and common credential locations. Run offline with a read-only root, dropped capabilities, no-new-privileges, non-root UID, memory/CPU/process/time/file-size limits, and a polled workspace size budget. Default to discarding output; explicit `--apply` writes successful command output back after symlink, path, and baseline-conflict checks. Keep per-run metadata under the local user home and omit raw command arguments. Document that container isolation is defense in depth, not microVM isolation or a multi-file transaction.

## 3. Acceptance Criteria
- Missing Docker, remote Docker contexts, unavailable seccomp/cgroup v2, unpinned or absent images, primary checkout paths, and unregistered worktrees fail closed.
- Container arguments are passed without a host shell; the container receives no network, host environment, Git metadata, Docker socket, or common secret directories.
- CPU, memory, process count, command duration, per-file size, file count, and a polled workspace size budget have configured bounds.
- Changes are discarded unless apply is explicitly enabled and command exit status is zero.
- Apply mode rejects symlink output and reports conflicts when source files no longer match the initial snapshot.
- Run metadata is written outside the checkout without raw command arguments; a receipt-write failure is visible in the report.
- JavaScript syntax and whitespace checks pass. Docker execution and full test suites are not run as part of this change verification.
