# PLAN-203: Architecture & ADRs for `SPEC-341` Metamorphic, Differential & Structural-Shrinking Blind-Spot Hunter

## Architecture Summary

`EosMetamorphicDifferentialBlindSpotCore` (`src/core/eosMetamorphicDifferentialBlindSpot.ts`) enforces Constitutional Law V (zero runtime npm dependencies) using deterministic seeded Mulberry32 generation, recursive AST/JSON value shrinking, differential execution oracles, metamorphic transformation invariance checks, and bounded HTTP/JSON-RPC fuzzing harnesses.

## Architectural Decision Records

### ADR-203-001: Zero-Dependency Recursive JSON Tree Shrinking Over External `fast-check`

- **Decision**: Implement seeded `generateArbitraryJsonValue` and recursive `shrinkJsonValue` directly in Layer-0 TypeScript using `Mulberry32`.
- **Rejected Alternative**: Installing `fast-check` as an npm runtime or dev runtime engine dependency for core auditing.
- **Rationale**: Preserves zero third-party runtime dependencies, keeps core behavior callable natively inside CLI, MCP tools, and mutation-gated tests, and guarantees reproducible hashes.

### ADR-203-002: Structural Comparison via Canonical JSON Normalization + Safe Serialization

- **Decision**: Compare differential outputs and JSON round-trips using canonical sorted-key serialization with safe handling for `-0`, `NaN`, `Infinity`, and cyclic references.
- **Rejected Alternative**: Raw `JSON.stringify` or strict reference equality `===`.
- **Rationale**: Preserves semantic distinction between `-0` and `+0` or non-finite values while comparing object/array values deterministically regardless of key insertion order.

### ADR-203-003: Dual-Mode Handler Boundary Fuzzing (Direct + HTTP Status Guard)

- **Decision**: Model fuzz targets cleanly as `(payload: unknown) => Promise<{ statusCode: number; body?: unknown }> | { statusCode: number; body?: unknown }` so any synchronous core parser, MCP server dispatcher, or serverless route adapter can be bombarded with `500+` inputs in-process without socket port flakiness.
- **Rejected Alternative**: Spawning external OS HTTP server listeners for every campaign.
- **Rationale**: Eliminates ephemeral port collisions on Windows CI while exercising the exact request-validation and serialization paths of `/api/mcp.js` and `EosMcpServer`.
