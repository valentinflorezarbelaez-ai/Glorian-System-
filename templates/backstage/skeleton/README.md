# ${{ values.componentTitle }}

> Sovereign Tier-0 Component governed by Glorian System under the EOS Agent Constitution.

- **Component ID**: `${{ values.componentId }}`
- **System Domain**: `${{ values.systemDomain }}`
- **Owner**: `${{ values.ownerSquad }}`
- **Runtime**: `${{ values.runtimeLanguage }}`
- **Isolation Tier**: `${{ values.isolationTier }}`

## Golden Path Compliance

- Zero external runtime npm dependencies (`dependencies: {}`).
- Canonical gate: `npm run verify:strict` → `bin/verify.mjs` (deps empty + `node --test`).
- Agent stub: `AGENTS.md` (owner / system / gate pointers).
- CI: `.github/workflows/ci.yml` runs `verify:strict` on PR/push.
- Catalog: `catalog-info.yaml` + TechDocs (`mkdocs.yaml`).

```bash
npm install --include=dev
npm run verify:strict
```
