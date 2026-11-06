# ADR-0005: Fleet Project Paths Resolved from Environment Variables

- Status: Accepted
- Date: 2026-10-26
- Deciders: Valentín Flórez Arbeláez

---

## Context

`eosFleetDispatcher.ts` originally contained hardcoded absolute paths such as:

```typescript
const FLEET_PROJECTS = {
  "eos-system-2":  "C:\\Users\\valen\\Eos-System-2",
  "apex-router":   "C:\\Users\\valen\\apex-router",
  "hermes-mesh":   "C:\\Users\\valen\\hermes-mesh",
};
```

These hardcoded paths caused multiple failure modes:

- **CI breakage** — GitHub Actions runners use Linux with a different filesystem
  layout; every fleet audit job failed with `ENOENT` errors.
- **Portability zero** — the fleet auditor was non-functional on any machine
  other than the primary development workstation (`C:\Users\valen\`).
- **Security smell** — absolute paths containing a username were committed to the
  repository, leaking filesystem layout in a public codebase.
- **Pair/review friction** — a collaborator or contractor could not run fleet
  operations without manually editing source code.

---

## Decision

Fleet project paths are resolved using a **four-level priority chain**:

```
Priority 1 (highest): EOS_PATH_<PROJECT_UPPER> env var
  e.g. EOS_PATH_EOS_SYSTEM_2=/workspace/Eos-System-2

Priority 2: EOS_FLEET_BASE env var + project directory name
  e.g. EOS_FLEET_BASE=/workspace → /workspace/Eos-System-2

Priority 3: OS home directory (node:os homedir()) + project directory name
  e.g. /home/runner/Eos-System-2 on Linux CI

Priority 4 (lowest): hardcoded default (development machine path, last resort)
  e.g. C:\Users\valen\Eos-System-2
```

Implementation in `eosFleetDispatcher.ts`:

```typescript
function resolveProjectPath(projectKey: string, defaultPath: string): string {
  const envKey = `EOS_PATH_${projectKey.toUpperCase().replace(/-/g, "_")}`;
  if (process.env[envKey]) return process.env[envKey]!;
  if (process.env.EOS_FLEET_BASE) {
    return path.join(process.env.EOS_FLEET_BASE, path.basename(defaultPath));
  }
  return path.join(os.homedir(), path.basename(defaultPath));
}
```

All environment variables are documented in `.env.example` with comments
explaining each variable's purpose and expected format.

CI pipelines set `EOS_FLEET_BASE` to `$GITHUB_WORKSPACE` (GitHub Actions) or
`$CI_PROJECT_DIR` (GitLab CI) via workflow environment blocks — no source code
changes required per environment.

---

## Consequences

**Positive:**
- Fleet auditor works correctly on any machine, CI runner, or container.
- No usernames or machine-specific paths committed to source control.
- Adding a new fleet project requires only updating `.env.example` and the
  project registry — no path hardcoding.
- CI configuration is the canonical source of truth for CI-specific paths.

**Negative / Trade-offs:**
- Developers must set up `.env` locally (one-time; documented in README).
- If `EOS_FLEET_BASE` is set incorrectly, all fleet paths are wrong simultaneously
  (mitigated by the per-project `EOS_PATH_*` override at Priority 1).
- The four-level chain adds cognitive overhead to debugging path resolution
  (mitigated by a `eos_fleet_debug_paths` MCP tool that prints resolved paths).

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| **Relative paths only** | Brittle; `cwd` at execution time varies between CLI invocation, MCP server launch, and CI job steps. |
| **Separate config file (`fleet.config.json`)** | Extra file to maintain, commit, and document; env vars are the industry standard for environment-specific configuration (12-factor). |
| **Always compute from `process.cwd()`** | Unreliable; the MCP server's `cwd` is the IDE working directory, which differs from the fleet project locations. |
| **Monorepo (all projects in one repo)** | Would eliminate the path problem but is architecturally incompatible with the multi-repo sovereign CI model. |
