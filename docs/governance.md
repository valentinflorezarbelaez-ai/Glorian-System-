# Governance

Control-plane governance pointers for TechDocs (Backstage `techdocs-ref: dir:.`).

- **Spotify-only north star:** [governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md](governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md)
- **Layer-0 dependency policy:** keep `@backstage/*` and all portal runtime deps **outside** `src/core/` (`dependencies: {}`)
- **Canonical merge gate:** `npm run verify:strict` → `node bin/eos.mjs verify`
- **Backstage operator notes:** [backstage/README.md](backstage/README.md)
- **Ownership (squad / tribe):** [ownership.md](ownership.md)

This page is curated navigation — not a second constitution. Formal EARS/BDD specs live under `openspec/specs/`.
