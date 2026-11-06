/**
 * EOS Error Catalog (Layer 0 — Centralized Typed Error Registry)
 *
 * Stripe-style error catalog for the EOS System. Every typed error class and
 * every stable machine-readable error code lives here, making programmatic
 * error handling reliable across the entire codebase.
 *
 * Design contract:
 *  - ZERO external dependencies — strictly pure TypeScript.
 *  - Each error class carries a `readonly code` string-literal field so
 *    callers can branch on `err.code` without relying on `instanceof`.
 *  - All codes are also enumerated in `EOS_ERROR_CODES` for exhaustive
 *    switch-case checking and human-readable descriptions.
 */

// ============================================================================
// Re-exports from peer modules
// ============================================================================

export { ContractError } from "./eosKernelPrimitives.ts";

/**
 * MCP tool errors — re-exported from the tool registry so consumers only
 * need to import from this single catalog file.
 */
export { ToolNotFoundError, ToolExecutionError } from "../mcp/eosToolRegistry.ts";

// ============================================================================
// Infrastructure errors — Fleet
// ============================================================================

/**
 * Base class for all EOS Fleet (multi-project workspace) errors.
 *
 * @example
 * ```ts
 * throw new EosFleetError("Workspace scan timed out", "my-project");
 * ```
 */
