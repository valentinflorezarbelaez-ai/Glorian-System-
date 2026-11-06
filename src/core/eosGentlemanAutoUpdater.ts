/**
 * EOS SYSTEM — AUTONOMOUS EVERGREEN AUTO-UPDATER FOR GENTLE-AI & GENTLEMAN STACK (Layer 0)
 * Governed by SPEC-045, CHANGE-038, ADR-051, FR-137..FR-141, BDD-133..BDD-137 (v51.0.0)
 *
 * Keeps `gentle-ai`, `engram`, `gga`, and `agent-teams-lite` skills continuously updated to the
 * latest upstream versions with:
 * - Zero-rate-limit Git smart-HTTP SemVer & commit discovery (`git ls-remote`)
 * - GoReleaser `checksums.txt` SHA-256 supply-chain verification
 * - Windows NTFS running-binary `.bak` hot-swap with automatic atomic rollback
 * - Symlink & plaintext-secret gate on synced `agent-teams-lite` skills preserving `eos-*` skills
 * - Cryptographic SHA-256 EOS Constitution preservation invariant (`AGENTS.md`)
 * - Atomic lockfile mutual exclusion, 6-hour TTL state, and Durable SQLite WAL Ledger receipts
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";
import { EosGentlemanStackBridge } from "./eosGentlemanStackBridge.ts";
import {
  assertPostcondition,
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";

export interface ParsedSemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly clean: string;
}

export interface UpstreamTagResolution {
  readonly version: string;
  readonly tag: string;
  readonly commitSha: string;
}

export type ComponentUpdateStatus =
  | "UP_TO_DATE"
  | "UPDATE_AVAILABLE"
  | "UPDATED"
  | "ROLLED_BACK"
  | "SKIPPED_OFFLINE"
  | "ERROR";

export interface GentlemanComponentCheck {
  readonly componentId: "gentle-ai" | "engram" | "gga" | "agent-teams-lite";
  readonly repositoryUrl: string;
  readonly installedVersion: string;
  readonly latestVersion: string;
  readonly latestCommitSha: string;
  readonly updateAvailable: boolean;
  readonly status: ComponentUpdateStatus;
  readonly detail: string;
}

export interface HotSwapResult {
  readonly swapped: boolean;
  readonly rolledBack: boolean;
  readonly targetPath: string;
  readonly backupPath: string | null;
  readonly verifiedOutput: string;
  readonly binarySha256: string;
  readonly error?: string;
}

export interface SkillSyncReport {
  readonly syncedSkillFolders: readonly string[];
  readonly preservedEosSkills: readonly string[];
  readonly filesVerified: number;
  readonly treeSha256: string;
}

export interface PersistedAutoUpdateState {
  readonly lastCheckedAtIso: string;
  readonly lastCheckedAtMs: number;
  readonly lastAppliedAtIso: string | null;
  readonly checkIntervalHours: number;
  readonly agentTeamsLiteCommitSha: string | null;
  readonly components: Readonly<Record<string, { version: string; updatedAtIso: string }>>;
  readonly lastReceiptSha256: string;
}

export interface GentlemanUpdateCycleReport {
  readonly mode: "CHECK_ONLY" | "APPLY";
  readonly executedAtIso: string;
  readonly lockSkipped: boolean;
  readonly constitutionPreserved: boolean;
  readonly constitutionSha256: string;
  readonly updatesDetected: number;
  readonly updatesApplied: number;
  readonly rollbacksTriggered: number;
  readonly components: readonly GentlemanComponentCheck[];
  readonly stateFilePath: string;
  readonly ledgerEntryId: string | null;
  readonly sha256Receipt: string;
}

export const DEFAULT_AUTO_UPDATE_INTERVAL_HOURS = 6;
const LOCK_STALE_TIMEOUT_MS = 30 * 60 * 1000;

const GENTLEMAN_REPOS = {
  "gentle-ai": "https://github.com/Gentleman-Programming/gentle-ai.git",
  engram: "https://github.com/Gentleman-Programming/engram.git",
  gga: "https://github.com/Gentleman-Programming/gentleman-guardian-angel.git",
  "agent-teams-lite": "https://github.com/Gentleman-Programming/agent-teams-lite.git"
} as const;

const SKILL_SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: "Live Stripe/OpenAI Key", regex: new RegExp("sk-" + "live-[0-9a-zA-Z]{16,}") },
  { name: "GitHub Personal Access Token", regex: new RegExp("ghp_" + "[0-9a-zA-Z]{24,}") },
  { name: "AWS Access Key ID", regex: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Google API Key", regex: new RegExp("AIza" + "[0-9A-Za-z\\-_]{35}") },
  { name: "PEM Private Key Block", regex: new RegExp("-----BEGIN " + "(RSA |EC |OPENSSH )?PRIVATE KEY-----") }
];

/**
 * Extracts a strict 3-part stable SemVer (`major.minor.patch`) from CLI output or tag strings.
 */
export function parseSemVer(raw: string): ParsedSemVer | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/(?:^|\s|\/|^v)v?(\d+)\.(\d+)\.(\d+)(?![0-9A-Za-z.-])/i);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    clean: `${major}.${minor}.${patch}`
  };
}

