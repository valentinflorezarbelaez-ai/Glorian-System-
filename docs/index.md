# Glorian System Control Plane

Sovereign deterministic control plane for AI-assisted engineering (formerly EOS System).

- **Component:** `eos-system-control-plane`
- **System:** `eos-sovereign-mesh`
- **Owner squad:** `group:glorian-control-plane-squad` · **Tribe:** `group:glorian-platform-tribe`
- **Canonical merge gate:** `npm run verify:strict` → `node bin/eos.mjs verify`
- **Layer-0 purity:** `src/core/` keeps zero external runtime dependencies
- **Frontend agent skill:** [Modern Web Guidance runbook](runbooks/modern-web-guidance.md) (`.agents/skills/modern-web-guidance/`, `npm run mwg:gate`)

This MkDocs tree is the control-plane **TechDocs** surface (`backstage.io/techdocs-ref: dir:.`): [Verify](verify.md), [Fleet](fleet.md), [Governance](governance.md), [Ownership](ownership.md). A full Backstage app host stays out of Layer-0 — see [Backstage integration notes](backstage/README.md).