export class EosFleetError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "EOS_FLEET_001" as const;

  constructor(
    message: string,
    /** The fleet project identifier that triggered the error, if known. */
    public readonly projectId?: string,
  ) {
    super(message);
    this.name = "EosFleetError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a fleet project's `localPath` does not exist on disk.
 * Typically indicates a stale fleet registry entry or a missing checkout.
 *
 * @example
 * ```ts
 * throw new EosFleetPathNotFoundError("my-project", "/home/dev/repos/my-project");
 * ```
 */
export class EosFleetPathNotFoundError extends EosFleetError {
  /** Stable machine-readable error code. */
  readonly code = "EOS_FLEET_002" as const;

  constructor(
    projectId: string,
    /** The absolute local path that could not be found. */
    public readonly localPath: string,
  ) {
    super(
      `Fleet project "${projectId}" local path not found: ${localPath}`,
      projectId,
    );
    this.name = "EosFleetPathNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a `git status` or similar git operation fails for a fleet project.
 *
 * @example
 * ```ts
 * throw new EosFleetGitError("my-project", "not a git repository");
 * ```
 */
export class EosFleetGitError extends EosFleetError {
  /** Stable machine-readable error code. */
  readonly code = "EOS_FLEET_003" as const;

  constructor(
    projectId: string,
    /** The raw error message from the git subprocess. */
    public readonly gitError: string,
  ) {
    super(
      `Fleet project "${projectId}" git status check failed: ${gitError}`,
      projectId,
    );
    this.name = "EosFleetGitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Pipeline errors — CI/CD
// ============================================================================

/**
 * Base class for all EOS CI/CD pipeline stage errors.
 *
 * @example
 * ```ts
 * throw new EosPipelineError("Lint stage failed with exit code 1", "lint");
 * ```
 */
export class EosPipelineError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "EOS_PIPELINE_001" as const;

  constructor(
    message: string,
    /** The pipeline stage name (e.g. "lint", "test", "build") if known. */
    public readonly stage?: string,
  ) {
    super(message);
    this.name = "EosPipelineError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a plaintext secret is detected in a file — a Law VI violation.
 * Blocks the pipeline immediately to prevent secret exfiltration.
 *
 * @example
 * ```ts
 * throw new EosSecretLeakError("src/config.ts", "AWS_SECRET_ACCESS_KEY");
 * ```
 */
export class EosSecretLeakError extends EosPipelineError {
  /** Stable machine-readable error code. */
  readonly code = "EOS_PIPELINE_002" as const;

  constructor(
    /** Path of the file containing the secret. */
    public readonly filePath: string,
    /** The type or name of the secret pattern that was matched. */
    public readonly secretType: string,
  ) {
    super(
      `Plaintext secret detected — Law VI violation: ${secretType} in ${filePath}`,
      "secret-scan",
    );
    this.name = "EosSecretLeakError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Architecture errors — Hexagonal invariants
// ============================================================================

/**
 * Base class for all hexagonal-architecture invariant violations.
 * Raised by the architecture linter or the refactor engine.
 *
 * @example
 * ```ts
 * throw new EosArchitectureViolationError(
 *   "Layer-0 module imports from Layer-2",
 *   "src/core/eosKernelPrimitives.ts",
 *   "no-upward-layer-import",
 * );
 * ```
 */
export class EosArchitectureViolationError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "EOS_ARCH_001" as const;

  constructor(
    message: string,
    /** The source file that violated the architecture rule, if known. */
    public readonly file?: string,
    /** The rule identifier that was violated, if known. */
    public readonly rule?: string,
  ) {
    super(message);
    this.name = "EosArchitectureViolationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the dependency analyser detects a circular import cycle.
 * The `cycle` array lists the full import path in order, e.g.
 * `["a.ts", "b.ts", "c.ts", "a.ts"]`.
 *
 * @example
 * ```ts
 * throw new EosCircularDependencyError([
 *   "src/core/eosKernelPrimitives.ts",
 *   "src/mcp/eosToolRegistry.ts",
 *   "src/core/eosKernelPrimitives.ts",
 * ]);
 * ```
 */
export class EosCircularDependencyError extends EosArchitectureViolationError {
  /** Stable machine-readable error code. */
  readonly code = "EOS_ARCH_002" as const;

  constructor(
    /** Ordered list of module paths forming the cycle (first === last). */
    public readonly cycle: readonly string[],
  ) {
    super(
      `Circular import dependency cycle detected: ${cycle.join(" → ")}`,
      cycle[0],
      "no-circular-imports",
    );
    this.name = "EosCircularDependencyError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Healing errors — Autonomous refactor / self-repair
// ============================================================================

/**
 * Thrown when an autonomous healing or refactoring operation fails to apply
 * a patch or complete a repair pass.
 *
 * @example
 * ```ts
 * throw new EosHealingError("Patch conflict on hunk 3", "src/api/fleet.ts");
 * ```
 */
export class EosHealingError extends Error {
  /** Stable machine-readable error code. */
  readonly code = "EOS_HEAL_001" as const;

  constructor(
    message: string,
    /** The file being repaired when the error occurred, if known. */
    public readonly targetFile?: string,
  ) {
    super(message);
    this.name = "EosHealingError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Error code catalog
// ============================================================================

/**
 * Exhaustive map of every stable EOS error code to its human-readable
 * description.  Use this for logging, monitoring dashboards, and
 * exhaustive switch-case type checks.
 *
 * @example
 * ```ts
 * import { EOS_ERROR_CODES, EosErrorCode } from "./eosErrorCatalog.ts";
 *
 * function describe(code: EosErrorCode): string {
 *   return EOS_ERROR_CODES[code];
 * }
 * ```
 */
export const EOS_ERROR_CODES = Object.freeze({
  EOS_FLEET_001: "Fleet operation failed",
  EOS_FLEET_002: "Fleet project local path not found",
  EOS_FLEET_003: "Fleet git status check failed",
  EOS_PIPELINE_001: "CI/CD pipeline stage failed",
  EOS_PIPELINE_002: "Plaintext secret detected — Law VI violation",
  EOS_MCP_TOOL_NOT_FOUND: "MCP tool not registered",
  EOS_MCP_TOOL_EXECUTION_ERROR: "MCP tool handler threw during execution",
  EOS_ARCH_001: "Hexagonal architecture invariant violated",
  EOS_ARCH_002: "Circular import dependency cycle detected",
  EOS_HEAL_001: "Autonomous healing operation failed",
} as const);

/** Union type of every stable EOS error code string. */
export type EosErrorCode = keyof typeof EOS_ERROR_CODES;
