# Governance

Control-plane governance pointers for TechDocs (Backstage `techdocs-ref: dir:.`).

- **Spotify-only north star:** [governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md](governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md)
- **Layer-0 dependency policy:** [governance/DEPENDENCY_POLICY_L0.md](governance/DEPENDENCY_POLICY_L0.md) — `dependencies: {}`; keep `@backstage/*` and all portal runtime deps **outside** `src/core/` (formal SoT: `openspec/specs/SPEC-002-HEXAGONAL-L0.md`)
- **Canonical merge gate:** `npm run verify:strict` → `node bin/eos.mjs verify`
- **Backstage operator notes:** [backstage/README.md](backstage/README.md)
- **Ownership (squad / tribe):** [ownership.md](ownership.md)

This page is curated navigation — not a second constitution. Formal EARS/BDD specs live under `openspec/specs/`.
