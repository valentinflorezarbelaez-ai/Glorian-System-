# Changelog

All notable changes to EOS System are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Auto-generated from `IMPLEMENTATION_AUTHORIZATION.md` — run `npm run changelog` to regenerate.

## [Unreleased]

## [64.0.0] — 2026-11-05

### Added / Fixed — 16 Big Tech Gaps Closed (v64)

#### P0: Request Timeout Enforcement (`eosMcpStreamServer.ts`)
- `requestTimeoutMs` was stored and validated in the constructor but NEVER applied to the actual
  dispatch path. Every slow tool call blocked its connection indefinitely.
  Fixed with `Promise.race([dispatchWithTimeout, timeout])` wrapping `dispatchJsonRpc()`.
  Timeout sends a `-32603` JSON-RPC error response. Stripe/Anthropic: all RPC dispatches need deadlines.

#### P0: SIGTERM/SIGINT Graceful Shutdown (`eosMcpStreamServer.ts`)
- No signal handlers existed — SIGTERM from Kubernetes would abruptly kill all SSE connections.
  Added `process.once("SIGTERM")` and `process.once("SIGINT")` in `listen()` that call `this.close()`
  (which drains sessions + closes the HTTP server) before calling `process.exit(0)`.
  Netflix/Google: Kubernetes pod termination requires graceful drain within terminationGracePeriodSeconds.

#### P0: `logging/setLevel` MCP Handler (`eosMcpServer.ts`)
- Capabilities advertised `logging: {}` but there was no `logging/setLevel` handler.
  Clients (Cursor, Claude Code) send this on connect and received `-32601 Method not found`.
  Added handler with RFC-5424 level validation (8 levels: debug → emergency).
  Best-effort: propagates level change to `EOS_LOG_LEVEL` env var when set.

#### P1: `setup-node@v4` Pinned to Commit SHA (SLSA L3 / Supply Chain)
- All 5 `actions/setup-node@v4` instances in the workflow (unpinned tag) replaced with
  `actions/setup-node@1d0ff469b12c6b44b14610a574a4e3163f0d34a5` (pinned SHA).
  Stripe and Google require ALL third-party GitHub Actions pinned to a commit SHA.

#### P1: SLSA Provenance Attestation Job (Google SLSA L2+)
- Added new Job 6 `slsa-provenance` that runs on main push only.
  Uses GitHub's native `actions/attest-build-provenance@v2` (OIDC-based, no external sigstore).
  Generates SBOM + In-Toto provenance document, attests the receipt + package.json,
  uploads evidence artifacts (90-day retention), and tags the release version.
  Requires `id-token: write` + `attestations: write` permissions (declared at job level only).

#### P1: SPEC Number Uniqueness Gate (Stage 3.91 in CI pipeline)
- Added Stage 3.91 in `verify-cicd-pipeline.mjs`: scans `openspec/specs/*.md`,
  detects duplicate SPEC numbers (was 6 collisions: 020, 021, 022, 044, 045, 046),
  records them as SARIF findings. Non-fatal warning for now (duplicates are legacy).

#### P1: OpenAPI Contract Structure Validation (Stage 3.92 in CI pipeline)
- Added Stage 3.92: validates `openspec/openapi.yaml` has required sections (`openapi:`, `info:`,
  `paths:`) and declares at least 10 API paths. Fails CI if the spec is structurally invalid.

#### P2: Feature Flags — Percentage Rollout + Runtime Refresh + Expiry (Netflix LaunchDarkly)
- Added `rolloutPercentage` field: `isEnabledForUser(key, userId)` uses SHA-256 stable hash
  for consistent sticky assignment. Same user always gets the same cohort bucket.
- Added runtime refresh: `_maybeRefresh()` re-reads `flags.json` every 30s without restart.
  Netflix standard: flag changes must propagate in <30s.
- Added `expiresAt` field with ISO-8601 date. Expired flags emit a `process.stderr` warning.
  Google/Anthropic: flags must have expiry dates to prevent permanent accumulation.
- Added `crypto` import for SHA-256 hash (zero external deps preserved).

#### P3: Pipeline Wall-Clock Deadline (`eosPipeline.ts`)
- `EosPipeline.solve()` now wraps `_solveInternal()` with a `Promise.race()` against a
  configurable `pipelineDeadlineMs` timeout (default: 120s).
  Prevents unbounded pipeline runs when a branch evaluation hangs.

