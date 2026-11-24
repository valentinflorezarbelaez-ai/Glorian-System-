import crypto from "node:crypto";
import { spawnSync, type spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type SandboxContainerRuntime = "runc" | "runsc" | "auto";

export interface SandboxCommandDeps {
  readonly runDockerSync?: (args: readonly string[], timeout: number) => string;
  readonly spawnDocker?: typeof spawn;
}

export interface SandboxRunOptions {
  readonly worktreePath: string;
  readonly command: string;
  readonly commandArgs?: readonly string[];
  readonly applyChanges?: boolean;
  readonly timeoutMs?: number;
  readonly runtime?: SandboxContainerRuntime;
}

export interface SandboxRunReport {
  readonly success: boolean;
  readonly status: "COMPLETED" | "COMMAND_FAILED" | "TIMED_OUT" | "CONFLICT" | "FAILED";
  readonly exitCode: number | null;
  readonly timeoutMs: number;
  readonly runtime?: "runc" | "runsc";
  readonly appliedChanges: boolean;
  readonly changedFiles: readonly string[];
  readonly conflicts: readonly string[];
  readonly excludedPaths: readonly string[];
  readonly receiptPath: string | null;
  readonly error?: string;
}

export interface FileRecord {
  readonly sha256: string;
  readonly size: number;
  readonly mode: number;
  readonly sandboxMode: number;
}

export interface SnapshotManifest {
  readonly files: Map<string, FileRecord>;
  readonly bytes: number;
  readonly symlinks: readonly string[];
}

export interface DockerImageInfo {
  readonly ref: string;
  readonly digest: string;
}

export const MAX_SNAPSHOT_FILES = 20_000;
export const MAX_SNAPSHOT_BYTES = 512 * 1024 * 1024;
export const MAX_SINGLE_FILE_BYTES = 64 * 1024 * 1024;

const EXCLUDED_DIRECTORIES = new Set(
  ".git,.worktrees,.eos,.vercel,.next,.turbo,.terraform,.secrets,secret,secrets,credentials,coverage,node_modules".split(
    ",",
  ),
);

const SENSITIVE_FILENAMES = new Set(
  ".npmrc,.pypirc,.netrc,credentials,credentials.json,credential.json,credentials.yaml,credentials.yml,secrets,secrets.json,secrets.yaml,secrets.yml,secret.json,secret.yaml,secret.yml,service-account.json,service_account.json,terraform.tfstate,terraform.tfstate.backup".split(
    ",",
  ),
);

const SECRET_DIR_NAMES = [".ssh", ".aws", ".azure", ".kube", ".config", ".docker"];

export function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function isExcluded(relativePath: string, isDirectory: boolean): boolean {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] || "";
  const lower = name.toLowerCase();
  if (isDirectory && EXCLUDED_DIRECTORIES.has(lower)) return true;
  if (parts.slice(0, -1).some((part) => EXCLUDED_DIRECTORIES.has(part.toLowerCase()))) return true;
  if (SECRET_DIR_NAMES.some((secretDir) => parts.some((part) => part.toLowerCase() === secretDir))) return true;
  if (lower.startsWith(".env") && ![".env.example", ".env.sample", ".env.template"].includes(lower)) return true;
  if (SENSITIVE_FILENAMES.has(lower)) return true;
  if (/(secret|credential|service.account|firebase.adminsdk).+\.(json|ya?ml)$/i.test(name)) return true;
  if (/^(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\.pub)?$/i.test(name)) return true;
  if (/\.(pem|key|p8|ppk|p12|pfx|jks|keystore|secret|token|tfstate)$/i.test(name)) return true;
  return false;
}

export function recordFile(filePath: string, relativePath: string): FileRecord {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`Non-regular file encountered in sandbox workspace: ${relativePath}`);
  if (stat.size > MAX_SINGLE_FILE_BYTES) throw new RangeError(`File exceeds the 64 MiB sandbox limit: ${relativePath}`);
  const content = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    size: content.byteLength,
    mode: stat.mode & 0o777,
    sandboxMode: stat.mode & 0o777,
  };
}

