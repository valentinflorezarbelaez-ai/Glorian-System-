# Glorian System (formerly EOS System)

EOS System is a repository of browser UI, Node.js command-line utilities, local analysis modules, and Vercel serverless routes for software-engineering workflows.

Some pages and endpoints are demonstrations. Static fixtures, generated drafts, local benchmarks, and project registry entries are not evidence of production health, external vendor integrations, formal verification, or deployment. The site does not connect AI agents or probe production systems by default.

## Requirements

- Node.js 22 or newer.
- No third-party runtime dependencies are listed in `package.json`.
- Run `npm ci` to install the pinned TypeScript compiler and Node.js type definitions used by checks.

## Start here

```sh
node --version
git clone https://github.com/valentinflorezarbelaez-ai/Eos-System.git
cd Eos-System
npm ci
node bin/eos.mjs help
node bin/eos.mjs flow inspect "<ruta-a-tu-repositorio-git>"
node bin/eos.mjs flow plan "<ruta-a-tu-repositorio-git>" "Describe the cambio"
```

The root `index.html` is the browser guide and demo catalog; it cannot run commands on your computer. The read-only `flow inspect` and `flow plan` commands do not change the target repository. Git and Node.js 22 or later must be installed. The routes under `api/` use Vercel's serverless-function conventions. Static file opening can show the page, but API-backed demos need a compatible function host.

For a first-time-user evaluation, task script, and qualitative launch gate, see [the EOS usability pilot](docs/USABILITY-PILOT.md). No user-study results are claimed yet.

## Useful commands

| Command | Behavior |
|---|---|
| `node bin/eos.mjs help` | Show the CLI help. |
| `node bin/eos.mjs guard [directory]` | Inspect local source dependencies and report architecture findings. |
| `node bin/eos.mjs amplify "prompt"` | Generate a local EARS/BDD prompt scaffold. Review it before use. |
| `node bin/eos.mjs eval <file>` | Run the repository's local cognitive-evaluation heuristics on a file. This is not an external model evaluation. |
| `node bin/eos.mjs graph` / `blast <file>` | Build a local source graph and report dependencies. |
| `node bin/eos.mjs heal src/core/eosAutonomousHealer.ts --dry-run` | Ask the local healer for a dry-run report. Inspect the implementation and report before relying on it. |
| `node bin/eos.mjs worktree list` | List Git worktrees for this repository. |
| `node bin/eos.mjs sandbox doctor` | Check for a local Linux Docker Engine, seccomp, cgroup v2, and the configured pinned image. |
| `node bin/eos.mjs sandbox run .worktrees/task -- node --version` | Run a command offline in a filtered temporary worktree copy; discard its edits. Add `--apply` to request conflict-checked writeback after exit code 0. |
| `node bin/eos.mjs honk "<task>"` | Produce a bounded local task draft; it does not edit code, create a branch, run tests, or open a PR. |
| `node bin/eos.mjs flow <action> ...` | Run the inspect → plan → worktree → isolated validation → diff review → approval-hash flow described below. |
| `npm run mcp` | Start the local MCP stdio server; each request is limited to 1 MiB. |
| `npm run mcp:stream` | Start authenticated local MCP HTTP/SSE on `127.0.0.1:3333`; exposes a read-only HTTP tool allowlist. |
| `npm run typecheck` | Strictly type-check `src/**/*.ts` with the locked TypeScript compiler. |
| `npm run test:workflow` | Test the core approval-gated workflow and CLI entry point; CI runs this subset on Windows, macOS, and Linux. |
| `npm run verify:strict` | Run the configured credential-pattern scan, static checks, bounded simulations, TypeScript check, all discovered Node suites, and mocked handler smoke checks. It writes a local-check receipt and configured-checks SARIF; it does not deploy, perform general SAST, produce an SBOM, run TLC, or sign an attestation. |
| `npm run test:unit` | Run the Node test file named in `package.json`. |

Commands that write files, change Git configuration, commit, or push should be reviewed before use. In particular, fleet ship mode can stage, commit, and push to `origin` for one explicitly selected project.

### Approval-gated project workflow

`flow` joins the local repository audit, Honk draft, Git worktrees, and the Docker sandbox into one lifecycle. Inspection and planning do not write to the target repository. The audit score counts bounded local structural signals; it does not assess production readiness, execute tests, verify CI results, or replace security scanners.