/**
 * Compares two SemVer strings numerically: returns `1` if `a > b`, `-1` if `a < b`, `0` if equal.
 */
export function compareSemVer(a: string, b: string): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa && !pb) return 0;
  if (pa && !pb) return 1;
  if (!pa && pb) return -1;
  if (pa!.major !== pb!.major) return pa!.major > pb!.major ? 1 : -1;
  if (pa!.minor !== pb!.minor) return pa!.minor > pb!.minor ? 1 : -1;
  if (pa!.patch !== pb!.patch) return pa!.patch > pb!.patch ? 1 : -1;
  return 0;
}

/**
 * Parses `git ls-remote --tags --refs` output and selects the highest stable SemVer tag,
 * ignoring `-rc`, `-beta`, `-alpha`, and non-SemVer tags.
 */
export function selectLatestStableTag(lsRemoteOutput: string): UpstreamTagResolution | null {
  if (typeof lsRemoteOutput !== "string" || lsRemoteOutput.trim().length === 0) return null;
  let best: UpstreamTagResolution | null = null;

  for (const rawLine of lsRemoteOutput.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{40})\s+refs\/tags\/(v?(\d+\.\d+\.\d+))$/i);
    if (!match) continue;
    const commitSha = match[1]!.toLowerCase();
    const tag = match[2]!;
    const version = match[3]!;
    if (!best || compareSemVer(version, best.version) > 0) {
      best = { version, tag, commitSha };
    }
  }

  return best ? deepFreeze(best) : null;
}

/**
 * Parses GoReleaser `checksums.txt` lines (`<sha256>  <filename>`) into an immutable lookup map.
 */
export function parseChecksumsManifest(manifestText: string): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  if (typeof manifestText !== "string") return map;
  for (const rawLine of manifestText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?([^\s]+)$/);
    if (match) {
      map.set(path.basename(match[2]!), match[1]!.toLowerCase());
    }
  }
  return map;
}

/**
 * Verifies archive bytes against the official `checksums.txt` SHA-256 entry (fail-closed).
 */
export function verifyArchiveChecksum(
  archiveBytes: Uint8Array,
  assetFileName: string,
  manifestText: string
): { readonly verified: boolean; readonly expectedSha256: string; readonly actualSha256: string } {
  const manifest = parseChecksumsManifest(manifestText);
  const expectedSha256 = manifest.get(path.basename(assetFileName)) || "";
  const actualSha256 = crypto.createHash("sha256").update(archiveBytes).digest("hex").toLowerCase();
  const verified = expectedSha256.length === 64 && actualSha256 === expectedSha256;
  return deepFreeze({ verified, expectedSha256, actualSha256 });
}

/**
 * Performs an atomic Windows-NTFS-safe executable hot-swap (`target -> target.bak`, copy candidate,
 * run version smoke probe, and automatically restore `.bak` if verification fails).
 */
export function hotSwapExecutableWithRollback(options: {
  readonly targetPath: string;
  readonly candidatePath: string;
  readonly smokeArgs: readonly string[];
  readonly expectedVersionSubstring?: string;
}): HotSwapResult {
  const targetPath = path.resolve(options.targetPath);
  const candidatePath = path.resolve(options.candidatePath);
  assertPrecondition(fs.existsSync(candidatePath), `Candidate binary does not exist: ${candidatePath}`);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  // Best-effort cleanup of unlocked historical `.bak*` artifacts
  try {
    const dir = path.dirname(targetPath);
    const base = path.basename(targetPath);
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(`${base}.bak`)) {
        try {
          fs.rmSync(path.join(dir, entry), { force: true });
        } catch {
          // Still locked by a running process; leave for future cycle
        }
      }
    }
  } catch {
    // Non-fatal
  }

  let backupPath: string | null = null;
  if (fs.existsSync(targetPath)) {
    const primaryBak = `${targetPath}.bak`;
    backupPath = fs.existsSync(primaryBak) ? `${targetPath}.bak.${Date.now()}` : primaryBak;
    fs.renameSync(targetPath, backupPath);
  }

  try {
    fs.copyFileSync(candidatePath, targetPath);
    if (process.platform !== "win32") {
      fs.chmodSync(targetPath, 0o755);
    }

    const isBatch = targetPath.toLowerCase().endsWith(".bat") || targetPath.toLowerCase().endsWith(".cmd");
    const rawOut = isBatch
      ? execFileSync("cmd.exe", ["/d", "/s", "/c", targetPath, ...options.smokeArgs], {
          encoding: "utf8",
          timeout: 6000,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        })
      : execFileSync(targetPath, [...options.smokeArgs], {
          encoding: "utf8",
          timeout: 6000,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true
        });

    const verifiedOutput = String(rawOut || "").trim().split(/\r?\n/)[0] || "ok";
    if (
      options.expectedVersionSubstring &&
      !String(rawOut || "").includes(options.expectedVersionSubstring)
    ) {
      throw new Error(
        `Post-install version mismatch: expected '${options.expectedVersionSubstring}' in '${verifiedOutput}'`
      );
    }

    const binarySha256 = crypto.createHash("sha256").update(fs.readFileSync(targetPath)).digest("hex");

    if (backupPath) {
      try {
        fs.rmSync(backupPath, { force: true });
      } catch {
        // Running MCP daemon on Windows still holds backup file handle; safe to leave until next cycle
      }
    }

    return deepFreeze({
      swapped: true,
      rolledBack: false,
      targetPath,
      backupPath,
      verifiedOutput,
      binarySha256
    });
  } catch (err: any) {
    let rolledBack = false;
    try {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
      }
      if (backupPath && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, targetPath);
        rolledBack = true;
      }
    } catch {
      rolledBack = false;
    }

    const restoredSha =
      fs.existsSync(targetPath)
        ? crypto.createHash("sha256").update(fs.readFileSync(targetPath)).digest("hex")
        : "";

    return deepFreeze({
      swapped: false,
      rolledBack,
      targetPath,
      backupPath,
      verifiedOutput: "",
      binarySha256: restoredSha,
      error: String(err?.message || err)
    });
  }
}