export function recordsEqual(a: FileRecord | undefined, b: FileRecord | undefined): boolean {
  return a === b || (!!a && !!b && a.sha256 === b.sha256 && a.mode === b.mode);
}

export interface WorkspaceLimitOverrides {
  readonly maxFiles?: number;
  readonly maxBytes?: number;
  readonly maxSingleFileBytes?: number;
}

export function scanWorkspace(
  workspacePath: string,
  baseline?: SnapshotManifest,
  originalModes?: ReadonlyMap<string, number>,
  limits: WorkspaceLimitOverrides = {},
): SnapshotManifest {
  const maxFiles = limits.maxFiles ?? MAX_SNAPSHOT_FILES;
  const maxBytes = limits.maxBytes ?? MAX_SNAPSHOT_BYTES;
  const files = new Map<string, FileRecord>();
  const symlinks: string[] = [];
  let bytes = 0;
  const walk = (directory: string, relativeDirectory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      // Detect symlinks BEFORE exclusion rules so container symlinks disguised under `.git` or `node_modules` cannot slip past.
      if (entry.isSymbolicLink()) {
        symlinks.push(relativePath);
        continue;
      }
      if (isExcluded(relativePath, entry.isDirectory())) continue;
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const observed = recordFile(absolutePath, relativePath);
      const prior = baseline?.files.get(relativePath);
      const originalMode = originalModes?.get(relativePath);
      const mode = prior && observed.sandboxMode === prior.sandboxMode ? prior.mode : (originalMode ?? observed.mode);
      const record = { ...observed, mode };
      files.set(relativePath, record);
      bytes += record.size;
      if (files.size > maxFiles || bytes > maxBytes) {
        throw new RangeError("Sandbox workspace exceeded its 20,000-file or 512 MiB limit.");
      }
    }
  };
  walk(workspacePath, "");
  return { files, bytes, symlinks };
}

export function assertWorkspaceWithinLimits(workspacePath: string, limits: WorkspaceLimitOverrides = {}): void {
  const maxFiles = limits.maxFiles ?? MAX_SNAPSHOT_FILES;
  const maxBytes = limits.maxBytes ?? MAX_SNAPSHOT_BYTES;
  const maxSingle = limits.maxSingleFileBytes ?? MAX_SINGLE_FILE_BYTES;
  let files = 0;
  let bytes = 0;
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        const size = fs.statSync(absolutePath).size;
        files += 1;
        bytes += size;
        if (size > maxSingle || files > maxFiles || bytes > maxBytes) {
          throw new RangeError("Sandbox workspace exceeded its live 64 MiB/file, 20,000-file, or 512 MiB budget.");
        }
      }
    }
  };
  walk(workspacePath);
}

function makeWritableForContainer(targetPath: string, isDirectory: boolean): void {
  if (process.platform === "win32") return;
  try {
    fs.chmodSync(targetPath, isDirectory ? 0o777 : (fs.statSync(targetPath).mode & 0o777) | 0o222);
  } catch {}
}

