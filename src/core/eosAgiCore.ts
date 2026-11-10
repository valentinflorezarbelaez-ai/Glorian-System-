/**
 * EOS AGI SOVEREIGN CORE — TREE OF THOUGHTS + TRIBUNAL + EPISODIC MEMORY (Layer 0)
 * SPEC-047: Frontier Agent Harness — AGI Operational Core
 *
 * Implements the four pillars of a functional AGI engineering system:
 *   1. Tree of Thoughts (Test-Time Compute): generates N orthogonal solution branches,
 *      simulates each, and selects the minimum-entropy winner — Occam's Razor in code.
 *   2. Deterministic Tribunal: the compiler/test-runner is the impartial judge.
 *      Exit Code 0 = law. The AI never self-certifies correctness.
 *   3. Episodic Axiom Memory: every failed branch distills a permanent immutable rule
 *      that prevents the same class of error in all future sessions.
 *   4. Rollback Invariant: every mutation is guarded by a CoW backup — no partial states
 *      can survive a failed branch evaluation.
 *
 * Zero external runtime dependencies. Pure Layer-0 TypeScript.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  assertPrecondition,
  assertPostcondition,
  assertInvariant,
  deepFreeze,
  Ok,
  Err,
  type Result,
} from "./eosKernelPrimitives.ts";

import { createLogger } from "./eosLogger.ts";
import type { EosWorkerTribunal, TribunalResult } from "./eosWorkerTribunal.ts";
import type { ThoughtBranch, BranchVerdict } from "./eosAgiTypes.ts";

export type { ThoughtBranch, BranchVerdict } from "./eosAgiTypes.ts";

const _log = createLogger("eosAgiCore");

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================

/** A crystallized lesson distilled from a failed evaluation. */
export interface AxiomMemory {
  /** Short hash of the error pattern for deduplication. */
  readonly errorHash: string;
  /** First 150 chars of the compiler/test output that triggered this axiom. */
  readonly errorPattern: string;
  /** Immutable rule to inject into future system prompts. */
  readonly immutableRule: string;
  /** ISO timestamp when this axiom was crystallized. */
  readonly crystallizedAt: string;
  /** How many times this pattern recurred (incremented on repeat failures). */
  recurrenceCount: number;
}

/** Final result of a full AGI core solve cycle. */
export interface AgiSolveResult {
  readonly objective: string;
  readonly solved: boolean;
  readonly winningBranchId: string | null;
  readonly winningStrategy: string | null;
  readonly branchesEvaluated: number;
  readonly totalDurationMs: number;
  readonly newAxiomsLearned: number;
  readonly totalAxiomsInMemory: number;
  readonly verdicts: readonly BranchVerdict[];
  readonly executionHash: string;
}

export type AgiProgressEventType =
  "SOLVE_STARTED" | "BRANCH_STARTED" | "BRANCH_PASSED" | "BRANCH_FAILED" | "AXIOM_CRYSTALLIZED" | "SOLVE_COMPLETE";

export interface AgiProgressEvent {
  readonly type: AgiProgressEventType;
  readonly branchId?: string;
  readonly strategy?: string;
  readonly complexity?: number;
  readonly durationMs?: number;
  readonly totalBranches?: number;
  readonly currentBranch?: number;
  readonly solved?: boolean;
  readonly message: string;
  readonly timestampMs: number;
}

/** Options for the solve cycle. */
export interface AgiSolveOptions {
  /**
   * Shell-executable test/compile command. Must exit 0 for success.
   * Example: "node scripts/verify-cicd-pipeline.mjs"
   * Example: "node --test test/eosCore.test.mjs"
   */
  readonly testCommand: string;
  /** Working directory for the test command. Defaults to projectRoot. */
  readonly testCwd?: string;
  /** Maximum time in ms to wait per branch evaluation. Default: 30_000. */
  readonly timeoutMs?: number;
  /** If true, winning branch is committed to disk. Default: true. */
  readonly commitOnSuccess?: boolean;
  /**
   * Called at each significant event during the solve cycle.
   * Use this to stream progress to the MCP client via notifications/progress.
   */
  readonly onProgress?: (event: AgiProgressEvent) => void;
  /**
   * If true, uses EosWorkerTribunal for VM-isolated concurrent branch evaluation.
   * Each branch runs in its own worker_threads Worker — a crash cannot kill the harness.
   * Default: false (sequential CoW mode). Set to true for production use.
   */
  readonly workerMode?: boolean;
  /**
   * Maximum concurrent workers when workerMode=true. Default: min(branches.length, 4).
   */
  readonly maxConcurrency?: number;
}

