# Fleet

Fleet identity source of truth: [projects/registry.json](projects/registry.json).

Useful local commands (control plane):

```bash
npm run fleet:audit
npm run fleet:scorecards
```

The System entity for the mesh is `eos-sovereign-mesh`. Fleet Component stubs live in [backstage/fleet-components.yaml](backstage/fleet-components.yaml) until sibling repos land their own `catalog-info.yaml`. Default Soundcheck posture remains `CONTROL_PLANE_ONLY`. Ownership: [ownership.md](ownership.md).
