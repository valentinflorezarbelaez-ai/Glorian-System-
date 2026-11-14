/**
 * SPEC-239 / CHANGE-121 — Layer-0 Polyglot RepoMap Symbol Compressor Types.
 * Zero external runtime dependencies (EOS Law V).
 */

export interface RepoMapSourceFileInput {
  readonly path: string;
  readonly content: string;
}

export interface BuildRepoMapOptions {
  readonly projectRoot?: string;
  readonly targetDir?: string;
  readonly maxTokenBudget?: number;
  readonly maxFiles?: number;
  readonly sourceFilesOverride?: readonly RepoMapSourceFileInput[];
}

export interface RepoMapFileEntry {
  readonly path: string;
  readonly symbols: readonly string[];
  readonly importsCount: number;
  readonly inDegree: number;
  readonly rankScore: number;
}

export interface CompressedRepoMapReport {
  readonly filesScanned: number;
  readonly filesIncluded: number;
  readonly maxTokenBudget: number;
  readonly estimatedOriginalTokens: number;
  readonly estimatedCompressedTokens: number;
  readonly tokenSavingsPercent: number;
  readonly rankedEntries: readonly RepoMapFileEntry[];
  readonly compressedMapMarkdown: string;
  readonly repoMapDigestSha256: string;
}