```sh
node bin/eos.mjs flow inspect "<repo-path>"
node bin/eos.mjs flow plan "<repo-path>" "<change to make>"
node bin/eos.mjs flow start "<repo-path>" "<change to make>"
# Edit only in the printed worktree, then commit the reviewed changes on that branch.
node bin/eos.mjs flow validate "<repo-path>" <workflow-id> -- npm test
node bin/eos.mjs flow review "<repo-path>" <workflow-id>
node bin/eos.mjs flow apply "<repo-path>" <workflow-id> --confirm-diff=<sha256-from-review>
node bin/eos.mjs flow status "<repo-path>" <workflow-id>
node bin/eos.mjs flow close "<repo-path>" <workflow-id>
```

`start` requires a clean, named base branch and creates `.worktrees/flow-<uuid>` plus ignored state under `.eos/workflows/`. If needed, it appends those two directory patterns to the repository's local `.git/info/exclude`, without editing tracked project files. `validate` requires a committed branch and runs the supplied executable in the existing network-disabled Docker sandbox; the command must be present in the locally available immutable image, since the sandbox cannot install dependencies from the network. `review` requires successful validation of the exact branch HEAD, a clean worktree, and an unchanged base; it prints the committed diff and its SHA-256. `apply` accepts only that hash, rechecks the diff and base, then fast-forwards the base branch locally. `status` shows validation, review, apply, and worktree state. `close` removes the worktree only if clean by default, preserves the branch, and requires `--force` to discard uncommitted files. None of these commands pushes or deploys. An external project pilot is still needed to measure acceptance, false positives, failures, time, and reversibility.

### Local MCP HTTP/SSE security

The `mcp:stream` command generates a fresh 256-bit bearer token at startup and prints it only to the local terminal's stderr so an MCP client can be configured. Set `EOS_MCP_HTTP_TOKEN` to override the token; configured values must contain at least 32 bytes. Every HTTP route requires `Authorization: Bearer <token>`, including health and metrics. The HTTP tool catalog contains only `eos_health_check`, `eos_amplify_prompt`, `eos_check_architecture`, `eos_evaluate_decision`, `eos_spotify_shuffle`, and `eos_optimize_context`; it does not expose mutating MCP tools or repository-file reads through context optimization.

Browser-based clients must also set `EOS_MCP_ALLOWED_ORIGINS` to a comma-separated list of exact origins such as `http://localhost:3000`. The default is no browser origins. Requests without an `Origin` header remain available to local/native clients only when they present the bearer token. The server bounds bodies to 1 MiB, body reads to 10 seconds, and concurrent SSE sessions to 16.

Example native client request:

```sh
curl -H "Authorization: Bearer $EOS_MCP_HTTP_TOKEN" http://127.0.0.1:3333/health
```

The token is a local capability: do not copy it into source control, screenshots, shared logs, or untrusted clients.

## Agent-tool boundaries

- Honk and Xirp provide local planning and context generation. They do not run a model or autonomous code-editing loop. Repository context is marked as untrusted data.
- The Honk GitHub Actions workflow is a manually invoked, read-only plan generator restricted to `main`. It does not consume issue comments, commit, push, or open pull requests; directive text and repository metadata are redacted from its logs.
- Git worktrees isolate branches and working files; they do not sandbox processes, network access, or credentials. EOS does not provide Devin-style microVM isolation.
- `eos sandbox run` uses a local Linux Docker Engine only. It requires `EOS_SANDBOX_IMAGE` to reference a locally available immutable `repository@sha256:...` image, the built-in seccomp profile, and cgroup v2 with resource controllers. The container has no network, a read-only root filesystem, dropped Linux capabilities, no-new-privileges, a non-root UID, CPU/memory/process/time/file-size limits, and a monitored 512 MiB workspace copy. It never mounts `.git`, the Docker socket, ignored files, or host credential directories. The copy also filters common secret paths; review the exclusions and image before use. Container isolation still depends on the local Docker daemon and host kernel, so this is defense in depth, not a microVM boundary. The workspace-size watchdog polls once per second and may briefly exceed its budget before stopping the container.
- Sandbox output is discarded by default. `--apply` writes only after the command exits successfully; it rejects symlink output and checks that each target still matches the copied baseline. Multi-file writeback is conflict-aware, not a single atomic transaction. Run `node bin/eos.mjs sandbox doctor` before use.
- MCP mutating options require JSON booleans set to `true`; strings such as `"true"` do not enable writes. File and resource reads are confined to the configured repository after symlink resolution.
- Fleetshift can create a missing `catalog-info.yaml` only for one registered Git checkout whose `origin` matches the registry. Dependency upgrades and custom codemods are plans only.
- Fleet ship runs the registered project gate before committing and pushing. Its HTTP 200 probe does not establish which commit is live.

## Browser demonstrations

