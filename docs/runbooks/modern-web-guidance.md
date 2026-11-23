# Modern Web Guidance (MWG) — Agentic Engineer Runbook

Google Chrome [Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance) is the preferred local standard for HTML/CSS and client-side JS in Glorian-System-. It lives as an **agent skill**, not a Layer-0 runtime dependency.

## Where it lives (outside Layer-0)

| Path                                          | Role                                                    |
| --------------------------------------------- | ------------------------------------------------------- |
| `.agents/skills/modern-web-guidance/SKILL.md` | Agent skill entrypoint (search → retrieve → disclose)   |
| `.agents/skills/modern-web-guidance/guides/`  | Offline guide corpus                                    |
| `skills-lock.json`                            | Pinned `GoogleChrome/modern-web-guidance` commit + hash |
| `.atl/skill-registry.md`                      | Discoverability for ATL / Judgment-Day / sub-agents     |
| `scripts/modern-web-guidance-gate.mjs`        | Fail-closed presence + Layer-0 isolation gate           |
| This runbook                                  | Human / agentic-engineer operating notes                |

**Law V:** `src/core/` and `package.json` `"dependencies"` stay empty (`dependencies: {}` / zero runtime deps). Do **not** add `modern-web-guidance` to `dependencies` or `devDependencies`.

## Install / refresh

```bash
npx -y modern-web-guidance@latest install
npm run mwg:gate
```

Install target: `./.agents/skills/modern-web-guidance` (universal Cursor / Amp / Cline / Codex skill layout). Review skill changes before committing.

**Prettier:** the skill tree is listed in `.prettierignore` (`.agents/skills/modern-web-guidance/**`) so `format:check` does not rewrite vendored upstream guides. Do not remove that ignore to “fix” formatting — refresh via the install command instead.

## Agent workflow (mandatory for UI / client JS)

1. **Search** (2–5 word action-oriented English query for one UI/platform capability):

   ```bash
   npx -y modern-web-guidance@latest search "<query>" --skill-version 2026_11_16-268fb9ea
   ```

2. **Retrieve** matching guide id(s):

   ```bash
   npx -y modern-web-guidance@latest retrieve "<id>"
   ```

3. Apply guidance (with Baseline fallbacks from the guide). Do not invent guide ids from memory after context compaction — re-run search/retrieve.
4. Disclose skill usage in the delivery response per `SKILL.md`.

**Do not trigger** for backend/SQL/CI/Docker/Go/Git-only work or trivial tooling renames.

## Browser support policy (Glorian default)

- **Baseline Widely available** features: safe without custom fallbacks.
- Features that are **not** Baseline Widely available: follow the guide's fallback recommendations unless a product owner records a stricter/looser policy in an ADR.
- Prefer zero new runtime npm packages for UI primitives when a platform API + progressive enhancement suffices (keeps Law V intact).

## Fail-closed gates

```bash
npm run mwg:gate                 # skill presence + Layer-0 isolation
npm run boundary:check           # src/core import boundary
npm run verify:strict            # includes MWG gate via verify-cicd-pipeline
```

If `mwg:gate` fails: restore the skill with the install command above; never “fix” by wiring MWG into `src/core/`.

## Agentic-engineer checklist

- [ ] Skill discoverable in `.atl/skill-registry.md`
- [ ] Compact rules injected for HTML/CSS/client-JS sub-agents
- [ ] `skills-lock.json` commit matches the installed tree
- [ ] No MWG package in `package.json`
- [ ] `npm run mwg:gate` and `npm run verify:strict` exit 0

## References

- Chrome docs: https://developer.chrome.com/docs/modern-web-guidance
- Upstream: https://github.com/googlechrome/modern-web-guidance
- Project skill: `.agents/skills/modern-web-guidance/SKILL.md`
