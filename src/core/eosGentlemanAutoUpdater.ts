/**
 * EOS SYSTEM — AUTONOMOUS EVERGREEN AUTO-UPDATER FOR GENTLE-AI & GENTLEMAN STACK (Layer 0)
 * Governed by SPEC-045, CHANGE-038, ADR-051, FR-137..FR-141, BDD-133..BDD-137 (v51.0.0)
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";
import {
  EosGentlemanStackBridge,
  parseSemVer,
  compareSemVer,
  selectLatestStableTag,
  parseChecksumsManifest,
  verifyArchiveChecksum,
  hotSwapExecutableWithRollback,
  syncSkillsTreeSafely,
  copyDirClean,
  resolvePlatformTargets,
  extractArchiveToDir,
  type ParsedSemVer,
  type UpstreamTagResolution,
  type HotSwapResult,
  type SkillSyncReport,
} from "./eosGentlemanStackBridge.ts";
import { assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  ComponentUpdateStatus,
  GentlemanComponentCheck,
  PersistedAutoUpdateState,
  GentlemanUpdateCycleReport,
} from "./eosGentlemanAutoUpdater.types.ts";

export {
  parseSemVer,
  compareSemVer,
  selectLatestStableTag,
  parseChecksumsManifest,
  verifyArchiveChecksum,
  hotSwapExecutableWithRollback,
  syncSkillsTreeSafely,
  type ParsedSemVer,
  type UpstreamTagResolution,
  type HotSwapResult,
  type SkillSyncReport,
};

export type { ComponentUpdateStatus, GentlemanComponentCheck, PersistedAutoUpdateState, GentlemanUpdateCycleReport };

export const DEFAULT_AUTO_UPDATE_INTERVAL_HOURS = 6;
const LOCK_STALE_TIMEOUT_MS = 30 * 60 * 1000;
const PIPE_STDIO = ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"];

const GENTLEMAN_REPOS = {
  "gentle-ai": "https://github.com/Gentleman-Programming/gentle-ai.git",
  engram: "https://github.com/Gentleman-Programming/engram.git",
  gga: "https://github.com/Gentleman-Programming/gentleman-guardian-angel.git",
  "agent-teams-lite": "https://github.com/Gentleman-Programming/agent-teams-lite.git",
} as const;

export class EosGentlemanAutoUpdater {
  public static defaultStatePath(projectRoot: string = process.cwd()): string {
    return path.join(path.resolve(projectRoot), ".eos", "state", "gentleman-auto-update.json");
  }

  public static defaultLockPath(projectRoot: string = process.cwd()): string {
    return path.join(path.resolve(projectRoot), ".eos", "state", "gentleman-autoupdate.lock");
  }

  public static readState(projectRoot: string = process.cwd()): PersistedAutoUpdateState | null {
    const statePath = this.defaultStatePath(projectRoot);
    if (!fs.existsSync(statePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(statePath, "utf8")) as PersistedAutoUpdateState;
    } catch {
      return null;
    }
  }

  public static isAutoUpdateDue(
    projectRoot: string = process.cwd(),
    intervalHours: number = DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
    nowMs: number = Date.now(),
  ): boolean {
    const lockPath = this.defaultLockPath(projectRoot);
    if (fs.existsSync(lockPath)) {
      try {
        const rawLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        const acquiredAt =
          typeof rawLock?.acquiredAtMs === "number" ? rawLock.acquiredAtMs : fs.statSync(lockPath).mtimeMs;
        if (nowMs - acquiredAt < LOCK_STALE_TIMEOUT_MS) return false;
      } catch {}
    }

    const state = this.readState(projectRoot);
    if (!state || typeof state.lastCheckedAtMs !== "number") return true;
    return nowMs - state.lastCheckedAtMs >= Math.max(0.25, intervalHours) * 60 * 60 * 1000;
  }

  public static acquireLock(projectRoot: string = process.cwd(), nowMs: number = Date.now()): boolean {
    const lockPath = this.defaultLockPath(projectRoot);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    if (fs.existsSync(lockPath)) {
      try {
        const rawLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        const acquiredAt =
          typeof rawLock?.acquiredAtMs === "number" ? rawLock.acquiredAtMs : fs.statSync(lockPath).mtimeMs;
        if (nowMs - acquiredAt >= LOCK_STALE_TIMEOUT_MS) fs.rmSync(lockPath, { force: true });
        else return false;
      } catch {}
    }

    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAtMs: nowMs }), "utf8");
      fs.closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }

  public static releaseLock(projectRoot: string = process.cwd()): void {
    const lockPath = this.defaultLockPath(projectRoot);
    try {
      if (fs.existsSync(lockPath)) fs.rmSync(lockPath, { force: true });
    } catch {}
  }

  public static computeConstitutionDigest(
    projectRoot: string = process.cwd(),
    geminiConfigDir: string = path.join(os.homedir(), ".gemini", "config"),
  ): string {
    const parts: string[] = [];
    const globalConstitution = path.join(path.resolve(geminiConfigDir), "AGENTS.md");
    const pluginConstitution = path.join(
      path.resolve(projectRoot),
      "integrations",
      "antigravity",
      "eos-governance",
      "rules",
      "AGENTS.md",
    );
    if (fs.existsSync(globalConstitution))
      parts.push(`global:${pureSha256(fs.readFileSync(globalConstitution, "utf8"))}`);
    if (fs.existsSync(pluginConstitution))
      parts.push(`plugin:${pureSha256(fs.readFileSync(pluginConstitution, "utf8"))}`);
    return pureSha256(parts.join("|") || "constitution-baseline");
  }

  private static queryGitLsRemote(args: readonly string[]): string {
    return execFileSync("git", ["ls-remote", ...args], {
      encoding: "utf8",
      timeout: 15000,
      stdio: PIPE_STDIO,
      windowsHide: true,
    });
  }

  private static async upgradeEngramRelease(
    latestVersion: string,
    targetExecutablePath: string,
  ): Promise<HotSwapResult> {
    const { osName, archName, archiveExt } = resolvePlatformTargets();
    const assetName = `engram_${latestVersion}_${osName}_${archName}.${archiveExt}`;
    const baseUrl = `https://github.com/Gentleman-Programming/engram/releases/download/v${latestVersion}`;

    const [checksumsRes, archiveRes] = await Promise.all([
      fetch(`${baseUrl}/checksums.txt`, { signal: AbortSignal.timeout(25000) }),
      fetch(`${baseUrl}/${assetName}`, { signal: AbortSignal.timeout(45000) }),
    ]);

    if (!checksumsRes.ok) throw new Error(`Failed to fetch engram checksums.txt (HTTP ${checksumsRes.status})`);
    if (!archiveRes.ok) throw new Error(`Failed to fetch ${assetName} (HTTP ${archiveRes.status})`);

    const checksumsText = await checksumsRes.text();
    const archiveBytes = new Uint8Array(await archiveRes.arrayBuffer());
    const verification = verifyArchiveChecksum(archiveBytes, assetName, checksumsText);
    if (!verification.verified) {
      throw new Error(
        `SHA-256 supply-chain verification failed for ${assetName}: expected ${verification.expectedSha256}, got ${verification.actualSha256}`,
      );
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-engram-upgrade-"));
    try {
      const archivePath = path.join(tmpDir, assetName);
      const extractDir = path.join(tmpDir, "extracted");
      fs.writeFileSync(archivePath, archiveBytes);
      extractArchiveToDir(archivePath, extractDir);

      const exeName = process.platform === "win32" ? "engram.exe" : "engram";
      const candidatePath = path.join(extractDir, exeName);
      if (!fs.existsSync(candidatePath)) throw new Error(`Extracted archive ${assetName} did not contain ${exeName}`);

      return hotSwapExecutableWithRollback({
        targetPath: targetExecutablePath,
        candidatePath,
        smokeArgs: ["version"],
        expectedVersionSubstring: latestVersion,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static async upgradeGentleAiRelease(
    latestVersion: string,
    latestTag: string,
    targetExecutablePath: string,
  ): Promise<HotSwapResult> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gentleai-upgrade-"));
    try {
      if (process.platform !== "win32") {
        const { osName, archName } = resolvePlatformTargets();
        const assetName = `gentle-ai_${latestVersion}_${osName}_${archName}.tar.gz`;
        const baseUrl = `https://github.com/Gentleman-Programming/gentle-ai/releases/download/v${latestVersion}`;
        const [checksumsRes, archiveRes] = await Promise.all([
          fetch(`${baseUrl}/checksums.txt`, { signal: AbortSignal.timeout(25000) }),
          fetch(`${baseUrl}/${assetName}`, { signal: AbortSignal.timeout(45000) }),
        ]);
        if (checksumsRes.ok && archiveRes.ok) {
          const checksumsText = await checksumsRes.text();
          const archiveBytes = new Uint8Array(await archiveRes.arrayBuffer());
          if (!verifyArchiveChecksum(archiveBytes, assetName, checksumsText).verified) {
            throw new Error(`SHA-256 verification failed for ${assetName}`);
          }
          const archivePath = path.join(tmpDir, assetName);
          const extractDir = path.join(tmpDir, "extracted");
          fs.writeFileSync(archivePath, archiveBytes);
          extractArchiveToDir(archivePath, extractDir);
          return hotSwapExecutableWithRollback({
            targetPath: targetExecutablePath,
            candidatePath: path.join(extractDir, "gentle-ai"),
            smokeArgs: ["--version"],
            expectedVersionSubstring: latestVersion,
          });
        }
      }

      const cloneDir = path.join(tmpDir, "src");
      execFileSync("git", ["clone", "--depth", "1", "--branch", latestTag, GENTLEMAN_REPOS["gentle-ai"], cloneDir], {
        timeout: 60000,
        stdio: PIPE_STDIO,
        windowsHide: true,
      });
      const candidatePath = path.join(tmpDir, process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai");
      execFileSync("go", ["build", "-ldflags=-s -w", "-o", candidatePath, "./cmd/gentle-ai"], {
        cwd: cloneDir,
        timeout: 120000,
        stdio: PIPE_STDIO,
        windowsHide: true,
      });

      return hotSwapExecutableWithRollback({
        targetPath: targetExecutablePath,
        candidatePath,
        smokeArgs: ["--version"],
        expectedVersionSubstring: latestVersion,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static upgradeGgaFromTag(latestVersion: string, latestTag: string, homeDir: string): HotSwapResult {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gga-upgrade-"));
    const binDir = path.join(homeDir, "bin");
    const libTargetDir = path.join(binDir, "lib", "gga");
    const libBackupDir = path.join(binDir, "lib", "gga.bak");

    try {
      const cloneDir = path.join(tmpDir, "gga-src");
      execFileSync("git", ["clone", "--depth", "1", "--branch", latestTag, GENTLEMAN_REPOS.gga, cloneDir], {
        timeout: 45000,
        stdio: PIPE_STDIO,
        windowsHide: true,
      });

      fs.mkdirSync(path.join(binDir, "lib"), { recursive: true });
      if (fs.existsSync(libBackupDir)) fs.rmSync(libBackupDir, { recursive: true, force: true });
      if (fs.existsSync(libTargetDir)) fs.renameSync(libTargetDir, libBackupDir);

      try {
        copyDirClean(path.join(cloneDir, "lib"), libTargetDir);
        const ggaScriptSource = fs
          .readFileSync(path.join(cloneDir, "bin", "gga"), "utf8")
          .replace('LIB_DIR="$SCRIPT_DIR/../lib"', 'LIB_DIR="$SCRIPT_DIR/lib/gga"');
        const candidateGga = path.join(tmpDir, "gga");
        fs.writeFileSync(candidateGga, ggaScriptSource, { encoding: "utf8", mode: 0o755 });

        if (process.platform === "win32") {
          const batPath = path.join(binDir, "gga.bat");
          if (!fs.existsSync(batPath)) {
            fs.writeFileSync(batPath, '@echo off\r\n"C:\\Program Files\\Git\\bin\\bash.exe" "%~dp0gga" %*\r\n', "utf8");
          }
        }

        const swapTarget = path.join(binDir, "gga");
        fs.copyFileSync(candidateGga, swapTarget);
        if (process.platform !== "win32") fs.chmodSync(swapTarget, 0o755);

        const probeTarget =
          process.platform === "win32" && fs.existsSync(path.join(binDir, "gga.bat"))
            ? path.join(binDir, "gga.bat")
            : swapTarget;
        const execOpts = { encoding: "utf8" as const, timeout: 6000, stdio: PIPE_STDIO, windowsHide: true };
        const out =
          process.platform === "win32" && probeTarget.endsWith(".bat")
            ? execFileSync("cmd.exe", ["/d", "/s", "/c", probeTarget, "--version"], execOpts)
            : execFileSync(probeTarget, ["--version"], execOpts);

        if (!String(out || "").includes(latestVersion)) {
          throw new Error(`gga version check did not contain ${latestVersion}`);
        }
        if (fs.existsSync(libBackupDir)) fs.rmSync(libBackupDir, { recursive: true, force: true });

        return deepFreeze({
          swapped: true,
          rolledBack: false,
          targetPath: probeTarget,
          backupPath: null,
          verifiedOutput:
            String(out || "")
              .trim()
              .split(/\r?\n/)[0] || `gga v${latestVersion}`,
          binarySha256: pureSha256(ggaScriptSource),
        });
      } catch (err: any) {
        if (fs.existsSync(libTargetDir)) fs.rmSync(libTargetDir, { recursive: true, force: true });
        if (fs.existsSync(libBackupDir)) fs.renameSync(libBackupDir, libTargetDir);
        return deepFreeze({
          swapped: false,
          rolledBack: true,
          targetPath: path.join(binDir, "gga"),
          backupPath: libBackupDir,
          verifiedOutput: "",
          binarySha256: "",
          error: String(err?.message || err),
        });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static upgradeAgentTeamsLiteSkills(projectRoot: string, gentleAiPath?: string): SkillSyncReport {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-atl-upgrade-"));
    try {
      const cloneDir = path.join(tmpDir, "atl");
      execFileSync("git", ["clone", "--depth", "1", GENTLEMAN_REPOS["agent-teams-lite"], cloneDir], {
        timeout: 45000,
        stdio: PIPE_STDIO,
        windowsHide: true,
      });
      const report = syncSkillsTreeSafely(path.join(cloneDir, "skills"), path.join(projectRoot, ".agents", "skills"));
      if (gentleAiPath && fs.existsSync(gentleAiPath)) {
        try {
          execFileSync(gentleAiPath, ["skill-registry", "refresh"], {
            cwd: projectRoot,
            timeout: 10000,
            stdio: PIPE_STDIO,
            windowsHide: true,
          });
        } catch {}
      }
      return report;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static async checkAndUpgradeSemVerComponent(params: {
    componentId: "gentle-ai" | "engram" | "gga";
    installedVersion: string;
    apply: boolean;
    force: boolean;
    performUpgrade: (latest: UpstreamTagResolution) => Promise<{ swap: HotSwapResult; successDetail: string }>;
  }): Promise<{ check: GentlemanComponentCheck; detected: number; applied: number; rolledBack: number }> {
    const repoUrl = GENTLEMAN_REPOS[params.componentId];
    const mk = (
      installedVersion: string,
      latestVersion: string,
      latestCommitSha: string,
      updateAvailable: boolean,
      status: ComponentUpdateStatus,
      detail: string,
    ): GentlemanComponentCheck => ({
      componentId: params.componentId,
      repositoryUrl: repoUrl,
      installedVersion,
      latestVersion,
      latestCommitSha,
      updateAvailable,
      status,
      detail,
    });
    try {
      const lsOut = this.queryGitLsRemote(["--tags", "--refs", repoUrl]);
      const latest = selectLatestStableTag(lsOut);
      if (!latest) throw new Error("No stable SemVer tags returned");
      const needsUpdate = compareSemVer(latest.version, params.installedVersion) > 0 || (params.force && params.apply);
      const detected = needsUpdate ? 1 : 0;

      if (params.apply && needsUpdate) {
        const { swap, successDetail } = await params.performUpgrade(latest);
        if (swap.swapped) {
          return {
            detected,
            applied: 1,
            rolledBack: 0,
            check: mk(latest.version, latest.version, latest.commitSha, false, "UPDATED", successDetail),
          };
        }
        return {
          detected,
          applied: 0,
          rolledBack: swap.rolledBack ? 1 : 0,
          check: mk(
            params.installedVersion,
            latest.version,
            latest.commitSha,
            true,
            swap.rolledBack ? "ROLLED_BACK" : "ERROR",
            `Upgrade failed (${swap.error || "unknown"}); rollback=${swap.rolledBack}`,
          ),
        };
      }

      return {
        detected,
        applied: 0,
        rolledBack: 0,
        check: mk(
          params.installedVersion,
          latest.version,
          latest.commitSha,
          needsUpdate,
          needsUpdate ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
          needsUpdate
            ? `Update available: ${params.installedVersion} -> ${latest.version}`
            : `Latest stable ${latest.version} active`,
        ),
      };
    } catch (err: any) {
      return {
        detected: 0,
        applied: 0,
        rolledBack: 0,
        check: mk(
          params.installedVersion,
          params.installedVersion,
          "",
          false,
          "SKIPPED_OFFLINE",
          `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`,
        ),
      };
    }
  }

  public static async runUpdateCycle(
    options: {
      readonly projectRoot?: string;
      readonly geminiConfigDir?: string;
      readonly homeDir?: string;
      readonly apply?: boolean;
      readonly force?: boolean;
      readonly intervalHours?: number;
    } = {},
  ): Promise<GentlemanUpdateCycleReport> {
    const projectRoot = path.resolve(options.projectRoot || process.cwd());
    const homeDir = path.resolve(options.homeDir || os.homedir());
    const geminiConfigDir = path.resolve(options.geminiConfigDir || path.join(homeDir, ".gemini", "config"));
    const apply = Boolean(options.apply);
    const force = Boolean(options.force);
    const intervalHours = options.intervalHours ?? DEFAULT_AUTO_UPDATE_INTERVAL_HOURS;
    const mode = apply ? "APPLY" : "CHECK_ONLY";
    const nowIso = new Date().toISOString();

    const constitutionBefore = this.computeConstitutionDigest(projectRoot, geminiConfigDir);

    if (!this.acquireLock(projectRoot)) {
      return deepFreeze({
        mode,
        executedAtIso: nowIso,
        lockSkipped: true,
        constitutionPreserved: true,
        constitutionSha256: constitutionBefore,
        updatesDetected: 0,
        updatesApplied: 0,
        rollbacksTriggered: 0,
        components: [],
        stateFilePath: this.defaultStatePath(projectRoot),
        ledgerEntryId: null,
        sha256Receipt: pureSha256(`LOCK_SKIPPED:${nowIso}:${constitutionBefore}`),
      });
    }

    try {
      const priorState = this.readState(projectRoot);
      const components: GentlemanComponentCheck[] = [];
      let updatesDetected = 0;
      let updatesApplied = 0;
      let rollbacksTriggered = 0;

      const gentleProbe = EosGentlemanStackBridge.probeBinary(
        "gentle-ai",
        ["--version"],
        [
          path.join(homeDir, "go", "bin", process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai"),
          path.join(homeDir, "AppData", "Local", "gentle-ai", "bin", "gentle-ai.exe"),
        ],
        homeDir,
      );
      const engramProbe = EosGentlemanStackBridge.probeBinary(
        "engram",
        ["version"],
        [
          path.join(homeDir, "AppData", "Local", "engram", "bin", "engram.exe"),
          path.join(homeDir, "go", "bin", process.platform === "win32" ? "engram.exe" : "engram"),
        ],
        homeDir,
      );
      const ggaProbe = EosGentlemanStackBridge.probeBinary(
        "gga",
        ["--version"],
        [path.join(homeDir, "bin", process.platform === "win32" ? "gga.bat" : "gga"), path.join(homeDir, "bin", "gga")],
        homeDir,
      );

      const gentleInstalled = parseSemVer(gentleProbe.versionOutput)?.clean || "0.0.0";
      const gentleRes = await this.checkAndUpgradeSemVerComponent({
        componentId: "gentle-ai",
        installedVersion: gentleInstalled,
        apply,
        force,
        performUpgrade: async (latest) => {
          const targetExe =
            gentleProbe.executablePath ||
            path.join(homeDir, "go", "bin", process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai");
          const swap = await this.upgradeGentleAiRelease(latest.version, latest.tag, targetExe);
          return {
            swap,
            successDetail: `Upgraded gentle-ai ${gentleInstalled} -> ${latest.version} (sha256:${swap.binarySha256.slice(0, 12)})`,
          };
        },
      });
      components.push(gentleRes.check);
      updatesDetected += gentleRes.detected;
      updatesApplied += gentleRes.applied;
      rollbacksTriggered += gentleRes.rolledBack;

      const engramInstalled = parseSemVer(engramProbe.versionOutput)?.clean || "0.0.0";
      const engramRes = await this.checkAndUpgradeSemVerComponent({
        componentId: "engram",
        installedVersion: engramInstalled,
        apply,
        force,
        performUpgrade: async (latest) => {
          const targetExe =
            engramProbe.executablePath ||
            path.join(
              homeDir,
              process.platform === "win32"
                ? path.join("AppData", "Local", "engram", "bin", "engram.exe")
                : path.join("go", "bin", "engram"),
            );
          const swap = await this.upgradeEngramRelease(latest.version, targetExe);
          return {
            swap,
            successDetail: `Hot-swapped engram ${engramInstalled} -> ${latest.version} with verified checksums.txt (sha256:${swap.binarySha256.slice(0, 12)})`,
          };
        },
      });
      components.push(engramRes.check);
      updatesDetected += engramRes.detected;
      updatesApplied += engramRes.applied;
      rollbacksTriggered += engramRes.rolledBack;

      const ggaInstalled = parseSemVer(ggaProbe.versionOutput)?.clean || "0.0.0";
      const ggaRes = await this.checkAndUpgradeSemVerComponent({
        componentId: "gga",
        installedVersion: ggaInstalled,
        apply,
        force,
        performUpgrade: async (latest) => {
          const swap = this.upgradeGgaFromTag(latest.version, latest.tag, homeDir);
          return { swap, successDetail: `Upgraded gga ${ggaInstalled} -> ${latest.version}` };
        },
      });
      components.push(ggaRes.check);
      updatesDetected += ggaRes.detected;
      updatesApplied += ggaRes.applied;
      rollbacksTriggered += ggaRes.rolledBack;

      let syncedAtlCommit = priorState?.agentTeamsLiteCommitSha || null;
      try {
        const headOut = this.queryGitLsRemote([GENTLEMAN_REPOS["agent-teams-lite"], "HEAD"]);
        const headMatch = headOut.trim().match(/^([0-9a-f]{40})\s+HEAD$/m);
        const latestHeadSha = headMatch ? headMatch[1]!.toLowerCase() : "";
        if (!latestHeadSha) throw new Error("Unable to parse HEAD SHA");

        const localSddExists = fs.existsSync(path.join(projectRoot, ".agents", "skills", "sdd-apply", "SKILL.md"));
        const effectiveInstalledSha = syncedAtlCommit || (localSddExists ? "vendored-initial" : "none");
        const needsSync =
          !localSddExists ||
          (syncedAtlCommit !== null && syncedAtlCommit !== latestHeadSha) ||
          (syncedAtlCommit === null && apply) ||
          (force && apply);

        if (needsSync) updatesDetected++;

        if (apply && needsSync) {
          const syncReport = this.upgradeAgentTeamsLiteSkills(projectRoot, gentleProbe.executablePath);
          syncedAtlCommit = latestHeadSha;
          updatesApplied++;
          components.push({
            componentId: "agent-teams-lite",
            repositoryUrl: GENTLEMAN_REPOS["agent-teams-lite"],
            installedVersion: latestHeadSha.slice(0, 12),
            latestVersion: latestHeadSha.slice(0, 12),
            latestCommitSha: latestHeadSha,
            updateAvailable: false,
            status: "UPDATED",
            detail: `Synced ${syncReport.syncedSkillFolders.length} Gentleman skill dirs (${syncReport.filesVerified} files SAST-verified; preserved ${syncReport.preservedEosSkills.length} eos-* skills)`,
          });
        } else {
          if (!syncedAtlCommit && localSddExists) syncedAtlCommit = latestHeadSha;
          const drift = syncedAtlCommit !== latestHeadSha;
          components.push({
            componentId: "agent-teams-lite",
            repositoryUrl: GENTLEMAN_REPOS["agent-teams-lite"],
            installedVersion:
              effectiveInstalledSha === "vendored-initial"
                ? latestHeadSha.slice(0, 12)
                : effectiveInstalledSha.slice(0, 12),
            latestVersion: latestHeadSha.slice(0, 12),
            latestCommitSha: latestHeadSha,
            updateAvailable: drift,
            status: drift ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
            detail: drift
              ? `New upstream skills commit available: ${latestHeadSha.slice(0, 12)}`
              : `Skills aligned at commit ${latestHeadSha.slice(0, 12)}`,
          });
        }
      } catch (err: any) {
        components.push({
          componentId: "agent-teams-lite",
          repositoryUrl: GENTLEMAN_REPOS["agent-teams-lite"],
          installedVersion: (syncedAtlCommit || "local").slice(0, 12),
          latestVersion: (syncedAtlCommit || "local").slice(0, 12),
          latestCommitSha: syncedAtlCommit || "",
          updateAvailable: false,
          status: "SKIPPED_OFFLINE",
          detail: `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`,
        });
      }

      const constitutionAfter = this.computeConstitutionDigest(projectRoot, geminiConfigDir);
      const constitutionPreserved = constitutionBefore === constitutionAfter;
      assertPostcondition(
        constitutionPreserved,
        "ConstitutionPreservationInvariant violated during Gentleman auto-update cycle",
      );

      const sha256Receipt = pureSha256(
        JSON.stringify({
          mode,
          executedAtIso: nowIso,
          constitutionSha256: constitutionAfter,
          updatesDetected,
          updatesApplied,
          rollbacksTriggered,
          components: components.map((c) => ({
            id: c.componentId,
            installed: c.installedVersion,
            latest: c.latestVersion,
            status: c.status,
          })),
        }),
      );

      const stateFilePath = this.defaultStatePath(projectRoot);
      fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
      const componentMap: Record<string, { version: string; updatedAtIso: string }> = {};
      for (const comp of components) {
        componentMap[comp.componentId] = { version: comp.installedVersion, updatedAtIso: nowIso };
      }
      const nextState: PersistedAutoUpdateState = {
        lastCheckedAtIso: nowIso,
        lastCheckedAtMs: Date.now(),
        lastAppliedAtIso: apply ? nowIso : priorState?.lastAppliedAtIso || null,
        checkIntervalHours: intervalHours,
        agentTeamsLiteCommitSha: syncedAtlCommit,
        components: componentMap,
        lastReceiptSha256: sha256Receipt,
      };
      fs.writeFileSync(stateFilePath, JSON.stringify(nextState, null, 2) + "\n", "utf8");

      let ledgerEntryId: string | null = null;
      if (apply) {
        const ledger = new EosDurableSqliteLedger(EosDurableSqliteLedger.defaultLedgerPath(projectRoot));
        try {
          const rec = ledger.appendEntry({
            category: "GENTLEMAN_ENGRAM_SYNC",
            projectId: "eos-system",
            title: `Gentleman Evergreen Auto-Update (${updatesApplied} applied, ${rollbacksTriggered} rollbacks)`,
            payload: {
              mode,
              updatesDetected,
              updatesApplied,
              rollbacksTriggered,
              constitutionPreserved,
              components: components.map((c) => ({
                id: c.componentId,
                version: c.installedVersion,
                status: c.status,
              })),
            },
            engramTopicKey: "config/gentleman-evergreen-autoupdate",
          });
          ledgerEntryId = rec.entryId;
        } finally {
          ledger.close();
        }
      }

      return deepFreeze({
        mode,
        executedAtIso: nowIso,
        lockSkipped: false,
        constitutionPreserved,
        constitutionSha256: constitutionAfter,
        updatesDetected,
        updatesApplied,
        rollbacksTriggered,
        components,
        stateFilePath,
        ledgerEntryId,
        sha256Receipt,
      });
    } finally {
      this.releaseLock(projectRoot);
    }
  }
}