// ============================================================================
// 2. AXIOM MEMORY STORE
// ============================================================================

/**
 * Persistent episodic memory that accumulates immutable rules from past failures.
 * Stored as a JSON file so knowledge survives process restarts.
 */
export class EosAxiomMemory {
  private readonly storePath: string;
  private axioms: Map<string, AxiomMemory> = new Map();
  private readonly _maxAxioms: number;

  constructor(storePath: string, maxAxioms = 200) {
    this.storePath = storePath;
    this._maxAxioms = maxAxioms;
    this._load();
  }

  /** Loads axioms from disk. Silently starts fresh if file is missing or corrupt. */
  private _load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, "utf8");
        const arr = JSON.parse(raw) as AxiomMemory[];
        for (const a of arr) {
          this.axioms.set(a.errorHash, a);
        }
      }
    } catch {
      this.axioms = new Map();
    }
  }

  /** Persists current axioms to disk atomically. */
  private _persist(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.storePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.axioms.values()], null, 2), "utf8");
    try {
      fs.renameSync(tmp, this.storePath);
    } catch (err: any) {
      if (err.code === "EPERM" || err.code === "EBUSY") {
        try {
          fs.unlinkSync(this.storePath);
        } catch {}
        try {
          fs.renameSync(tmp, this.storePath);
        } catch {
          fs.copyFileSync(tmp, this.storePath);
          try {
            fs.unlinkSync(tmp);
          } catch {}
        }
      } else {
        throw err;
      }
    }
  }

  /**
   * Crystallizes a new axiom from a failed branch.
   * If the same error pattern was seen before, increments recurrence count.
   * Returns the (new or updated) axiom.
   */
  public crystallize(failedStrategy: string, compilerOutput: string): AxiomMemory {
    const errorPattern = compilerOutput.slice(0, 200).trim();
    const errorHash = crypto.createHash("sha256").update(errorPattern).digest("hex").slice(0, 16);

    const existing = this.axioms.get(errorHash);
    if (existing) {
      existing.recurrenceCount++;
      this._persist();
      return existing;
    }

    const axiom: AxiomMemory = {
      errorHash,
      errorPattern,
      immutableRule: `AVOID strategy [${failedStrategy.slice(0, 80)}] — caused: ${errorPattern.slice(0, 100)}`,
      crystallizedAt: new Date().toISOString(),
      recurrenceCount: 1,
    };

    this.axioms.set(errorHash, axiom);

    // LRU eviction: if over the cap, remove the least-recurred axiom
    if (this.axioms.size > this._maxAxioms) {
      let lruHash = "";
      let lruCount = Infinity;
      for (const [hash, a] of this.axioms.entries()) {
        if (a.recurrenceCount < lruCount) {
          lruCount = a.recurrenceCount;
          lruHash = hash;
        }
      }
      if (lruHash) this.axioms.delete(lruHash);
    }

    this._persist();
    _log.debug("Axiom crystallized", { errorHash, recurrenceCount: 1, rule: axiom.immutableRule.slice(0, 80) });
    return axiom;
  }

  /** Returns all rules as a formatted block for system-prompt injection. */
  public formatRulesBlock(): string {
    if (this.axioms.size === 0) return "";
    const rules = [...this.axioms.values()]
      .sort((a, b) => b.recurrenceCount - a.recurrenceCount)
      .map((a, i) => `  ${i + 1}. [x${a.recurrenceCount}] ${a.immutableRule}`)
      .join("\n");
    return `LEARNED AXIOMS (never repeat these errors):\n${rules}`;
  }

  public get size(): number {
    return this.axioms.size;
  }

  public getAll(): readonly AxiomMemory[] {
    return Object.freeze([...this.axioms.values()]);
  }
}

// ============================================================================
// 3. HERMETIC BRANCH EVALUATOR
// ============================================================================

