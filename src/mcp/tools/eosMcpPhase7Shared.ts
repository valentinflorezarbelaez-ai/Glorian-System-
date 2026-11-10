/**
 * EOS SYSTEM — PHASE-7 SHARED HANDLER CONTRACT (SPEC-155 / T7c)
 * Dependency shape and input-hardening helpers shared by the Phase-7 handler slices.
 */

import path from "node:path";

export const MAX_MCP_STRING_BYTES = 256 * 1024;

export interface Phase7DomainHandlerDeps {
  readonly projectRoot: string;
  readonly resolveProjectPath: (value: unknown, kind: "file" | "directory", fallback?: string) => string;
  readonly resolveConfinedLedgerPath: (value: unknown) => string;
  readonly hybridKnowledge: any;
  readonly knowledgeStore: any;
  readonly knowledgeGraph: any;
  readonly agentSessionContract: any;
  readonly hnsw: any;
  readonly server: any;
}

export interface Phase7HandlerContext {
  readonly onProgress?: (...args: any[]) => void;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
