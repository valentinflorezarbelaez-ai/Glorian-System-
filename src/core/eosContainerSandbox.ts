/**
 * Docker-backed, network-disabled command runner for registered Git worktrees.
 * The container receives a filtered temporary copy, never the repository's
 * .git directory, host environment, Docker socket, or credential directories.
 * This is defense in depth, not a microVM or a guarantee against kernel escapes.
 */

import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_SNAPSHOT_FILES = 20_000;
const MAX_SNAPSHOT_BYTES = 512 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 64 * 1024 * 1024;
const MAX_RUN_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RUN_DISK_CHECK_MS = 1_000;
const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".worktrees", ".eos", ".vercel", ".next", ".turbo", ".terraform",
  ".secrets", "secret", "secrets", "credentials", "coverage", "node_modules"
]);

export interface SandboxRunOptions {
  readonly worktreePath: string;
  readonly command: string;
  readonly commandArgs?: readonly string[];
  readonly applyChanges?: boolean;
  readonly timeoutMs?: number;
}

export interface SandboxRunReport {
  readonly success: boolean;
  readonly status: "COMPLETED" | "COMMAND_FAILED" | "TIMED_OUT" | "CONFLICT" | "FAILED";
  readonly exitCode: number | null;
  readonly timeoutMs: number;
  readonly appliedChanges: boolean;
  readonly changedFiles: readonly string[];
  readonly conflicts: readonly string[];
  readonly excludedPaths: readonly string[];
  readonly receiptPath: string | null;
  readonly error?: string;
}

interface FileRecord {
  readonly sha256: string;
  readonly size: number;
  readonly mode: number;
  readonly sandboxMode: number;
}

interface SnapshotManifest {
  readonly files: Map<string, FileRecord>;
  readonly bytes: number;
  readonly symlinks: readonly string[];
}