- The command console previews commands; it does not execute a shell. Only commands with an implemented CLI handler can be copied.
- The development form generates generic text drafts in browser memory. It does not write files, compile, run tests, scan security, or deploy.
- The memory page stores user-created notes in this browser's `localStorage`, filters text locally, and can export a Markdown file. Its initial records and API data are examples; there is no server persistence, FTS5, Engram integration, or conflict tribunal.
- The kernel page shows static fixtures and a JavaScript loop measurement. It is not a Linux kernel, eBPF verifier, RCU implementation, or ABI test.
- The Big Tech page returns a scenario fixture. It does not run TLA+, inject faults, or repair a system.
- The Omega page fingerprints text with SHA-256 and reads a static project registry. It does not implement PQC signatures, ZK proofs, BFT consensus, deterministic replay, or production probes.
- The CI/CD page shows a simulation. It does not run repository checks or deploy.

## API routes

| Route | Scope |
|---|---|
| `/api/health` | Handler liveness and process data. Subsystems are marked not probed. |
| `/api/mcp` | Stateless JSON-RPC over POST with a bounded read-only tool allowlist. File reads, mutations, sessions, and SSE are not exposed over HTTP. |
| `/api/fleet` | Static project registry; no health, CI, hook, or deployment probes. |
| `/api/cicd` | Bounded CI/CD simulation; no checks, SBOM generation, or deployment. |
| `/api/bigtech` | Static scenario fixtures; no model checking or fault injection. |
| `/api/kernel` | Read-only Linux concept fixtures; no kernel telemetry. `/api/omega` serves a text fingerprint and concept metadata through this handler; no cryptographic proof or consensus runs. |
| `/api/memory` | Static sample records and action previews; no server persistence or FTS5. |
| `/api/eval` | Local evaluator with project-root confinement and a 100 KiB source limit. Evaluator load errors return a non-success status. |
| `/api/titans` | Local benchmark code through the evaluator route; results do not describe Spotify, SpaceX, NVIDIA, Google, or xAI services. |
| `/api/graph` | Local source graph when the engine loads; otherwise returns an explicit unavailable error. |
| `/api/amplify` | Prompt-scaffolding route backed by `api/compile.js`; it does not call a remote language model. |
| `/api/compile` | Local JavaScript benchmark and text transformation; no hardware or vendor benchmark. |
| `/api/jarvis`, `/api/spotify`, `/api/teurgia` | Deterministic application responses. No external AI, Spotify, or production control-plane connection is implied. |

All API responses should be interpreted according to their `status`, `note`, and execution flags. A successful HTTP response alone does not mean a subsystem or deployment was verified.

## Fleet paths

The registry stores environment-variable names instead of workstation-specific paths. Set a variable only when you want a local fleet command to inspect that checkout:

| Project | Variable |
|---|---|
| EOS System | `EOS_FLEET_EOS_SYSTEM_PATH` |
| Aberamentho | `EOS_FLEET_ABERAMENTHO_PATH` |
| Portafolio | `EOS_FLEET_PORTAFOLIO_PATH` |
| PTG | `EOS_FLEET_PTG_PATH` |

Fleet audit mode checks configured local Git roots and probes each configured HTTPS production URL. Hook installation changes Git hooks and `core.hooksPath`; it requires one project ID plus a matching confirmation. Installed `pre-commit` and `pre-push` hooks run that project's configured `cicdGateScript`.

### Sandbox image setup (PowerShell)

The example below pins Docker Official Image `node:22-bookworm-slim` to the multi-platform digest currently published by Docker Hub. Verify the digest against the [official image page](https://hub.docker.com/_/node/tags?name=22-bookworm&page=&page_size=) when refreshing it. The sandbox runner never pulls images itself.

```powershell
docker pull node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d
$env:EOS_SANDBOX_IMAGE = "node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d"
node bin/eos.mjs sandbox doctor
node bin/eos.mjs worktree add task
node bin/eos.mjs sandbox run .worktrees/task -- node --version
```

To preserve successful edits from the temporary copy, include `--apply` before `--`. Supply a trusted image built for the project when more tools are needed. The container gets no network, so dependencies and compilers must already be inside the pinned image or copied workspace.

Ship mode requires one project ID plus matching `--confirm-project=<id>`, a valid HTTPS production URL, a configured in-repository gate (`.js`, `.mjs`, or `.ps1`), a valid local Git root, and an `origin` matching the registered repository. It runs the gate before staging, committing, and pushing the selected checkout. It then checks the configured URL for HTTP 200; that probe does not confirm which commit is serving in production. Ship mode stages all changes in the selected checkout, so review its working tree before invoking it.

## Deployment

`vercel.json` points Vercel at the project root and runs `node scripts/verify-cicd-pipeline.mjs` as the build command. Deployment and live health are separate operations; this repository does not claim either has happened just because a build command or API returns successfully.

## License

MIT.
