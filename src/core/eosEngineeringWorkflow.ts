/**
 * Local, approval-gated repository workflow built from EOS audit, worktree,
 * and Docker sandbox capabilities. It never pushes or deploys.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { EosContainerSandbox, type SandboxRunReport } from "./eosContainerSandbox.ts";
import { EosSpotifyAgenticFactory } from "./eosSpotifyAgenticFactory.ts";
import { EosUniversalProjectAdapter, type PolyglotAuditReport } from "./eosUniversalProjectAdapter.ts";
import { EosWorktreeOrchestrator } from "./eosWorktreeOrchestrator.ts";

const MAX_TASK_BYTES = 512;
const MAX_DIFF_BYTES = 4 * 1024 * 1024;
const WORKFLOW_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface WorkflowRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly repoRoot: string;
  readonly task: string;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly baseCommit: string;
  readonly worktreePath: string;
  readonly createdAt: string;
  readonly validationStatus?: SandboxRunReport["status"];
  readonly validationHead?: string;
  readonly validationReceipt?: string | null;
  readonly reviewedHead?: string;
  readonly reviewedDiffSha256?: string;
  readonly reviewedAt?: string;
  readonly appliedHead?: string;
  readonly appliedAt?: string;
  readonly closedAt?: string;
}

export interface EngineeringWorkflowPlan {
  readonly task: string;
  readonly audit: PolyglotAuditReport;
  readonly planStatus: "PLAN_ONLY";
  readonly suggestedStack: string;
  readonly detectedStack: string;
  readonly templateInventorySummary: string;
  readonly candidateValidationCommands: readonly string[];
  readonly proposedSteps: readonly string[];
  readonly executionPerformed: false;
  readonly note: string;
}

export interface EngineeringWorkflowStart {
  readonly workflowId: string;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly baseCommit: string;
  readonly worktreePath: string;
  readonly localExcludeUpdated: boolean;
  readonly plan: EngineeringWorkflowPlan;
}

export interface EngineeringWorkflowReview {
  readonly workflowId: string;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly baseCommit: string;
  readonly headCommit: string;
  readonly changedFiles: readonly string[];
  readonly diffSha256: string;
  readonly diff: string;
  readonly approvalCommand: string;
}

export interface EngineeringWorkflowStatus {
  readonly workflowId: string;
  readonly task: string;
  readonly branchName: string;
  readonly branchHead: string | null;
  readonly baseBranch: string;
  readonly baseCommit: string;
  readonly worktreePath: string;
  readonly worktreeAvailable: boolean;
  readonly worktreeDirtyFiles: readonly string[];
  readonly validationStatus: SandboxRunReport["status"] | "NOT_RUN";
  readonly validationHead: string | null;
  readonly reviewedDiffSha256: string | null;
  readonly appliedHead: string | null;
  readonly closedAt: string | null;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertLocalDirectory(root: string, directory: string): void {
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !isWithin(root, fs.realpathSync(directory))) {
      throw new Error(`Refusing a symlink or out-of-repository workflow directory: ${directory}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    fs.mkdirSync(directory, { mode: 0o700 });
  }
}

function safeTaskSlug(task: string): string {
  return task.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "task";
}

function getCleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_WORK_TREE;
  delete env.GIT_PREFIX;
  return env;
}

export class EosEngineeringWorkflow {
  private readonly sandboxFactory: (repoRoot: string) => Pick<EosContainerSandbox, "run">;

  constructor(
    sandboxFactory: (repoRoot: string) => Pick<EosContainerSandbox, "run"> =
      (repoRoot) => new EosContainerSandbox(repoRoot)
  ) {
    this.sandboxFactory = sandboxFactory;
  }

  private resolveGitRoot(targetPath: string): string {
    if (typeof targetPath !== "string" || !targetPath.trim() || Buffer.byteLength(targetPath, "utf8") > 4096) {
      throw new TypeError("A repository path of 1 to 4096 UTF-8 bytes is required.");
    }
    const requestedPath = path.resolve(targetPath);
    let candidate: string;
    try {
      candidate = fs.realpathSync(requestedPath);
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code === "ENOENT" || code === "ENOTDIR") {
        throw new Error(`Repository path not found: ${requestedPath}. Check the path and try again.`, { cause: error });
      }
      if (code === "EACCES" || code === "EPERM") {
        throw new Error(`Cannot access repository path: ${requestedPath}. Check the folder permissions and try again.`, { cause: error });
      }
      throw error;
    }
    if (!fs.statSync(candidate).isDirectory()) {
      throw new Error(`Repository path is a file, not a folder: ${candidate}. Pass the repository folder instead.`);
    }

    let gitRoot: string;
    try {
      gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: candidate,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanGitEnv()
      }).trim();
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      const status = error instanceof Error && "status" in error
        ? (error as NodeJS.ErrnoException & { status?: number }).status
        : undefined;
      if (code === "ENOENT") {
        throw new Error("Git was not found on PATH. Install Git, restart the terminal, and try again.", { cause: error });
      }
      if (status === 128) {
        throw new Error(`Could not find a Git repository from ${candidate}. Pass a folder inside an initialized Git working tree.`, { cause: error });
      }
      throw error;
    }
    const resolvedRoot = fs.realpathSync(gitRoot);
    // Linked worktrees use a regular .git file rather than a directory.
    const gitMarker = path.join(resolvedRoot, ".git");
    const gitMarkerStat = fs.lstatSync(gitMarker);
    if (gitMarkerStat.isSymbolicLink() || (!gitMarkerStat.isFile() && !gitMarkerStat.isDirectory())) {
      throw new Error("Could not verify the repository Git marker.");
    }
    return resolvedRoot;
  }

  private gitText(repoRoot: string, args: readonly string[], maxBuffer = 1024 * 1024): string {
    return execFileSync("git", [...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer,
      windowsHide: true,
      env: getCleanGitEnv()
    }).trimEnd();
  }

  private gitBuffer(repoRoot: string, args: readonly string[]): Buffer {
    return execFileSync("git", [...args], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: MAX_DIFF_BYTES + 1,
      windowsHide: true,
      env: getCleanGitEnv()
    });
  }

  private gitStatus(repoRoot: string): string[] {
    const status = this.gitText(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
    return status ? status.split(/\r?\n/).filter(Boolean) : [];
  }

  private assertBaseAncestor(repoRoot: string, baseCommit: string, headCommit: string): void {
    const mergeBase = this.gitText(repoRoot, ["merge-base", baseCommit, headCommit]);
    if (mergeBase !== baseCommit) throw new Error("Workflow branch no longer descends from its recorded base commit.");
  }

  private assertWorkflowBranch(record: WorkflowRecord): string {
    const checkedOutBranch = this.gitText(record.worktreePath, ["branch", "--show-current"]);
    if (checkedOutBranch !== record.branchName) throw new Error("Workflow worktree is checked out on an unexpected branch.");
    const worktreeHead = this.gitText(record.worktreePath, ["rev-parse", "HEAD"]);
    const branchHead = this.gitText(record.repoRoot, ["rev-parse", `refs/heads/${record.branchName}`]);
    if (worktreeHead !== branchHead) throw new Error("Workflow branch ref and worktree HEAD do not match.");
    this.assertBaseAncestor(record.repoRoot, record.baseCommit, worktreeHead);
    return worktreeHead;
  }

  private ensureWorkflowPathsIgnored(repoRoot: string): boolean {
    const gitDirectory = fs.realpathSync(this.gitText(repoRoot, ["rev-parse", "--absolute-git-dir"]));
    const commonDirectory = fs.realpathSync(path.resolve(repoRoot, this.gitText(repoRoot, ["rev-parse", "--git-common-dir"])));
    const excludePath = path.resolve(repoRoot, this.gitText(repoRoot, ["rev-parse", "--git-path", "info/exclude"]));
    const excludeParent = fs.realpathSync(path.dirname(excludePath));
    const allowedGitDirs = [gitDirectory, commonDirectory];
    if (!allowedGitDirs.some((directory) => isWithin(directory, excludeParent))) {
      throw new Error("Git's local exclude file resolves outside this repository's Git metadata.");
    }

    let previous = "";
    try {
      const stat = fs.lstatSync(excludePath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Refusing a symlink or non-file Git exclude path.");
      previous = fs.readFileSync(excludePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const lines = new Set(previous.split(/\r?\n/));
    const missing = [".worktrees/", ".eos/"].filter((entry) => !lines.has(entry));
    if (missing.length === 0) return false;
    const addition = `${previous && !previous.endsWith("\n") ? "\n" : ""}# EOS local workflow state\n${missing.join("\n")}\n`;
    const temporaryPath = `${excludePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporaryPath, previous + addition, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try { fs.renameSync(temporaryPath, excludePath); }
    catch (error) {
      try { fs.unlinkSync(temporaryPath); } catch {}
      throw error;
    }
    return true;
  }

  private candidateValidationCommands(repoRoot: string, audit: PolyglotAuditReport): string[] {
    const scripts: Record<string, unknown> = {};
    const packageJsonPath = path.join(repoRoot, "package.json");
    try {
      const stat = fs.lstatSync(packageJsonPath);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 1024 * 1024) {
        const parsed: unknown = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const candidateScripts = (parsed as { scripts?: unknown }).scripts;
          if (candidateScripts && typeof candidateScripts === "object" && !Array.isArray(candidateScripts)) {
            Object.assign(scripts, candidateScripts);
          }
        }
      }
    } catch {}

    const commands: string[] = [];
    const packageManagerPrefix = ({ npm: "npm", pnpm: "pnpm", yarn: "yarn", bun: "bun" } as const);
    const manager = audit.fingerprint.packageManager;
    if (manager === "npm" || manager === "pnpm" || manager === "yarn" || manager === "bun") {
      const prefix = packageManagerPrefix[manager];
      if (typeof scripts.test === "string") commands.push(`${prefix} test`);
      if (typeof scripts.typecheck === "string") commands.push(`${prefix} run typecheck`);
      if (typeof scripts.lint === "string") commands.push(`${prefix} run lint`);
    } else if (manager === "go_mod") {
      commands.push("go test ./...");
    } else if (manager === "cargo") {
      commands.push(fs.existsSync(path.join(repoRoot, "Cargo.lock")) ? "cargo test --locked" : "cargo test");
    } else if (audit.fingerprint.testFramework === "pytest") {
      commands.push("python -m pytest");
    } else if (audit.fingerprint.testFramework === "flutter_test") {
      commands.push("flutter test");
    } else if (manager === "maven") {
      commands.push("mvn test");
    } else if (manager === "gradle") {
      commands.push(process.platform === "win32" ? "gradlew.bat test" : "./gradlew test");
    }
    return commands;
  }

  public inspect(targetPath: string): {
    readonly audit: PolyglotAuditReport;
    readonly branch: string;
    readonly headCommit: string;
    readonly dirtyFiles: readonly string[];
  } {
    const repoRoot = this.resolveGitRoot(targetPath);
    const audit = new EosUniversalProjectAdapter(repoRoot).audit(repoRoot);
    const dirtyFiles = this.gitStatus(repoRoot).map((line) => line.slice(3));
    return {
      audit,
      branch: this.gitText(repoRoot, ["branch", "--show-current"]) || "DETACHED",
      headCommit: this.gitText(repoRoot, ["rev-parse", "HEAD"]),
      dirtyFiles
    };
  }

  public plan(targetPath: string, requestedTask: string): EngineeringWorkflowPlan {
    const task = typeof requestedTask === "string" ? requestedTask.trim().replace(/\s+/g, " ") : "";
    if (!task || Buffer.byteLength(task, "utf8") > MAX_TASK_BYTES) {
      throw new RangeError(`Task must contain 1 to ${MAX_TASK_BYTES} UTF-8 bytes.`);
    }
    const repoRoot = this.resolveGitRoot(targetPath);
    const audit = new EosUniversalProjectAdapter(repoRoot).audit(repoRoot);
    const honk = new EosSpotifyAgenticFactory(repoRoot).dispatchHonk({
      taskName: task,
      repoPath: ".",
      specDescription: task,
      dryRun: true
    });
    const candidateValidationCommands = this.candidateValidationCommands(repoRoot, audit);
    return {
      task,
      audit,
      planStatus: "PLAN_ONLY",
      suggestedStack: honk.stack,
      detectedStack: `${audit.fingerprint.primaryLanguage} / ${audit.fingerprint.packageManager} / ${audit.fingerprint.testFramework}`,
      templateInventorySummary: honk.fileInventorySummary,
      candidateValidationCommands,
      proposedSteps: [
        "Acordar criterios de aceptación observables para la tarea indicada.",
        "Revisar los módulos y pruebas relacionados; tratar los hallazgos de EOS como pistas heurísticas.",
        "Implementar y comprometer el cambio únicamente dentro del worktree aislado.",
        candidateValidationCommands.length > 0
          ? `Ejecutar las validaciones candidatas: ${candidateValidationCommands.join(", ")}.`
          : "Elegir manualmente un comando de validación del proyecto; EOS no detectó uno con confianza.",
        "Revisar el diff y aplicar localmente solo después de confirmar su SHA-256."
      ],
      executionPerformed: false,
      note: "Análisis local heurístico y borrador; no usa un modelo, no ejecuta validaciones y no escribe archivos."
    };
  }

  public start(targetPath: string, requestedTask: string): EngineeringWorkflowStart {
    const plan = this.plan(targetPath, requestedTask);
    const repoRoot = plan.audit.projectPath;
    const dirtyFiles = this.gitStatus(repoRoot);
    if (dirtyFiles.length > 0) {
      throw new Error(`Refusing to create a workflow from a dirty checkout (${dirtyFiles.length} uncommitted path(s)). Commit, stash, or review them first.`);
    }
    const localExcludeUpdated = this.ensureWorkflowPathsIgnored(repoRoot);
    const baseBranch = this.gitText(repoRoot, ["branch", "--show-current"]);
    if (!baseBranch) throw new Error("A workflow must start from a named branch, not a detached HEAD.");
    this.gitText(repoRoot, ["check-ref-format", "--branch", baseBranch]);
    const baseCommit = this.gitText(repoRoot, ["rev-parse", "HEAD"]);
    const workflowId = crypto.randomUUID();
    const branchName = `eos/${safeTaskSlug(plan.task)}-${workflowId.slice(0, 8)}`;
    const worktreeParent = path.join(repoRoot, ".worktrees");
    const metadataParent = path.join(repoRoot, ".eos");
    assertLocalDirectory(repoRoot, worktreeParent);
    assertLocalDirectory(repoRoot, metadataParent);
    const worktreePath = path.join(worktreeParent, `flow-${workflowId}`);
    if (!isWithin(repoRoot, worktreePath) || fs.existsSync(worktreePath)) {
      throw new Error("Workflow worktree path is unsafe or already exists.");
    }

    const workflowsDirectory = path.join(metadataParent, "workflows");
    assertLocalDirectory(repoRoot, workflowsDirectory);
    const record: WorkflowRecord = {
      schemaVersion: 1,
      id: workflowId,
      repoRoot,
      task: plan.task,
      branchName,
      baseBranch,
      baseCommit,
      worktreePath,
      createdAt: new Date().toISOString()
    };
    const worktrees = new EosWorktreeOrchestrator(repoRoot);
    worktrees.createWorktree(branchName, path.relative(repoRoot, worktreePath), {
      baseBranch,
      copyEnv: false,
      copyHooks: false
    });
    try {
      this.writeRecord(record);
    } catch (error) {
      worktrees.removeWorktree(worktreePath, { force: true });
      throw error;
    }
    return { workflowId, branchName, baseBranch, baseCommit, worktreePath, localExcludeUpdated, plan };
  }

  public async validate(targetPath: string, workflowId: string, command: string, commandArgs: readonly string[] = []): Promise<SandboxRunReport> {
    const record = this.readRecord(targetPath, workflowId);
    if (record.closedAt) throw new Error("This workflow is closed.");
    if (record.appliedAt) throw new Error("This workflow has already been applied to its base branch.");
    this.assertRegisteredWorktree(record);
    const branchHead = this.assertWorkflowBranch(record);
    if (this.gitStatus(record.worktreePath).length > 0) throw new Error("Commit the worktree changes before running isolated validation.");
    const commitCount = Number(this.gitText(record.repoRoot, ["rev-list", "--count", `${record.baseCommit}..${branchHead}`]));
    if (!Number.isInteger(commitCount) || commitCount < 1) throw new Error("No committed changes exist in the workflow branch to validate.");

    const report = await this.sandboxFactory(record.repoRoot).run({
      worktreePath: record.worktreePath,
      command,
      commandArgs,
      applyChanges: false
    });
    this.writeRecord({
      ...record,
      validationStatus: report.status,
      validationHead: branchHead,
      validationReceipt: report.receiptPath
    });
    return report;
  }

  public review(targetPath: string, workflowId: string): EngineeringWorkflowReview {
    const record = this.readRecord(targetPath, workflowId);
    if (record.closedAt) throw new Error("This workflow is closed.");
    if (record.appliedAt) throw new Error("This workflow has already been applied.");
    this.assertRegisteredWorktree(record);
    if (record.validationStatus !== "COMPLETED" || !record.validationHead) {
      throw new Error("A successful isolated validation is required before review.");
    }
    const dirtyFiles = this.gitStatus(record.worktreePath);
    if (dirtyFiles.length > 0) throw new Error("Commit all changes in the isolated worktree before generating a review diff.");
    const headCommit = this.assertWorkflowBranch(record);
    if (headCommit !== record.validationHead) throw new Error("The worktree changed after validation; validate the current commit again.");
    if (this.gitText(record.repoRoot, ["branch", "--show-current"]) !== record.baseBranch ||
      this.gitText(record.repoRoot, ["rev-parse", "HEAD"]) !== record.baseCommit) {
      throw new Error("The base checkout changed after workflow start; recreate the review against the current base.");
    }
    const commitCount = Number(this.gitText(record.repoRoot, ["rev-list", "--count", `${record.baseCommit}..${headCommit}`]));
    if (!Number.isInteger(commitCount) || commitCount < 1) throw new Error("The workflow branch has no committed diff to review.");

    const diffBuffer = this.gitBuffer(record.repoRoot, ["diff", "--no-ext-diff", "--no-color", "--binary", record.baseCommit, headCommit]);
    if (diffBuffer.byteLength > MAX_DIFF_BYTES) throw new RangeError("Review diff exceeds the 4 MiB safety limit.");
    const changedFilesOutput = this.gitBuffer(record.repoRoot, ["diff", "--name-only", "-z", record.baseCommit, headCommit]).toString("utf8");
    const changedFiles = changedFilesOutput.split("\0").filter(Boolean);
    const diffSha256 = crypto.createHash("sha256").update(diffBuffer).digest("hex");
    this.writeRecord({
      ...record,
      reviewedHead: headCommit,
      reviewedDiffSha256: diffSha256,
      reviewedAt: new Date().toISOString()
    });
    return {
      workflowId,
      branchName: record.branchName,
      baseBranch: record.baseBranch,
      baseCommit: record.baseCommit,
      headCommit,
      changedFiles,
      diffSha256,
      diff: diffBuffer.toString("utf8"),
      approvalCommand: `node bin/eos.mjs flow apply "${record.repoRoot}" ${workflowId} --confirm-diff=${diffSha256}`
    };
  }

  public apply(targetPath: string, workflowId: string, confirmedDiffSha256: string): string {
    if (!/^[a-f0-9]{64}$/.test(confirmedDiffSha256)) throw new Error("Approval requires the 64-character SHA-256 printed by flow review.");
    const record = this.readRecord(targetPath, workflowId);
    if (record.closedAt) throw new Error("This workflow is closed.");
    if (record.appliedAt) throw new Error("This workflow has already been applied.");
    if (record.reviewedDiffSha256 !== confirmedDiffSha256 || !record.reviewedHead) {
      throw new Error("Approval hash does not match the last reviewed diff.");
    }
    if (record.validationStatus !== "COMPLETED" || record.validationHead !== record.reviewedHead) {
      throw new Error("The reviewed commit must have a successful isolated validation.");
    }
    this.assertRegisteredWorktree(record);
    if (this.gitStatus(record.worktreePath).length > 0) throw new Error("The isolated worktree changed after review.");
    const branchHead = this.assertWorkflowBranch(record);
    if (branchHead !== record.reviewedHead) throw new Error("The workflow branch changed after review.");
    const currentDiff = this.gitBuffer(record.repoRoot, ["diff", "--no-ext-diff", "--no-color", "--binary", record.baseCommit, branchHead]);
    const currentDiffHash = crypto.createHash("sha256").update(currentDiff).digest("hex");
    if (currentDiffHash !== confirmedDiffSha256) throw new Error("The diff changed after review; review it again before approval.");
    if (this.gitText(record.repoRoot, ["branch", "--show-current"]) !== record.baseBranch ||
      this.gitText(record.repoRoot, ["rev-parse", "HEAD"]) !== record.baseCommit) {
      throw new Error("The base checkout changed after review; refusing to merge.");
    }
    if (this.gitStatus(record.repoRoot).length > 0) throw new Error("The base checkout must be clean before applying the reviewed workflow.");

    this.gitText(record.repoRoot, ["merge", "--ff-only", "--no-edit", record.branchName]);
    const appliedHead = this.gitText(record.repoRoot, ["rev-parse", "HEAD"]);
    if (appliedHead !== branchHead) throw new Error("Fast-forward result did not match the reviewed commit.");
    this.writeRecord({ ...record, appliedHead, appliedAt: new Date().toISOString() });
    return appliedHead;
  }

  public status(targetPath: string, workflowId: string): EngineeringWorkflowStatus {
    const record = this.readRecord(targetPath, workflowId);
    const worktreeAvailable = fs.existsSync(record.worktreePath);
    let worktreeDirtyFiles: string[] = [];
    if (worktreeAvailable) {
      this.assertRegisteredWorktree(record);
      worktreeDirtyFiles = this.gitStatus(record.worktreePath).map((line) => line.slice(3));
    }
    let branchHead: string | null = null;
    try { branchHead = this.gitText(record.repoRoot, ["rev-parse", `refs/heads/${record.branchName}`]); }
    catch {}
    return {
      workflowId,
      task: record.task,
      branchName: record.branchName,
      branchHead,
      baseBranch: record.baseBranch,
      baseCommit: record.baseCommit,
      worktreePath: record.worktreePath,
      worktreeAvailable,
      worktreeDirtyFiles,
      validationStatus: record.validationStatus || "NOT_RUN",
      validationHead: record.validationHead || null,
      reviewedDiffSha256: record.reviewedDiffSha256 || null,
      appliedHead: record.appliedHead || null,
      closedAt: record.closedAt || null
    };
  }

  public close(targetPath: string, workflowId: string, force = false): string {
    const record = this.readRecord(targetPath, workflowId);
    if (record.closedAt) throw new Error("This workflow is already closed.");
    let removalMessage = "Worktree was already absent.";
    if (fs.existsSync(record.worktreePath)) {
      this.assertRegisteredWorktree(record);
      this.assertWorkflowBranch(record);
      const dirtyFiles = this.gitStatus(record.worktreePath);
      if (dirtyFiles.length > 0 && !force) {
        throw new Error(`Worktree has ${dirtyFiles.length} uncommitted path(s); preserve them or close with --force to discard them. The branch will be preserved.`);
      }
      const result = new EosWorktreeOrchestrator(record.repoRoot).removeWorktree(record.worktreePath, { force });
      if (!result.success) throw new Error(`Could not close workflow worktree: ${result.error || "git worktree remove failed"}`);
      removalMessage = dirtyFiles.length > 0 ? "Uncommitted worktree files discarded; branch preserved." : "Clean worktree removed; branch preserved.";
    }
    this.writeRecord({ ...record, closedAt: new Date().toISOString() });
    return removalMessage;
  }

  private workflowDirectory(repoRoot: string, create: boolean): string {
    const metadataParent = path.join(repoRoot, ".eos");
    const workflowsDirectory = path.join(metadataParent, "workflows");
    if (create) {
      assertLocalDirectory(repoRoot, metadataParent);
      assertLocalDirectory(repoRoot, workflowsDirectory);
    } else {
      for (const directory of [metadataParent, workflowsDirectory]) {
        const stat = fs.lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() || !isWithin(repoRoot, fs.realpathSync(directory))) {
          throw new Error("Workflow state directory is unsafe.");
        }
      }
    }
    return workflowsDirectory;
  }

  private recordPath(repoRoot: string, workflowId: string, create: boolean): string {
    if (!WORKFLOW_ID_PATTERN.test(workflowId)) throw new Error("Workflow ID must be a UUID returned by flow start.");
    const directory = this.workflowDirectory(repoRoot, create);
    return path.join(directory, `${workflowId}.json`);
  }

  private writeRecord(record: WorkflowRecord): void {
    const target = this.recordPath(record.repoRoot, record.id, true);
    try {
      const targetStat = fs.lstatSync(target);
      if (!targetStat.isFile() || targetStat.isSymbolicLink()) throw new Error("Refusing to overwrite unsafe workflow state.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    try { fs.renameSync(temporary, target); }
    catch (error) {
      try { fs.unlinkSync(temporary); } catch {}
      throw error;
    }
  }

  private readRecord(targetPath: string, workflowId: string): WorkflowRecord {
    const repoRoot = this.resolveGitRoot(targetPath);
    const recordFile = this.recordPath(repoRoot, workflowId, false);
    const stat = fs.lstatSync(recordFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error("Workflow state is not a bounded regular file.");
    const value: unknown = JSON.parse(fs.readFileSync(recordFile, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Workflow state is invalid.");
    const record = value as WorkflowRecord;
    if (record.schemaVersion !== 1 || record.id !== workflowId || record.repoRoot !== repoRoot ||
      typeof record.task !== "string" || typeof record.branchName !== "string" ||
      typeof record.baseBranch !== "string" || !/^[a-f0-9]{40,64}$/.test(record.baseCommit)) {
      throw new Error("Workflow state does not match this repository or has an unsupported format.");
    }
    if (record.branchName !== `eos/${safeTaskSlug(record.task)}-${workflowId.slice(0, 8)}`) {
      throw new Error("Workflow branch name does not match its recorded task and ID.");
    }
    this.gitText(repoRoot, ["check-ref-format", "--branch", record.baseBranch]);
    this.gitText(repoRoot, ["check-ref-format", "--branch", record.branchName]);
    const resolvedWorktree = path.resolve(record.worktreePath);
    if (!isWithin(repoRoot, resolvedWorktree) || resolvedWorktree === repoRoot) throw new Error("Workflow worktree path escapes the repository.");
    return { ...record, worktreePath: resolvedWorktree };
  }

  private assertRegisteredWorktree(record: WorkflowRecord): void {
    const realWorktree = fs.realpathSync(record.worktreePath);
    if (!isWithin(record.repoRoot, realWorktree) || realWorktree === record.repoRoot) {
      throw new Error("Workflow worktree resolves outside the project boundary.");
    }
    const registered = new EosWorktreeOrchestrator(record.repoRoot).listWorktrees()
      .some((worktree) => path.resolve(worktree.path) === realWorktree);
    if (!registered) throw new Error("Workflow path is no longer a registered Git worktree.");
  }
}
