---
name: Feature Request
about: Propose a new Layer-0 core engine, CLI subcommand, or MCP tool
title: "[feat]: "
labels: ["enhancement", "triage"]
---

## Summary

<!-- One or two sentences describing the proposed feature. -->

## Motivation

<!-- Why is this needed? What problem does it solve? Reference a real scenario. -->

## Proposed Solution

<!-- High-level description of the implementation approach. -->

## Spec-Driven (Law I & II)

<!-- Big tech standard: features start with a formal spec, not code. -->

- [ ] I have drafted an OpenSpec (or will create one before implementation)
- [ ] The spec follows EARS syntax for functional requirements
- [ ] The spec includes BDD Given-When-Then acceptance scenarios

## Layer-0 Purity (Law V)

<!-- If this adds a new src/core/ module, it must have zero runtime deps. -->

- [ ] The implementation will use only native Node.js primitives
- [ ] No new `dependencies` will be added to `package.json`

## Affected Areas

- [ ] `src/core/` — Layer-0 engine
- [ ] `src/mcp/` — MCP server tool
- [ ] `bin/` — CLI subcommand
- [ ] `api/` — Vercel serverless function
- [ ] `scripts/` — CI/CD pipeline
- [ ] `test/` — test suite
- [ ] `docs/` — documentation
