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
import {
  applyWorkspaceChanges,
  assertWorkspaceWithinLimits,
  copyFilteredWorkspace,
  isPathWithin,
  recordsEqual,
  scanWorkspace,
  type DockerImageInfo,
  type SandboxCommandDeps,
  type SandboxContainerRuntime,
  type SandboxRunOptions,
  type SandboxRunReport,
} from "./eosContainerSandbox.types.ts";

export {
  applyWorkspaceChanges,
  copyFilteredWorkspace,
  scanWorkspace,
  type SandboxCommandDeps,
  type SandboxContainerRuntime,
  type SandboxRunOptions,
  type SandboxRunReport,
} from "./eosContainerSandbox.types.ts";

const MAX_RUN_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RUN_DISK_CHECK_MS = 1_000;

function sanitizeDockerEnv(): NodeJS.ProcessEnv {
  const allowed =
    "PATH,SYSTEMROOT,WINDIR,TEMP,TMP,USERPROFILE,HOME,DOCKER_HOST,DOCKER_CONTEXT,DOCKER_CONFIG,DOCKER_TLS_VERIFY,DOCKER_CERT_PATH,DOCKER_API_VERSION".split(
      ",",
    );
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function runDockerSyncDefault(args: readonly string[], timeout: number): string {
  const result = spawnSync("docker", [...args], {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    env: sanitizeDockerEnv(),
    maxBuffer: 1024 * 1024,
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
    throw new Error(
      "Set EOS_SANDBOX_IMAGE to a locally available image pinned as repository@sha256:<64 hex characters>.",
    );
  }
  if (Buffer.byteLength(imageRef, "utf8") > 512) throw new Error("Sandbox image reference exceeds 512 UTF-8 bytes.");
  const match = /^([A-Za-z0-9][A-Za-z0-9._:/-]*)@sha256:([a-f0-9]{64})$/.exec(imageRef);
  if (!match) throw new Error("Sandbox image must use an immutable repository@sha256:<64 hex> reference.");
  return { ref: imageRef, digest: `sha256:${match[2]}` };
}

function verifyDockerEngine(runDockerSync: (args: readonly string[], timeout: number) => string): void {
  const osType = runDockerSync(["info", "--format", "{{.OSType}}"], 8_000);
  if (osType !== "linux")
    throw new Error("EOS sandbox requires a Linux container engine; no fallback execution is allowed.");
  const securityOptions = runDockerSync(["info", "--format", "{{json .SecurityOptions}}"], 8_000);
  if (!securityOptions || securityOptions === "null") {
    throw new Error("Docker did not report active security options; refusing to start the sandbox.");
  }
  const parsedSecurityOptions = JSON.parse(securityOptions) as string[];
  if (!parsedSecurityOptions.some((option) => option.includes("name=seccomp") && option.includes("profile=builtin"))) {
    throw new Error("Docker's built-in seccomp profile is unavailable or disabled; refusing to start the sandbox.");
  }
  const cgroupVersion = runDockerSync(["info", "--format", "{{.CgroupVersion}}"], 5_000);
  if (cgroupVersion !== "2")
    throw new Error("EOS sandbox requires cgroup v2 so CPU, memory, and process limits are enforceable.");
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
    throw new Error(
      "Remote Docker contexts are not allowed; configure a local Docker Desktop or local Engine context.",
    );
  }
}

export function detectAvailableRuntimes(
  runDockerSync: (args: readonly string[], timeout: number) => string,
): ReadonlySet<string> {
  try {
    const raw = runDockerSync(["info", "--format", "{{json .Runtimes}}"], 5_000);
    if (!raw || raw === "null") return new Set(["runc"]);
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const names = Object.keys(parsed).filter(Boolean);
      if (names.length > 0) return new Set(names);
    }
  } catch {}
  return new Set(["runc"]);
}

