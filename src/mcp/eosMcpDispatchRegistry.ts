/**
 * EOS SYSTEM — MCP DISPATCH REGISTRY (SPEC-155 / CHANGE-090)
 * Progressive extraction target for eosMcpServer.ts god-file handlers.
 */

export interface McpHandlerContext {
  readonly projectRoot: string;
  readonly resolveProjectPath: (
    value: unknown,
    kind: "file" | "directory",
    fallback?: string
  ) => string;
  readonly onProgress?: (progress: number, total?: number, message?: string) => void;
}

export type McpToolHandler = (
  args: Record<string, any>,
  ctx: McpHandlerContext
) => unknown;

export class EosMcpDispatchRegistry {
  private readonly handlers = new Map<string, McpToolHandler>();

  public register(toolName: string, handler: McpToolHandler): void {
    const name = String(toolName || "").trim();
    if (!name) throw new Error("toolName required");
    this.handlers.set(name, handler);
  }

  public registerAll(bundle: Readonly<Record<string, McpToolHandler>>): void {
    for (const [name, handler] of Object.entries(bundle)) {
      this.register(name, handler);
    }
  }

  public has(toolName: string): boolean {
    return this.handlers.has(String(toolName || "").trim());
  }

  public get size(): number {
    return this.handlers.size;
  }

  public listRegistered(): readonly string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  public tryDispatch(
    toolName: string,
    args: Record<string, any>,
    ctx: McpHandlerContext
  ): { readonly handled: true; readonly result: unknown } | { readonly handled: false } {
    const handler = this.handlers.get(String(toolName || "").trim());
    if (!handler) return { handled: false };
    return { handled: true, result: handler(args || {}, ctx) };
  }
}