/**
 * Evaluates a single ThoughtBranch in isolation:
 *   1. Backs up the current file(s) content (CoW).
 *   2. Writes proposed content to disk (single or multi-file).
 *   3. Runs the test/compile command.
 *   4. Reads the verdict (exit code).
 *   5. On failure: atomically restores ALL files to their pre-branch state.
 */
/**
 * Resolves a branch target and enforces containment with a relative-path check.
 * `String.startsWith` alone accepts sibling prefixes ("/tmp/root" vs
 * "/tmp/root-evil"), which a crafted target could exploit.
 */
function resolveInsideProject(projectRoot: string, targetRelPath: string): string {
  const fullPath = path.resolve(projectRoot, targetRelPath);
  const relative = path.relative(projectRoot, fullPath);
  assertInvariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `Branch target "${targetRelPath}" would escape projectRoot — security violation.`,
  );
  return fullPath;
}

function evaluateBranch(
  branch: ThoughtBranch,
  projectRoot: string,
  defaultTestCommand: string,
  defaultTestCwd: string,
  timeoutMs: number,
): BranchVerdict {
  const t0 = Date.now();

  // Build the list of file mutations for this branch (supports both single & multi-file)
  const mutations: Array<{ fullPath: string; relPath: string; content: string }> = [];

  if (branch.targets && branch.targets.length > 0) {
    for (const t of branch.targets) {
      mutations.push({
        fullPath: resolveInsideProject(projectRoot, t.relPath),
        relPath: t.relPath,
        content: t.content,
      });
    }
  } else if (branch.targetRelPath && branch.proposedContent !== undefined) {
    mutations.push({
      fullPath: resolveInsideProject(projectRoot, branch.targetRelPath),
      relPath: branch.targetRelPath,
      content: branch.proposedContent,
    });
  }

  if (mutations.length === 0) {
    return {
      branchId: branch.id,
      strategy: branch.strategy,
      passed: false,
      durationMs: Date.now() - t0,
      exitCode: 1,
      stdout: "",
      stderr: "Branch has no file targets — provide targetRelPath+proposedContent or targets[]",
      rollbackApplied: false,
    };
  }

  // CoW backup — null means file didn't exist before this branch
  const backups = new Map<string, string | null>();
  for (const m of mutations) {
    backups.set(m.fullPath, fs.existsSync(m.fullPath) ? fs.readFileSync(m.fullPath, "utf8") : null);
  }

  const testCmd = branch.testCommandOverride ?? defaultTestCommand;
  const [bin, ...args] = testCmd.split(/\s+/);
  const resolvedBin = bin === "node" ? process.execPath : bin;

  try {
    // Write all files atomically
    for (const m of mutations) {
      const dir = path.dirname(m.fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(m.fullPath, m.content, "utf8");
    }

    // Run tribunal
    const stdout = execFileSync(resolvedBin, args, {
      cwd: defaultTestCwd,
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      branchId: branch.id,
      strategy: branch.strategy,
      passed: true,
      durationMs: Date.now() - t0,
      exitCode: 0,
      stdout: stdout.slice(0, 2000),
      stderr: "",
      rollbackApplied: false,
    };
  } catch (err: unknown) {
    // Atomic rollback — restore ALL files to their pre-branch state
    for (const [fullPath, backup] of backups.entries()) {
      if (backup !== null) {
        fs.writeFileSync(fullPath, backup, "utf8");
      } else if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    return {
      branchId: branch.id,
      strategy: branch.strategy,
      passed: false,
      durationMs: Date.now() - t0,
      exitCode: e.status ?? 1,
      stdout: (e.stdout ?? "").slice(0, 1000),
      stderr: (e.stderr ?? e.message ?? "").slice(0, 1000),
      rollbackApplied: true,
    };
  }
}

// ============================================================================
// 4. AGI SOVEREIGN CORE
// ============================================================================

/**
 * The AGI Sovereign Core orchestrates the full Tree of Thoughts solve cycle.
 *
 * Usage:
 * ```ts
 * const core = new EosAgiCore("/workspace");
 * const branches = await myModelRouter.generateBranches(objective, core.getRulesBlock());
 * const result = core.solve(objective, branches, { testCommand: "npm test" });
 * ```
 */
export class EosAgiCore {
  private readonly projectRoot: string;
  private readonly memory: EosAxiomMemory;

  constructor(projectRoot: string = process.cwd(), axiomStorePath?: string) {
    this.projectRoot = path.resolve(projectRoot);
    const defaultStore = path.join(this.projectRoot, "docs", "memory", "agi_axioms.json");
    this.memory = new EosAxiomMemory(axiomStorePath ?? defaultStore);
  }

  /**
   * Returns the current learned rules block for injection into AI system prompts.
   * Feed this to your model router so the AI never repeats past mistakes.
   */
  public getRulesBlock(): string {
    return this.memory.formatRulesBlock();
  }

  /**
   * Returns all axioms in memory — useful for auditing what the system has learned.
   */
  public getAxioms(): readonly AxiomMemory[] {
    return this.memory.getAll();
  }

  /**
   * Executes the full Tree of Thoughts solve cycle.
   *
   * Supports two evaluation modes:
   *   - workerMode=false (default): sequential CoW evaluation in main thread
   *   - workerMode=true: concurrent VM-isolated evaluation via worker_threads
   *     (crash-safe — a branch that kills Node.js won't affect the harness)
   */
  public async solve(
    objective: string,
    branches: readonly ThoughtBranch[],
    options: AgiSolveOptions,
  ): Promise<AgiSolveResult> {
    assertPrecondition(branches.length > 0, "At least one ThoughtBranch is required.");
    assertPrecondition(options.testCommand.trim().length > 0, "testCommand must not be empty.");

    const t0 = Date.now();
    const axiomsBefore = this.memory.size;
    const testCwd = options.testCwd ?? this.projectRoot;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const commitOnSuccess = options.commitOnSuccess ?? true;

    // Sort by complexity ascending — try simplest solution first
    const sorted = [...branches].sort((a, b) => a.estimatedComplexity - b.estimatedComplexity);

    _log.info("AGI solve started", {
      objective: objective.slice(0, 80),
      branches: sorted.length,
      testCommand: options.testCommand,
      activeAxioms: axiomsBefore,
      mode: options.workerMode ? "worker_threads (concurrent)" : "sequential (CoW)",
    });

    options.onProgress?.({
      type: "SOLVE_STARTED",
      totalBranches: sorted.length,
      message: `Starting Tree of Thoughts: ${sorted.length} branches, tribunal: ${options.testCommand}`,
      timestampMs: Date.now(),
    });

    // ── Evaluation ────────────────────────────────────────────────────────────
    // workerMode=true  → concurrent, crash-safe via worker_threads (Cognition/AWS standard)
    // workerMode=false → sequential CoW in main thread (default — simpler, debuggable)

    const verdicts: BranchVerdict[] = [];
    let winningBranchId: string | null = null;
    let winningStrategy: string | null = null;

    if (options.workerMode) {
      // Dynamic import to avoid loading worker_threads in environments that don't need it
      const { EosWorkerTribunal } = await import("./eosWorkerTribunal.ts");
      _log.info("Using worker_threads tribunal (concurrent, VM-isolated)");

      const tribunalResult = await EosWorkerTribunal.evaluate(
        sorted,
        options.testCommand,
        this.projectRoot,
        testCwd,
        timeoutMs,
        { concurrent: true, maxConcurrency: options.maxConcurrency ?? 4 },
      );

      // Emit progress for each verdict
      for (const v of tribunalResult.verdicts) {
        verdicts.push(v);
        options.onProgress?.({
          type: v.passed ? "BRANCH_PASSED" : "BRANCH_FAILED",
          branchId: v.branchId,
          durationMs: v.durationMs,
          message: v.passed
            ? `✔ ${v.branchId} PASSED tribunal in ${v.durationMs}ms`
            : `✘ ${v.branchId} FAILED — ${v.stderr.slice(0, 80)}`,
          timestampMs: Date.now(),
        });

        if (!v.passed) {
          const compilerOutput = `${v.stderr}\n${v.stdout}`.trim();
          const axiom = this.memory.crystallize(v.strategy, compilerOutput);
          options.onProgress?.({
            type: "AXIOM_CRYSTALLIZED",
            branchId: v.branchId,
            message: `Axiom crystallized: ${axiom.immutableRule.slice(0, 80)}`,
            timestampMs: Date.now(),
          });
        }
      }

      winningBranchId = tribunalResult.winningBranchId;
      winningStrategy = tribunalResult.winningStrategy;
    } else {
      // Sequential CoW mode (original behavior — unchanged)
      for (const branch of sorted) {
        _log.debug("Evaluating branch", {
          id: branch.id,
          strategy: branch.strategy.slice(0, 60),
          complexity: branch.estimatedComplexity,
        });

        options.onProgress?.({
          type: "BRANCH_STARTED",
          branchId: branch.id,
          strategy: branch.strategy,
          complexity: branch.estimatedComplexity,
          currentBranch: verdicts.length + 1,
          totalBranches: sorted.length,
          message: `Evaluating ${branch.id} [complexity ${branch.estimatedComplexity}/10]: ${branch.strategy.slice(0, 60)}`,
          timestampMs: Date.now(),
        });

        const verdict = evaluateBranch(branch, this.projectRoot, options.testCommand, testCwd, timeoutMs);
        verdicts.push(verdict);

        if (verdict.passed) {
          _log.info("Branch PASSED tribunal", { branchId: branch.id, durationMs: verdict.durationMs });
          options.onProgress?.({
            type: "BRANCH_PASSED",
            branchId: branch.id,
            durationMs: verdict.durationMs,
            message: `✔ ${branch.id} PASSED tribunal in ${verdict.durationMs}ms`,
            timestampMs: Date.now(),
          });
          winningBranchId = branch.id;
          winningStrategy = branch.strategy;
          break;
        } else {
          _log.warn("Branch FAILED tribunal — rollback applied", {
            branchId: branch.id,
            stderr: verdict.stderr.slice(0, 120),
          });
          options.onProgress?.({
            type: "BRANCH_FAILED",
            branchId: branch.id,
            durationMs: verdict.durationMs,
            message: `✘ ${branch.id} FAILED — rollback applied (${verdict.stderr.slice(0, 80)})`,
            timestampMs: Date.now(),
          });

          const compilerOutput = `${verdict.stderr}\n${verdict.stdout}`.trim();
          const axiom = this.memory.crystallize(branch.strategy, compilerOutput);
          _log.debug("Axiom crystallized from failure", { rule: axiom.immutableRule.slice(0, 80) });
          options.onProgress?.({
            type: "AXIOM_CRYSTALLIZED",
            branchId: branch.id,
            message: `Axiom crystallized: ${axiom.immutableRule.slice(0, 80)}`,
            timestampMs: Date.now(),
          });
        }
      }
    }

    const totalDurationMs = Date.now() - t0;
    const newAxiomsLearned = this.memory.size - axiomsBefore;

    const receiptData = `${objective}:${winningBranchId}:${verdicts.length}:${totalDurationMs}`;
    const executionHash = `sha256:${crypto.createHash("sha256").update(receiptData).digest("hex")}`;

    const result: AgiSolveResult = deepFreeze({
      objective,
      solved: winningBranchId !== null,
      winningBranchId,
      winningStrategy,
      branchesEvaluated: verdicts.length,
      totalDurationMs,
      newAxiomsLearned,
      totalAxiomsInMemory: this.memory.size,
      verdicts,
      executionHash,
    });

    if (result.solved) {
      _log.info("AGI solve SUCCESS", { winningBranchId, totalDurationMs });
    } else {
      _log.warn("AGI solve FAILED — all branches rejected", { newAxiomsLearned, totalDurationMs });
    }

    options.onProgress?.({
      type: "SOLVE_COMPLETE",
      solved: result.solved,
      durationMs: totalDurationMs,
      message: result.solved
        ? `✔ SOLVED — ${winningBranchId} in ${totalDurationMs}ms`
        : `✘ ALL BRANCHES FAILED — ${newAxiomsLearned} axioms crystallized`,
      timestampMs: Date.now(),
    });

    // Seal evidence receipt
    this._sealReceipt(result);

    return result;
  }

  /**
   * Writes a cryptographically sealed execution receipt to docs/evidence/.
   * Enables full audit trail of every AGI solve cycle.
   */
  private _sealReceipt(result: AgiSolveResult): void {
    try {
      const evidenceDir = path.join(this.projectRoot, "docs", "evidence");
      if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
      const filename = `AGI-RECEIPT-${Date.now()}.json`;
      fs.writeFileSync(path.join(evidenceDir, filename), JSON.stringify(result, null, 2), "utf8");
    } catch {
      // Evidence sealing is best-effort — never block the solve result
    }
  }
}
