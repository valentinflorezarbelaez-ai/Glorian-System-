# OPENSPEC BASE SPECIFICATION: XIRP-GRADE WORKTREE ISOLATION (SPEC-003)

## 1. Scope

Defines physical filesystem isolation for concurrent multi-agent software engineering.

## 2. Requirements (EARS)

- **EVENT-DRIVEN**: WHEN an autonomous agent initiates a task, THE SYSTEM SHALL provision an isolated Git Worktree in `.worktrees/<taskId>`.
- **UBIQUITOUS**: THE SYSTEM SHALL ensure parallel agent branches do not overwrite, lock, or corrupt the primary working directory.
- **EVENT-DRIVEN**: WHEN a task completes or is aborted, THE SYSTEM SHALL atomically remove the worktree and prune Git metadata without leaving orphan locks.

## 3. Acceptance Criteria (BDD)

```gherkin
SCENARIO: Provision and Inspect Isolated Agent Worktree (BDD-028)
  GIVEN an active git repository with multiple tasks
  WHEN the worktree orchestrator inspects the worktree list
  THEN the primary main worktree is identified and its clean status is verified
  AND isolated worktrees can be enumerated with HEAD commit hashes.

SCENARIO: Guard Primary Root and Prune Worktrees (BDD-029)
  GIVEN a request to remove the primary repository root
  WHEN the orchestrator attempts removal
  THEN the orchestrator rejects the deletion with an explicit invariant error
  AND safe pruning of expired worktree references succeeds cleanly.
```
