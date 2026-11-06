# INTAKE-038: AUTONOMOUS EVERGREEN AUTO-UPDATER FOR GENTLE-AI & COMPLETE GENTLEMAN STACK (v51.0.0)

## 1. Stakeholder Request & Strategic Intent
* **Owner**: Valentín Flórez Arbeláez
* **Date**: 2026-10-30
* **Directive**: *"necesito que gentle ai y todo su stack se actualize automaticamente a la version mas reciente siempre se mantenga actualizado"*
* **Objective**: Engineer a zero-toil, defense-in-depth **Evergreen Self-Updating Lifecycle Architecture** for `gentle-ai` and every component of the Gentleman Programming AI Stack (`gentle-ai`, `engram`, `gga`, `agent-teams-lite` skills, and `context7` MCP health) so that the entire ecosystem stays continuously updated to the latest upstream release without manual intervention and without ever clobbering the EOS Constitution or interrupting running MCP processes on Windows.

## 2. Live Reconnaissance Findings
1. **Upstream Drift Already Present**: Running `gentle-ai update` and `git ls-remote` revealed `engram` installed at `v3.2.1` while upstream `Gentleman-Programming/engram` has already released **`v3.6.0`** (`checksums.txt` SHA-256 `22650375af19d1e46ffe1f376314c12c20370dfd19045fbc649a95991706a102` for `engram_3.6.0_windows_amd64.zip`).
2. **Platform Packaging Asymmetry**:
   - `engram` publishes pre-built `windows_amd64.zip` + `checksums.txt` on GitHub Releases.
   - `gentle-ai` (`v4.3.1`) publishes `darwin_*` and `linux_*` tarballs in `checksums.txt` — **no prebuilt `windows_amd64` archive** — requiring automatic shallow-tag Git clone (`--depth 1 --branch v<latest>`) + `go build` against official `go.sum` on Windows.
   - `gga` (`v2.10.1`) updates from tagged Git repository `Gentleman-Programming/gentleman-guardian-angel` (`bin/gga` + `lib/` + Windows `gga.bat`).
   - `agent-teams-lite` updates continuously from `HEAD` (`6901875cb1c2387914b57bebfceb686646572253`) without SemVer tags, requiring commit-SHA tracking + symlink/secret SAST scanning prior to syncing `.agents/skills/` while preserving `eos-*` skills.
3. **Windows NTFS Running-Process Constraint**: Because Antigravity keeps `engram.exe mcp` running, direct file overwrite fails with `EBUSY`/`EPERM`; atomic NTFS rename (`engram.exe -> engram.exe.bak`) followed by placing the new binary succeeds cleanly while `engram mcp` is running and enables instant rollback on failure.
4. **Triple-Trigger Evergreen Automation**:
   - **OS Background Schedule**: Per-user Windows Scheduled Task (`EOS-Gentleman-Stack-AutoUpdate`, every 6 hours via hidden `wscript.exe` `SW_HIDE` launcher — zero console window popups).
   - **IDE SessionStart Opportunistic Trigger**: Non-blocking detached `windowsHide: true` background spawn inside `eos-governance` `SessionStart` hook whenever the last check in `.eos/state/gentleman-auto-update.json` is older than 6 hours (handles laptop sleep/wake).
   - **On-Demand CLI & MCP Control**: `eos gentleman update [--check|--apply|--force]` and MCP tool `eos_gentleman_update`.
