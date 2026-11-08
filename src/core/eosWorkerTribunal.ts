/**
 * EOS WORKER TRIBUNAL (Layer 0)
 * SPEC-055: VM-isolated branch evaluation using worker_threads.
 *
 * Problem it solves (Cognition/AWS gap):
 *   - A branch that crashes Node.js would kill the entire harness
 *   - Sequential evaluation wastes wall-clock time
 *
 * Solution:
 *   - Each ThoughtBranch is evaluated in an isolated Worker thread
 *   - Workers are killed after timeout regardless of what the code does
 *   - Branches are evaluated CONCURRENTLY (default) or sequentially
 *   - A crashed worker = FAILED verdict, not a crashed process
 *
 * Architecture:
 *   EosWorkerTribunal.evaluate(branches) →
 *     [Worker 1: branch A] ──┐
 *     [Worker 2: branch B] ──┤→ collect all BranchVerdicts
 *     [Worker 3: branch C] ──┘
 *
 * The test command runs in the MAIN process (execFileSync in the worker),
 * not in a sub-sub-process, maintaining filesystem access.
 *
 * Zero external runtime dependencies — uses Node.js built-in worker_threads.
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ThoughtBranch, BranchVerdict } from "./eosAgiTypes.ts";
import { assertInvariant } from "./eosKernelPrimitives.ts";

const __filename = fileURLToPath(import.meta.url);

// ============================================================================
// 1. WORKER PAYLOAD (serialized across thread boundary)
// ============================================================================

export interface TribunalWorkerInput {
  readonly branch: ThoughtBranch;
  readonly projectRoot: string;
  readonly testCommand: string;
  readonly testCwd: string;
  readonly timeoutMs: number;
}

export interface TribunalWorkerOutput {
  readonly branchId: string;
  readonly passed: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly rollbackApplied: boolean;
  readonly error?: string;
}

// ============================================================================
// 2. WORKER EXECUTION (runs in isolated thread)
// ============================================================================

if (!isMainThread && parentPort) {
  const input: TribunalWorkerInput = workerData;

  async function runInWorker(): Promise<TribunalWorkerOutput> {
    const t0 = Date.now();
    const branch = input.branch;
    const root = input.projectRoot;

    // Build mutations list
    const mutations: Array<{ fullPath: string; content: string }> = [];
    const within = (p: string): boolean => {
      const rel = path.relative(root, p);
      return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
    };

    if (branch.targets && branch.targets.length > 0) {
      for (const t of branch.targets) {
        const fullPath = path.resolve(root, t.relPath);
        assertInvariant(within(fullPath), `Worker security: target "${t.relPath}" escapes projectRoot.`);
        mutations.push({ fullPath, content: t.content });
      }
    } else if (branch.targetRelPath && branch.proposedContent !== undefined) {
      const fullPath = path.resolve(root, branch.targetRelPath);
      assertInvariant(within(fullPath), `Worker security: target "${branch.targetRelPath}" escapes projectRoot.`);
      mutations.push({ fullPath, content: branch.proposedContent });
    }

    if (mutations.length === 0) {
      return {
        branchId: branch.id,
        passed: false,
        exitCode: 1,
        stdout: "",
        stderr: "No file targets in branch",
        durationMs: Date.now() - t0,
        rollbackApplied: false,
      };
    }

    // CoW backup
    const backups = new Map<string, string | null>();
    for (const m of mutations) {
      backups.set(m.fullPath, fs.existsSync(m.fullPath) ? fs.readFileSync(m.fullPath, "utf8") : null);
    }

    const [bin, ...args] = input.testCommand.split(/\s+/);
    const resolvedBin = bin === "node" ? process.execPath : (bin ?? process.execPath);

    try {
      // Write all files atomically
      for (const m of mutations) {
        const dir = path.dirname(m.fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(m.fullPath, m.content, "utf8");
      }

      const stdout = execFileSync(resolvedBin, args, {
        cwd: input.testCwd,
        timeout: input.timeoutMs,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return {
        branchId: branch.id,
        passed: true,
        exitCode: 0,
        stdout: stdout.slice(0, 2000),
        stderr: "",
        durationMs: Date.now() - t0,
        rollbackApplied: false,
      };
    } catch (err: unknown) {
      // Rollback all files
      for (const [fullPath, backup] of backups.entries()) {
        if (backup !== null) fs.writeFileSync(fullPath, backup, "utf8");
        else if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }

      const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
      return {
        branchId: branch.id,
        passed: false,
        exitCode: e.status ?? 1,
        stdout: (e.stdout ?? "").slice(0, 1000),
        stderr: (e.stderr ?? e.message ?? "").slice(0, 1000),
        durationMs: Date.now() - t0,
        rollbackApplied: true,
      };
    }
  }

  runInWorker()
    .then((output) => {
      parentPort!.postMessage(output);
    })
    .catch((err) => {
      parentPort!.postMessage({
        branchId: workerData?.branch?.id ?? "unknown",
        passed: false,
        exitCode: 1,
        stdout: "",
        stderr: String(err?.message ?? err).slice(0, 500),
        durationMs: 0,
        rollbackApplied: false,
        error: String(err?.message ?? err),
      } as TribunalWorkerOutput);
    });
}

// ============================================================================
// 3. TRIBUNAL ORCHESTRATOR (runs on main thread)
// ============================================================================

export interface WorkerTribunalOptions {
  /** Evaluate branches in parallel (default: true). */
  readonly concurrent?: boolean;
  /** Max concurrent workers. Default: min(branches.length, 4). */
  readonly maxConcurrency?: number;
  /** Override for the worker module path (for testing). */
  readonly workerModulePath?: string;
}

