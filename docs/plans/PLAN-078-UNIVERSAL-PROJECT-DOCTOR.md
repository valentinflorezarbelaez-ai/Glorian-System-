# PLAN-078: Universal Project Doctor & SDLC Acceleration Engine

- **Owner**: Valentín Flórez Arbeláez (Architect & Owner)
- **Status**: APPROVED
- **Date**: 2026-11-10
- **Governed by**: SPEC-193, CHANGE-078

## 1. Architectural Strategy

Implement `src/core/eosUniversalProjectDoctor.ts`:

1. **Stack Fingerprinting**: Checks project root for indicators (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `CMakeLists.txt`, `pubspec.yaml`).
2. **5-Pillar Score Calculation**:
   - Pillar 1 (Security, 25 pts): Secret scans, `.gitignore` presence, locked lockfiles.
   - Pillar 2 (Testing & Quality, 25 pts): Test directory existence, test scripts in manifests.
   - Pillar 3 (CI/CD Automation, 20 pts): Workflow files in `.github/workflows/` or `.gitlab-ci.yml`.
   - Pillar 4 (Documentation & Specs, 15 pts): `README.md`, `LICENSE`, `CONTRIBUTING.md`, ADRs.
   - Pillar 5 (Build Hygiene, 15 pts): Dependency lockfile existence, typecheck/linter config.
3. **Workflow Generator**: Pure string templating producing hardened `.github/workflows/glorian-ci.yml` with matrix jobs, caching, and race condition flags tailored to the detected stack.
4. **CLI & MCP Binding**: Connects `glorian doctor [path]` and `eos_enterprise_workspace` with `action: "doctor"`.
