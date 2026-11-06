# BASE SPECIFICATION: SAFE AGENT HARNESS BOUNDARIES (SPEC-022)

## 1. Scope
Defines local MCP and agent-factory boundaries for untrusted tool arguments, repository context, filesystem writes, fleet checkout selection, and the optional Docker command runner. This specification does not claim a model-driven autonomous coding loop or microVM isolation; the Docker runner relies on the local engine and host kernel.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL treat MCP arguments and repository metadata as untrusted, validate their runtime types, and enforce byte limits before processing.
- **UBIQUITOUS**: THE SYSTEM SHALL enable write or force behavior only when the corresponding JSON boolean is exactly `true`; strings and other truthy values SHALL NOT authorize mutations.
- **UBIQUITOUS**: THE SYSTEM SHALL resolve local read and write targets through real paths and keep them inside the configured project or selected repository boundary.
- **EVENT-DRIVEN**: WHEN Fleetshift creates a catalog file, THE SYSTEM SHALL require one selected registered Git checkout whose `origin` matches its registered remote, and SHALL create only a missing regular file without replacing an existing file.
- **EVENT-DRIVEN**: WHEN the healer applies a proposal, THE SYSTEM SHALL re-check that every target still matches the diagnosed content, stage all valid proposals before replacement, replace each file atomically, and report conflicts or partial completion explicitly.
- **UBIQUITOUS**: THE healer SHALL cap a source file at 1 MiB, a full scan at 2,000 files and 50 MiB, and SHALL create unique evidence receipts without overwriting earlier records.
- **UBIQUITOUS**: THE SYSTEM SHALL keep Honk plan-only, bound directive sizes, and mark user-provided text and repository metadata as untrusted data in generated context.
- **UBIQUITOUS**: THE MCP stdio server SHALL reject requests larger than 1 MiB before JSON parsing and SHALL NOT return stack traces in JSON-RPC errors.
- **EVENT-DRIVEN**: WHEN the local sandbox is invoked, THE SYSTEM SHALL require a non-primary registered Git worktree, a local Linux Docker Engine with seccomp and cgroup v2, and a locally available image pinned by digest; it SHALL fail closed when any precondition is missing.
- **EVENT-DRIVEN**: WHEN a command runs in the sandbox, THE SYSTEM SHALL disable networking, use a read-only container root, drop capabilities, enable no-new-privileges, run as a non-root UID, apply CPU/memory/process/time bounds, and expose only a filtered temporary workspace copy.
- **EVENT-DRIVEN**: WHEN sandbox results are copied back, THE SYSTEM SHALL require explicit apply mode and successful command exit, reject symbolic links, and report baseline conflicts; it SHALL not claim multi-file transactional atomicity.
- **EVENT-DRIVEN**: WHEN a sandbox run finishes, THE SYSTEM SHALL attempt to record metadata outside the repository without storing raw command arguments and SHALL report when receipt creation fails.
- **EVENT-DRIVEN**: WHEN the Honk GitHub workflow runs, THE SYSTEM SHALL require manual dispatch from `main`, use read-only repository permissions, avoid persisted checkout credentials, and redact untrusted task text and repository metadata from logs; it SHALL NOT commit, push, or open pull requests.
- **UBIQUITOUS**: THE CI inventory scanner SHALL skip symlinks and special files and SHALL enforce configured file-count and byte limits before reading repository contents.
- **UBIQUITOUS**: THE SYSTEM SHALL describe the current tools by their actual scope and SHALL NOT imply model orchestration, microVM isolation, or autonomous deployment where those capabilities do not exist.

## 3. Invariants
- A tool description is not an access-control boundary; server-side runtime checks enforce its limits.
- A string such as `"false"` cannot enable a write or forced deletion.
- A registered project ID alone is not proof that a local checkout is the matching repository.
- Repository metadata and user specifications may contain prompt-injection text and remain data, not agent policy.
- Plan generation does not create branches, run tests, or open pull requests.
- An MCP error does not disclose a JavaScript stack trace.
- The sandbox is not a microVM and does not isolate against Docker daemon or host-kernel vulnerabilities; workspace size is enforced by a polling watchdog and may briefly overshoot.