function validateStagingTreeSecurity(dirPath: string, filesCounter = { count: 0 }, hashParts: string[] = [], rootDir = dirPath): { filesVerified: number; treeSha256: string } {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    const lstat = fs.lstatSync(full);
    if (lstat.isSymbolicLink()) {
      throw new Error(`Security gate blocked symbolic link in upstream skills bundle: ${entry.name}`);
    }
    if (lstat.isDirectory()) {
      validateStagingTreeSecurity(full, filesCounter, hashParts, rootDir);
    } else if (lstat.isFile()) {
      const content = fs.readFileSync(full, "utf8");
      for (const pat of SKILL_SECRET_PATTERNS) {
        if (pat.regex.test(content)) {
          throw new Error(`Security gate blocked credential pattern (${pat.name}) in upstream skill file: ${entry.name}`);
        }
      }
      filesCounter.count++;
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      hashParts.push(`${rel}:${pureSha256(content)}`);
    }
  }
  return {
    filesVerified: filesCounter.count,
    treeSha256: pureSha256(hashParts.join("\n"))
  };
}

function copyDirClean(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirClean(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Validates incoming `agent-teams-lite/skills` against symlinks and plaintext secrets,
 * then synchronizes them into `.agents/skills/` while strictly preserving all `eos-*` skills.
 */
export function syncSkillsTreeSafely(upstreamSkillsDir: string, localSkillsDir: string): SkillSyncReport {
  const resolvedUpstream = path.resolve(upstreamSkillsDir);
  const resolvedLocal = path.resolve(localSkillsDir);
  assertPrecondition(fs.existsSync(resolvedUpstream), `Upstream skills directory missing: ${resolvedUpstream}`);

  const securityScan = validateStagingTreeSecurity(resolvedUpstream);
  fs.mkdirSync(resolvedLocal, { recursive: true });

  const preservedEosSkills = fs
    .readdirSync(resolvedLocal, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("eos-"))
    .map((d) => d.name)
    .sort();

  const syncedSkillFolders: string[] = [];
  const upstreamEntries = fs
    .readdirSync(resolvedUpstream, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dirEntry of upstreamEntries) {
    if (dirEntry.name.startsWith("eos-")) {
      // Never allow an upstream skill folder to overwrite a sovereign EOS skill
      continue;
    }
    const targetFolder = path.join(resolvedLocal, dirEntry.name);
    const stagingBackup = `${targetFolder}.eos-sync-bak`;
    if (fs.existsSync(stagingBackup)) {
      fs.rmSync(stagingBackup, { recursive: true, force: true });
    }
    if (fs.existsSync(targetFolder)) {
      fs.renameSync(targetFolder, stagingBackup);
    }
    try {
      copyDirClean(path.join(resolvedUpstream, dirEntry.name), targetFolder);
      if (fs.existsSync(stagingBackup)) {
        fs.rmSync(stagingBackup, { recursive: true, force: true });
      }
      syncedSkillFolders.push(dirEntry.name);
    } catch (err) {
      if (fs.existsSync(targetFolder)) {
        fs.rmSync(targetFolder, { recursive: true, force: true });
      }
      if (fs.existsSync(stagingBackup)) {
        fs.renameSync(stagingBackup, targetFolder);
      }
      throw err;
    }
  }

  return deepFreeze({
    syncedSkillFolders,
    preservedEosSkills,
    filesVerified: securityScan.filesVerified,
    treeSha256: securityScan.treeSha256
  });
}

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

  /**
   * Fast O(1) synchronous check (<2ms) used by Antigravity's `SessionStart` hook
   * to decide whether an opportunistic background update check should be spawned.
   */
  public static isAutoUpdateDue(
    projectRoot: string = process.cwd(),
    intervalHours: number = DEFAULT_AUTO_UPDATE_INTERVAL_HOURS,
    nowMs: number = Date.now()
  ): boolean {
    const lockPath = this.defaultLockPath(projectRoot);
    if (fs.existsSync(lockPath)) {
      try {
        const rawLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        const acquiredAt = typeof rawLock?.acquiredAtMs === "number"
          ? rawLock.acquiredAtMs
          : fs.statSync(lockPath).mtimeMs;
        if (nowMs - acquiredAt < LOCK_STALE_TIMEOUT_MS) {
          return false; // Another update worker is already active
        }
      } catch {
        // Proceed if lock disappeared or malformed
      }
    }

    const state = this.readState(projectRoot);
    if (!state || typeof state.lastCheckedAtMs !== "number") return true;
    const ttlMs = Math.max(0.25, intervalHours) * 60 * 60 * 1000;
    return nowMs - state.lastCheckedAtMs >= ttlMs;
  }

  public static acquireLock(projectRoot: string = process.cwd(), nowMs: number = Date.now()): boolean {
    const lockPath = this.defaultLockPath(projectRoot);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    if (fs.existsSync(lockPath)) {
      try {
        const rawLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        const acquiredAt = typeof rawLock?.acquiredAtMs === "number"
          ? rawLock.acquiredAtMs
          : fs.statSync(lockPath).mtimeMs;
        if (nowMs - acquiredAt >= LOCK_STALE_TIMEOUT_MS) {
          fs.rmSync(lockPath, { force: true });
        } else {
          return false;
        }
      } catch {
        // Ignore race if lock was just removed
      }
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
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  }

  public static computeConstitutionDigest(
    projectRoot: string = process.cwd(),
    geminiConfigDir: string = path.join(os.homedir(), ".gemini", "config")
  ): string {
    const parts: string[] = [];
    const globalConstitution = path.join(path.resolve(geminiConfigDir), "AGENTS.md");
    const pluginConstitution = path.join(
      path.resolve(projectRoot),
      "integrations",
      "antigravity",
      "eos-governance",
      "rules",
      "AGENTS.md"
    );
    if (fs.existsSync(globalConstitution)) {
      parts.push(`global:${pureSha256(fs.readFileSync(globalConstitution, "utf8"))}`);
    }
    if (fs.existsSync(pluginConstitution)) {
      parts.push(`plugin:${pureSha256(fs.readFileSync(pluginConstitution, "utf8"))}`);
    }
    return pureSha256(parts.join("|") || "constitution-baseline");
  }

  private static queryGitLsRemote(args: readonly string[]): string {
    return execFileSync("git", ["ls-remote", ...args], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  }

  private static resolvePlatformTargets(): { osName: string; archName: string; archiveExt: string } {
    const osName =
      process.platform === "win32"
        ? "windows"
        : process.platform === "darwin"
          ? "darwin"
          : "linux";
    const archName = process.arch === "arm64" ? "arm64" : "amd64";
    const archiveExt = osName === "windows" ? "zip" : "tar.gz";
    return { osName, archName, archiveExt };
  }

  private static extractArchiveToDir(archivePath: string, extractDir: string): void {
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      execFileSync("tar", ["-xf", archivePath, "-C", extractDir], {
        timeout: 20000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
    } catch {
      if (process.platform === "win32" && archivePath.endsWith(".zip")) {
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
          ],
          { timeout: 30000, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
        );
      } else {
        throw new Error(`Failed to extract archive: ${archivePath}`);
      }
    }
  }

  private static async upgradeEngramRelease(
    latestVersion: string,
    targetExecutablePath: string
  ): Promise<HotSwapResult> {
    const { osName, archName, archiveExt } = this.resolvePlatformTargets();
    const assetName = `engram_${latestVersion}_${osName}_${archName}.${archiveExt}`;
    const baseUrl = `https://github.com/Gentleman-Programming/engram/releases/download/v${latestVersion}`;

    const [checksumsRes, archiveRes] = await Promise.all([
      fetch(`${baseUrl}/checksums.txt`, { signal: AbortSignal.timeout(25000) }),
      fetch(`${baseUrl}/${assetName}`, { signal: AbortSignal.timeout(45000) })
    ]);

    if (!checksumsRes.ok) {
      throw new Error(`Failed to fetch engram checksums.txt (HTTP ${checksumsRes.status})`);
    }
    if (!archiveRes.ok) {
      throw new Error(`Failed to fetch ${assetName} (HTTP ${archiveRes.status})`);
    }

    const checksumsText = await checksumsRes.text();
    const archiveBytes = new Uint8Array(await archiveRes.arrayBuffer());
    const verification = verifyArchiveChecksum(archiveBytes, assetName, checksumsText);
    if (!verification.verified) {
      throw new Error(
        `SHA-256 supply-chain verification failed for ${assetName}: expected ${verification.expectedSha256}, got ${verification.actualSha256}`
      );
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-engram-upgrade-"));
    try {
      const archivePath = path.join(tmpDir, assetName);
      const extractDir = path.join(tmpDir, "extracted");
      fs.writeFileSync(archivePath, archiveBytes);
      this.extractArchiveToDir(archivePath, extractDir);

      const exeName = process.platform === "win32" ? "engram.exe" : "engram";
      const candidatePath = path.join(extractDir, exeName);
      if (!fs.existsSync(candidatePath)) {
        throw new Error(`Extracted archive ${assetName} did not contain ${exeName}`);
      }

      return hotSwapExecutableWithRollback({
        targetPath: targetExecutablePath,
        candidatePath,
        smokeArgs: ["version"],
        expectedVersionSubstring: latestVersion
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static async upgradeGentleAiRelease(
    latestVersion: string,
    latestTag: string,
    targetExecutablePath: string
  ): Promise<HotSwapResult> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gentleai-upgrade-"));
    try {
      if (process.platform !== "win32") {
        const { osName, archName } = this.resolvePlatformTargets();
        const assetName = `gentle-ai_${latestVersion}_${osName}_${archName}.tar.gz`;
        const baseUrl = `https://github.com/Gentleman-Programming/gentle-ai/releases/download/v${latestVersion}`;
        const [checksumsRes, archiveRes] = await Promise.all([
          fetch(`${baseUrl}/checksums.txt`, { signal: AbortSignal.timeout(25000) }),
          fetch(`${baseUrl}/${assetName}`, { signal: AbortSignal.timeout(45000) })
        ]);
        if (checksumsRes.ok && archiveRes.ok) {
          const checksumsText = await checksumsRes.text();
          const archiveBytes = new Uint8Array(await archiveRes.arrayBuffer());
          const verification = verifyArchiveChecksum(archiveBytes, assetName, checksumsText);
          if (!verification.verified) {
            throw new Error(`SHA-256 verification failed for ${assetName}`);
          }
          const archivePath = path.join(tmpDir, assetName);
          const extractDir = path.join(tmpDir, "extracted");
          fs.writeFileSync(archivePath, archiveBytes);
          this.extractArchiveToDir(archivePath, extractDir);
          const candidatePath = path.join(extractDir, "gentle-ai");
          return hotSwapExecutableWithRollback({
            targetPath: targetExecutablePath,
            candidatePath,
            smokeArgs: ["--version"],
            expectedVersionSubstring: latestVersion
          });
        }
      }

      // Windows & source-verified Go toolchain path (builds against official upstream go.sum)
      const cloneDir = path.join(tmpDir, "src");
      execFileSync(
        "git",
        ["clone", "--depth", "1", "--branch", latestTag, GENTLEMAN_REPOS["gentle-ai"], cloneDir],
        { timeout: 60000, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );
      const exeName = process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai";
      const candidatePath = path.join(tmpDir, exeName);
      execFileSync(
        "go",
        ["build", "-ldflags=-s -w", "-o", candidatePath, "./cmd/gentle-ai"],
        { cwd: cloneDir, timeout: 120000, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );

      return hotSwapExecutableWithRollback({
        targetPath: targetExecutablePath,
        candidatePath,
        smokeArgs: ["--version"],
        expectedVersionSubstring: latestVersion
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static upgradeGgaFromTag(
    latestVersion: string,
    latestTag: string,
    homeDir: string
  ): HotSwapResult {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gga-upgrade-"));
    const binDir = path.join(homeDir, "bin");
    const libTargetDir = path.join(binDir, "lib", "gga");
    const libBackupDir = path.join(binDir, "lib", "gga.bak");

    try {
      const cloneDir = path.join(tmpDir, "gga-src");
      execFileSync(
        "git",
        ["clone", "--depth", "1", "--branch", latestTag, GENTLEMAN_REPOS.gga, cloneDir],
        { timeout: 45000, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );

      fs.mkdirSync(path.join(binDir, "lib"), { recursive: true });
      if (fs.existsSync(libBackupDir)) {
        fs.rmSync(libBackupDir, { recursive: true, force: true });
      }
      if (fs.existsSync(libTargetDir)) {
        fs.renameSync(libTargetDir, libBackupDir);
      }

      try {
        copyDirClean(path.join(cloneDir, "lib"), libTargetDir);
        // Upstream gga prints `gga vdev` unless GGA_VERSION is pinned. Bake the
        // installed SemVer tag so evergreen probes and --version stay deterministic.
        const ggaScriptSource = fs
          .readFileSync(path.join(cloneDir, "bin", "gga"), "utf8")
          .replace('LIB_DIR="$SCRIPT_DIR/../lib"', 'LIB_DIR="$SCRIPT_DIR/lib/gga"')
          .replace(
            /VERSION="\$\{GGA_VERSION:-dev\}"/,
            `VERSION="\${GGA_VERSION:-${latestVersion}}"`
          );
        const candidateGga = path.join(tmpDir, "gga");
        fs.writeFileSync(candidateGga, ggaScriptSource, { encoding: "utf8", mode: 0o755 });

        if (process.platform === "win32") {
          const batPath = path.join(binDir, "gga.bat");
          if (!fs.existsSync(batPath)) {
            fs.writeFileSync(
              batPath,
              '@echo off\r\n"C:\\Program Files\\Git\\bin\\bash.exe" "%~dp0gga" %*\r\n',
              "utf8"
            );
          }
        }

        const swapTarget = process.platform === "win32" ? path.join(binDir, "gga") : path.join(binDir, "gga");
        fs.copyFileSync(candidateGga, swapTarget);
        if (process.platform !== "win32") {
          fs.chmodSync(swapTarget, 0o755);
        }

        const probeTarget = process.platform === "win32" && fs.existsSync(path.join(binDir, "gga.bat"))
          ? path.join(binDir, "gga.bat")
          : swapTarget;
        const probeEnv = { ...process.env, GGA_VERSION: latestVersion };
        const out = process.platform === "win32" && probeTarget.endsWith(".bat")
          ? execFileSync("cmd.exe", ["/d", "/s", "/c", probeTarget, "--version"], {
              encoding: "utf8",
              timeout: 6000,
              stdio: ["ignore", "pipe", "pipe"],
              windowsHide: true,
              env: probeEnv
            })
          : execFileSync(probeTarget, ["--version"], {
              encoding: "utf8",
              timeout: 6000,
              stdio: ["ignore", "pipe", "pipe"],
              windowsHide: true,
              env: probeEnv
            });

        if (!String(out || "").includes(latestVersion)) {
          throw new Error(`gga version check did not contain ${latestVersion}`);
        }
        if (fs.existsSync(libBackupDir)) {
          fs.rmSync(libBackupDir, { recursive: true, force: true });
        }

        return deepFreeze({
          swapped: true,
          rolledBack: false,
          targetPath: probeTarget,
          backupPath: null,
          verifiedOutput: String(out || "").trim().split(/\r?\n/)[0] || `gga v${latestVersion}`,
          binarySha256: pureSha256(ggaScriptSource)
        });
      } catch (err: any) {
        if (fs.existsSync(libTargetDir)) {
          fs.rmSync(libTargetDir, { recursive: true, force: true });
        }
        if (fs.existsSync(libBackupDir)) {
          fs.renameSync(libBackupDir, libTargetDir);
        }
        return deepFreeze({
          swapped: false,
          rolledBack: true,
          targetPath: path.join(binDir, "gga"),
          backupPath: libBackupDir,
          verifiedOutput: "",
          binarySha256: "",
          error: String(err?.message || err)
        });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private static upgradeAgentTeamsLiteSkills(
    projectRoot: string,
    gentleAiPath?: string
  ): SkillSyncReport {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-atl-upgrade-"));
    try {
      const cloneDir = path.join(tmpDir, "atl");
      execFileSync(
        "git",
        ["clone", "--depth", "1", GENTLEMAN_REPOS["agent-teams-lite"], cloneDir],
        { timeout: 45000, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );
      const report = syncSkillsTreeSafely(
        path.join(cloneDir, "skills"),
        path.join(projectRoot, ".agents", "skills")
      );

      // Refresh .atl/skill-registry.md when gentle-ai is present
      if (gentleAiPath && fs.existsSync(gentleAiPath)) {
        try {
          execFileSync(gentleAiPath, ["skill-registry", "refresh"], {
            cwd: projectRoot,
            timeout: 10000,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true
          });
        } catch {
          // Non-fatal if gentle-ai skill-registry uses cached registry
        }
      }

      return report;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Executes a full Evergreen Update Check or Apply cycle across all 4 Gentleman repositories.
   */
  public static async runUpdateCycle(options: {
    readonly projectRoot?: string;
    readonly geminiConfigDir?: string;
    readonly homeDir?: string;
    readonly apply?: boolean;
    readonly force?: boolean;
    readonly intervalHours?: number;
  } = {}): Promise<GentlemanUpdateCycleReport> {
    const projectRoot = path.resolve(options.projectRoot || process.cwd());
    const homeDir = path.resolve(options.homeDir || os.homedir());
    const geminiConfigDir = path.resolve(
      options.geminiConfigDir || path.join(homeDir, ".gemini", "config")
    );
    const apply = Boolean(options.apply);
    const force = Boolean(options.force);
    const intervalHours = options.intervalHours ?? DEFAULT_AUTO_UPDATE_INTERVAL_HOURS;
    const mode = apply ? "APPLY" : "CHECK_ONLY";
    const nowIso = new Date().toISOString();

    const constitutionBefore = this.computeConstitutionDigest(projectRoot, geminiConfigDir);

    if (!this.acquireLock(projectRoot)) {
      const skippedReceipt = pureSha256(`LOCK_SKIPPED:${nowIso}:${constitutionBefore}`);
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
        sha256Receipt: skippedReceipt
      });
    }

    try {
      const priorState = this.readState(projectRoot);
      const components: GentlemanComponentCheck[] = [];
      let updatesDetected = 0;
      let updatesApplied = 0;
      let rollbacksTriggered = 0;

      // Probe current local binaries
      const gentleProbe = EosGentlemanStackBridge.probeBinary(
        "gentle-ai",
        ["--version"],
        [
          path.join(homeDir, "go", "bin", process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai"),
          path.join(homeDir, "AppData", "Local", "gentle-ai", "bin", "gentle-ai.exe")
        ],
        homeDir
      );
      const engramProbe = EosGentlemanStackBridge.probeBinary(
        "engram",
        ["version"],
        [
          path.join(homeDir, "AppData", "Local", "engram", "bin", "engram.exe"),
          path.join(homeDir, "go", "bin", process.platform === "win32" ? "engram.exe" : "engram")
        ],
        homeDir
      );
      const ggaProbe = EosGentlemanStackBridge.probeBinary(
        "gga",
        ["--version"],
        [
          path.join(homeDir, "bin", process.platform === "win32" ? "gga.bat" : "gga"),
          path.join(homeDir, "bin", "gga")
        ],
        homeDir
      );

      // 1. Check & optionally upgrade `gentle-ai`
      const gentleInstalled = parseSemVer(gentleProbe.versionOutput)?.clean || "0.0.0";
      try {
        const lsOut = this.queryGitLsRemote(["--tags", "--refs", GENTLEMAN_REPOS["gentle-ai"]]);
        const latest = selectLatestStableTag(lsOut);
        if (!latest) throw new Error("No stable SemVer tags returned");
        const needsUpdate = compareSemVer(latest.version, gentleInstalled) > 0 || (force && apply);
        if (needsUpdate) updatesDetected++;

        if (apply && needsUpdate) {
          const targetExe =
            gentleProbe.executablePath ||
            path.join(homeDir, "go", "bin", process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai");
          const swap = await this.upgradeGentleAiRelease(latest.version, latest.tag, targetExe);
          if (swap.swapped) {
            updatesApplied++;
            components.push({
              componentId: "gentle-ai",
              repositoryUrl: GENTLEMAN_REPOS["gentle-ai"],
              installedVersion: latest.version,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: false,
              status: "UPDATED",
              detail: `Upgraded gentle-ai ${gentleInstalled} -> ${latest.version} (sha256:${swap.binarySha256.slice(0, 12)})`
            });
          } else {
            if (swap.rolledBack) rollbacksTriggered++;
            components.push({
              componentId: "gentle-ai",
              repositoryUrl: GENTLEMAN_REPOS["gentle-ai"],
              installedVersion: gentleInstalled,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: true,
              status: swap.rolledBack ? "ROLLED_BACK" : "ERROR",
              detail: `Upgrade failed (${swap.error || "unknown"}); rollback=${swap.rolledBack}`
            });
          }
        } else {
          components.push({
            componentId: "gentle-ai",
            repositoryUrl: GENTLEMAN_REPOS["gentle-ai"],
            installedVersion: gentleInstalled,
            latestVersion: latest.version,
            latestCommitSha: latest.commitSha,
            updateAvailable: needsUpdate,
            status: needsUpdate ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
            detail: needsUpdate
              ? `Update available: ${gentleInstalled} -> ${latest.version}`
              : `Latest stable ${latest.version} active`
          });
        }
      } catch (err: any) {
        components.push({
          componentId: "gentle-ai",
          repositoryUrl: GENTLEMAN_REPOS["gentle-ai"],
          installedVersion: gentleInstalled,
          latestVersion: gentleInstalled,
          latestCommitSha: "",
          updateAvailable: false,
          status: "SKIPPED_OFFLINE",
          detail: `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`
        });
      }

      // 2. Check & optionally upgrade `engram` (with checksums.txt SHA-256 + Windows running-MCP hot-swap)
      const engramInstalled = parseSemVer(engramProbe.versionOutput)?.clean || "0.0.0";
      try {
        const lsOut = this.queryGitLsRemote(["--tags", "--refs", GENTLEMAN_REPOS.engram]);
        const latest = selectLatestStableTag(lsOut);
        if (!latest) throw new Error("No stable SemVer tags returned");
        const needsUpdate = compareSemVer(latest.version, engramInstalled) > 0 || (force && apply);
        if (needsUpdate) updatesDetected++;

        if (apply && needsUpdate) {
          const targetExe =
            engramProbe.executablePath ||
            path.join(
              homeDir,
              process.platform === "win32" ? path.join("AppData", "Local", "engram", "bin", "engram.exe") : path.join("go", "bin", "engram")
            );
          const swap = await this.upgradeEngramRelease(latest.version, targetExe);
          if (swap.swapped) {
            updatesApplied++;
            components.push({
              componentId: "engram",
              repositoryUrl: GENTLEMAN_REPOS.engram,
              installedVersion: latest.version,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: false,
              status: "UPDATED",
              detail: `Hot-swapped engram ${engramInstalled} -> ${latest.version} with verified checksums.txt (sha256:${swap.binarySha256.slice(0, 12)})`
            });
          } else {
            if (swap.rolledBack) rollbacksTriggered++;
            components.push({
              componentId: "engram",
              repositoryUrl: GENTLEMAN_REPOS.engram,
              installedVersion: engramInstalled,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: true,
              status: swap.rolledBack ? "ROLLED_BACK" : "ERROR",
              detail: `Upgrade failed (${swap.error || "unknown"}); rollback=${swap.rolledBack}`
            });
          }
        } else {
          components.push({
            componentId: "engram",
            repositoryUrl: GENTLEMAN_REPOS.engram,
            installedVersion: engramInstalled,
            latestVersion: latest.version,
            latestCommitSha: latest.commitSha,
            updateAvailable: needsUpdate,
            status: needsUpdate ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
            detail: needsUpdate
              ? `Update available: ${engramInstalled} -> ${latest.version}`
              : `Latest stable ${latest.version} active`
          });
        }
      } catch (err: any) {
        components.push({
          componentId: "engram",
          repositoryUrl: GENTLEMAN_REPOS.engram,
          installedVersion: engramInstalled,
          latestVersion: engramInstalled,
          latestCommitSha: "",
          updateAvailable: false,
          status: "SKIPPED_OFFLINE",
          detail: `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`
        });
      }

      // 3. Check & optionally upgrade `gga`
      const ggaInstalled = parseSemVer(ggaProbe.versionOutput)?.clean || "0.0.0";
      try {
        const lsOut = this.queryGitLsRemote(["--tags", "--refs", GENTLEMAN_REPOS.gga]);
        const latest = selectLatestStableTag(lsOut);
        if (!latest) throw new Error("No stable SemVer tags returned");
        const needsUpdate = compareSemVer(latest.version, ggaInstalled) > 0 || (force && apply);
        if (needsUpdate) updatesDetected++;

        if (apply && needsUpdate) {
          const swap = this.upgradeGgaFromTag(latest.version, latest.tag, homeDir);
          if (swap.swapped) {
            updatesApplied++;
            components.push({
              componentId: "gga",
              repositoryUrl: GENTLEMAN_REPOS.gga,
              installedVersion: latest.version,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: false,
              status: "UPDATED",
              detail: `Upgraded gga ${ggaInstalled} -> ${latest.version}`
            });
          } else {
            if (swap.rolledBack) rollbacksTriggered++;
            components.push({
              componentId: "gga",
              repositoryUrl: GENTLEMAN_REPOS.gga,
              installedVersion: ggaInstalled,
              latestVersion: latest.version,
              latestCommitSha: latest.commitSha,
              updateAvailable: true,
              status: swap.rolledBack ? "ROLLED_BACK" : "ERROR",
              detail: `Upgrade failed (${swap.error || "unknown"}); rollback=${swap.rolledBack}`
            });
          }
        } else {
          components.push({
            componentId: "gga",
            repositoryUrl: GENTLEMAN_REPOS.gga,
            installedVersion: ggaInstalled,
            latestVersion: latest.version,
            latestCommitSha: latest.commitSha,
            updateAvailable: needsUpdate,
            status: needsUpdate ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
            detail: needsUpdate
              ? `Update available: ${ggaInstalled} -> ${latest.version}`
              : `Latest stable ${latest.version} active`
          });
        }
      } catch (err: any) {
        components.push({
          componentId: "gga",
          repositoryUrl: GENTLEMAN_REPOS.gga,
          installedVersion: ggaInstalled,
          latestVersion: ggaInstalled,
          latestCommitSha: "",
          updateAvailable: false,
          status: "SKIPPED_OFFLINE",
          detail: `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`
        });
      }

      // 4. Check & optionally sync `agent-teams-lite` skills (`HEAD` commit tracking)
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
            detail: `Synced ${syncReport.syncedSkillFolders.length} Gentleman skill dirs (${syncReport.filesVerified} files SAST-verified; preserved ${syncReport.preservedEosSkills.length} eos-* skills)`
          });
        } else {
          // Record baseline commit SHA when local skills are already present during check
          if (!syncedAtlCommit && localSddExists) {
            syncedAtlCommit = latestHeadSha;
          }
          const drift = syncedAtlCommit !== latestHeadSha;
          components.push({
            componentId: "agent-teams-lite",
            repositoryUrl: GENTLEMAN_REPOS["agent-teams-lite"],
            installedVersion: effectiveInstalledSha === "vendored-initial" ? latestHeadSha.slice(0, 12) : effectiveInstalledSha.slice(0, 12),
            latestVersion: latestHeadSha.slice(0, 12),
            latestCommitSha: latestHeadSha,
            updateAvailable: drift,
            status: drift ? "UPDATE_AVAILABLE" : "UP_TO_DATE",
            detail: drift
              ? `New upstream skills commit available: ${latestHeadSha.slice(0, 12)}`
              : `Skills aligned at commit ${latestHeadSha.slice(0, 12)}`
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
          detail: `Upstream probe skipped: ${String(err?.message || err).slice(0, 120)}`
        });
      }

      const constitutionAfter = this.computeConstitutionDigest(projectRoot, geminiConfigDir);
      const constitutionPreserved = constitutionBefore === constitutionAfter;
      assertPostcondition(
        constitutionPreserved,
        "ConstitutionPreservationInvariant violated during Gentleman auto-update cycle"
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
            status: c.status
          }))
        })
      );

      // Persist state file for TTL & SessionStart coordination
      const stateFilePath = this.defaultStatePath(projectRoot);
      fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
      const componentMap: Record<string, { version: string; updatedAtIso: string }> = {};
      for (const comp of components) {
        componentMap[comp.componentId] = {
          version: comp.installedVersion,
          updatedAtIso: nowIso
        };
      }
      const nextState: PersistedAutoUpdateState = {
        lastCheckedAtIso: nowIso,
        lastCheckedAtMs: Date.now(),
        lastAppliedAtIso: apply ? nowIso : priorState?.lastAppliedAtIso || null,
        checkIntervalHours: intervalHours,
        agentTeamsLiteCommitSha: syncedAtlCommit,
        components: componentMap,
        lastReceiptSha256: sha256Receipt
      };
      fs.writeFileSync(stateFilePath, JSON.stringify(nextState, null, 2) + "\n", "utf8");

      // Seal durable SQLite WAL ledger receipt on APPLY or when updates were applied
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
                status: c.status
              }))
            },
            engramTopicKey: "config/gentleman-evergreen-autoupdate"
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
        sha256Receipt
      });
    } finally {
      this.releaseLock(projectRoot);
    }
  }
}
