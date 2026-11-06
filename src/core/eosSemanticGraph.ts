/**
 * EOS SYSTEM — STATIC SOURCE IMPORT GRAPH (Layer 0)
 * Governed by ADR-021, FR-031, FR-032, FR-033, FR-034 & BDD-024, BDD-025
 *
 * Indexes supported static relative imports and exported declarations. The graph
 * is heuristic: it does not resolve every TypeScript/JavaScript import form,
 * measure runtime impact, or guarantee a complete test selection.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type SymbolKind = "function" | "class" | "interface" | "type" | "const" | "variable";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ExportedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly filePath: string;
  readonly lineNumber: number;
}

export interface FileNode {
  readonly filePath: string;
  readonly fullPath: string;
  readonly exports: readonly ExportedSymbol[];
  readonly imports: readonly string[]; // Relative file paths imported by this file
  readonly importedBy: string[];       // Reverse index: files that import this file
}

export interface BlastRadiusReport {
  readonly targetFile: string;
  readonly directConsumers: readonly string[];
  readonly transitiveConsumers: readonly string[];
  readonly totalImpactedFiles: number;
  readonly impactPercentage: number;
  readonly riskLevel: RiskLevel;
  readonly affectedLayers: readonly string[];
  readonly predictiveTestSuites: readonly string[];
  readonly durationUs: number;
}

export interface DeadCodeSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly filePath: string;
  readonly lineNumber: number;
}

export interface SemanticGraphSummary {
  readonly totalFiles: number;
  readonly totalExports: number;
  readonly totalEdges: number;
  readonly deadCodeCount: number;
  readonly deadSymbols: readonly DeadCodeSymbol[];
  readonly durationMs: number;
}

/**
 * Mapping of source modules to their corresponding test suites (PTS Matrix).
 */
const PTS_TEST_MAP: Record<string, string[]> = {
  "src/core/eosNeuralVectorCore": ["test/eosCore.test.mjs"],
  "src/core/eosJarvisMonad": ["test/eosCore.test.mjs", "test/chaosResilience.test.mjs"],
  "src/core/eosPatchValidator": ["test/eosCore.test.mjs"],
  "src/core/eosContextOptimizer": ["test/eosCore.test.mjs"],
  "src/core/eosPromptAmplifier": ["test/eosPrometheus.test.mjs"],
  "src/core/eosArchitectureGuard": ["test/eosPrometheus.test.mjs"],
  "src/core/eosCognitiveJudge": ["test/eosPrometheus.test.mjs"],
  "src/core/eosTurboEngine": ["test/eosTurbo.test.mjs"],
  "src/core/eosSemanticGraph": ["test/eosSemanticGraph.test.mjs"],
  "src/core/eosAutonomousHealer": ["test/eosAutonomousHealer.test.mjs"],
  "src/core/eosWorktreeOrchestrator": ["test/eosWorktree.test.mjs"],
  "src/core/eosCognitiveEval": ["test/eosCognitiveEval.test.mjs"],
  "src/core/eosOpenSpecSync": ["test/eosOpenSpec.test.mjs"],
  "src/core/eosTitansMatrix": ["test/eosTitans.test.mjs"],
  "src/core/eosSpotifyCodex": ["test/eosSpotify.test.mjs", "test/eosTitans.test.mjs"],
  "src/mcp/eosMcpServer": ["test/eosCore.test.mjs", "test/eosPrometheus.test.mjs", "test/eosTurbo.test.mjs", "test/eosSpotify.test.mjs"],
  "bin/eos": ["test/eosCore.test.mjs", "test/eosTurbo.test.mjs"]
};

/**
 * Extracts exported symbols from source code.
 */
export function extractExports(sourceCode: string, relativePath: string): ExportedSymbol[] {
  const symbols: ExportedSymbol[] = [];
  const lines = sourceCode.split(/\r?\n/);

  const exportPatterns = [
    { kind: "function" as SymbolKind, regex: /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/ },
    { kind: "class" as SymbolKind, regex: /export\s+class\s+([A-Za-z0-9_$]+)/ },
    { kind: "interface" as SymbolKind, regex: /export\s+interface\s+([A-Za-z0-9_$]+)/ },
    { kind: "type" as SymbolKind, regex: /export\s+type\s+([A-Za-z0-9_$]+)/ },
    { kind: "const" as SymbolKind, regex: /export\s+const\s+([A-Za-z0-9_$]+)/ }
  ];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;

    for (const pat of exportPatterns) {
      const match = pat.regex.exec(trimmed);
      if (match) {
        const symbolName = match[1];
        if (symbolName.startsWith("$") || trimmed.includes("${")) continue;
        symbols.push({
          name: symbolName,
          kind: pat.kind,
          filePath: relativePath,
          lineNumber: idx + 1
        });
        break;
      }
    }
  });

  return symbols;
}

/**
 * Resolves a relative import specifier to a relative project path.
 */
