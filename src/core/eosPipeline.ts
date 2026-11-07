/**
 * EOS END-TO-END PIPELINE (Layer 0)
 * SPEC-050: From problem description to verified solution in one call.
 *
 * Connects:
 *   EosContextWindowManager → EosMultiModelRouter → EosAgiCore → Result
 *
 * Usage:
 * ```ts
 * const pipeline = new EosPipeline("/workspace");
 * const result = await pipeline.solve({
 *   problem: "Fix the N+1 query in the users service",
 *   targetFile: "src/core/eosFleetDispatcher.ts",
 *   testCommand: "node --test test/eosFleetElevator.test.mjs",
 * });
 * ```
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { EosContextWindowManager } from "./eosContextWindowManager.ts";
import { EosMultiModelRouter } from "./eosMultiModelRouter.ts";
import { EosAgiCore, type ThoughtBranch, type AgiSolveResult } from "./eosAgiCore.ts";
import { createLogger } from "./eosLogger.ts";
import { EosTracer } from "./eosTracer.ts";

const _log = createLogger("eosPipeline");
const _tracer = EosTracer.getInstance();

export interface PipelineRequest {
  /** Natural language problem description */
  readonly problem: string;
  /** Primary file to fix/modify */
  readonly targetFile: string;
  /** Test command to use as tribunal (must exit 0 on success) */
  readonly testCommand: string;
  /** Working directory for test command (default: projectRoot) */
  readonly testCwd?: string;
  /** Token budget for context assembly (default: 32000) */
  readonly tokenBudget?: number;
  /** Number of branches to generate (default: 3) */
  readonly branchCount?: number;
  /** Timeout per branch evaluation in ms (default: 30000) */
  readonly timeoutMs?: number;
  /**
   * Wall-clock deadline for the entire pipeline in ms (default: 120000).
   * If the pipeline exceeds this, it is aborted and returns solved: false.
   * Netflix/Google standard: every pipeline call must have an end-to-end deadline.
   */
  readonly pipelineDeadlineMs?: number;
}

export interface PipelineResult {
  readonly problem: string;
  readonly solved: boolean;
  readonly winningBranchId: string | null;
  readonly winningStrategy: string | null;
  readonly contextAssembled: {
    readonly filesIncluded: number;
    readonly tokensUsed: number;
    readonly tokenBudget: number;
  };
  readonly branchesGenerated: number;
  readonly branchesEvaluated: number;
  readonly newAxiomsLearned: number;
  readonly totalDurationMs: number;
  readonly agiResult: AgiSolveResult | null;
  readonly error: string | null;
  readonly pipelineHash: string;
}

