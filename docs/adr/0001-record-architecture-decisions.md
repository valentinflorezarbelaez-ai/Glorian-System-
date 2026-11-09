# ADR 0001: Record Architecture Decisions

Date: 2026-11-06
Status: Accepted

## Context

Glorian System is a complex engineering platform with ~200 Layer-0 modules,
formal TLA+ specifications, and a 7-stage SecDevOps pipeline. Architectural
decisions are currently scattered across `ARCHITECTURE-S0.md`, `DESIGN.md`,
governance steering files, and commit messages. This makes it hard for new
contributors to understand _why_ decisions were made, not just _what_ was
decided.

## Decision

We adopt **Architecture Decision Records (ADRs)** following the
[Michael Nygard template](https://github.com/joelparkerhenderson/architecture_decision_record).

Each ADR is a single Markdown file in `docs/adr/` numbered sequentially:
`NNNN-short-title.md`. The ADR is committed to the repository — it is the
durable record of the decision, its context, consequences, and alternatives
considered.

### ADR Lifecycle

| Status     | Meaning                                      |
| ---------- | -------------------------------------------- |
| Proposed   | Draft ADR, not yet reviewed                  |
| Accepted   | Reviewed and approved; decision is active    |
| Deprecated | Superseded by a later ADR                    |
| Superseded | Replaced by ADR-NNNN (reference the new ADR) |

### When to Write an ADR

- Adding a new Layer-0 engine or changing the module isolation contract
- Changing the CI/CD pipeline structure (adding/removing a gate stage)
- Adopting or removing a tooling dependency (even devDependencies)
- Changing the testing strategy (e.g., adding a new test runner)
- Modifying the security model (e.g., CSP, auth, supply chain)
- Any decision that future developers will need to understand the _why_ of

### ADR Template

```markdown
# ADR NNNN: <short title>

Date: YYYY-MM-DD
Status: Proposed | Accepted | Deprecated | Superseded

## Context

<!-- What is the issue? What constraints exist? What forces are at play? -->

## Decision

<!-- What we decided to do. Be specific and actionable. -->

## Consequences

<!-- Positive: what we gain. Negative: what we lose. Neutral: what changes. -->

## Alternatives Considered

<!-- What else did we look at? Why was it rejected? -->
```

## Consequences

- **Positive**: Decisions are durable, searchable, and reviewable. New
  contributors can trace _why_ a choice was made without reading commit history.
- **Negative**: One more file to maintain per architectural change.
- **Neutral**: ADRs are append-only — a superseded ADR is marked, not deleted.

## Alternatives Considered

1. **Not documenting decisions** — rejected: tribal knowledge doesn't scale.
2. **Wiki/Confluence** — rejected: external to the repo, drifts from code.
3. **Commit messages only** — rejected: hard to discover, no structure.