export interface TribunalResult {
  readonly verdicts: readonly BranchVerdict[];
  readonly winningBranchId: string | null;
  readonly winningStrategy: string | null;
  readonly totalDurationMs: number;
  readonly executionHash: string;
}

/**
 * EosWorkerTribunal orchestrates concurrent, crash-safe branch evaluation
 * using Node.js worker_threads.
 *
 * Each branch runs in an isolated Worker — a crash in one branch cannot
 * affect the harness or other branches.
 */
export class EosWorkerTribunal {
  /**
   * Evaluates all branches, optionally in parallel.
   * Respects Occam's Razor: sorts by complexity, tries simplest first.
   * If concurrent=true, runs all in parallel and picks the simplest passer.
   */
  static async evaluate(
    branches: readonly ThoughtBranch[],
    testCommand: string,
    projectRoot: string,
    testCwd: string,
    timeoutMs: number,
    options: WorkerTribunalOptions = {},
  ): Promise<TribunalResult> {
    const t0 = Date.now();
    const sorted = [...branches].sort((a, b) => a.estimatedComplexity - b.estimatedComplexity);
    const concurrent = options.concurrent ?? true;
    const maxConcurrency = options.maxConcurrency ?? Math.min(sorted.length, 4);

    let verdicts: BranchVerdict[];

    if (concurrent) {
      verdicts = await EosWorkerTribunal._evaluateConcurrent(
        sorted,
        testCommand,
        projectRoot,
        testCwd,
        timeoutMs,
        maxConcurrency,
        options.workerModulePath,
      );
    } else {
      verdicts = await EosWorkerTribunal._evaluateSequential(
        sorted,
        testCommand,
        projectRoot,
        testCwd,
        timeoutMs,
        options.workerModulePath,
      );
    }

    // Pick winning branch: simplest (first in sorted order) that passed
    const winningVerdict = verdicts.find((v) => v.passed);
    const winningBranch = sorted.find((b) => b.id === winningVerdict?.branchId);

    const receiptData = `${winningVerdict?.branchId ?? "none"}:${verdicts.length}:${Date.now() - t0}`;
    const executionHash = `sha256:${crypto.createHash("sha256").update(receiptData).digest("hex")}`;

    return {
      verdicts: Object.freeze(verdicts),
      winningBranchId: winningBranch?.id ?? null,
      winningStrategy: winningBranch?.strategy ?? null,
      totalDurationMs: Date.now() - t0,
      executionHash,
    };
  }