export function copyFilteredWorkspace(
  sourceRoot: string,
  destinationRoot: string,
): { readonly excludedPaths: string[]; readonly originalModes: ReadonlyMap<string, number> } {
  const excluded: string[] = [];
  const originalModes = new Map<string, number>();
  let files = 0;
  let bytes = 0;
  const gitResult = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: sourceRoot,
    encoding: "utf8",
    timeout: 8_000,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (gitResult.error || gitResult.status !== 0) {
    throw new Error(
      `Unable to enumerate non-ignored worktree files: ${gitResult.error?.message || gitResult.stderr || "git failed"}`,
    );
  }

  for (const relativePath of (gitResult.stdout || "").split("\0").filter(Boolean)) {
    if (isExcluded(relativePath, false)) {
      excluded.push(relativePath);
      continue;
    }
    const components = relativePath.split("/").filter(Boolean);
    const sourcePath = path.resolve(sourceRoot, ...components);
    if (!isPathWithin(sourceRoot, sourcePath) || sourcePath === sourceRoot) {
      excluded.push(`${relativePath} (unsafe path)`);
      continue;
    }
    let cursor = sourceRoot;
    let unsafeParent = false;
    for (const component of components.slice(0, -1)) {
      cursor = path.join(cursor, component);
      try {
        const parentStat = fs.lstatSync(cursor);
        if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) unsafeParent = true;
      } catch {
        unsafeParent = true;
      }
      if (unsafeParent) break;
    }
    if (unsafeParent) {
      excluded.push(`${relativePath} (symlink parent or missing path)`);
      continue;
    }
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(sourcePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      excluded.push(`${relativePath} (symlink or non-regular file)`);
      continue;
    }
    if (stat.size > MAX_SINGLE_FILE_BYTES) {
      throw new RangeError(`File exceeds the 64 MiB sandbox limit: ${relativePath}`);
    }
    files += 1;
    bytes += stat.size;
    if (files > MAX_SNAPSHOT_FILES || bytes > MAX_SNAPSHOT_BYTES) {
      throw new RangeError("Sandbox input exceeded its 20,000-file or 512 MiB limit.");
    }
    const destinationPath = path.resolve(destinationRoot, ...components);
    if (!isPathWithin(destinationRoot, destinationPath)) throw new Error(`Unsafe destination path: ${relativePath}`);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true, mode: 0o777 });
    fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    originalModes.set(relativePath, stat.mode & 0o777);
    try {
      fs.chmodSync(destinationPath, stat.mode & 0o777);
    } catch {}
    makeWritableForContainer(destinationPath, false);
    for (
      let directory = path.dirname(destinationPath);
      isPathWithin(destinationRoot, directory) && directory !== destinationRoot;
      directory = path.dirname(directory)
    ) {
      makeWritableForContainer(directory, true);
    }
  }
  makeWritableForContainer(destinationRoot, true);
  return { excludedPaths: excluded, originalModes };
}

function targetForRelativePath(root: string, relativePath: string): string {
  const target = path.resolve(root, ...relativePath.split("/"));
  if (!isPathWithin(root, target) || target === root) {
    throw new Error(`Unsafe workspace-relative path: ${relativePath}`);
  }
  return target;
}

