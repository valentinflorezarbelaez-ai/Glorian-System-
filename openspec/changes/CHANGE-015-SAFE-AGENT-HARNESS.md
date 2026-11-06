# OPENSPEC CHANGE PROPOSAL: SAFE AGENT HARNESS BOUNDARIES (CHANGE-015)

## 1. Metadata
- **Status**: `IMPLEMENTED_UNVERIFIED`
- **Authorization**: Local repository changes requested by the project owner; no commit, push, or deployment performed.
- **Impacted Specs**: `SPEC-003`, `SPEC-012`, `SPEC-020`, `SPEC-022`
- **Modules Targeted**:
  - `src/mcp/eosMcpServer.ts`
  - `src/core/eosAutonomousHealer.ts`
  - `bin/eos.mjs`
  - `src/core/eosSpotifyAgenticFactory.ts`
  - `api/fleet.js`
  - `src/core/eosFleetDispatcher.ts`
  - `scripts/fleet-autonomous-cicd.mjs`
  - `scripts/install-fleet-cicd-hooks.mjs`
  - `scripts/eos-jarvis-daemon.mjs`
  - `.githooks/pre-commit`
  - `.githooks/pre-push`

## 2. Description
Enforce strict boolean opt-ins for MCP writes and forced worktree removal; bound and incrementally limit MCP input; validate JSON-RPC tool argument shapes; suppress stack traces; and confine resource and project-file reads to resolved repository paths. Keep Honk as a bounded plan-only tool, label repository context as untrusted, and make generated context writes atomic. Make healer writes conflict-aware and atomic per file, with explicit partial-write reporting, input budgets, and unique receipts. Permit Fleetshift writes only for a single registered Git checkout with a matching origin, and create only a missing catalog file. Run the registered gate before explicit fleet shipping, confirm the registered remote, and connect installed hooks to the same gate. Replace the periodic JARVIS full-suite run and unconditional health claim with bounded, serialized checks and a timeout-controlled process-liveness probe.

## 3. Acceptance Criteria
- A non-boolean truthy MCP argument does not trigger scaffolding, context sync, environment copying, or forced worktree removal.
- An oversized MCP line is discarded before JSON parsing, and returned tool errors do not contain stack data.
- MCP resource and Honk metadata reads reject symlinks resolving outside the configured checkout.
- Honk inputs stay within their configured limits, and prompt-like metadata appears as fenced or escaped untrusted data.
- Healer apply mode rejects stale or unsafe targets, reports partial completion, replaces files atomically, and preserves distinct receipts.
- Fleetshift cannot write to an unregistered or mismatched checkout and cannot replace an existing catalog file.
- Fleet ship runs the selected repository's configured gate before staging or pushing; missing or mismatched preconditions fail before writes.
- JARVIS reports the result of each check, avoids overlapping cycles, and does not claim subsystem health from a process-liveness probe.
- JavaScript syntax, SRI, and whitespace checks pass. Full test suites and external ship operations are not part of this change verification.