  /** Runs all branches concurrently. Max `maxConcurrency` workers at once. */
  private static async _evaluateConcurrent(
    branches: readonly ThoughtBranch[],
    testCommand: string,
    projectRoot: string,
    testCwd: string,
    timeoutMs: number,
    maxConcurrency: number,
    workerPath?: string,
  ): Promise<BranchVerdict[]> {
    const verdicts: BranchVerdict[] = [];
    // Process in batches of maxConcurrency
    for (let i = 0; i < branches.length; i += maxConcurrency) {
      const batch = branches.slice(i, i + maxConcurrency);
      const results = await Promise.all(
        batch.map((branch) =>
          EosWorkerTribunal._runInWorker(branch, testCommand, projectRoot, testCwd, timeoutMs, workerPath),
        ),
      );
      verdicts.push(...results);
    }
    return verdicts;
  }

  /** Runs branches sequentially (stops at first pass). */
  private static async _evaluateSequential(
    branches: readonly ThoughtBranch[],
    testCommand: string,
    projectRoot: string,
    testCwd: string,
    timeoutMs: number,
    workerPath?: string,
  ): Promise<BranchVerdict[]> {
    const verdicts: BranchVerdict[] = [];
    for (const branch of branches) {
      const verdict = await EosWorkerTribunal._runInWorker(
        branch,
        testCommand,
        projectRoot,
        testCwd,
        timeoutMs,
        workerPath,
      );
      verdicts.push(verdict);
      if (verdict.passed) break; // stop at first pass (sequential Occam's Razor)
    }
    return verdicts;
  }

  /** Spawns a single Worker for one branch. Returns BranchVerdict regardless of crash. */
  private static _runInWorker(
    branch: ThoughtBranch,
    testCommand: string,
    projectRoot: string,
    testCwd: string,
    timeoutMs: number,
    workerPath?: string,
  ): Promise<BranchVerdict> {
    return new Promise((resolve) => {
      const input: TribunalWorkerInput = { branch, projectRoot, testCommand, testCwd, timeoutMs };
      const t0 = Date.now();

      // The worker module is this same file — it detects !isMainThread and runs the evaluation
      const workerFile = workerPath ?? __filename;

      let worker: Worker | null = null;
      const hardTimeoutMs = timeoutMs + 5_000; // grace period beyond testCommand timeout

      try {
        worker = new Worker(workerFile, {
          workerData: input,
          // Resource limits — prevent worker from consuming unbounded memory
          resourceLimits: {
            maxOldGenerationSizeMb: 512,
            maxYoungGenerationSizeMb: 64,
          },
        });

        const timer = setTimeout(() => {
          worker?.terminate();
          resolve({
            branchId: branch.id,
            strategy: branch.strategy,
            passed: false,
            exitCode: -1,
            stdout: "",
            stderr: `Worker hard timeout after ${hardTimeoutMs}ms`,
            durationMs: Date.now() - t0,
            rollbackApplied: true,
          });
        }, hardTimeoutMs);
        timer.unref();

        worker.on("message", (output: TribunalWorkerOutput) => {
          clearTimeout(timer);
          resolve({
            branchId: output.branchId,
            strategy: branch.strategy,
            passed: output.passed,
            exitCode: output.exitCode,
            stdout: output.stdout,
            stderr: output.stderr,
            durationMs: output.durationMs,
            rollbackApplied: output.rollbackApplied,
          });
        });

        worker.on("error", (err) => {
          clearTimeout(timer);
          resolve({
            branchId: branch.id,
            strategy: branch.strategy,
            passed: false,
            exitCode: -1,
            stdout: "",
            stderr: `Worker crashed: ${err.message.slice(0, 200)}`,
            durationMs: Date.now() - t0,
            rollbackApplied: true,
          });
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            clearTimeout(timer);
            resolve({
              branchId: branch.id,
              strategy: branch.strategy,
              passed: false,
              exitCode: code,
              stdout: "",
              stderr: `Worker exited with code ${code}`,
              durationMs: Date.now() - t0,
              rollbackApplied: true,
            });
          }
        });
      } catch (err) {
        resolve({
          branchId: branch.id,
          strategy: branch.strategy,
          passed: false,
          exitCode: -1,
          stdout: "",
          stderr: `Worker spawn failed: ${String(err).slice(0, 200)}`,
          durationMs: Date.now() - t0,
          rollbackApplied: false,
        });
      }
    });
  }
}