export function resolveSandboxRuntime(
  requested: SandboxContainerRuntime | undefined,
  available: ReadonlySet<string>,
): "runc" | "runsc" {
  if (requested !== undefined && requested !== "runc" && requested !== "runsc" && requested !== "auto") {
    throw new Error("Sandbox runtime must be 'runc', 'runsc', or 'auto'.");
  }
  if (requested === "runsc") {
    if (!available.has("runsc")) {
      throw new Error("Requested gVisor runtime 'runsc' is not registered in local Docker Engine.");
    }
    return "runsc";
  }
  if (requested === "auto") {
    return available.has("runsc") ? "runsc" : "runc";
  }
  return "runc";
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
  const registered = output
    .split(/\r?\n/)
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
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Unable to verify registered Git worktrees: ${result.error?.message || result.stderr || "git failed"}`,
    );
  }
  return result.stdout || "";
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
      try {
        fs.mkdirSync(target, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const stat = fs.lstatSync(target);
      if (!stat.isDirectory() || stat.isSymbolicLink() || !isPathWithin(home, fs.realpathSync(target))) {
        throw new Error("Sandbox receipt directory must be a real directory inside the user home.");
      }
    }
    try {
      fs.chmodSync(directory, 0o700);
    } catch {}
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
  private readonly execDockerSync: (args: readonly string[], timeout: number) => string;
  private readonly spawnDockerProcess: typeof spawn;

  constructor(repoRoot: string = process.cwd(), deps: SandboxCommandDeps = {}) {
    this.repoRoot = path.resolve(repoRoot);
    this.execDockerSync = deps.runDockerSync ?? runDockerSyncDefault;
    this.spawnDockerProcess = deps.spawnDocker ?? spawn;
  }

  public doctor(): {
    readonly ready: boolean;
    readonly image: string | null;
    readonly runtimes: readonly string[];
    readonly gvisorAvailable: boolean;
    readonly message: string;
  } {
    try {
      verifyDockerEngine(this.execDockerSync);
      const image = validatePinnedImage(process.env.EOS_SANDBOX_IMAGE);
      this.execDockerSync(["image", "inspect", "--format", "{{json .RepoDigests}}", image.ref], 8_000);
      const availableRuntimes = detectAvailableRuntimes(this.execDockerSync);
      const runtimes = [...availableRuntimes].sort();
      return {
        ready: true,
        image: image.ref,
        runtimes,
        gvisorAvailable: availableRuntimes.has("runsc"),
        message: availableRuntimes.has("runsc")
          ? "Docker Linux engine is reachable (gVisor runsc registered); pinned image is available locally."
          : "Docker Linux engine is reachable; pinned image is available locally.",
      };
    } catch (error) {
      return {
        ready: false,
        image: null,
        runtimes: [],
        gvisorAvailable: false,
        message: error instanceof Error ? error.message : String(error),
      };
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
    const argumentBytes = commandArgs.reduce(
      (total, arg) => total + Buffer.byteLength(arg, "utf8"),
      Buffer.byteLength(command, "utf8"),
    );
    if (argumentBytes > 128 * 1024) throw new RangeError("Sandbox command and arguments exceed 128 KiB.");
    if (
      !command ||
      command.startsWith("-") ||
      command.includes("\0") ||
      commandArgs.some((arg) => arg.includes("\0"))
    ) {
      throw new Error("Provide an executable name and NUL-free arguments after `--`.");
    }
    if (options.applyChanges !== true && options.applyChanges !== false && options.applyChanges !== undefined) {
      throw new TypeError("applyChanges must be a boolean.");
    }

    const image = validatePinnedImage(process.env.EOS_SANDBOX_IMAGE);
    verifyDockerEngine(this.execDockerSync);
    const availableRuntimes = detectAvailableRuntimes(this.execDockerSync);
    const effectiveRuntime = resolveSandboxRuntime(options.runtime, availableRuntimes);
    const repoRoot = fs.realpathSync(this.repoRoot);
    const worktree = getRegisteredWorktree(repoRoot, options.worktreePath);
    const inspectDigest = JSON.parse(
      this.execDockerSync(["image", "inspect", "--format", "{{json .RepoDigests}}", image.ref], 8_000),
    ) as string[] | null;
    if (!Array.isArray(inspectDigest) || !inspectDigest.some((digest) => digest.endsWith(`@${image.digest}`))) {
      throw new Error("Pinned image digest is not present in local Docker image metadata.");
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sandbox-"));
    try {
      fs.chmodSync(tempRoot, 0o700);
    } catch {}
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
      if (baseline.symlinks.length > 0)
        throw new Error("Filtered sandbox snapshot unexpectedly contains symbolic links.");
      if (snapshotPath.includes(","))
        throw new Error("Sandbox temp path contains a comma; Docker bind mounts cannot encode it safely.");

      const baseDockerFlags =
        "run --rm --init --pull=never --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges=true --pids-limit=128 --memory=2g --memory-swap=2g --cpus=2";
      const runtimeFlags = effectiveRuntime === "runsc" ? ["--runtime=runsc"] : [];
      const limitFlags =
        "--ulimit core=0 --ulimit nofile=1024:1024 --ulimit nproc=128:128 --ulimit fsize=67108864:67108864";
      const envFlags =
        "--tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m --workdir /workspace --user 65532:65532 --env HOME=/tmp --env TMPDIR=/tmp --env LANG=C.UTF-8";
      const dockerArgs = [
        ...baseDockerFlags.split(" "),
        ...runtimeFlags,
        "--name",
        containerName,
        ...limitFlags.split(" "),
        ...envFlags.split(" "),
        "--mount",
        `type=bind,source=${snapshotPath},target=/workspace,bind-propagation=rprivate`,
        "--entrypoint",
        command,
        image.ref,
        ...commandArgs,
      ];
      const runResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; spawnError?: Error }>(
        (resolve) => {
          const child = this.spawnDockerProcess("docker", dockerArgs, {
            cwd: tempRoot,
            stdio: "inherit",
            windowsHide: true,
            env: sanitizeDockerEnv(),
          });
          let finished = false;
          let resourceLimitExceeded = false;
          const requestContainerStop = () => {
            try {
              const killer = this.spawnDockerProcess("docker", ["kill", containerName], {
                stdio: "ignore",
                windowsHide: true,
                env: sanitizeDockerEnv(),
              });
              killer.unref();
            } catch {}
            try {
              child.kill("SIGTERM");
            } catch {}
          };
          const timer = setTimeout(() => {
            timedOut = true;
            requestContainerStop();
            setTimeout(() => {
              try {
                const remover = this.spawnDockerProcess("docker", ["rm", "--force", containerName], {
                  stdio: "ignore",
                  windowsHide: true,
                  env: sanitizeDockerEnv(),
                });
                remover.unref();
              } catch {}
              try {
                child.kill("SIGKILL");
              } catch {}
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
        },
      );
      exitCode = runResult.code;
      if (runResult.spawnError) throw new Error(`Could not start Docker: ${runResult.spawnError.message}`);
      if (errorMessage) throw new Error(errorMessage);
      status = timedOut ? "TIMED_OUT" : exitCode === 0 ? "COMPLETED" : "COMMAND_FAILED";

      const after = scanWorkspace(snapshotPath, baseline);
      if (after.symlinks.length > 0)
        throw new Error(`Sandbox output contains symlinks; refusing output: ${after.symlinks.slice(0, 5).join(", ")}`);
      changedFiles = [...new Set([...baseline.files.keys(), ...after.files.keys()])]
        .filter((relativePath) => !recordsEqual(baseline.files.get(relativePath), after.files.get(relativePath)))
        .sort();
      if (timedOut) throw new Error("Sandbox command exceeded its time limit; no changes were written back.");
      if (exitCode !== 0)
        throw new Error(`Sandbox command exited with status ${exitCode ?? "unknown"}; no changes were written back.`);
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
        errorMessage = errorMessage
          ? `${errorMessage}; cleanup failed: ${cleanupError}`
          : `Sandbox cleanup failed: ${cleanupError}`;
      }
    }

    const argsDigest = crypto
      .createHash("sha256")
      .update(JSON.stringify([command, ...commandArgs]))
      .digest("hex");
    receiptPath = writeReceipt({
      schemaVersion: 1,
      runId: containerName,
      startedAt,
      finishedAt: new Date().toISOString(),
      worktree,
      image: image.ref,
      runtime: effectiveRuntime,
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
      error: errorMessage || null,
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
      runtime: effectiveRuntime,
      appliedChanges,
      changedFiles,
      conflicts,
      excludedPaths,
      receiptPath,
      ...(errorMessage ? { error: errorMessage } : {}),
    };
  }
}
