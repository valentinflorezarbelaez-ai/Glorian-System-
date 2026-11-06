# OPENSPEC CHANGE PROPOSAL: UNTRUSTED BROWSER DATA (CHANGE-013)

## 1. Metadata
- **Status**: `PROPOSED_AND_AUTHORIZED`
- **Authorization**: `LEVEL_3_PRODUCTION_AUTHORIZED`
- **Impacted Specs**: `SPEC-001`, `SPEC-020`
- **Modules Targeted**:
  - `js/eos.js`
  - `index.html`
  - `sw.js`
  - `scripts/verify-sri-integrity.mjs`
  - `docs/specs/spec.md`

## 2. Description
Close persistent DOM injection paths in the Akashic vault, Solar Sanctum, and evolution log by validating browser-storage record shapes and escaping dynamic values at their HTML rendering boundary. Escape the Akashic search query in its empty-result state. Invalid records are discarded while valid records remain available; malformed storage falls back to the feature defaults. Update the static asset integrity metadata and service-worker cache generation so clients receive the hardened script.

## 3. Acceptance Criteria
- **BDD-050**: User-controlled strings containing HTML are rendered as inert text in affected browser-backed features.
- Malformed or unexpected records from browser storage do not abort the page render.
- The initial experience and zero-dependency browser runtime remain unchanged for valid existing data.
