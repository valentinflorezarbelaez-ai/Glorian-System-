# CHANGE-075: Delay-Tolerant Networking & Opportunistic Bundle Protocol Engine

## Intent

Equip Glorian System with Delay-Tolerant Networking (DTN) store-and-forward architecture inspired by SpaceX Starlink/Mars deep-space communications and Palantir edge data mesh, allowing asynchronous bundles to traverse intermittent, degraded, or high-latency network partitions with guaranteed custody transfer under zero runtime npm dependencies.

## Scope

- SPEC-190 + `src/core/eosDelayTolerantMesh.ts`
- Barrel export in `src/core/index.ts`
- Subpath export `"./dtn"` in `package.json`
- Verification suite in `test/eosDelayTolerantMesh.test.mjs`

## Non-goals

- No physical radio/satellite hardware driver bundled
- No unbounded memory or disk leak (enforced bundle TTL and capacity bounds)
- Zero external runtime npm dependencies (`dependencies: {}`)

## Status

APPROVED — owner directive to implement SpaceX/Palantir disconnected resilience.
