/**
 * EOS SYSTEM — AGI DATA CONTRACTS (Layer 0)
 *
 * Shared by the AGI core and the hermetic worker tribunal. Kept in a leaf
 * module so the tribunal never needs to import the core (architecture rule R3).
 */

/** A single hypothesis branch in the Tree of Thoughts. */
export interface ThoughtBranch {
  /** Unique branch identifier (e.g. "BRANCH-001"). */
  readonly id: string;
  /** One-sentence strategy description for logging and memory. */
  readonly strategy: string;
  /** Single target file (for backwards compatibility). Takes precedence if set. */
  readonly targetRelPath?: string;
  /** Single file content (backwards compat with single-file branches). */
  readonly proposedContent?: string;
  /** Multi-file targets — all files are written/rolled-back atomically. */
  readonly targets?: ReadonlyArray<{
    readonly relPath: string;
    readonly content: string;
  }>;
  /**
   * Complexity score 1–10 (lower = simpler = preferred).
   * The core sorts branches ascending so the cleanest solution
   * is attempted first — Occam's Razor enforcement.
   */
  readonly estimatedComplexity: number;
  /** Optional test command override for this branch (falls back to default). */
  readonly testCommandOverride?: string;
}

/** Verdict for a single branch evaluation. */
export interface BranchVerdict {
  readonly branchId: string;
  readonly strategy: string;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly rollbackApplied: boolean;
}
