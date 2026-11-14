/**
 * SPEC-239 / CHANGE-121 — Layer-0 Polyglot RepoMap Symbol Compressor.
 * Extracts public declarations and import topology across polyglot codebases,
 * ranking modules by graph centrality and packing strictly within token budgets.
 * Zero external runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  BuildRepoMapOptions,
  CompressedRepoMapReport,
  RepoMapFileEntry,
  RepoMapSourceFileInput,
} from "./eosRepoMapSymbolCompressorCore.types.ts";

const SUPPORTED_EXT = /\.(?:ts|mts|js|mjs|go|py|rs|java)$/i;
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", ".eos", ".worktrees", ".vercel", "coverage"]);

function resolveConfinedDir(projectRoot: string, relDir: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relDir);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function collectDiskFiles(rootAbs: string, scanAbs: string, maxFiles: number): RepoMapSourceFileInput[] {
  const results: RepoMapSourceFileInput[] = [];
  function walk(current: string): void {
    if (results.length >= maxFiles || !fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (results.length >= maxFiles) break;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(path.join(current, entry.name));
      } else if (entry.isFile() && SUPPORTED_EXT.test(entry.name)) {
        const abs = path.join(current, entry.name);
        const rel = path.relative(rootAbs, abs).replace(/\\/g, "/");
        results.push({ path: rel, content: fs.readFileSync(abs, "utf8") });
      }
    }
  }
  walk(scanAbs);
  return results;
}

function extractSymbols(content: string): string[] {
  const found = new Set<string>();
  const patterns: readonly RegExp[] = [
    /export\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|type|function|const|enum)\s+([A-Za-z0-9_]+)/g,
    /^\s*pub\s+(?:fn|struct|enum|trait)\s+([A-Za-z0-9_]+)/gm,
    /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z0-9_]+)\s*\(/gm,
    /^\s*(?:def|class)\s+([A-Za-z0-9_]+)/gm,
    /^\s*public\s+(?:class|interface|enum|record)\s+([A-Za-z0-9_]+)/gm,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      if (m[1]) found.add(m[1]);
    }
  }
  return [...found].slice(0, 20);
}

function extractRelativeImports(content: string): string[] {
  const refs: string[] = [];
  const re = /import\s+[^"']*["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    refs.push(m[1]);
  }
  return refs;
}

function estimateTokens(textLength: number): number {
  return Math.ceil(textLength / 4);
}

function packWithinBudget(
  entries: readonly RepoMapFileEntry[],
  maxTokenBudget: number,
): {
  markdown: string;
  includedCount: number;
} {
  const maxChars = Math.max(12, maxTokenBudget * 4);
  const lines: string[] = ["# RepoMap"];
  let usedChars = lines[0].length;
  let includedCount = 0;

  for (const item of entries) {
    const symbolList = item.symbols.length > 0 ? item.symbols.join(", ") : "(no exported symbols)";
    const candidate = `- ${item.path} [rank=${item.rankScore}, in=${item.inDegree}]: ${symbolList}`;
    if (usedChars + 1 + candidate.length > maxChars) break;
    lines.push(candidate);
    usedChars += 1 + candidate.length;
    includedCount++;
  }
  return { markdown: lines.join("\n"), includedCount };
}

export class EosRepoMapSymbolCompressorCore {
  public static buildCompressedRepoMap(options: BuildRepoMapOptions = {}): CompressedRepoMapReport {
    const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    const maxTokenBudget = Math.max(16, Math.trunc(options.maxTokenBudget ?? 1500));
    const maxFiles = Math.max(1, Math.min(500, Math.trunc(options.maxFiles ?? 80)));

    const files: readonly RepoMapSourceFileInput[] = options.sourceFilesOverride
      ? options.sourceFilesOverride.slice(0, maxFiles)
      : collectDiskFiles(
          projectRoot,
          options.targetDir ? resolveConfinedDir(projectRoot, options.targetDir) : projectRoot,
          maxFiles,
        );

    const parsed = files.map((f) => ({
      normPath: f.path.replace(/\\/g, "/"),
      baseNoExt: path.posix.basename(f.path.replace(/\\/g, "/")).replace(SUPPORTED_EXT, ""),
      symbols: extractSymbols(f.content),
      imports: extractRelativeImports(f.content),
      rawChars: f.content.length,
    }));

    const inDegreeMap = new Map<string, number>();
    for (const item of parsed) inDegreeMap.set(item.normPath, 0);

    for (const caller of parsed) {
      for (const imp of caller.imports) {
        const impBase = path.posix.basename(imp).replace(SUPPORTED_EXT, "");
        for (const target of parsed) {
          if (target.normPath !== caller.normPath && target.baseNoExt === impBase) {
            inDegreeMap.set(target.normPath, (inDegreeMap.get(target.normPath) ?? 0) + 1);
          }
        }
      }
    }

    const rankedEntries: RepoMapFileEntry[] = parsed
      .map((p) => {
        const inDegree = inDegreeMap.get(p.normPath) ?? 0;
        const rankScore = inDegree * 3 + p.symbols.length;
        return {
          path: p.normPath,
          symbols: p.symbols,
          importsCount: p.imports.length,
          inDegree,
          rankScore,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore || a.path.localeCompare(b.path));

    const packed = packWithinBudget(rankedEntries, maxTokenBudget);
    const originalChars = parsed.reduce((acc, f) => acc + f.rawChars, 0);
    const estimatedOriginalTokens = Math.max(1, estimateTokens(originalChars));
    const estimatedCompressedTokens = estimateTokens(packed.markdown.length);
    const tokenSavingsPercent = Math.max(
      0,
      Math.round(((estimatedOriginalTokens - estimatedCompressedTokens) / estimatedOriginalTokens) * 100),
    );

    const body = {
      filesScanned: parsed.length,
      filesIncluded: packed.includedCount,
      maxTokenBudget,
      estimatedOriginalTokens,
      estimatedCompressedTokens,
      tokenSavingsPercent,
      rankedEntries,
      compressedMapMarkdown: packed.markdown,
    };
    const repoMapDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return { ...body, repoMapDigestSha256 };
  }
}
