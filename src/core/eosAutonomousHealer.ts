/**
 * Local formatting-remediation suggestions with optional explicit file writes.
 * The syntax check is local and heuristic; it does not establish production readiness.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { validatePatch } from "./eosPatchValidator.ts";
import { runTurboPipeline } from "./eosTurboEngine.ts";
import type { TurboPipelineResult } from "./eosTurboEngine.ts";
import { EosSemanticGraph } from "./eosSemanticGraph.ts";

const MAX_HEAL_SOURCE_FILE_BYTES = 1024 * 1024;
const MAX_HEAL_SCAN_FILES = 2000;
const MAX_HEAL_SCAN_BYTES = 50 * 1024 * 1024;

export type RemediationAction =
  | "NORMALIZE_LINE_ENDINGS"
  | "PRUNE_TRAILING_WHITESPACE"
  | "INJECT_SOVEREIGN_HEADER"
  | "RESOLVE_ORPHAN_EXPORT"
  | "CUSTOM_PATCH";

export interface RemediationCandidate {
  readonly targetPath: string;
  readonly fullPath: string;
  readonly action: RemediationAction;
  readonly originalContent: string;
  readonly proposedContent: string;
  readonly patchDiff: string;
  readonly sandboxValid: boolean;
  readonly blastRadiusRisk: string;
}

export interface HealOptions {
  readonly dryRun?: boolean;
  readonly targetFile?: string;
  readonly autoApply?: boolean;
}

export interface HealExecutionReport {
  readonly success: boolean;
  readonly remediatedCount: number;
  readonly candidateCount: number;
  readonly changesApplied: boolean;
  readonly writeStatus: "NOT_REQUESTED" | "NO_CHANGES" | "APPLIED" | "REJECTED" | "CONFLICT" | "PARTIAL" | "FAILED";
  readonly writeConflicts: readonly string[];
  readonly writeErrors: readonly string[];
  readonly localChecksExecuted: boolean;
  readonly candidates: readonly RemediationCandidate[];
  readonly epistemicState: "LOCAL_CHECKS_PASSED" | "FINDINGS_IDENTIFIED";
  readonly receiptPath: string | null;
  readonly receiptSha256: string | null;
  readonly durationMs: number;
}

interface StagedRemediation {
  readonly candidate: RemediationCandidate;
  readonly targetPath: string;
  temporaryPath: string;
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Produces a minimal human-readable text diff.
 */
function createSimpleDiff(orig: string, proposed: string): string {
  if (orig === proposed) return "(No change)";
  const origLines = orig.split("\n");
  const propLines = proposed.split("\n");

  const diffLines: string[] = [];
  const max = Math.max(origLines.length, propLines.length);

  for (let i = 0; i < max; i++) {
    const o = origLines[i];
    const p = propLines[i];
    if (o !== p) {
      if (o !== undefined) diffLines.push(`- L${i + 1}: ${o}`);
      if (p !== undefined) diffLines.push(`+ L${i + 1}: ${p}`);
    }
  }

  return diffLines.slice(0, 10).join("\n") || "(Binary/Formatting diff)";
}