interface DockerImageInfo {
  readonly ref: string;
  readonly digest: string;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function sanitizeDockerEnv(): NodeJS.ProcessEnv {
  const allowed = [
    "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOME",
    "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH", "DOCKER_API_VERSION"
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function runDockerSync(args: readonly string[], timeout: number): string {
  const result = spawnSync("docker", [...args], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: sanitizeDockerEnv(),
    maxBuffer: 1024 * 1024
  });
  if (result.error) throw new Error(`Docker CLI unavailable or timed out: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "Docker command failed").trim().slice(0, 1200);
    throw new Error(detail);
  }
  return (result.stdout || "").trim();
}

function validatePinnedImage(imageRef: string | undefined): DockerImageInfo {
  if (!imageRef) {
    throw new Error("Set EOS_SANDBOX_IMAGE to a locally available image pinned as repository@sha256:<64 hex characters>.");
  }
  if (Buffer.byteLength(imageRef, "utf8") > 512) throw new Error("Sandbox image reference exceeds 512 UTF-8 bytes.");
  const match = /^([A-Za-z0-9][A-Za-z0-9._:/-]*)@sha256:([a-f0-9]{64})$/.exec(imageRef);
  if (!match) throw new Error("Sandbox image must use an immutable repository@sha256:<64 hex> reference.");
  return { ref: imageRef, digest: `sha256:${match[2]}` };
}

function verifyDockerEngine(): void {
  const osType = runDockerSync(["info", "--format", "{{.OSType}}"], 8_000);
  if (osType !== "linux") throw new Error("EOS sandbox requires a Linux container engine; no fallback execution is allowed.");
  const securityOptions = runDockerSync(["info", "--format", "{{json .SecurityOptions}}"], 8_000);
  if (!securityOptions || securityOptions === "null") {
    throw new Error("Docker did not report active security options; refusing to start the sandbox.");
  }
  const parsedSecurityOptions = JSON.parse(securityOptions) as string[];
  if (!parsedSecurityOptions.some((option) => option.includes("name=seccomp") && option.includes("profile=builtin"))) {
    throw new Error("Docker's built-in seccomp profile is unavailable or disabled; refusing to start the sandbox.");
  }
  const cgroupVersion = runDockerSync(["info", "--format", "{{.CgroupVersion}}"], 5_000);
  if (cgroupVersion !== "2") throw new Error("EOS sandbox requires cgroup v2 so CPU, memory, and process limits are enforceable.");
  const cgroupDriver = runDockerSync(["info", "--format", "{{.CgroupDriver}}"], 5_000);
  if (!cgroupDriver || cgroupDriver === "none") throw new Error("Docker cgroup resource controllers are unavailable.");
  if (parsedSecurityOptions.some((option) => option.startsWith("name=rootless")) && cgroupDriver !== "systemd") {
    throw new Error("Rootless Docker resource limits require the systemd cgroup driver.");
  }
  const warnings = JSON.parse(runDockerSync(["info", "--format", "{{json .Warnings}}"], 5_000)) as string[] | null;
  if (Array.isArray(warnings) && warnings.some((warning) => /memory|swap|pids|cpu cfs quota/i.test(warning))) {
    throw new Error(`Docker reports unsupported resource limits: ${warnings.join("; ")}`);
  }
  const contextName = runDockerSync(["context", "show"], 5_000);
  const contextData = JSON.parse(runDockerSync(["context", "inspect", contextName], 5_000)) as Array<{
    Endpoints?: { docker?: { Host?: string } };
  }>;
  const configuredHost = process.env.DOCKER_HOST || contextData[0]?.Endpoints?.docker?.Host || "";
  const isLocalPipe = /^(npipe|unix):\/\//i.test(configuredHost);
  const isLocalTcp = /^tcp:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(configuredHost);
  if (!isLocalPipe && !isLocalTcp) {
    throw new Error("Remote Docker contexts are not allowed; configure a local Docker Desktop or local Engine context.");
  }
}

function getRegisteredWorktree(repoRoot: string, selectedPath: string): string {
  const root = fs.realpathSync(repoRoot);
  const candidate = path.resolve(root, selectedPath);
  if (!isPathWithin(root, candidate) || candidate === root) {
    throw new Error("Sandbox can run only in a non-primary worktree contained in this repository.");
  }
  const realCandidate = fs.realpathSync(candidate);
  if (!isPathWithin(root, realCandidate) || realCandidate === root) {
    throw new Error("Selected worktree resolves outside the repository boundary.");
  }
  const output = listRegisteredGitWorktrees(root);
  const registered = output.split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length).trim()));
  if (!registered.some((worktree) => path.resolve(worktree) === realCandidate)) {
    throw new Error("Selected path is not a registered Git worktree of this repository.");
  }
  return realCandidate;
}

function listRegisteredGitWorktrees(root: string): string {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to verify registered Git worktrees: ${result.error?.message || result.stderr || "git failed"}`);
  }
  return result.stdout || "";
}

function isExcluded(relativePath: string, isDirectory: boolean): boolean {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] || "";
  const lower = name.toLowerCase();
  if (isDirectory && EXCLUDED_DIRECTORIES.has(lower)) return true;
  if (parts.slice(0, -1).some((part) => EXCLUDED_DIRECTORIES.has(part.toLowerCase()))) return true;
  if ([".ssh", ".aws", ".azure", ".kube", ".config", ".docker"].some((secretDir) => parts.some((part) => part.toLowerCase() === secretDir))) return true;
  if (lower.startsWith(".env") && ![".env.example", ".env.sample", ".env.template"].includes(lower)) return true;
  if ([
    ".npmrc", ".pypirc", ".netrc", "credentials", "credentials.json", "credential.json",
    "credentials.yaml", "credentials.yml", "secrets", "secrets.json", "secrets.yaml", "secrets.yml",
    "secret.json", "secret.yaml", "secret.yml", "service-account.json", "service_account.json",
    "terraform.tfstate", "terraform.tfstate.backup"
  ].includes(lower)) return true;
  if (/(secret|credential|service.account|firebase.adminsdk).+\.(json|ya?ml)$/i.test(name)) return true;
  if (/^(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\.pub)?$/i.test(name)) return true;
  if (/\.(pem|key|p8|ppk|p12|pfx|jks|keystore|secret|token|tfstate)$/i.test(name)) return true;
  return false;
}

function recordFile(filePath: string, relativePath: string): FileRecord {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`Non-regular file encountered in sandbox workspace: ${relativePath}`);
  if (stat.size > MAX_SINGLE_FILE_BYTES) throw new RangeError(`File exceeds the 64 MiB sandbox limit: ${relativePath}`);
  const content = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    size: content.byteLength,
    mode: stat.mode & 0o777,
    sandboxMode: stat.mode & 0o777
  };
}

