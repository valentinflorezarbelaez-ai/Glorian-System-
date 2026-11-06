/**
 * EOS SYSTEM — XIRP-GRADE MULTI-AGENT GIT WORKTREE & ISOLATION MATRIX (Layer 0)
 * Governed by ADR-022, FR-035 & BDD-028, BDD-029
 *
 * Implements physical filesystem isolation inspired by the Xirp standard,
 * Google Piper/CitC, and Meta Sapling. Allows parallel AI agents (Cursor,
 * Antigravity, Claude, DeepSeek) to operate concurrently on independent branches
 * without race conditions, working-tree corruption, or lock contention.
 *
 * Zero external runtime dependencies.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface WorktreeInfo {
  readonly path: string;
  readonly headCommit: string;
  readonly branch: string;
  readonly isBare: boolean;
  readonly isMain: boolean;
  readonly isLocked: boolean;
  readonly lockReason?: string;
}

export interface CreateWorktreeOptions {
  readonly baseBranch?: string;
  readonly copyEnv?: boolean;
  readonly copyHooks?: boolean;
}

export interface RemoveWorktreeOptions {
  readonly force?: boolean;
  readonly deleteBranch?: boolean;
}

export interface RemoveWorktreeResult {
  readonly success: boolean;
  readonly removedPath: string;
  readonly pruned: boolean;
  readonly error?: string;
}

export interface PruneWorktreeResult {
  readonly success: boolean;
  readonly output: string;
}

export interface WorktreeStatus {
  readonly clean: boolean;
  readonly modifiedFiles: readonly string[];
  readonly untrackedFiles: readonly string[];
  readonly currentBranch: string;
}

function getCleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_WORK_TREE;
  delete env.GIT_PREFIX;
  return env;
}

export class EosWorktreeOrchestrator {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
  }

  /**
   * Lists all currently registered Git worktrees using porcelain output.
   */
  public listWorktrees(): WorktreeInfo[] {
    try {
      const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
        cwd: this.rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        env: getCleanGitEnv()
      });

      return this.parsePorcelainList(output);
    } catch (_err) {
      // Fallback if not inside git or command failed
      return [
        {
          path: this.rootDir,
          headCommit: "HEAD",
          branch: "main",
          isBare: false,
          isMain: true,
          isLocked: false
        }
      ];
    }
  }

  /**
   * Creates an isolated worktree for an autonomous agent or subtask.
   */
  public createWorktree(
    branchName: string,
    customPath?: string,
    options: CreateWorktreeOptions = {}
  ): WorktreeInfo {
    const sanitizedBranch = branchName.replace(/[^a-zA-Z0-9_\-./]/g, "-");
    if (!sanitizedBranch || sanitizedBranch.startsWith("-") || sanitizedBranch.startsWith("/") || sanitizedBranch.endsWith("/")) {
      throw new Error("Branch name must be a non-empty relative Git branch name.");
    }
    const targetPath = customPath
      ? path.resolve(this.rootDir, customPath)
      : path.join(this.rootDir, ".worktrees", sanitizedBranch.replace(/\//g, "-"));

    if (fs.existsSync(targetPath)) {
      throw new Error(`Worktree destination already exists: ${targetPath}`);
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Check if branch already exists locally
    let branchExists = false;
    try {
      execFileSync("git", ["rev-parse", "--verify", sanitizedBranch], {
        cwd: this.rootDir,
        stdio: ["ignore", "pipe", "ignore"],
        env: getCleanGitEnv()
      });
      branchExists = true;
    } catch {
      branchExists = false;
    }

    const args = ["worktree", "add"];
    if (!branchExists) {
      args.push("-b", sanitizedBranch);
    }
    args.push(targetPath);
    if (!branchExists && options.baseBranch) {
      args.push(options.baseBranch);
    }

    try {
      execFileSync("git", args, {
        cwd: this.rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanGitEnv()
      });
    } catch (err: any) {
      throw new Error(`Failed to create worktree: ${err.message || String(err)}`);
    }

    // Environment files can contain secrets; never copy them unless requested.
    if (options.copyEnv === true) {
      const envSource = path.join(this.rootDir, ".env");
      const envExample = path.join(this.rootDir, ".env.example");
      const envTarget = path.join(targetPath, ".env");
      if (fs.existsSync(envSource)) {
        fs.copyFileSync(envSource, envTarget);
      } else if (fs.existsSync(envExample)) {
        fs.copyFileSync(envExample, envTarget);
      }
    }

    // Mirror git hooks if requested
    if (options.copyHooks !== false) {
      try {
        execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
          cwd: targetPath,
          stdio: ["ignore", "ignore", "ignore"],
          env: getCleanGitEnv()
        });
      } catch {
        // Non-blocking
      }
    }

    const all = this.listWorktrees();
    const created = all.find((w) => path.resolve(w.path) === path.resolve(targetPath));
    if (created) return created;

    return {
      path: targetPath,
      headCommit: "UNKNOWN",
      branch: sanitizedBranch,
      isBare: false,
      isMain: false,
      isLocked: false
    };
  }

  /**
   * Safely removes a worktree and prunes Git references.
   */
  public removeWorktree(targetPath: string, options: RemoveWorktreeOptions = {}): RemoveWorktreeResult {
    const resolved = path.resolve(this.rootDir, targetPath);

    // Prevent deletion of the root directory
    if (resolved === this.rootDir) {
      return {
        success: false,
        removedPath: resolved,
        pruned: false,
        error: "Cannot remove primary repository root worktree"
      };
    }

    const registered = this.listWorktrees().some((worktree) => path.resolve(worktree.path) === resolved);
    if (!registered) {
      return {
        success: false,
        removedPath: resolved,
        pruned: false,
        error: "Target is not a registered worktree of this repository."
      };
    }

    const args = ["worktree", "remove"];
    if (options.force) {
      args.push("--force");
    }
    args.push(resolved);

    try {
      execFileSync("git", args, {
        cwd: this.rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanGitEnv()
      });

      this.pruneWorktrees();

      return {
        success: true,
        removedPath: resolved,
        pruned: true
      };
    } catch (err: any) {
      return {
        success: false,
        removedPath: resolved,
        pruned: false,
        error: err.message || String(err)
      };
    }
  }

  /**
   * Prunes dead or unreachable worktree references.
   */
  public pruneWorktrees(): PruneWorktreeResult {
    try {
      const output = execFileSync("git", ["worktree", "prune", "-v"], {
        cwd: this.rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: getCleanGitEnv()
      });
      return { success: true, output: output.trim() };
    } catch (err: any) {
      return { success: false, output: err.message || String(err) };
    }
  }

  /**
   * Gets clean/dirty status of a given worktree.
   */
  public getWorktreeStatus(worktreePath: string): WorktreeStatus {
    const resolved = path.resolve(this.rootDir, worktreePath);
    try {
      const statusOutput = execFileSync("git", ["status", "--porcelain"], {
        cwd: resolved,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        env: getCleanGitEnv()
      });

      const branchOutput = execFileSync("git", ["branch", "--show-current"], {
        cwd: resolved,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        env: getCleanGitEnv()
      });

      const lines = statusOutput.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const modifiedFiles: string[] = [];
      const untrackedFiles: string[] = [];

      for (const line of lines) {
        const code = line.slice(0, 2);
        const file = line.slice(3).trim();
        if (code === "??") {
          untrackedFiles.push(file);
        } else {
          modifiedFiles.push(file);
        }
      }

      return {
        clean: modifiedFiles.length === 0,
        modifiedFiles,
        untrackedFiles,
        currentBranch: branchOutput.trim()
      };
    } catch {
      return {
        clean: false,
        modifiedFiles: [],
        untrackedFiles: [],
        currentBranch: "unknown"
      };
    }
  }

  private parsePorcelainList(output: string): WorktreeInfo[] {
    const list: WorktreeInfo[] = [];
    const blocks = output.split(/\r?\n\r?\n/).filter((b) => b.trim().length > 0);

    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split(/\r?\n/);
      let worktreePath = "";
      let headCommit = "";
      let branch = "";
      let isBare = false;
      let isLocked = false;
      let lockReason = "";

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          worktreePath = line.substring(9).trim();
        } else if (line.startsWith("HEAD ")) {
          headCommit = line.substring(5).trim();
        } else if (line.startsWith("branch ")) {
          const rawBranch = line.substring(7).trim();
          branch = rawBranch.replace(/^refs\/heads\//, "");
        } else if (line === "bare") {
          isBare = true;
        } else if (line.startsWith("locked")) {
          isLocked = true;
          lockReason = line.substring(6).trim();
        }
      }

      if (worktreePath) {
        list.push({
          path: worktreePath,
          headCommit,
          branch: branch || (isBare ? "(bare)" : "detached"),
          isBare,
          isMain: i === 0,
          isLocked,
          lockReason: isLocked ? lockReason : undefined
        });
      }
    }

    return list;
  }
}
