/**
 * EOS SYSTEM — API MIDDLEWARE CHAIN (Layer 0)
 * Governed by SPEC-164 (Kong / Express / Fastify pipeline pattern)
 *
 * Implements:
 * - Ordered middleware composition (use/insert)
 * - Async context propagation through the chain
 * - Short-circuit support (return early without calling next)
 * - Deterministic chain fingerprint for CI regression detection
 * - Structured error handler registration
 *
 * Zero external dependencies.
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  statusCode: number;
  response?: unknown;
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export type NextFn = () => Promise<void>;
export type MiddlewareFn = (ctx: RequestContext, next: NextFn) => Promise<void>;
export type ErrorHandlerFn = (err: unknown, ctx: RequestContext) => void;

export function createContext(
  partial: Partial<RequestContext> & { requestId: string; method: string; path: string },
): RequestContext {
  return {
    requestId: partial.requestId,
    method: partial.method,
    path: partial.path,
    headers: partial.headers ?? {},
    body: partial.body,
    statusCode: partial.statusCode ?? 200,
    response: partial.response,
    state: partial.state ?? {},
    metadata: partial.metadata ?? {},
  };
}

export class EosApiMiddlewareChain {
  private readonly middlewares: Array<{ name: string; fn: MiddlewareFn }> = [];
  private readonly errorHandlers: ErrorHandlerFn[] = [];

  use(name: string, fn: MiddlewareFn): this {
    this.middlewares.push({ name, fn });
    return this;
  }

  insert(index: number, name: string, fn: MiddlewareFn): this {
    this.middlewares.splice(index, 0, { name, fn });
    return this;
  }

  onError(handler: ErrorHandlerFn): this {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Runs the pipeline. Each middleware calls next() to advance; if it does
   * not, downstream middlewares are skipped (short-circuit).
   */
  async handle(ctx: RequestContext): Promise<RequestContext> {
    let cursor = 0;
    let shortCircuited = false;

    const runNext: NextFn = async () => {
      if (shortCircuited) return;
      if (cursor >= this.middlewares.length) return;
      const current = this.middlewares[cursor++];
      try {
        let called = false;
        await current.fn(ctx, async () => {
          called = true;
          await runNext();
        });
        if (!called) shortCircuited = true;
      } catch (err) {
        for (const h of this.errorHandlers) {
          try {
            h(err, ctx);
          } catch {
            /* swallow handler errors */
          }
        }
        throw err;
      }
    };

    await runNext();
    return ctx;
  }

  listNames(): readonly string[] {
    return this.middlewares.map((m) => m.name);
  }

  chainFingerprint(): string {
    return pureSha256(this.middlewares.map((m) => m.name).join(">"));
  }
}

// ------------------------------------------------------------------
// Ready-made middlewares
// ------------------------------------------------------------------

export function requestIdMiddleware(headerName = "x-request-id"): MiddlewareFn {
  return async (ctx, next) => {
    ctx.metadata.requestId = ctx.headers[headerName] ?? ctx.requestId;
    await next();
  };
}

export function timingMiddleware(): MiddlewareFn {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    ctx.metadata.durationMs = Date.now() - start;
  };
}

export function authMiddleware(verify: (token: string) => boolean): MiddlewareFn {
  return async (ctx, next) => {
    const token = ctx.headers["authorization"]?.replace(/^Bearer\s+/i, "") ?? "";
    if (!verify(token)) {
      ctx.statusCode = 401;
      ctx.response = deepFreeze({ error: "unauthorized" });
      return; // short-circuit
    }
    await next();
  };
}