function scanWorkspace(
  workspacePath: string,
  baseline?: SnapshotManifest,
  originalModes?: ReadonlyMap<string, number>
): SnapshotManifest {
  const files = new Map<string, FileRecord>();
  const symlinks: string[] = [];
  let bytes = 0;
  const walk = (directory: string, relativeDirectory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (isExcluded(relativePath, entry.isDirectory())) continue;
      if (entry.isSymbolicLink()) {
        symlinks.push(relativePath);
        continue;
      }
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const observed = recordFile(absolutePath, relativePath);
      const prior = baseline?.files.get(relativePath);
      const originalMode = originalModes?.get(relativePath);
      const mode = prior && observed.sandboxMode === prior.sandboxMode
        ? prior.mode
        : originalMode ?? observed.mode;
      const record = { ...observed, mode };
      files.set(relativePath, record);
      bytes += record.size;
      if (files.size > MAX_SNAPSHOT_FILES || bytes > MAX_SNAPSHOT_BYTES) {
        throw new RangeError("Sandbox workspace exceeded its 20,000-file or 512 MiB limit.");
      }
    }
  };
  walk(workspacePath, "");
  return { files, bytes, symlinks };
}

function assertWorkspaceWithinLimits(workspacePath: string): void {
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
        if (size > MAX_SINGLE_FILE_BYTES || files > MAX_SNAPSHOT_FILES || bytes > MAX_SNAPSHOT_BYTES) {
          throw new RangeError("Sandbox workspace exceeded its live 64 MiB/file, 20,000-file, or 512 MiB budget.");
        }
      }
    }
  };
  walk(workspacePath);
}

function makeWritableForContainer(targetPath: string, isDirectory: boolean): void {
  if (process.platform === "win32") return;
  try { fs.chmodSync(targetPath, isDirectory ? 0o777 : (fs.statSync(targetPath).mode & 0o777) | 0o222); } catch {}
}

function copyFilteredWorkspace(sourceRoot: string, destinationRoot: string): {
  readonly excludedPaths: string[];
  readonly originalModes: ReadonlyMap<string, number>;
} {
  const excluded: string[] = [];
  const originalModes = new Map<string, number>();
  let files = 0;
  let bytes = 0;
  const gitResult = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: sourceRoot,
    encoding: "utf8",
    timeout: 8_000,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
  if (gitResult.error || gitResult.status !== 0) {
    throw new Error(`Unable to enumerate non-ignored worktree files: ${gitResult.error?.message || gitResult.stderr || "git failed"}`);
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
    try { stat = fs.lstatSync(sourcePath); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      excluded.push(`${relativePath} (symlink or non-regular file)`);
      continue;
    }
    if (stat.size > MAX_SINGLE_FILE_BYTES) throw new RangeError(`File exceeds the 64 MiB sandbox limit: ${relativePath}`);
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
    try { fs.chmodSync(destinationPath, stat.mode & 0o777); } catch {}
    makeWritableForContainer(destinationPath, false);
    for (let directory = path.dirname(destinationPath); isPathWithin(destinationRoot, directory) && directory !== destinationRoot; directory = path.dirname(directory)) {
      makeWritableForContainer(directory, true);
    }
  }
  makeWritableForContainer(destinationRoot, true);
  return { excludedPaths: excluded, originalModes };
}

function recordsEqual(a: FileRecord | undefined, b: FileRecord | undefined): boolean {
  return a === b || (!!a && !!b && a.sha256 === b.sha256 && a.mode === b.mode);
}

function targetForRelativePath(root: string, relativePath: string): string {
  const target = path.resolve(root, ...relativePath.split("/"));
  if (!isPathWithin(root, target) || target === root) throw new Error(`Unsafe workspace-relative path: ${relativePath}`);
  return target;
}