export class EosAutonomousHealer {
  private readonly projectRoot: string;
  private readonly semanticGraph: EosSemanticGraph;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.semanticGraph = new EosSemanticGraph(projectRoot);
  }

  private applyCandidates(candidates: readonly RemediationCandidate[]): {
    readonly applied: readonly RemediationCandidate[];
    readonly conflicts: readonly string[];
    readonly errors: readonly string[];
  } {
    const root = fs.realpathSync(this.projectRoot);
    const staged: StagedRemediation[] = [];
    const conflicts: string[] = [];
    const errors: string[] = [];
    const applied: RemediationCandidate[] = [];

    const cleanup = () => {
      for (const entry of staged) {
        if (entry.temporaryPath && fs.existsSync(entry.temporaryPath)) {
          try { fs.unlinkSync(entry.temporaryPath); } catch {}
        }
      }
    };
    const unchangedRegularFile = (targetPath: string, candidate: RemediationCandidate): boolean => {
      try {
        const fileStat = fs.lstatSync(targetPath);
        if (!fileStat.isFile() || fileStat.isSymbolicLink()) return false;
        const realPath = fs.realpathSync(targetPath);
        if (!isPathWithin(root, realPath)) return false;
        return fs.readFileSync(realPath, "utf8") === candidate.originalContent;
      } catch {
        return false;
      }
    };

    try {
      for (const candidate of candidates) {
        const targetPath = path.resolve(root, candidate.targetPath);
        if (!isPathWithin(root, targetPath) || !unchangedRegularFile(targetPath, candidate)) {
          conflicts.push(candidate.targetPath);
          continue;
        }

        const fileStat = fs.statSync(targetPath);
        const temporaryPath = path.join(
          path.dirname(targetPath),
          `.${path.basename(targetPath)}.eos-${crypto.randomUUID()}.tmp`
        );
        try {
          fs.writeFileSync(temporaryPath, candidate.proposedContent, {
            encoding: "utf8",
            flag: "wx",
            mode: fileStat.mode & 0o777
          });
          staged.push({ candidate, targetPath, temporaryPath });
        } catch (error) {
          try { fs.unlinkSync(temporaryPath); } catch {}
          errors.push(`${candidate.targetPath}: ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
      }

      // Do not start replacing files if any proposal changed while it was staged.
      if (conflicts.length > 0 || errors.length > 0) return { applied, conflicts, errors };

      for (const entry of staged) {
        if (!unchangedRegularFile(entry.targetPath, entry.candidate)) {
          conflicts.push(entry.candidate.targetPath);
          break;
        }
        try {
          // Same-directory rename makes each individual file replacement atomic.
          fs.renameSync(entry.temporaryPath, entry.targetPath);
          entry.temporaryPath = "";
          applied.push(entry.candidate);
        } catch (error) {
          errors.push(`${entry.candidate.targetPath}: ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
      }
    } finally {
      cleanup();
    }

    return { applied, conflicts, errors };
  }

  /**
   * Diagnoses and synthesizes remediation patches for target or project files.
   */
  public diagnoseAndSynthesize(targetRelativePath?: string): RemediationCandidate[] {
    const candidates: RemediationCandidate[] = [];
    const realRoot = fs.realpathSync(this.projectRoot);

    const filesToScan: string[] = [];
    if (targetRelativePath) {
      if (Buffer.byteLength(targetRelativePath, "utf8") > 4096) {
        throw new RangeError("Target file path must not exceed 4096 UTF-8 bytes.");
      }
      const full = path.resolve(realRoot, targetRelativePath);
      if (!isPathWithin(realRoot, full)) {
        throw new Error("Target file must stay inside the project root.");
      }
      if (fs.existsSync(full)) {
        const realFile = fs.realpathSync(full);
        if (!isPathWithin(realRoot, realFile)) {
          throw new Error("Target file must resolve inside the project root.");
        }
        if (fs.statSync(realFile).isFile()) filesToScan.push(realFile);
      }
    } else {
      // Scan all source files in src/
      const srcDir = path.join(realRoot, "src");
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const realDir = fs.realpathSync(dir);
        if (!isPathWithin(realRoot, realDir)) throw new Error("Source scan directory resolves outside the project root.");
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(realDir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
            filesToScan.push(full);
          }
        }
      };
      walk(srcDir);
    }

    if (filesToScan.length > MAX_HEAL_SCAN_FILES) {
      throw new RangeError(`Healing scan exceeds the ${MAX_HEAL_SCAN_FILES}-file limit.`);
    }
    let totalBytes = 0;
    for (const fullPath of filesToScan) {
      const fileStat = fs.statSync(fullPath);
      if (fileStat.size > MAX_HEAL_SOURCE_FILE_BYTES) {
        throw new RangeError(`Healing target exceeds the 1 MiB file limit: ${path.relative(realRoot, fullPath)}`);
      }
      totalBytes += fileStat.size;
      if (totalBytes > MAX_HEAL_SCAN_BYTES) throw new RangeError("Healing scan exceeds the 50 MiB aggregate file limit.");
      const relPath = path.relative(realRoot, fullPath).replace(/\\/g, "/");
      const origContent = fs.readFileSync(fullPath, "utf8");
      let proposed = origContent;
      let action: RemediationAction | null = null;

      // 1. Line Ending Normalization (CRLF -> LF)
      if (proposed.includes("\r\n")) {
        proposed = proposed.replace(/\r\n/g, "\n");
        action = "NORMALIZE_LINE_ENDINGS";
      }

      // 2. Trailing Whitespace Pruning
      const lines = proposed.split("\n");
      let hasTrailing = false;
      const cleanedLines = lines.map((l) => {
        const trimmed = l.trimEnd();
        if (trimmed !== l) hasTrailing = true;
        return trimmed;
      });

      if (hasTrailing) {
        proposed = cleanedLines.join("\n");
        action = action || "PRUNE_TRAILING_WHITESPACE";
      }

      // 3. Ensure trailing newline at EOF
      if (proposed.length > 0 && !proposed.endsWith("\n")) {
        proposed += "\n";
        action = action || "PRUNE_TRAILING_WHITESPACE";
      }

      if (action && proposed !== origContent) {
        // Pre-validate via AST sandbox
        const valRes = validatePatch(relPath, proposed, this.projectRoot);
        const blast = this.semanticGraph.calculateBlastRadius(relPath);

        candidates.push({
          targetPath: relPath,
          fullPath,
          action,
          originalContent: origContent,
          proposedContent: proposed,
          patchDiff: createSimpleDiff(origContent, proposed),
          sandboxValid: valRes.valid,
          blastRadiusRisk: blast.riskLevel
        });
      }
    }

    return candidates;
  }

  /**
   * Executes autonomous healing across the project or specified file.
   */
  public executeHealing(options: HealOptions = {}): HealExecutionReport {
    const startMs = Date.now();
    const applyChanges = options.autoApply === true && options.dryRun !== true;
    const candidates = this.diagnoseAndSynthesize(options.targetFile);
    const validCandidates = candidates.filter((c) => c.sandboxValid);
    let appliedCandidates: readonly RemediationCandidate[] = [];
    let writeConflicts: readonly string[] = [];
    let writeErrors: string[] = [];
    let writeStatus: HealExecutionReport["writeStatus"] = "NOT_REQUESTED";

    if (applyChanges && candidates.length === 0) {
      writeStatus = "NO_CHANGES";
    } else if (applyChanges && validCandidates.length !== candidates.length) {
      writeStatus = "REJECTED";
    } else if (applyChanges) {
      const applied = this.applyCandidates(validCandidates);
      appliedCandidates = applied.applied;
      writeConflicts = applied.conflicts;
      writeErrors = [...applied.errors];
      if (writeConflicts.length > 0 || writeErrors.length > 0) {
        writeStatus = appliedCandidates.length > 0 ? "PARTIAL" : writeConflicts.length > 0 ? "CONFLICT" : "FAILED";
      } else {
        writeStatus = "APPLIED";
      }
    }

    // Run turbo pipeline to verify final state
    let turboRes: TurboPipelineResult;
    let localChecksExecuted = false;
    try {
      turboRes = runTurboPipeline(this.projectRoot);
      localChecksExecuted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      turboRes = {
        success: false,
        totalDurationUs: 0,
        totalDurationMs: 0,
        totalFilesChecked: 0,
        cacheHits: 0,
        freshScans: 0,
        stages: [],
        violations: [`Local verification could not complete: ${message}`],
        epistemicState: "FINDINGS_IDENTIFIED",
        sourceInventoryDigest: "unavailable"
      };
    }

    let receiptPath: string | null = null;
    let receiptSha256: string | null = null;

    if (applyChanges && appliedCandidates.length > 0) {
      const timestamp = new Date().toISOString();
      const receiptData = {
        epistemicState: turboRes.success ? "LOCAL_CHECKS_PASSED" : "FINDINGS_IDENTIFIED",
        timestamp,
        remediatedFilesCount: appliedCandidates.length,
        writeStatus,
        writeConflicts,
        writeErrors,
        remediations: appliedCandidates.map((c) => ({
          file: c.targetPath,
          action: c.action,
          blastRadiusRisk: c.blastRadiusRisk,
          sandboxValid: c.sandboxValid
        })),
        sourceInventoryDigest: turboRes.sourceInventoryDigest
      };

      const receiptContent = JSON.stringify(receiptData, null, 2);
      receiptSha256 = crypto.createHash("sha256").update(receiptContent, "utf8").digest("hex");
      let receiptCreated = false;
      try {
        const root = fs.realpathSync(this.projectRoot);
        const docsPath = path.join(root, "docs");
        const realDocsPath = fs.realpathSync(docsPath);
        if (!isPathWithin(root, realDocsPath)) throw new Error("Evidence directory resolves outside the project root.");
        const receiptDir = path.join(realDocsPath, "evidence");
        if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir);
        const realReceiptDir = fs.realpathSync(receiptDir);
        if (!isPathWithin(root, realReceiptDir)) throw new Error("Evidence directory resolves outside the project root.");
        const safeTimestamp = timestamp.replace(/[:.]/g, "-");
        receiptPath = path.join(realReceiptDir, `HEAL-${safeTimestamp}-${crypto.randomBytes(4).toString("hex")}.json`);
        const descriptor = fs.openSync(receiptPath, "wx", 0o644);
        receiptCreated = true;
        try {
          fs.writeFileSync(descriptor, receiptContent, "utf8");
        } finally {
          fs.closeSync(descriptor);
        }
      } catch (error) {
        if (receiptCreated && receiptPath) {
          try { fs.unlinkSync(receiptPath); } catch {}
        }
        receiptPath = null;
        receiptSha256 = null;
        writeErrors = [...writeErrors, `Healing receipt: ${error instanceof Error ? error.message : String(error)}`];
        writeStatus = appliedCandidates.length > 0 ? "PARTIAL" : "FAILED";
      }
    }

    const appliedCount = appliedCandidates.length;
    const success = turboRes.success && (
      !applyChanges || writeStatus === "APPLIED" || writeStatus === "NO_CHANGES"
    );

    return {
      success,
      remediatedCount: appliedCount,
      candidateCount: candidates.length,
      changesApplied: appliedCount > 0,
      writeStatus,
      writeConflicts,
      writeErrors,
      localChecksExecuted,
      candidates,
      epistemicState: success ? "LOCAL_CHECKS_PASSED" : "FINDINGS_IDENTIFIED",
      receiptPath,
      receiptSha256: receiptSha256 ? `sha256:${receiptSha256}` : null,
      durationMs: Date.now() - startMs
    };
  }
}
