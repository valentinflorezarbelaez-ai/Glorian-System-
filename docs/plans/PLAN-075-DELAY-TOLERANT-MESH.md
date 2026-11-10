# PLAN-075: Delay-Tolerant Networking & Opportunistic Bundle Protocol Engine

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-190, CHANGE-075

## 1. Architectural Strategy

Implement `src/core/eosDelayTolerantMesh.ts`:

1. **Bundle Structure**: In-memory map indexing stored bundles by `bundleId`, containing source, destination, creation timestamp, TTL, payload string/binary, and SHA-256 payload digest.
2. **Custody Engine**: Tracks current custodian and emits custody transfer receipts with SHA-256 signatures.
3. **Opportunistic Router**: Evaluates peer contact events, matches pending bundles destined for the contact or general epidemic forwarding, and generates sync envelopes.
4. **Anti-Entropy Manifest Sync**: Exchanges bundle ID sets and SHA-256 digest trees to request only unheld bundles.
5. **Garbage Collection**: Prunes expired bundles (`Date.now() > creationTimestamp + ttlMs`) deterministically.