function walkParentDirectories(root: string, targetPath: string, createdDirs: string[] | null): void {
  const relativeParent = path.relative(root, path.dirname(targetPath));
  let cursor = root;
  for (const component of relativeParent.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    try {
      const stat = fs.lstatSync(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`Refusing symlink or non-directory parent: ${cursor}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!createdDirs) return;
      fs.mkdirSync(cursor);
      createdDirs.push(cursor);
    }
  }
}

function targetMatchesBaseline(targetPath: string, baseline: FileRecord | undefined): boolean {
  try {
    const stat = fs.lstatSync(targetPath);
    if (!baseline || !stat.isFile() || stat.isSymbolicLink()) return false;
    return recordFile(targetPath, targetPath).sha256 === baseline.sha256 && (stat.mode & 0o777) === baseline.mode;
  } catch (error) {
    return !baseline && (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

interface UndoEntry {
  readonly targetPath: string;
  readonly existed: boolean;
  readonly bytes?: Buffer;
  readonly mode?: number;
}

function rollbackWriteback(undoEntries: UndoEntry[], createdDirs: string[]): void {
  for (let i = undoEntries.length - 1; i >= 0; i--) {
    const entry = undoEntries[i]!;
    try {
      if (entry.existed && entry.bytes !== undefined) {
        fs.writeFileSync(entry.targetPath, entry.bytes);
        if (entry.mode !== undefined) {
          try {
            fs.chmodSync(entry.targetPath, entry.mode);
          } catch {}
        }
      } else {
        fs.rmSync(entry.targetPath, { force: true });
      }
    } catch {}
  }
  for (let i = createdDirs.length - 1; i >= 0; i--) {
    try {
      fs.rmdirSync(createdDirs[i]!);
    } catch {}
  }
}

/**
 * Two-phase atomic workspace writeback: preflight-validates all modified targets
 * without mutating the host, then commits using an in-memory undo journal so any
 * mid-flight conflict or I/O error rolls the live worktree back to its baseline.
 */
export function applyWorkspaceChanges(
  projectRoot: string,
  snapshotRoot: string,
  baseline: SnapshotManifest,
  after: SnapshotManifest,
  faultHook?: (relativePath: string, appliedCount: number) => void,
): { applied: string[]; conflicts: string[] } {
  const root = fs.realpathSync.native(projectRoot);
  if (after.symlinks.length > 0) {
    throw new Error(`Sandbox output contains symlinks; refusing writeback: ${after.symlinks.slice(0, 5).join(", ")}`);
  }

  const pending: Array<{
    relativePath: string;
    targetPath: string;
    original: FileRecord | undefined;
    proposed: FileRecord | undefined;
  }> = [];
  const preflightConflicts: string[] = [];

  for (const relativePath of [...new Set([...baseline.files.keys(), ...after.files.keys()])].sort()) {
    const original = baseline.files.get(relativePath);
    const proposed = after.files.get(relativePath);
    if (recordsEqual(original, proposed)) continue;
    try {
      const targetPath = targetForRelativePath(root, relativePath);
      walkParentDirectories(root, targetPath, null);
      if (!targetMatchesBaseline(targetPath, original)) {
        preflightConflicts.push(relativePath);
        continue;
      }
      pending.push({ relativePath, targetPath, original, proposed });
    } catch {
      preflightConflicts.push(relativePath);
    }
  }

  if (preflightConflicts.length > 0) {
    return { applied: [], conflicts: preflightConflicts };
  }

  const applied: string[] = [];
  const undoEntries: UndoEntry[] = [];
  const createdDirs: string[] = [];

  for (const item of pending) {
    const temporaryPath = path.join(
      path.dirname(item.targetPath),
      `.${path.basename(item.targetPath)}.eos-sandbox-${crypto.randomUUID()}.tmp`,
    );
    try {
      walkParentDirectories(root, item.targetPath, createdDirs);
      if (!targetMatchesBaseline(item.targetPath, item.original)) {
        throw new Error("Target changed before replacement.");
      }
      const backupBytes = item.original ? fs.readFileSync(item.targetPath) : undefined;
      faultHook?.(item.relativePath, applied.length);

      if (!item.proposed) {
        fs.unlinkSync(item.targetPath);
        undoEntries.push({ targetPath: item.targetPath, existed: true, bytes: backupBytes, mode: item.original!.mode });
      } else {
        const sourcePath = targetForRelativePath(snapshotRoot, item.relativePath);
        fs.copyFileSync(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
        try {
          fs.chmodSync(temporaryPath, item.proposed.mode & 0o777);
        } catch {}
        if (item.original) {
          fs.renameSync(temporaryPath, item.targetPath);
          undoEntries.push({
            targetPath: item.targetPath,
            existed: true,
            bytes: backupBytes,
            mode: item.original.mode,
          });
        } else {
          fs.linkSync(temporaryPath, item.targetPath);
          fs.unlinkSync(temporaryPath);
          undoEntries.push({ targetPath: item.targetPath, existed: false });
        }
      }
      applied.push(item.relativePath);
    } catch {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {}
      rollbackWriteback(undoEntries, createdDirs);
      return { applied: [], conflicts: [item.relativePath] };
    }
  }

  return { applied, conflicts: [] };
}
