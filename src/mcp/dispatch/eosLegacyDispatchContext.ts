import type { EosKnowledgeGraphEngine } from "../../core/eosKnowledgeGraphEngine.ts";
import type { EosHnswVectorEngine } from "../../core/eosHnswVectorEngine.ts";

export interface EosLegacyDispatchContext {
  readonly projectRoot: string;
  readonly knowledgeGraph: EosKnowledgeGraphEngine;
  readonly hnsw: EosHnswVectorEngine;
  resolveProjectPath(value: unknown, kind: "file" | "directory", defaultPath?: string): string;
}

export type EosLegacyProgressReporter = (progress: number, total?: number, message?: string) => void;

export type EosLegacyToolArgs = Record<string, any>;

export type EosLegacyToolHandler = (
  context: EosLegacyDispatchContext,
  args: EosLegacyToolArgs,
  onProgress?: EosLegacyProgressReporter,
) => any;