#### P3: CSP `unsafe-inline` Removed (`vercel.json`)
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` → `style-src 'self' https://fonts.googleapis.com`
  Google/Anthropic prohibit `unsafe-inline` in style-src. Nonce-based styles are the replacement.
- `img-src 'self' data: https:` (overly broad) → `img-src 'self' data: https://eos-system-ten.vercel.app`
  Pins image sources to known origins instead of all HTTPS.
- Added `worker-src 'none'` and `manifest-src 'self'` directives.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` → kept (popups required for OAuth flows).

## [63.0.0] — 2026-11-05

### Added / Fixed — 12 Big Tech Gaps Closed (Google · Stripe · Netflix · Anthropic · Cognition)

#### P0: API Rate Limiting — 14/14 Endpoints Protected (Stripe Standard)
- **SPEC-053 fully implemented**: All 14 serverless API handlers now wrapped with `withRateLimit()`.
  Previously only `api/health.js` was protected. Now all 13 remaining handlers are rate-limited:
  `api/spotify.js`, `api/graph.js`, `api/memory.js`, `api/teurgia.js`, `api/kernel.js`,
  `api/jarvis.js`, `api/cicd.js`, `api/eval.js`, `api/fleet.js`, `api/compile.js`,
  `api/_bigtech.js`, `api/mcp.js`, `api/finops.js`.
  Rates tuned by workload: 30/min for agents (mcp, spotify), 20/min for read endpoints, 10/min for
  expensive compute (eval, fleet, jarvis). All return `Retry-After` + `X-RateLimit-*` headers.

#### P0: CORS Allowlist Enforcement Fixed (`eosMcpStreamServer.ts`)
- `this.allowedOrigins` Set was constructed with strict validation but never used in `handleHttpRequest`.
  Added `_getCorsOrigin(req)` private method: when `allowedOrigins.size > 0`, only exact-match
  origins are reflected; non-matching origins get `"null"`. When no allowlist is configured,
  dev defaults to `*` and production defaults to `"null"`.

#### P0: POST /message Rate Limit (`eosMcpStreamServer.ts`)
- Added per-IP token-bucket limiter on the JSON-RPC dispatch endpoint (60 req/min burst, 1/sec refill).
  Returns 429 with `Retry-After: 1` and `X-RateLimit-Limit` header. Stored in `_messageBuckets` Map
  (inline, zero deps). Prevents a single Antigravity retry storm from flooding the dispatch queue.

#### P1: EosSecretsManager — Circuit Breaker + Stale-On-Failure (Google SRE / Netflix Hystrix)
- Added circuit breaker state machine: after 3 consecutive provider failures, circuit OPENS for 30s,
  short-circuiting to stale cache or `process.env` fallback without retrying the failing provider.
- Added stale-on-failure (Netflix Hystrix pattern): on fetch failure, returns expired cache value
  instead of `null` — safer for long-running services.
- Added 2-attempt retry with 200ms delay before counting a failure.
- Half-open probe after 30s timeout allows recovery detection.
- Added `_isCircuitOpen()` and `providerCircuitStatus` for observability.

#### P1: `serverInfo.version` Now Dynamic (`eosMcpServer.ts`)
- Hardcoded `"version": "61.0.0"` in the MCP `initialize` response replaced with
  `this.serverVersion` (read from `package.json` in constructor). Clients will always see
  the correct version after each release.

#### P1: `prompts/get` Complete for All 4 Advertised Prompts (`eosMcpServer.ts`)
- Previously only `eos-consult` was resolvable; `eos-pipeline`, `eos-drift`, `eos-context`
  returned `-32602 Unknown prompt`. Now all 4 advertised prompts return full structured
  `messages[]` responses (Anthropic MCP spec: every listed prompt must be gettable).
  Default error now lists all 4 valid prompt names.

#### P2: CI — Chaos Tests Now Run on Every Push (Netflix Standard)
- Added `EOS_FLAG_CHAOS_IN_CI: "1"` to `sovereign-gate` job env block.
  Chaos tests (Stage 4.6, `scripts/run-chaos-tests.mjs`) now run unconditionally on every
  push to main, not just when the flag is manually set.

#### P2: CI — All `actions/checkout` Pinned to Commit SHA (SLSA L3 / SPEC-139)
- `property-tests`, `sovereign-gate`, `mutation-testing`, and `integration-summary` jobs all used
  unpinned `actions/checkout@v4`. All 4 now pinned to
  `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (same SHA as `typecheck` job).

