# Layer-0 Dependency Policy (`DEPENDENCY_POLICY_L0`)

<!-- Epistemic: POLICY_PUBLISHED · formal SoT remains SPEC-002 / SPEC-001 Law V · enforced by Stage 3 + boundary:check -->

**Purpose:** Short onboarding / agent-constitution pointer for Glorian/EOS Layer-0 purity.  
**This file does not invent rules.** Formal requirements live in OpenSpec; CI is the merge-gate truth.

## Source of truth (precedence)

| Layer | Artifact | Role |
| --- | --- | --- |
| 1 (formal) | [`openspec/specs/SPEC-002-HEXAGONAL-L0.md`](../../openspec/specs/SPEC-002-HEXAGONAL-L0.md) | EARS invariants: `dependencies: {}`, unidirectional hexagonal flow, fail-closed on domain third-party / UI imports, acyclic graph |
| 1 (constitution) | [`openspec/specs/SPEC-001-CONSTITUTION.md`](../../openspec/specs/SPEC-001-CONSTITUTION.md) Law V | Architectural purity commandment |
| 2 (measurable goal) | [`docs/goals/GOAL-L0-DEPS.json`](../goals/GOAL-L0-DEPS.json) | GDD: `runtime_dependencies_count == 0` |
| 3 (this policy) | `docs/governance/DEPENDENCY_POLICY_L0.md` | Human/agent discoverability only |

If this policy and SPEC-002 diverge, **SPEC-002 + the verify gate win**.

## Invariants (summary)

1. **Runtime npm inventory is empty:** root `package.json` MUST keep `"dependencies": {}` (zero external runtime packages).
2. **`src/core/` is fail-closed:** Layer-0 modules MAY import only:
   - Node.js builtins via the `node:` protocol (for example `node:crypto`, `node:fs`, `node:path`, `node:http`, `node:https`, `node:stream`, `node:url`, `node:events`, `node:net`, `node:child_process`, `node:v8`, `node:assert`, `node:os`, `node:buffer`, `node:util`, `node:worker_threads`); and
   - other modules under `src/core/`.
3. **Third-party / framework imports in `src/core/` are banned** (UI kits, HTTP frameworks, ORMs, vector DBs, agent SDKs, Backstage packages, Modern Web Guidance npm packages, etc.). Enforcement: `npm run boundary:check` → `scripts/import-boundary-gate.mjs`.
4. **Standard Web APIs** available on the Node/runtime host (for example `crypto.subtle`, `TextEncoder`/`TextDecoder`, `URL`, `AbortController`, `fetch` where the engine provides them) are allowed when they require **no** npm package.
5. **devDependencies** (eslint, prettier, typescript, `@types/node`, …) are tooling-only. They MUST NOT leak into `dependencies` or into Layer-0 import graphs. Unused-devDep hygiene: `npm run deps:check`.

## Supply-chain evidence pointers

| Artifact | Path / command |
| --- | --- |
| Lockfile / inventory SBOM (CycloneDX) | `docs/evidence/sbom.cdx.json` · `npm run sbom:gate` |
| Layer-0 SBOM | `docs/evidence/sbom.l0.cdx.json` |
| in-toto / SLSA provenance | `docs/evidence/provenance.intoto.jsonl` |
| Combined verifier | `node scripts/verify-supply-chain.mjs` (also reachable via deep/supply-chain scripts) |

Local `npm run verify:strict` Stage 3 asserts zero runtime deps; it does **not** by itself claim signed SLSA Level 3 attestation for external auditors — see `docs/specs/spec.md` honesty limits.

## Related gates (do not weaken)

- Canonical merge gate: `npm run verify:strict` → `node bin/eos.mjs verify` (Stage 3 runtime-deps + inventory digest).
- Import boundary: `npm run boundary:check`.
- Dependabot majors: [`DEPENDABOT_MAJOR_POLICY.md`](./DEPENDABOT_MAJOR_POLICY.md) (must not regress Layer-0).
- TechDocs / Backstage portal packages stay **outside** Layer-0 (see [`docs/governance.md`](../governance.md) and [`docs/backstage/README.md`](../backstage/README.md)).

## Acceptance (BDD sketch)

```gherkin
SCENARIO: Layer-0 dependency policy is discoverable and aligned
  GIVEN the repository tip includes docs/governance/DEPENDENCY_POLICY_L0.md
  WHEN an agent or contributor follows constitution citations to DEPENDENCY_POLICY_L0
  THEN the file exists and points to SPEC-002 as formal SoT
  AND package.json dependencies remains {}
  AND npm run boundary:check exits 0
```
