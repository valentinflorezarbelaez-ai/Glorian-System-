# BASE SPECIFICATION: LOCAL SDLC PLANNING TOOLS (SPEC-012)

## 1. Scope and capability status
The Spotify names are design references, not vendor integrations. This specification describes the current local planning and template features. EOS does not implement a model-driven coding agent, background healing loop, fleet-wide codemod runner, or production canary controller.

## 2. Requirements (EARS)
- **UBIQUITOUS**: THE SYSTEM SHALL run its local planning tools without external runtime package dependencies.
- **EVENT-DRIVEN**: WHEN Honk receives a task description, THE SYSTEM SHALL validate bounded input, inspect local metadata and candidate paths, and return a plan-only report; it SHALL NOT edit source code, create a branch, execute project tests, or open a pull request.
- **EVENT-DRIVEN**: WHEN Xirp context synchronization is explicitly requested, THE SYSTEM SHALL derive local context from repository metadata, label that metadata as untrusted, and report the files written.
- **EVENT-DRIVEN**: WHEN Fleetshift receives a migration request, THE SYSTEM SHALL produce a local plan by default. Its only current disk action is creation of a missing catalog file for one selected registered Git checkout whose `origin` matches the local registry, after explicit opt-in.
- **EVENT-DRIVEN**: WHEN a canary manifest is requested, THE SYSTEM SHALL generate a local data artifact; it SHALL NOT deploy a release, query production telemetry, or claim rollout verification.
- **UBIQUITOUS**: THE SYSTEM SHALL describe command and MCP results according to their actual local scope and SHALL distinguish planning from execution.

## 3. Invariants
- A generated task plan is not autonomous code generation or verification evidence.
- Static file inventories do not establish a dependency audit, fleet migration, or production health.
- Local manifest generation does not configure or control Flagger, Argo Rollouts, or a production cluster.
