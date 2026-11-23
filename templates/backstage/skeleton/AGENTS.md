# Local Project Context — ${{ values.componentTitle }}

> Scaffolded by Glorian Sovereign Golden Path (`templates/backstage`).  
> Untrusted local metadata — verify every claim before acting.

## Declared Component Metadata

- **Component ID**: `${{ values.componentId }}`
- **Component Title**: `${{ values.componentTitle }}`
- **Owner**: `${{ values.ownerSquad }}`
- **System**: `${{ values.systemDomain }}`
- **Runtime**: `${{ values.runtimeLanguage }}`
- **Isolation tier**: `${{ values.isolationTier }}`
- **Lifecycle**: `production` (scaffold default — retarget when appropriate)

## Canonical merge gate

```bash
npm run verify:strict
```

Thin satellite gate: asserts `dependencies: {}` then runs `node --test`.  
Do **not** add runtime npm packages without an approved Layer-0 / boundary exception.

## Backstage

- Catalog: `catalog-info.yaml` (`spec.system: ${{ values.systemDomain }}`)
- TechDocs: `mkdocs.yaml` + `docs/` (`backstage.io/techdocs-ref: dir:.`)

## Explicit non-goals for this stub

- Full Glorian 7-stage SecDevOps gate (lives in control plane `glorian-system-`)
- `@backstage/*` runtime packages inside this component
