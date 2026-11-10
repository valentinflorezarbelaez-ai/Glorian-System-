/**
 * Shared shape for static MCP "tools/list" schema entries.
 * Lives in its own module so definition partitions can import it without a cycle.
 */
export interface EosMcpToolDefinitionInput {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}