function ensureSafeParentDirectories(root: string, targetPath: string): void {
  const relativeParent = path.relative(root, path.dirname(targetPath));
  let cursor = root;
  for (const component of relativeParent.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, component);
    try {
      const stat = fs.lstatSync(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing symlink or non-directory parent: ${cursor}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fs.mkdirSync(cursor);
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

function applyWorkspaceChanges(
  projectRoot: string,
  snapshotRoot: string,
  baseline: SnapshotManifest,
  after: SnapshotManifest
): { applied: string[]; conflicts: string[] } {
  const root = fs.realpathSync(projectRoot);
  const names = [...new Set([...baseline.files.keys(), ...after.files.keys()])].sort();
  const applied: string[] = [];
  const conflicts: string[] = [];
  if (after.symlinks.length > 0) throw new Error(`Sandbox output contains symlinks; refusing writeback: ${after.symlinks.slice(0, 5).join(", ")}`);

  for (const relativePath of names) {
    const original = baseline.files.get(relativePath);
    const proposed = after.files.get(relativePath);
    if (recordsEqual(original, proposed)) continue;
    const targetPath = targetForRelativePath(root, relativePath);
    try { ensureSafeParentDirectories(root, targetPath); }
    catch { conflicts.push(relativePath); continue; }
    if (!targetMatchesBaseline(targetPath, original)) {
      conflicts.push(relativePath);
      continue;
    }
    if (!proposed) {
      try {
        fs.unlinkSync(targetPath);
        applied.push(relativePath);
      } catch { conflicts.push(relativePath); }
      continue;
    }

    const sourcePath = targetForRelativePath(snapshotRoot, relativePath);
    const temporaryPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.eos-sandbox-${crypto.randomUUID()}.tmp`);
    try {
      fs.copyFileSync(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
      try { fs.chmodSync(temporaryPath, proposed.mode & 0o777); } catch {}
      if (original) {
        if (!targetMatchesBaseline(targetPath, original)) throw new Error("Target changed before replacement.");
        fs.renameSync(temporaryPath, targetPath);
      } else {
        // Hard-link creation is exclusive: it cannot replace a newly appeared file.
        fs.linkSync(temporaryPath, targetPath);
        fs.unlinkSync(temporaryPath);
      }
      applied.push(relativePath);
    } catch {
      try { fs.unlinkSync(temporaryPath); } catch {}
      conflicts.push(relativePath);
    }
  }
  return { applied, conflicts };
}

function getTimeout(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_RUN_TIMEOUT_MS;
  if (!Number.isInteger(requested) || requested < 1_000 || requested > MAX_RUN_TIMEOUT_MS) {
    throw new RangeError(`Sandbox timeout must be between 1000 and ${MAX_RUN_TIMEOUT_MS} ms.`);
  }
  return requested;
}

function writeReceipt(data: Record<string, unknown>): string | null {
  try {
    const home = fs.realpathSync(os.homedir());
    const baseDirectory = path.join(home, ".eos-system");
    const directory = path.join(baseDirectory, "sandbox-runs");
    for (const target of [baseDirectory, directory]) {
      try { fs.mkdirSync(target, { mode: 0o700 }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      const stat = fs.lstatSync(target);
      if (!stat.isDirectory() || stat.isSymbolicLink() || !isPathWithin(home, fs.realpathSync(target))) {
        throw new Error("Sandbox receipt directory must be a real directory inside the user home.");
      }
    }
    try { fs.chmodSync(directory, 0o700); } catch {}
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(directory, `RUN-${timestamp}-${crypto.randomBytes(6).toString("hex")}.json`);
    fs.writeFileSync(destination, JSON.stringify(data, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    return destination;
  } catch {
    return null;
  }
}

export class EosContainerSandbox {
  private readonly repoRoot: string;

  constructor(repoRoot: string = process.cwd()) {
    this.repoRoot = path.resolve(repoRoot);
  }

  public doctor(): { readonly ready: boolean; readonly image: string | null; readonly message: string } {
    try {
      verifyDockerEngine();
      const image = validatePinnedImage(process.env.EOS_SANDBOX_IMAGE);
      runDockerSync(["image", "inspect", "--format", "{{json .RepoDigests}}", image.ref], 8_000);
      return { ready: true, image: image.ref, message: "Docker Linux engine is reachable; pinned image is available locally." };
    } catch (error) {
      return { ready: false, image: null, message: error instanceof Error ? error.message : String(error) };
    }
  }

  public async run(options: SandboxRunOptions): Promise<SandboxRunReport> {
    const startedAt = new Date().toISOString();
    const timeoutMs = getTimeout(options.timeoutMs);
    if (typeof options.worktreePath !== "string" || Buffer.byteLength(options.worktreePath, "utf8") > 4096) {
      throw new Error("Sandbox worktree path must be a string of at most 4096 UTF-8 bytes.");
    }
    if (typeof options.command !== "string") throw new TypeError("Sandbox executable must be a string.");
    const command = options.command.trim();
    const commandArgs = options.commandArgs || [];
    if (!Array.isArray(commandArgs) || commandArgs.length > 512 || commandArgs.some((arg) => typeof arg !== "string")) {
      throw new TypeError("Sandbox arguments must be an array of at most 512 strings.");
    }
    const argumentBytes = commandArgs.reduce((total, arg) => total + Buffer.byteLength(arg, "utf8"), Buffer.byteLength(command, "utf8"));
    if (argumentBytes > 128 * 1024) throw new RangeError("Sandbox command and arguments exceed 128 KiB.");
    if (!command || command.startsWith("-") || command.includes("\0") || commandArgs.some((arg) => arg.includes("\0"))) {
      throw new Error("Provide an executable name and NUL-free arguments after `--`.");
    }
    if (options.applyChanges !== true && options.applyChanges !== false && options.applyChanges !== undefined) {
      throw new TypeError("applyChanges must be a boolean.");
    }

    const image = validatePinnedImage(process.env.EOS_SANDBOX_IMAGE);
    verifyDockerEngine();
    const repoRoot = fs.realpathSync(this.repoRoot);
    const worktree = getRegisteredWorktree(repoRoot, options.worktreePath);
    const inspectDigest = JSON.parse(runDockerSync(["image", "inspect", "--format", "{{json .RepoDigests}}", image.ref], 8_000)) as string[] | null;
    if (!Array.isArray(inspectDigest) || !inspectDigest.some((digest) => digest.endsWith(`@${image.digest}`))) {
      throw new Error("Pinned image digest is not present in local Docker image metadata.");
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sandbox-"));
    try { fs.chmodSync(tempRoot, 0o700); } catch {}
    const snapshotPath = path.join(tempRoot, "workspace");
    let excludedPaths: string[] = [];
    let exitCode: number | null = null;
    let timedOut = false;
    let status: SandboxRunReport["status"] = "FAILED";
    let errorMessage: string | undefined;
    let appliedChanges = false;
    let changedFiles: string[] = [];
    let conflicts: string[] = [];
    let receiptPath: string | null = null;
    const containerName = `eos-sandbox-${crypto.randomBytes(12).toString("hex")}`;

    try {
      fs.mkdirSync(snapshotPath, { mode: 0o700 });
      const copied = copyFilteredWorkspace(worktree, snapshotPath);
      excludedPaths = copied.excludedPaths;
      const baseline = scanWorkspace(snapshotPath, undefined, copied.originalModes);
      if (baseline.symlinks.length > 0) throw new Error("Filtered sandbox snapshot unexpectedly contains symbolic links.");
      if (snapshotPath.includes(",")) throw new Error("Sandbox temp path contains a comma; Docker bind mounts cannot encode it safely.");

      const dockerArgs = [
        "run", "--rm", "--init", "--pull=never", "--name", containerName,
        "--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges=true",
        "--pids-limit=128", "--memory=2g", "--memory-swap=2g", "--cpus=2",
        "--ulimit", "core=0", "--ulimit", "nofile=1024:1024", "--ulimit", "nproc=128:128",
        "--ulimit", "fsize=67108864:67108864",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=128m",
        "--mount", `type=bind,source=${snapshotPath},target=/workspace,bind-propagation=rprivate`,
        "--workdir", "/workspace", "--user", "65532:65532",
        "--env", "HOME=/tmp", "--env", "TMPDIR=/tmp", "--env", "LANG=C.UTF-8",
        "--entrypoint", command, image.ref, ...commandArgs
      ];
      const runResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; spawnError?: Error }>((resolve) => {
        const child = spawn("docker", dockerArgs, {
          cwd: tempRoot,
          stdio: "inherit",
          windowsHide: true,
          env: sanitizeDockerEnv()
        });
        let finished = false;
        let resourceLimitExceeded = false;
        const requestContainerStop = () => {
          try {
            const killer = spawn("docker", ["kill", containerName], {
              stdio: "ignore",
              windowsHide: true,
              env: sanitizeDockerEnv()
            });
            killer.unref();
          } catch {}
          try { child.kill("SIGTERM"); } catch {}
        };
        const timer = setTimeout(() => {
          timedOut = true;
          requestContainerStop();
          setTimeout(() => {
            try {
              const remover = spawn("docker", ["rm", "--force", containerName], {
                stdio: "ignore",
                windowsHide: true,
                env: sanitizeDockerEnv()
              });
              remover.unref();
            } catch {}
            try { child.kill("SIGKILL"); } catch {}
          }, 2_000).unref();
        }, timeoutMs);
        timer.unref();
        const workspaceMonitor = setInterval(() => {
          try {
            assertWorkspaceWithinLimits(snapshotPath);
          } catch {
            resourceLimitExceeded = true;
            clearInterval(workspaceMonitor);
            requestContainerStop();
          }
        }, MAX_RUN_DISK_CHECK_MS);
        workspaceMonitor.unref();
        child.once("error", (error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          clearInterval(workspaceMonitor);
          resolve({ code: null, signal: null, spawnError: error });
        });
        child.once("close", (code, signal) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          clearInterval(workspaceMonitor);
          if (resourceLimitExceeded) errorMessage = "Sandbox exceeded its live workspace file or disk budget.";
          resolve({ code, signal });
        });
      });
      exitCode = runResult.code;
      if (runResult.spawnError) throw new Error(`Could not start Docker: ${runResult.spawnError.message}`);
      if (errorMessage) throw new Error(errorMessage);
      status = timedOut ? "TIMED_OUT" : exitCode === 0 ? "COMPLETED" : "COMMAND_FAILED";

      const after = scanWorkspace(snapshotPath, baseline);
      if (after.symlinks.length > 0) throw new Error(`Sandbox output contains symlinks; refusing output: ${after.symlinks.slice(0, 5).join(", ")}`);
      changedFiles = [...new Set([...baseline.files.keys(), ...after.files.keys()])]
        .filter((relativePath) => !recordsEqual(baseline.files.get(relativePath), after.files.get(relativePath)))
        .sort();
      if (timedOut) throw new Error("Sandbox command exceeded its time limit; no changes were written back.");
      if (exitCode !== 0) throw new Error(`Sandbox command exited with status ${exitCode ?? "unknown"}; no changes were written back.`);
      if (options.applyChanges === true && changedFiles.length > 0) {
        const result = applyWorkspaceChanges(worktree, snapshotPath, baseline, after);
        conflicts = result.conflicts;
        appliedChanges = result.applied.length > 0;
        if (conflicts.length > 0) status = "CONFLICT";
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      if (status !== "TIMED_OUT" && status !== "COMMAND_FAILED") status = "FAILED";
    } finally {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        if (fs.existsSync(tempRoot)) throw new Error("Temporary sandbox copy remains on disk after cleanup.");
      } catch (error) {
        status = "FAILED";
        const cleanupError = error instanceof Error ? error.message : String(error);
        errorMessage = errorMessage ? `${errorMessage}; cleanup failed: ${cleanupError}` : `Sandbox cleanup failed: ${cleanupError}`;
      }
    }

    const argsDigest = crypto.createHash("sha256").update(JSON.stringify([command, ...commandArgs])).digest("hex");
    receiptPath = writeReceipt({
      schemaVersion: 1,
      runId: containerName,
      startedAt,
      finishedAt: new Date().toISOString(),
      worktree,
      image: image.ref,
      network: "disabled",
      limits: { timeoutMs, memory: "2g", cpus: 2, pids: 128, workspaceMiB: 512 },
      command: path.basename(command),
      argumentCount: commandArgs.length,
      commandSha256: `sha256:${argsDigest}`,
      status,
      exitCode,
      appliedChanges,
      changedFiles,
      conflicts,
      excludedPaths,
      error: errorMessage || null
    });
    if (!receiptPath) {
      errorMessage = errorMessage
        ? `${errorMessage}; local sandbox receipt could not be written`
        : "Local sandbox receipt could not be written.";
    }

    return {
      success: status === "COMPLETED",
      status,
      exitCode,
      timeoutMs,
      appliedChanges,
      changedFiles,
      conflicts,
      excludedPaths,
      receiptPath,
      ...(errorMessage ? { error: errorMessage } : {})
    };
  }
}