function resolveImportPath(specifier: string, sourceFullPath: string, projectRoot: string): string | null {
  if (!specifier.startsWith(".")) return null;

  const sourceDir = path.dirname(sourceFullPath);
  const targetCandidate = path.resolve(sourceDir, specifier);
  const extensions = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];

  for (const ext of extensions) {
    const candidate = targetCandidate + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(projectRoot, candidate).replace(/\\/g, "/");
    }
  }

  return null;
}

/**
 * Builds the complete semantic code graph for the project.
 */
export class EosSemanticGraph {
  public readonly nodes = new Map<string, FileNode>();
  public readonly symbolIndex = new Map<string, ExportedSymbol[]>();
  public readonly projectRoot: string;
  private readonly _cacheFile: string;
  private static readonly _CACHE_VERSION = "1";

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this._cacheFile = path.join(this.projectRoot, ".eos-graph-cache.json");
    this._loadOrBuild();
  }

  private _loadOrBuild(): void {
    // Compute a fast fingerprint of all source files (mtimeMs sum)
    const fingerprint = this._computeFingerprint();

    // Try loading from cache
    if (fs.existsSync(this._cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(this._cacheFile, "utf8"));
        if (cache.version === EosSemanticGraph._CACHE_VERSION && cache.fingerprint === fingerprint) {
          // Restore nodes from cache
          for (const [k, v] of Object.entries(cache.nodes as Record<string, unknown>)) {
            this.nodes.set(k, v as FileNode);
          }
          return; // cache hit
        }
      } catch {
        // corrupt cache — rebuild
      }
    }

    // Cache miss or stale — rebuild and save
    this.buildGraph();
    this._saveCache(fingerprint);
  }

  private _computeFingerprint(): string {
    // Scan directories directly for fingerprint (pre-build, nodes map is empty)
    const dirs = ["src", "test", "api", "bin"];
    let fsum = 0n;
    for (const dir of dirs) {
      const d = path.join(this.projectRoot, dir);
      if (!fs.existsSync(d)) continue;
      const walk = (p: string) => {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          const full = path.join(p, e.name);
          if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) walk(full);
          else if (e.isFile() && /\.(ts|tsx|js|mjs)$/.test(e.name)) {
            try { fsum += BigInt(Math.floor(fs.statSync(full).mtimeMs)); } catch { /* skip */ }
          }
        }
      };
      walk(d);
    }
    return fsum.toString(16);
  }

  private _saveCache(fingerprint: string): void {
    try {
      const cache = {
        version: EosSemanticGraph._CACHE_VERSION,
        fingerprint,
        savedAt: new Date().toISOString(),
        nodes: Object.fromEntries(this.nodes),
      };
      fs.writeFileSync(this._cacheFile, JSON.stringify(cache), "utf8");
    } catch { /* best-effort */ }
  }

  private buildGraph(): void {
    const rawFiles: string[] = [];

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist" && entry.name !== ".next") {
            walk(full);
          }
        } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          rawFiles.push(full);
        }
      }
    };

    walk(this.projectRoot);

    // 1. First pass: Create nodes and extract symbols
    for (const fullPath of rawFiles) {
      const relPath = path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
      let content = "";
      try {
        content = fs.readFileSync(fullPath, "utf8");
      } catch {
        continue; // Skip file if temporarily locked by concurrent worker
      }
      const exports = extractExports(content, relPath);

      // Extract imports
      const imports: string[] = [];
      const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const resolved = resolveImportPath(match[1], fullPath, this.projectRoot);
        if (resolved && !imports.includes(resolved)) {
          imports.push(resolved);
        }
      }

      this.nodes.set(relPath, {
        filePath: relPath,
        fullPath,
        exports,
        imports,
        importedBy: []
      });

      // Index symbols
      for (const sym of exports) {
        const list = this.symbolIndex.get(sym.name) || [];
        list.push(sym);
        this.symbolIndex.set(sym.name, list);
      }
    }

    // 2. Second pass: Build reverse importedBy index
    for (const [nodePath, node] of this.nodes.entries()) {
      for (const imp of node.imports) {
        const targetNode = this.nodes.get(imp);
        if (targetNode && !targetNode.importedBy.includes(nodePath)) {
          targetNode.importedBy.push(nodePath);
        }
      }
    }
  }

  /**
   * Calculates the downstream closure in the currently indexed static import graph.
   */
  public calculateBlastRadius(targetFilePath: string): BlastRadiusReport {
    const startUs = process.hrtime.bigint();
    const normalizedTarget = targetFilePath.replace(/\\/g, "/").replace(/^\.\//, "");

    // Locate matching node (support exact or base name match)
    let matchedKey: string | null = null;
    for (const key of this.nodes.keys()) {
      if (key === normalizedTarget || key.endsWith(normalizedTarget)) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      const endUs = process.hrtime.bigint();
      return {
        targetFile: targetFilePath,
        directConsumers: [],
        transitiveConsumers: [],
        totalImpactedFiles: 0,
        impactPercentage: 0,
        riskLevel: "LOW",
        affectedLayers: [],
        predictiveTestSuites: [],
        durationUs: Number((endUs - startUs) / 1000n)
      };
    }

    const targetNode = this.nodes.get(matchedKey)!;
    const directConsumers = [...targetNode.importedBy];

    // BFS for transitive closure
    const visited = new Set<string>();
    const queue = [...directConsumers];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const node = this.nodes.get(current);
        if (node) {
          for (const upstream of node.importedBy) {
            if (!visited.has(upstream)) {
              queue.push(upstream);
            }
          }
        }
      }
    }

    const transitiveConsumers = Array.from(visited);
    const totalFiles = this.nodes.size || 1;
    const impactPercentage = Number(((transitiveConsumers.length / totalFiles) * 100).toFixed(1));

    // Determine Risk Level
    let riskLevel: RiskLevel = "LOW";
    if (impactPercentage > 40 || matchedKey.includes("core/")) riskLevel = "CRITICAL";
    else if (impactPercentage > 20) riskLevel = "HIGH";
    else if (impactPercentage > 5) riskLevel = "MEDIUM";

    // Affected Layers
    const layers = new Set<string>();
    for (const f of transitiveConsumers) {
      if (f.includes("core/")) layers.add("DOMAIN");
      else if (f.includes("mcp/") || f.includes("api/")) layers.add("INFRASTRUCTURE");
      else if (f.includes("components/") || f.includes("js/")) layers.add("PRESENTATION");
      else layers.add("SYSTEM");
    }

    // Predictive Test Selection (PTS)
    const ptsSuites = new Set<string>();
    const allImpacted = [matchedKey, ...transitiveConsumers];
    for (const imp of allImpacted) {
      for (const [prefix, suites] of Object.entries(PTS_TEST_MAP)) {
        if (imp.includes(prefix)) {
          suites.forEach((s) => ptsSuites.add(s));
        }
      }
    }

    const endUs = process.hrtime.bigint();
    const durationUs = Number((endUs - startUs) / 1000n);

    return {
      targetFile: matchedKey,
      directConsumers,
      transitiveConsumers,
      totalImpactedFiles: transitiveConsumers.length,
      impactPercentage,
      riskLevel,
      affectedLayers: Array.from(layers),
      predictiveTestSuites: Array.from(ptsSuites),
      durationUs
    };
  }

  /**
   * Identifies exported symbols with zero active consumers across the codebase.
   *
   * Uses the already-built import/export graph — O(N) over file nodes, no regex,
   * no file I/O. A module whose `importedBy` array is empty has no consumers, so
   * every symbol it exports is considered dead.
   */
  public detectDeadSymbols(): DeadCodeSymbol[] {
    const deadSymbols: DeadCodeSymbol[] = [];

    for (const node of this.nodes.values()) {
      // No other module imports this file → all its exports are unreachable.
      if (node.importedBy.length === 0 && node.exports.length > 0) {
        for (const sym of node.exports) {
          deadSymbols.push({
            name: sym.name,
            kind: sym.kind,
            filePath: sym.filePath,
            lineNumber: sym.lineNumber
          });
        }
      }
    }

    return deadSymbols;
  }

  /**
   * Generates a high-level summary of the semantic graph.
   */
  public getSummary(): SemanticGraphSummary {
    let totalExports = 0;
    let totalEdges = 0;

    for (const node of this.nodes.values()) {
      totalExports += node.exports.length;
      totalEdges += node.imports.length;
    }

    const startMs = Date.now();
    const deadSymbols = this.detectDeadSymbols();
    const durationMs = Date.now() - startMs;

    return {
      totalFiles: this.nodes.size,
      totalExports,
      totalEdges,
      deadCodeCount: deadSymbols.length,
      deadSymbols,
      durationMs
    };
  }

  /**
   * Executes Predictive Test Selection (PTS): Runs only test suites affected by target file.
   */
  public runPredictiveTests(targetFile?: string): {
    readonly executedSuites: readonly string[];
    readonly totalSuites: number;
    readonly pass: boolean;
    readonly durationMs: number;
  } {
    const startMs = Date.now();
    let suitesToRun: string[] = [];

    if (targetFile) {
      const radius = this.calculateBlastRadius(targetFile);
      suitesToRun = [...radius.predictiveTestSuites];
    } else {
      suitesToRun = ["test/eosSpotify.test.mjs", "test/eosTitans.test.mjs"];
    }

    if (suitesToRun.length === 0) {
      suitesToRun = ["test/eosCore.test.mjs"];
    }

    let allPassed = true;
    for (const suite of suitesToRun) {
      const fullPath = path.join(this.projectRoot, suite);
      if (fs.existsSync(fullPath)) {
        try {
          execFileSync(process.execPath, ["--test", fullPath], {
            cwd: this.projectRoot,
            stdio: "pipe"
          });
        } catch {
          allPassed = false;
        }
      }
    }

    return {
      executedSuites: suitesToRun,
      totalSuites: suitesToRun.length,
      pass: allPassed,
      durationMs: Date.now() - startMs
    };
  }
}
