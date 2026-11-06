# ADR-0003: MCP Tool Handler Registry Pattern (decompose god-file)

- Status: Accepted
- Date: 2026-10-26
- Deciders: Valentín Flórez Arbeláez

---

## Context

`eosMcpServer.ts` organically grew to **3,200 lines** with a single
`dispatchTool()` method containing a **1,226-line `switch/case`** block that
handled every MCP tool in one place. This structure created several problems:

- **Untestable in isolation** — unit tests for a single tool (e.g.,
  `eos_kernel_health`) required instantiating the entire MCP server with all
  dependencies.
- **Merge conflicts** — every tool addition or modification touched the same
  file, causing frequent conflicts in version control.
- **Single Responsibility violation** — the server class owned lifecycle
  management (start, stop, session handling) *and* all business logic for every
  tool simultaneously.
- **Cognitive load** — a contributor adding a new tool had to navigate 3,200
  lines to find the correct insertion point and ensure no `case` label shadowing.
- **Static analysis degradation** — TypeScript's type narrowing inside a 1,226-
  line switch is slow and occasionally incorrect due to control-flow complexity.

---

## Decision

Introduce two new constructs:

### 1. `ToolHandler` interface (`src/mcp/eosToolRegistry.ts`)

```typescript
export interface ToolHandler {
  readonly toolName: string;
  readonly schema: ToolSchema;
  execute(params: unknown, context: EosContext): Promise<ToolResult>;
}
```

Each MCP tool is implemented as a class (or plain object) satisfying this
interface, placed in `src/mcp/handlers/<toolName>.handler.ts`.

### 2. `EosToolRegistry` class (`src/mcp/eosToolRegistry.ts`)

```typescript
export class EosToolRegistry {
  private handlers = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void { ... }
  dispatch(toolName: string, params: unknown, ctx: EosContext): Promise<ToolResult> { ... }
  listTools(): ToolSchema[] { ... }
}
```

`eosMcpServer.ts` is reduced to lifecycle management: it instantiates the
registry, registers handlers at startup, and delegates all `tools/call` requests
to `registry.dispatch()`. The server class itself has no knowledge of individual
tool logic.

Handlers are registered in `src/mcp/handlerBootstrap.ts`, the single place where
all handlers are imported and wired to the registry.

---

## Consequences

**Positive:**
- Each handler module is **independently unit-testable** — no server startup
  required.
- Adding a new tool requires only: creating `src/mcp/handlers/<name>.handler.ts`
  and adding one `registry.register(new MyHandler())` line in
  `handlerBootstrap.ts`.
- `eosMcpServer.ts` shrinks to ~150 lines of lifecycle code.
- TypeScript type narrowing is fast and correct per handler (small, focused
  files).
- Parallel test execution is trivially achievable — handlers share no mutable
  state.

**Negative / Trade-offs:**
- Initial migration cost: existing 1,226-line switch must be decomposed into
  individual handler files (one-time effort).
- Slightly more files in the `handlers/` directory (one file per tool), which
  may feel verbose for simple tools.
- `handlerBootstrap.ts` becomes a mandatory edit point for every new tool
  (acceptable; it's a single-line addition).

---

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| **Leave the god-file** | Untestable, unmaintainable. Ruled out immediately. |
| **Dynamic `require()` / plugin loading** | Over-engineering; runtime `require()` defeats static analysis and TypeScript's module graph. Security concern for an MCP server. |
| **Separate microservices per tool** | Extreme operational overhead for a single-operator system; network latency per tool call is unacceptable. |
| **Function map (plain object)** | Viable, but a class-based registry provides `listTools()` for MCP capability advertisement without a separate data structure. |
