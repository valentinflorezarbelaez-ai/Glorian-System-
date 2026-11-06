# ADR-0001: Zero External Runtime Dependencies

- Status: Accepted
- Date: 2026-10-26
- Deciders: Valentín Flórez Arbeláez

---

## Context

The EOS System must be deployable to Vercel Edge Functions and any Node.js 22+
environment without an `npm install` step. External runtime dependencies introduce:

- **Supply chain risk** — each transitive package is a potential compromise vector.
- **SLSA violations** — provenance cannot be guaranteed for third-party packages
  that are fetched at deploy time.
- **Bundle size bloat** — Edge Functions have tight size constraints; large
  dependency trees exceed those limits.
- **Version drift** — semver ranges allow silent behavioral changes between
  environments.

The system must remain fully functional from a bare Node.js 22+ runtime and must
be deployable as a standalone artifact with no external network calls required at
startup.

---

## Decision

All functionality is implemented using **Node.js built-in modules only**
(`node:crypto`, `node:fs`, `node:path`, `node:http`, `node:stream`, etc.).

The `"dependencies": {}` field in `package.json` is a **CI-enforced invariant**:
the `check-no-runtime-deps` gate in the sovereign CI/CD pipeline (Stage 1) fails
the build if any key is present under `dependencies`.

`devDependencies` (TypeScript types, test harnesses) are permitted because they
are never bundled into the runtime artifact.

---

## Consequences

**Positive:**
- Zero supply-chain attack surface at runtime.
- SLSA Level 4 provenance is achievable because the build is fully reproducible
  from first-party source.
- Instant cold-start on Vercel Edge Functions — no module resolution overhead.
- `npm install --omit=dev` produces an empty `node_modules/` in production.

**Negative / Trade-offs:**
- Higher implementation cost for features that would otherwise be one `require()`
  away (e.g., JWT verification, YAML parsing, schema validation).
- Developers must implement or vendor utility logic that the ecosystem provides
  for free in other projects.
- Onboarding friction for contributors who expect a conventional dependency tree.

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| **Express.js** | Framework coupling; would require bundling and violates the zero-dep invariant. Edge deployment incompatible. |
| **axios** | External HTTP client; `node:fetch` (Node 22 built-in) covers all required use cases with no added package. |
| **lodash** | Utility belt; every required function is implementable with native ES2022+ array/object methods. |
| **zod** | Schema validation library; a lightweight `eosKernelPrimitives.ts` validator covers internal contracts without the 12 kB footprint. |
| **jsonwebtoken** | JWT library; replaced by `node:crypto` HMAC/RSA primitives already present in the kernel. |
