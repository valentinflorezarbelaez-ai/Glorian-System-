/**
 * EOS SYSTEM — MCP TOOL REGISTRY (Layer 0)
 * Governed by ADR-015
 *
 * A zero-external-dependency registry that decouples tool dispatch from the
 * MCP server class. Each tool is registered as an isolated `ToolHandler`
 * object; the registry owns the dispatch loop and surfaces typed errors
 * instead of untyped throw-anything.
 *
 * Design contract:
 *  - Layer-0: no imports outside the standard Node built-ins or project core.
 *  - Synchronous API: handlers return `unknown` (or a Promise<unknown>) but
 *    the registry itself stays synchronous at the dispatch boundary.
 *  - Immutable after sealing: `deepFreeze` on the internal map is optional
 *    but callers should treat the registry as append-only.
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Shared runtime context passed into every tool handler at invocation time.
 * This replaces the need for handlers to capture `this.*` from the server
 * class and makes each handler unit-testable in isolation.
 */
export interface ToolContext {
  /**
   * Absolute path to the project root directory.
   * Resolved by `EosMcpServer` via the 4-tier waterfall in its constructor.
   */
  projectRoot: string;

  /**
   * The EOS sovereign knowledge store instance.
   * Typed `any` here to avoid a hard compile-time dependency on
   * `eosNeuralVectorCore` inside this Layer-0 module.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  knowledgeStore: any;
}

// ---------------------------------------------------------------------------
// ToolHandler interface
// ---------------------------------------------------------------------------

/**
 * A single executable tool exposed through the MCP interface.
 *
 * @example
 * ```ts
 * const echoHandler: ToolHandler = {
 *   name: "eos_echo",
 *   description: "Returns the input unchanged.",
 *   handle(args, _ctx) {
 *     return { echo: args.input };
 *   }
 * };
 * ```
 */
export interface ToolHandler {
  /** Unique tool name as declared in the MCP `tools/list` response. */
  readonly name: string;

  /**
   * Human-readable description forwarded to the MCP client during tool
   * discovery. Keep it concise — one sentence maximum.
   */
  readonly description: string;

  /**
   * Executes the tool logic.
   *
   * @param args   - Raw JSON-decoded arguments from the MCP call.
   * @param ctx    - Shared server context (projectRoot, knowledgeStore, …).
   * @returns      - Arbitrary JSON-serialisable result, or a Promise thereof.
   */
  handle(
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): unknown;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown by `EosToolRegistry.dispatch` when the requested tool name has no
 * registered handler.
 *
 * @example
 * ```ts
 * try {
 *   registry.dispatch("eos_unknown", {}, ctx);
 * } catch (e) {
 *   if (e instanceof ToolNotFoundError) {
 *     console.error(e.toolName); // "eos_unknown"
 *   }
 * }
 * ```
 */
export class ToolNotFoundError extends Error {
  /** Stable machine-readable error code. */
  public readonly code = "EOS_MCP_TOOL_NOT_FOUND" as const;

  /** The tool name that was looked up and not found. */
  public readonly toolName: string;

  constructor(toolName: string) {
    super(`EOS MCP tool not found: "${toolName}"`);
    this.name = "ToolNotFoundError";
    this.toolName = toolName;

    // Restore prototype chain when compiled to ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown (or re-thrown) by `EosToolRegistry.dispatch` when a registered
 * handler throws at runtime. The original error is preserved on `cause`.
 *
 * @example
 * ```ts
 * try {
 *   registry.dispatch("eos_validate_patch", { filePath: "" }, ctx);
 * } catch (e) {
 *   if (e instanceof ToolExecutionError) {
 *     console.error(e.code, e.toolName, e.cause);
 *   }
 * }
 * ```
 */
export class ToolExecutionError extends Error {
  /** Stable machine-readable error code. */
  public readonly code = "EOS_MCP_TOOL_EXECUTION_ERROR" as const;

  /** The tool name whose handler threw. */
  public readonly toolName: string;

  /**
   * The original error raised by the handler.
   * Typed as `unknown` because any value can be thrown in JavaScript.
   */
  public readonly cause: unknown;

  constructor(toolName: string, cause: unknown) {
    const causeMessage =
      cause instanceof Error ? cause.message : String(cause);
    super(
      `EOS MCP tool "${toolName}" threw during execution: ${causeMessage}`,
    );
    this.name = "ToolExecutionError";
    this.toolName = toolName;
    this.cause = cause;

    // Restore prototype chain when compiled to ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Maintains a lookup map of `ToolHandler` objects indexed by their `name`
 * and provides a single typed dispatch entrypoint.
 *
 * @example
 * ```ts
 * const registry = new EosToolRegistry();
 * registry.register(myHandler);
 *
 * const ctx: ToolContext = { projectRoot: "/repo", knowledgeStore: store };
 * const result = registry.dispatch("eos_my_tool", { key: "value" }, ctx);
 * ```
 */
export class EosToolRegistry {
  /** Internal handler map keyed by tool name. */
  private readonly _handlers = new Map<string, ToolHandler>();

  /**
   * Registers a tool handler.
   *
   * If a handler with the same `name` is already registered, the new one
   * silently replaces it — allowing hot-reload scenarios during development.
   *
   * @param handler - The tool handler to register.
   */
  public register(handler: ToolHandler): void {
    this._handlers.set(handler.name, handler);
  }

  /**
   * Dispatches a tool call by name.
   *
   * @param toolName - The MCP tool name to invoke.
   * @param args     - Raw call arguments forwarded to the handler.
   * @param ctx      - Shared server context.
   * @returns The handler's return value.
   * @throws {ToolNotFoundError}    When `toolName` has no registered handler.
   * @throws {ToolExecutionError}   When the handler itself throws.
   */
  public dispatch(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): unknown {
    const handler = this._handlers.get(toolName);
    if (!handler) {
      throw new ToolNotFoundError(toolName);
    }
    try {
      return handler.handle(args, ctx);
    } catch (cause) {
      // Re-wrap so callers always deal with a typed EOS error at this boundary.
      throw new ToolExecutionError(toolName, cause);
    }
  }

  /**
   * Returns a read-only snapshot of all registered handlers in insertion
   * order.  Useful for building `tools/list` MCP responses.
   *
   * @returns Immutable array of registered `ToolHandler` objects.
   */
  public listTools(): readonly ToolHandler[] {
    return Object.freeze([...this._handlers.values()]);
  }
}
