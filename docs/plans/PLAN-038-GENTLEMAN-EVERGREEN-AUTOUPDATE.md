# PLAN-038 & ADR-051: DEFENSE-IN-DEPTH EVERGREEN AUTO-UPDATER FOR GENTLEMAN AI STACK (v51.0.0)

## Context
The Gentleman Programming AI Stack (`gentle-ai`, `engram`, `gga`, `agent-teams-lite`, `context7`) evolves rapidly across four independent GitHub repositories with heterogeneous release mechanisms (prebuilt GoReleaser zips with `checksums.txt` for `engram`, source-built Go tags on Windows for `gentle-ai`, tagged Bash/Batch scripts for `gga`, and rolling `main` commits for `agent-teams-lite`). Manual updates inevitably drift (evidenced by `engram` drifting from `3.2.1` to `3.6.0`).

## Decision (`ADR-051`)
1. **Rate-Limit-Free Git Smart-HTTP Discovery (`git ls-remote`)**: Discover latest stable SemVer tags (`gentle-ai`, `engram`, `gga`) and `HEAD` commit SHAs (`agent-teams-lite`) via `git ls-remote` rather than unauthenticated GitHub REST API calls (which suffer 60 req/hr IP throttling).
2. **Cryptographic Supply-Chain Verification & Windows NTFS Hot-Swap**:
   - Verify prebuilt release archives (`engram`) against official `checksums.txt` SHA-256 digests prior to extraction.
   - Build Windows `gentle-ai` binaries from shallow-cloned official SemVer tags (`--depth 1 --branch vX.Y.Z`) verified by upstream `go.sum`.
   - Perform Windows NTFS running-executable hot-swaps (`target.exe -> target.exe.bak`, write new `target.exe`, run `--version` smoke probe, restore `.bak` on failure) so updates succeed even while Antigravity holds `engram.exe mcp` open.
3. **Symlink/Secret Gate & EOS Constitution Invariant on Skill Syncs**:
   - Inspect all incoming `agent-teams-lite/skills/**` files in a temporary staging directory for symbolic links and secret regex patterns before copying into `.agents/skills/`.
   - Never delete or overwrite `eos-*` skills and assert SHA-256 equality on `AGENTS.md` before and after every update cycle.
4. **Triple-Trigger Evergreen Schedule (Zero Console Flash)**:
   - **Windows Task Scheduler (`EOS-Gentleman-Stack-AutoUpdate`)**: Runs every 6 hours under the current user account via a silent `wscript.exe` (`SW_HIDE`, window style `0`) wrapper so no terminal window flashes on screen.
   - **Antigravity `SessionStart` Hook**: Checks `.eos/state/gentleman-auto-update.json` in `<2ms`; if stale (`> 6h`), spawns a detached `windowsHide: true` background updater (`unref()`).
   - **Lockfile Mutual Exclusion**: `.eos/state/gentleman-autoupdate.lock` (with stale-PID/30-min timeout recovery) prevents concurrent update races between Task Scheduler and `SessionStart`.

## Rejected Alternatives
* **Delegating solely to `gentle-ai upgrade` + `gentle-ai sync`**: Rejected because `gentle-ai` `v4.3.1` does not ship prebuilt Windows binaries for itself in GitHub Releases, does not hot-swap a running `engram.exe` MCP daemon safely on Windows if locked, and running `gentle-ai install/sync` unsupervised risks mutating global `AGENTS.md` Constitutional rules.
* **Polling GitHub REST API (`api.github.com/repos/.../releases/latest`)**: Rejected as primary discovery mechanism due to unauthenticated HTTP 403 rate limits on shared IPs.
* **Blocking `SessionStart` synchronously while downloading/compiling updates**: Rejected because `SessionStart` hooks in Antigravity have a strict 5-second budget and must never stall user chat latency.