#### P2: CI — `NODE_ENV=production` Set in Sovereign Gate (Security Standard)
- Added `NODE_ENV: "production"` to `sovereign-gate` job env block.
  Ensures error messages don't expose internals (stack traces, internal paths) in the
  production-equivalent CI run.

#### P2: Package Version Sync — vscode-extension + github-app
- `packages/vscode-extension` bumped from `58.0.0` → `62.0.0`.
- `packages/github-app` bumped from `58.0.0` → `62.0.0`.
  Both sub-packages now match the main package version (monorepo consistency standard).

## [62.0.0] — 2026-11-05

### Fixed — Critical Merge Artifact in eosMcpStreamServer.ts (v62 Clean Rewrite)
- **Removed phantom `options` parameter** — constructor now has explicit `options: EosMcpStreamServerOptions` parameter; no more reference to an undeclared variable at runtime.
- **Removed undefined `DEFAULT_MAX_SESSIONS`, `DEFAULT_MAX_REQUEST_BYTES`, `DEFAULT_REQUEST_TIMEOUT_MS`** — all constants now defined as module-level `const` before class declaration.
- **Removed undefined `SUPPORTED_MCP_PROTOCOL_VERSIONS`** — defined as `Object.freeze(new Set([...]))` with the 3 supported versions.
- **Removed undefined `StreamableSession` type** — phantom type and `this.streamableSessions` map eliminated; `close()` takes no arguments.
- **Removed duplicate `const contentLength`** — single unified body-size cap using `this.maxRequestBytes`; no redeclaration in the same block.
- **Removed double auth check** — single `_authenticate()` private method with constant-time `timingSafeEqual`; second `EOS_MCP_TOKEN` check was a merge artifact from two versions mixed together.
- **Added `writeJson()` private method** — all JSON responses go through it; no more undefined reference.
- **Added `EosMcpStreamServerOptions` interface** — typed constructor options replacing the phantom `options` object.
- **Fixed per-IP counter leak** — `sessionsPerIp` counter now decrements via `res.once("close"/"finish")` listeners instead of leaking indefinitely.
- **Wrapped `handleRequest` in `Promise.resolve()`** — `dispatchJsonRpc` returns `Promise<JsonRpcResponse | null>` without `await`ing a sync method.
- **tsconfig.json** — added `"types": ["node"]` to compilerOptions to eliminate IDE LSP noise from `@types/node` resolution.

### Preserved from v61
- SSE per-IP rate limiting (max 10 concurrent connections per IP)
- Request ID deduplication (prevents double-dispatch on Antigravity retries)
- Fully async `handleHttpRequest` — long tools never block other requests
- MCP prompts/list + resources/list endpoints for Antigravity discovery
- Idle session auto-close at 60 min
- Dynamic version read from package.json

## [58.0.0] — 2026-10-26