export class EosPipeline {
  private readonly projectRoot: string;
  private readonly contextManager: EosContextWindowManager;
  private readonly router: EosMultiModelRouter;
  private readonly agiCore: EosAgiCore;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.contextManager = new EosContextWindowManager(this.projectRoot);
    this.router = new EosMultiModelRouter();
    this.agiCore = new EosAgiCore(this.projectRoot);
  }

  /**
   * Runs the full end-to-end pipeline:
   *   1. Assemble context from blast radius
   *   2. Generate ThoughtBranches via MultiModelRouter
   *   3. Evaluate branches through deterministic tribunal
   *   4. Return result with winning code or learned axioms
   */
  public async solve(req: PipelineRequest): Promise<PipelineResult> {
    const t0 = Date.now();
    const pipelineDeadlineMs = req.pipelineDeadlineMs ?? 120_000; // 2-min wall-clock default

    // Wall-clock deadline (Netflix/Google: every pipeline must have an end-to-end deadline)
    const deadlineTimer = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`EOS_PIPELINE_TIMEOUT: pipeline exceeded ${pipelineDeadlineMs}ms wall-clock deadline`)),
        pipelineDeadlineMs,
      ).unref(),
    );

    return Promise.race([this._solveInternal(req, t0), deadlineTimer]);
  }

  private async _solveInternal(req: PipelineRequest, t0: number): Promise<PipelineResult> {
    const span = _tracer.startSpan("eos.pipeline.solve", {
      "problem.summary": req.problem.slice(0, 80),
      "target.file": req.targetFile,
      "token.budget": req.tokenBudget ?? 32_000,
    });
    _log.info("Pipeline started", { problem: req.problem.slice(0, 80), targetFile: req.targetFile });

    try {
      // ── Phase 1: Context Assembly ──────────────────────────────────────
      _log.info("Phase 1: Assembling context window");
      const ctxSpan = _tracer.startSpan("eos.pipeline.context_assembly", {}, "INTERNAL");
      const context = this.contextManager.assemble(req.problem, req.targetFile, {
        tokenBudget: req.tokenBudget ?? 32_000,
      });
      ctxSpan.setAttribute("files.included", context.filesIncluded);
      ctxSpan.setAttribute("tokens.used", context.totalTokensUsed);
      ctxSpan.setStatus("OK");
      ctxSpan.end();

      _log.info("Context assembled", {
        filesIncluded: context.filesIncluded,
        tokensUsed: context.totalTokensUsed,
      });

      // ── Phase 2: Branch Generation ─────────────────────────────────────
      _log.info("Phase 2: Generating ThoughtBranches via model router");
      const branchSpan = _tracer.startSpan("eos.pipeline.branch_generation", {}, "CLIENT");

      // Read current file content for context
      const targetFullPath = path.resolve(this.projectRoot, req.targetFile);
      const currentContent = fs.existsSync(targetFullPath) ? fs.readFileSync(targetFullPath, "utf8") : "";

      const branches = await this.router.generateBranches({
        objective: req.problem,
        targetRelPath: req.targetFile,
        currentContent,
        branchCount: req.branchCount ?? 3,
        rulesBlock: this.agiCore.getRulesBlock(),
        extraContext: context.contextBlock,
      });

      branchSpan.setAttribute("branches.generated", branches.length);
      branchSpan.setStatus(branches.length > 0 ? "OK" : "ERROR", branches.length === 0 ? "0 branches" : undefined);
      branchSpan.end();

      _log.info("Branches generated", { count: branches.length });

      if (branches.length === 0) {
        span.setStatus("ERROR", "0 branches generated");
        span.end();
        const result: PipelineResult = {
          problem: req.problem,
          solved: false,
          winningBranchId: null,
          winningStrategy: null,
          contextAssembled: {
            filesIncluded: context.filesIncluded,
            tokensUsed: context.totalTokensUsed,
            tokenBudget: context.tokenBudget,
          },
          branchesGenerated: 0,
          branchesEvaluated: 0,
          newAxiomsLearned: 0,
          totalDurationMs: Date.now() - t0,
          agiResult: null,
          error: "Model router generated 0 branches — check API key and model availability",
          pipelineHash: "",
        };
        return result;
      }

      // ── Phase 3: Tribunal Evaluation ──────────────────────────────────
      _log.info("Phase 3: Evaluating branches through deterministic tribunal");
      const tribunalSpan = _tracer.startSpan("eos.pipeline.tribunal", {
        "branches.count": branches.length,
        "test.command": req.testCommand,
      });

      const agiResult = await this.agiCore.solve(req.problem, branches, {
        testCommand: req.testCommand,
        testCwd: req.testCwd ?? this.projectRoot,
        timeoutMs: req.timeoutMs ?? 30_000,
      });

      tribunalSpan.setAttribute("solved", agiResult.solved);
      tribunalSpan.setAttribute("new.axioms", agiResult.newAxiomsLearned);
      tribunalSpan.setStatus(agiResult.solved ? "OK" : "ERROR");
      tribunalSpan.end();

      _log.info("Pipeline complete", {
        solved: agiResult.solved,
        winningBranchId: agiResult.winningBranchId,
        newAxioms: agiResult.newAxiomsLearned,
      });

      const totalDurationMs = Date.now() - t0;
      const hashData = `${req.problem}:${agiResult.solved}:${agiResult.branchesEvaluated}:${totalDurationMs}`;
      const pipelineHash = `sha256:${crypto.createHash("sha256").update(hashData).digest("hex")}`;

      span.setAttribute("solved", agiResult.solved);
      span.setAttribute("duration.ms", totalDurationMs);
      span.setAttribute("axioms.learned", agiResult.newAxiomsLearned);
      span.setStatus(agiResult.solved ? "OK" : "ERROR");
      span.end();

      return {
        problem: req.problem,
        solved: agiResult.solved,
        winningBranchId: agiResult.winningBranchId,
        winningStrategy: agiResult.winningStrategy,
        contextAssembled: {
          filesIncluded: context.filesIncluded,
          tokensUsed: context.totalTokensUsed,
          tokenBudget: context.tokenBudget,
        },
        branchesGenerated: branches.length,
        branchesEvaluated: agiResult.branchesEvaluated,
        newAxiomsLearned: agiResult.newAxiomsLearned,
        totalDurationMs,
        agiResult,
        error: null,
        pipelineHash,
      };
    } catch (err) {
      _log.error("Pipeline failed", { error: String(err).slice(0, 200) });
      span.setStatus("ERROR", String(err).slice(0, 100));
      span.end();
      return {
        problem: req.problem,
        solved: false,
        winningBranchId: null,
        winningStrategy: null,
        contextAssembled: { filesIncluded: 0, tokensUsed: 0, tokenBudget: req.tokenBudget ?? 32_000 },
        branchesGenerated: 0,
        branchesEvaluated: 0,
        newAxiomsLearned: 0,
        totalDurationMs: Date.now() - t0,
        agiResult: null,
        error: err instanceof Error ? err.message : String(err),
        pipelineHash: "",
      };
    }
  }

  /** Returns current learned axioms for inspection. */
  public getAxioms() {
    return this.agiCore.getAxioms();
  }

  /** Returns current router usage stats for FinOps tracking. */
  public getUsageStats() {
    return this.router.getUsageStats();
  }
}
