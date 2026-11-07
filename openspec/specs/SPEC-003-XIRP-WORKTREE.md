# OPENSPEC BASE SPECIFICATION: XIRP-GRADE WORKTREE ISOLATION (SPEC-003)

## 1. Scope

Defines physical filesystem isolation for concurrent multi-agent software engineering.

## 2. Requirements (EARS)

- **EVENT-DRIVEN**: WHEN an autonomous agent initiates a task, THE SYSTEM SHALL provision an isolated Git Worktree in `.worktrees/<taskId>`.
- **UBIQUITOUS**: THE SYSTEM SHALL ensure parallel agent branches do not overwrite, lock, or corrupt the primary working directory.
- **EVENT-DRIVEN**: WHEN a task completes or is aborted, THE SYSTEM SHALL atomically remove the worktree and prune Git metadata without leaving orphan locks.