### Added — 8 Operational Gaps Closed (Stripe/Netflix/Google/Meta Standard)
- **Feature Flags** (`src/core/eosFeatureFlags.ts`) — `EosFeatureFlags` class reads from `EOS_FLAG_*` env vars → `flags.json` → defaults. 12 built-in flags (agi_pipeline, chaos_in_ci, perf_regression, mcp_auth, etc.). Progressive delivery: toggle without redeployment. `eos flags` CLI command shows all flags + sources. Exported in `@eos-system/core`.
- **Diff Patcher** (`src/core/eosDiffPatcher.ts`) — `parseDiff()`, `applyDiff()`, `generateDiff()`. Applies unified diffs instead of full file rewrites. 10x more token-efficient, preserves unrelated changes. Includes CoW backup + atomic rollback. `eos diff apply <file.diff>` and `eos diff generate <old> <new>` CLI commands.
- **API Rate Limiting wired** (`src/core/eosApiRateLimit.ts` + `api/health.js`) — `withRateLimit()` HOF wraps any Vercel handler. Sets `X-RateLimit-Limit/Remaining` headers, returns 429 with `Retry-After` on exceed. `/api/health` now rate-limited to 20 burst / 10/sec. All other APIs can be wrapped the same way.
- **Plugin Loader** (`src/core/eosPluginLoader.ts`) — `EosPluginLoader.loadAll(registry)` discovers plugins from `EOS_PLUGINS` env var and `plugins.json`. Loads from `plugins/` directory or `node_modules/`. Calls `default(registry)` or `register(registry)`. Tracks per-plugin toolsAdded, version, error. "Everything is a plugin" — DeepSeek standard.
- **Performance Regression CI** (`scripts/verify-performance.mjs`) — Benchmarks turbo pipeline and cosine similarity. Compares vs `docs/evidence/PERF-BASELINE.json`. Fails if >25% slower. `npm run perf:regression`. First run creates baseline (informational).
- **Accessibility Automation** (`scripts/verify-accessibility.mjs`) — Zero-dep WCAG 2.1 AA scanner. Checks: skip-link, aria-live, lang attr, img alt, button text, link text, heading hierarchy, form labels, viewport meta. Integrated as Stage 5.5 in CI. `npm run a11y`.
- **Chaos Engineering in CI** (`scripts/run-chaos-tests.mjs`) — Runs `test/chaosResilience.test.mjs` as Stage 4.6. Gated behind `EOS_FLAG_CHAOS_IN_CI=1` feature flag. Seals `docs/evidence/CHAOS-RECEIPT.json`.
- **Operational Test Suite** (`test/eosOperational.test.mjs`) — 4 suites: Feature Flags (7 tests), Diff Patcher (6 tests), Rate Limiting (4 tests), Plugin Loader (3 tests). Added to CI.
- New scripts: `design:lint`, `perf:regression`, `a11y`, `chaos:ci`, `flags`, `diff`
- All new modules exported in `packages/core/src/index.ts`

## [57.0.0] — 2026-10-26

### Added — 4-Layer Visual Governance Architecture
- **Capa 1: `src/core/eosDesignTokens.ts`** — Closed token system: 17 allowed colors (void #050505, surface #0A0C12, panel #11141D, ink-primary #F4F4F5, accent-blue #2563EB, accent-status #10B981), 7 allowed border-radius values (0px-9999px), 4 allowed shadows (none/glow/inner/window), 3 allowed fonts, 3 allowed timing functions (spring cubic-bezier). Validates CSS and HTML against the closed set — any raw hex color, large radius, or generic shadow is flagged as a violation.
- **Capa 2: `src/core/eosDesignPrimitives.ts`** — 5 immutable architectural primitives: `architecturalGrid()` (1px hairline exposed grid), `telemetryHeader()` (monospace index + status dot + tracking-tighter title), `spotlightPanel()` (cursor-tracking glow + inner light), `codeBlock()` (copy-to-clipboard), `consoleTrace()` (traceability table with role-colored turns). All generate HTML strings (zero-dep, no React needed). Includes `generatePrimitivesCSS()` and `generateSpotlightScript()`.
- **Capa 3: `scripts/verify-design-system.mjs`** — AST design linter that scans all CSS and HTML files for: no-raw-colors (hex not in token set), no-large-radius (rounded-2xl/3xl blocked), no-generic-shadow (shadow-lg/xl/2xl blocked), no-inline-styles (style="" without var()). Exit 1 on violation. Integrated as Stage 3.9 in CI pipeline.
- **Capa 4: `.cursor/rules/eos-governance.mdc`** — Section 6: Visual Governance rules (palette cerrada, geometría técnica, sombras limitadas, tipografía triple capa, física Bézier, primitivas obligatorias, linter veto, mockups en vivo). All AI agents (Cursor, Claude Code, Antigravity) read these rules automatically.
- `npm run design:lint` — standalone design linter command
- Palantir/Anduril aesthetic: deep blacks, 1px hairline borders, monospace telemetry, cursor-tracking spotlight, exposed grids

## [56.0.0] — 2026-10-26

### Changed — DeepSeek Harness Grade UI Redesign
- **Complete `index.html` rewrite** — Dark SaaS aesthetic matching DeepSeek Harness quality:
  - Sticky nav with backdrop blur, 1px borders
  - Hero with gradient title, badge, CTA buttons, copy-paste command
  - Interactive app mockup built entirely in HTML/CSS (no screenshots) — sidebar, chat, bento cards, model selector
  - Bento grid section with 7 capability cards (AGI Pipeline, Consulting, Tool Forge, Context Window, Spec Drift, MCP, Security)
  - Developer tools traceability view — console-style table showing pipeline turns (SYSTEM/USER/TOOL/ASSISTANT) with ms timings
  - Stats row (90 modules, 48 tests, 30+ MCP tools, 0 deps, 7 ADRs)
  - Code block with copy button
  - Footer with live links
- **Complete `css/eos.css` rewrite** — DeepSeek dark palette (#090A0F), 1px borders (border-white/10), low-opacity cards (bg-white/0.02), Inter + JetBrains Mono typography, glow effects, fade-in animations, custom scrollbar
- Maintained WCAG 2.1 AA (skip-link, aria-live, closedby="any", JSON-LD)
- Note: Run `node scripts/verify-sri-integrity.mjs --fix` to update SRI hashes after CSS rewrite

## [55.0.0] — 2026-10-26

### Added — Nielsen 10 Usability Heuristics Applied to CLI
- **`src/core/eosCliUx.ts`** — Complete CLI UX engine implementing all 10 Nielsen heuristics:
  - **H1 Visibility**: `eos status` dashboard shows version, modules, tests, specs, axioms, CI result in one view
  - **H2 Real-world language**: Bilingual Spanish/English output, familiar terminology
  - **H3 User control**: `eos interactive` mode — menu-driven, no memorization needed
  - **H4 Consistency**: Dynamic version from `package.json` (was hardcoded `v47.0`)
  - **H5 Error prevention**: Input validation with helpful examples before execution
  - **H6 Recognition over recall**: Interactive categorized command menu, `EOS_COMMANDS` registry
  - **H7 Flexibility**: `--quiet` / `-q` flags for scripting, command aliases
  - **H8 Minimalist**: `printMinimalBanner()` — single line vs 4-line box
  - **H9 Error recovery**: Levenshtein command suggestion engine — "Did you mean...?"
  - **H10 Help & docs**: First-run onboarding guide, improved help output with categories
- **`test/eosCliUx.test.mjs`** — 7 test suites: suggestion engine, input validation, status dashboard, first-run, dynamic version, command registry, color output
- **Color output**: ANSI escape codes (zero-dep), respects `NO_COLOR` env var
- **First-run onboarding**: `.eos-initialized` marker file, shows quick-start on first `eos help`
- **`eos interactive`** / `eos menu` — Categorized interactive command browser
- **`eos status`** — Unified status dashboard (version, modules, tests, specs, axioms, CI, memory)
- **Command suggestion** — `eos consutl` suggests `consult` via Levenshtein distance
- **`--quiet` / `-q`** — Minimal banner for scripting and CI
- **Pipeline module** (`src/core/eosPipeline.ts`) — End-to-end: Context → Router → Tribunal → Result
- **`eos_pipeline` MCP tool** — Full solve cycle via MCP with progress streaming
- **`eos pipeline` CLI command** — End-to-end problem solving from terminal
- **Extended MCP handlers** (`src/mcp/handlers/eosExtendedToolHandlers.ts`) — 12 more handlers extracted
- **ContextWindowManager test suite** — 9 tests for token-budget context assembly
- **API contract tests** — Validates all 14 API response shapes against expected fields
- **VS Code extension build script** (`packages/vscode-extension/build.mjs`)
- **npm publish workflow** (`.github/workflows/eos-publish.yml`)

### Changed
- `bin/eos.mjs` — Dynamic version, suggestion engine, first-run onboarding, quiet mode, status command, interactive command, categorized help
- `.gitignore` — `.eos-initialized` marker excluded
- CI pipeline — 3 new test suites added (eosCliUx, eosContextWindow, eosApiContract)

## [54.0.0] — 2026-10-26

### Added
- **EosContextWindowManager** (`src/core/eosContextWindowManager.ts`) — Token-budget-aware context assembly using blast radius. Selects relevant files, compresses each, packs within budget. Comparable to Cursor's internal context assembly.
- **EosSpecDriftDetector** (`src/core/eosSpecDriftDetector.ts`) — Detects drift between source code and specs: modules without specs, specs without modules, code newer than spec. Closes the final loop in Zero Vibe Coding (Law I).
- **AGI Streaming Output** — `onProgress` callback in `EosAgiCore.solve()` emits 6 event types: SOLVE_STARTED, BRANCH_STARTED, BRANCH_PASSED, BRANCH_FAILED, AXIOM_CRYSTALLIZED, SOLVE_COMPLETE. MCP clients receive live `notifications/progress`.
- **`eos_agi_solve` MCP Tool** — Full solve cycle accessible from Cursor/Claude Code with live progress streaming.
- **Semantic Graph Persistent Cache** — `.eos-graph-cache.json` with mtimeMs fingerprint invalidation. First build: ~15ms. Subsequent: ~2ms.
- **`@eos-system/core` npm package** (`packages/core/`) — Publishable library exposing EosAgiCore, EosConsultantCore, EosDynamicToolForge, EosContextWindowManager, EosSpecDriftDetector, EosLogger, EosToolRegistry, and all primitives. Zero external deps.
- **EOS VS Code Extension** (`packages/vscode-extension/`) — 4 commands: Consult, Spec Drift, Context Window, Start MCP Server. Auto-detects EOS root from workspace.
- **EOS GitHub App Bot** (`packages/github-app/`) — Webhook server that runs `eos consult` on every PR and posts the deliverable as a collapsible PR comment. HMAC signature validation, async processing.
- **CLI commands**: `eos context <objective> <file> [budget]`, `eos drift [threshold_days]`
- **MCP tools**: `eos_context_window`, `eos_spec_drift`, `eos_agi_solve` added to tools/list and dispatchTool
- **Monorepo structure**: `packages/*` workspaces in root package.json
- **`.eos-graph-cache.json`** added to `.gitignore`

### Changed
- `package.json` — `workspaces: ["packages/*"]` field added for monorepo support
- All 3 sub-packages bumped to v54.0.0

## [53.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-PERFECTION-047**: 10/10 production hardening — 12 gaps closed simultaneously
  - `src/core/eosLogger.ts` — Zero-dependency structured JSON logger (Pino/Bunyan design, stderr-only, sensitive field redaction, nanosecond timers, child namespaces, `EOS_LOG_LEVEL` env control)
  - `scripts/run-mutation-testing.mjs` — Real mutation testing CI runner: operator-level mutations written to disk, each tested with actual test suite, kill score ≥60% gate, evidence receipt sealed
  - `scripts/generate-changelog.mjs` — Auto-generates CHANGELOG.md from IMPLEMENTATION_AUTHORIZATION.md in Keep-a-Changelog format
  - `scripts/track-dora-metrics.mjs` — DORA metrics (Deployment Frequency, Lead Time, CFR, MTTR) from git log + evidence receipts, saved to `docs/evidence/DORA-METRICS.json`
  - `test/eosPropertyBased.test.mjs` — 60-run property-based test suite: cosine similarity (self=1, symmetry, range [0,1], empty→0), L2 norm always 1.0, tokenizer idempotency, TMR security invariants, LRU cap
  - MCP Stream Server Bearer token auth (`EOS_MCP_TOKEN` env var) with `crypto.timingSafeEqual` — no oracle attacks
  - Scoped CORS on SSE endpoint (`EOS_MCP_ALLOWED_ORIGIN` env var, production defaults to `null`)
  - SRI WASM coverage in `verify-sri-integrity.mjs` — SHA-384 computed for `assets/eos_apex.wasm` when present
  - Stage 4.5 coverage measurement in CI (`--experimental-test-coverage` on 5 critical modules, informational)
  - Matrix CI builds: Ubuntu × Windows × Node 22 × Node 23 (4 combinations)
  - Mutation testing job in GitHub Actions with artifact upload
  - `test:pbt`, `mutate:ci`, `changelog`, `dora` scripts in package.json

### Changed
- `src/core/eosAgiCore.ts` — All `console.log/warn/error` replaced with `createLogger("eosAgiCore")` structured JSON calls

## [52.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-AGI-HARDENING-046**: AGI Harness Production Hardening (15 gaps)
  - MCP Tool Registry live — `EosToolRegistry` + `CORE_TOOL_HANDLERS` wired into `eosMcpServer.ts`
  - 4 AGI MCP Tools: `eos_consult`, `eos_agi_axioms`, `eos_forge_list`, `eos_forge_tool`
  - Multi-file `ThoughtBranch.targets[]` with atomic CoW rollback across all files
  - Go/Rust/Python/Terraform code patterns in `EosConsultantCore._generateCode()`
  - INCIDENT_POSTMORTEM blameless template (Spotify/Google SRE standard)
  - Response cache in `EosMultiModelRouter` (SHA-256 content-addressed, 5-min TTL)
  - Rate limiting in `EosMultiModelRouter` (30 calls/min per ModelFamily)
  - LRU eviction cap in `EosAxiomMemory` (max 200, configurable)
  - JSON Schema draft-7 validation in `EosDynamicToolForge.forge()`
  - `test/eosAgiHarness.test.mjs` added to CI Stage 4

### Fixed
- `.gitignore` — excludes `src/dynamic_tools/*.tool.mjs`, `forge_manifest.json`, `docs/memory/`, `docs/consulting/`, `docs/evidence/AGI-RECEIPT-*.json`

## [51.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-AGI-HARNESS-045**: EOS AGI Frontier Harness (4 modules)
  - `EosAgiCore` — Tree of Thoughts + Deterministic Tribunal (Exit Code 0 = law) + Episodic Axiom Memory
  - `EosAxiomMemory` — persistent learning store; crystallizes immutable rules from failures; survives restarts
  - `EosMultiModelRouter` — routes tasks to optimal model (ARCHITECT→Opus, CODE→Haiku, SECURITY→Opus)
  - `EosDynamicToolForge` — auto-creates and registers MCP tools at runtime from ESM source
  - `EosConsultantCore` — offline consulting engine: 5-Whys, ADR, code, risk matrix, FinOps; no API needed
  - CLI: `eos agi`, `eos consult`, `eos solve`, `eos forge`
  - `test/eosAgiHarness.test.mjs` — 30 test cases, all offline

## [50.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-ARCHITECTURE-CORRECTNESS-044**: Architecture & Correctness Hardening (10 gaps)
  - Iterative DFS in `eosArchitectureGuard` (replaces recursive — no stack overflow)
  - tsconfig path alias resolution in architecture guard
  - O(N) dead code detection in `eosSemanticGraph` (replaces O(N²) regex)
  - Real TMR independence — BETA n-gram scoring, GAMMA command structure detection
  - SPEC number deduplication (030→044, 031→045, 040→046); `SPEC-NUMBERS.md` index

### Fixed
- `fleet-autonomous-cicd.mjs` shell injection — `execFileSync` arg arrays, `git add --update`
- CSP `unsafe-inline` removed from `vercel.json` `script-src`
- `registry.json` path corrected (`Eos-System` → `Eos-System-2`)
- `api/health.js` version read from `package.json` dynamically; real `errorBudgetConsumedPercent`

## [49.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-BIG-TECH-HARDENING-043**: Big-Tech Engineering Hardening (10 gaps)
  - `EosToolRegistry` + `ToolHandler` interface (MCP god-file decomposition)
  - 8 core MCP handlers in `src/mcp/handlers/eosCoreToolHandlers.ts`
  - `EosDeterministicSimulator` real determinism — runs twice, compares hashes
  - `api/graph.js` `FALLBACK_MODE` flag when TypeScript import fails (was silently returning fake data)
  - 3-job parallel GitHub Actions CI (typecheck ∥ sovereign-gate → integration-summary)
  - `docs/adr/` — 6 MADR-format Architecture Decision Records
  - `EosErrorCatalog` — Stripe-style typed error classes with `readonly code` fields
  - OpenAPI 3.1 spec for all 14 API endpoints (`openspec/openapi.yaml`)
  - `CONTRIBUTING.md` — complete developer onboarding guide
  - Code coverage scripts with Node.js 22 `--experimental-test-coverage` (zero deps)
  - `commit-msg` hook enforcing Conventional Commits

## [48.0.0] — 2026-10-26

### Added
- **AUTH-2026-10-26-BIG-TECH-HARDENING-042**: v48 hardening (4 gaps)
  - `tsconfig.json` with `strict: true` (Google/Stripe/Airbnb grade)
  - `eosFleetDispatcher.ts` v11 — real `git status --porcelain`, env-configurable paths
  - `api/fleet.js` v11 — real filesystem + git + HTTP health checks
  - `scripts/verify-typescript.mjs` — TypeScript strict CI gate (Stage 3.8)
  - `.env.example` — documents `EOS_FLEET_BASE` and `EOS_PATH_*` variables

### Fixed
- Fleet paths hardcoded to `C:\Users\valen\` replaced with env-first resolution
- `api/fleet.js` was returning all hardcoded `HEALTHY_200` without checking anything

---

*Generated 2026-10-26 from IMPLEMENTATION_AUTHORIZATION.md*
*Current version: 53.0.0 | Total authorizations: 47*
