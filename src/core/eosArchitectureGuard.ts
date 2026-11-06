/**
 * EOS SYSTEM — CLEAN/HEXAGONAL ARCHITECTURE & CIRCULAR INVARIANT GUARD (Layer 0)
 * Governed by ADR-019, FR-025 & BDD-020
 *
 * Statically analyzes project source files to enforce Clean/Hexagonal boundaries:
 * 1. Domain Purity: Layer-0 core modules must never import UI, frameworks, or external infrastructure.
 * 2. Unidirectional Flow: Dependencies must point inward (UI -> Infra/App -> Domain).
 * 3. Directed Graph Circular Dependency Detection: DFS cycle detection across the module graph.
 * 4. Purity Score: Quantitative rating (0-100%) of architectural compliance.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";

export type ArchitecturalLayer = "DOMAIN" | "APPLICATION" | "INFRASTRUCTURE" | "PRESENTATION" | "UNKNOWN";

export interface FileImport {
  rawSpecifier: string;
  resolvedPath: string | null;
  isExternal: boolean;
  lineNumber: number;
  isDynamicUnresolvable?: boolean;
}

export interface FileAnalysis {
  filePath: string;
  relativeFilePath: string;
  layer: ArchitecturalLayer;
  imports: FileImport[];
  violations: string[];
}

export interface ArchitectureReport {
  scannedFilesCount: number;
  layersDistribution: Record<ArchitecturalLayer, number>;
  totalViolations: number;
  violations: Array<{ file: string; rule: string; details: string }>;
  circularDependencies: string[][];
  architecturePurityScore: number;
  isClean: boolean;
}

/**
 * Classifies a file path into an Architectural Layer.
 */
export function classifyLayer(relativePath: string): ArchitecturalLayer {
  const norm = relativePath.replace(/\\/g, "/").toLowerCase();

  if (norm.includes("src/core/") || norm.includes("domain/") || norm.includes("entities/")) {
    return "DOMAIN";
  }
  if (norm.includes("src/usecases/") || norm.includes("src/services/") || norm.includes("application/")) {
    return "APPLICATION";
  }
  if (norm.includes("src/mcp/") || norm.includes("api/") || norm.includes("infra/") || norm.includes("adapters/")) {
    return "INFRASTRUCTURE";
  }
  if (norm.includes("src/components/") || norm.includes("src/ui/") || norm.includes("js/") || norm.includes("css/") || norm.includes("pages/")) {
    return "PRESENTATION";
  }
  return "UNKNOWN";
}

/**
 * Reads tsconfig.json from projectRoot and extracts path alias → real directory mappings.
 * e.g. { "@core/*": ["src/core/*"] } → { "@core/": "src/core/" }
 */
export function resolveTsconfigPaths(projectRoot: string): Record<string, string> {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return {};

  let raw: string;
  try {
    raw = fs.readFileSync(tsconfigPath, "utf8");
  } catch {
    return {};
  }

  let tsconfig: Record<string, unknown>;
  try {
    // Strip single-line comments and trailing commas for lenient JSON parsing
    const stripped = raw
      .replace(/\/\/[^\n]*/g, "")
      .replace(/,(\s*[}\]])/g, "$1");
    tsconfig = JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    return {};
  }

  const compilerOptions = tsconfig["compilerOptions"] as Record<string, unknown> | undefined;
  if (!compilerOptions) return {};

  const paths = compilerOptions["paths"] as Record<string, string[]> | undefined;
  if (!paths || typeof paths !== "object") return {};

  const baseUrl = typeof compilerOptions["baseUrl"] === "string"
    ? compilerOptions["baseUrl"]
    : ".";

  const aliasMap: Record<string, string> = {};
  for (const [aliasPattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    // Convert glob patterns: "@core/*" → "@core/"  and  "src/core/*" → "src/core/"
    const aliasPrefix = aliasPattern.endsWith("/*")
      ? aliasPattern.slice(0, -1)   // "@core/*" → "@core/"
      : aliasPattern + "/";

    const targetPattern = targets[0];
    const realPrefix = targetPattern.endsWith("/*")
      ? path.join(projectRoot, baseUrl, targetPattern.slice(0, -1))
      : path.join(projectRoot, baseUrl, targetPattern);

    aliasMap[aliasPrefix] = realPrefix.replace(/\\/g, "/");
  }

  return aliasMap;
}

/**
 * Extracts import/require statements from source code text.
 */
export function extractImports(
  sourceCode: string,
  sourceFilePath: string,
  projectRoot: string,
  aliasMap: Record<string, string> = {}
): FileImport[] {
  const imports: FileImport[] = [];
  const lines = sourceCode.split(/\r?\n/);

  // Regex patterns for static imports and dynamic imports/requires
  const staticImportRegex = /import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Matches only string-literal dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Matches non-literal dynamic imports (template literals, variables, concatenation)
  const dynamicImportUnresolvableRegex = /import\s*\(\s*(?!['"])([^)]+)\)/g;

  const resolveSpecifier = (specifier: string): string | null => {
    const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".jsx", "/index.ts", "/index.js"];

    if (specifier.startsWith(".")) {
      const sourceDir = path.dirname(sourceFilePath);
      const candidate = path.resolve(sourceDir, specifier);
      for (const ext of extensions) {
        const testPath = candidate + ext;
        if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
          return path.resolve(testPath);
        }
      }
      return null;
    }

    // Alias resolution
    for (const [aliasPrefix, realPrefix] of Object.entries(aliasMap)) {
      if (specifier.startsWith(aliasPrefix)) {
        const remainder = specifier.slice(aliasPrefix.length);
        const candidate = path.join(realPrefix, remainder);
        for (const ext of extensions) {
          const testPath = candidate + ext;
          if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            return path.resolve(testPath);
          }
        }
        return null;
      }
    }

    return null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      return; // Skip comments
    }

    const checkMatch = (regex: RegExp, isDynamic = false) => {
      let match: RegExpExecArray | null;
      // Reset lastIndex to avoid cross-line state issues
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        const specifier = match[1];
        const isExternal = !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:");
        const resolved = resolveSpecifier(specifier);

        imports.push({
          rawSpecifier: specifier,
          resolvedPath: resolved,
          isExternal,
          lineNumber: idx + 1
        });
      }
    };

    // Handle non-literal dynamic imports — warn and flag as unresolvable
    const checkDynamicUnresolvable = (regex: RegExp) => {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const rawExpr = match[1].trim();
        imports.push({
          rawSpecifier: rawExpr,
          resolvedPath: null,
          isExternal: false,
          lineNumber: idx + 1,
          isDynamicUnresolvable: true
        });
      }
    };

    checkMatch(staticImportRegex);
    checkMatch(requireRegex);
    checkMatch(dynamicImportRegex, true);
    checkDynamicUnresolvable(dynamicImportUnresolvableRegex);
  });

  return imports;
}

/**
 * Disallowed imports for Domain Layer (Layer 0 Core).
 */
const FORBIDDEN_DOMAIN_PATTERNS = [
  "react",
  "vue",
  "angular",
  "express",
  "next",
  "koa",
  "fastify",
  "components",
  "window",
  "document"
];

/**
 * Inspects imports of a file against Hexagonal Layer invariants.
 */
export function validateLayerInvariants(analysis: FileAnalysis): string[] {
  const violations: string[] = [];

  if (analysis.layer === "DOMAIN") {
    for (const imp of analysis.imports) {
      // 1. Domain must not import UI / framework libraries
      const lowerSpec = imp.rawSpecifier.toLowerCase();
      for (const forbidden of FORBIDDEN_DOMAIN_PATTERNS) {
        if (lowerSpec.includes(forbidden)) {
          violations.push(
            `Domain Purity Violation at line ${imp.lineNumber}: Domain module cannot import '${imp.rawSpecifier}' (Law V).`
          );
        }
      }

      // 2. Domain must not import Presentation components
      if (imp.resolvedPath) {
        const rel = imp.resolvedPath.replace(/\\/g, "/").toLowerCase();
        if (rel.includes("src/components") || rel.includes("src/ui") || rel.includes("/js/")) {
          violations.push(
            `Inward Dependency Violation at line ${imp.lineNumber}: Domain module cannot import Presentation module '${imp.rawSpecifier}'.`
          );
        }
      }
    }
  }

  if (analysis.layer === "APPLICATION") {
    for (const imp of analysis.imports) {
      if (imp.resolvedPath) {
        const rel = imp.resolvedPath.replace(/\\/g, "/").toLowerCase();
        if (rel.includes("src/components") || rel.includes("src/ui")) {
          violations.push(
            `Inward Dependency Violation at line ${imp.lineNumber}: Application module cannot import Presentation module '${imp.rawSpecifier}'.`
          );
        }
      }
    }
  }

  return violations;
}

/**
 * Detects circular dependencies in the module import graph using an iterative DFS.
 * Uses an explicit worklist to avoid call-stack overflow on large graphs.
 */
export function detectCircularDependencies(analyses: Map<string, FileAnalysis>): string[][] {
  const adj = new Map<string, string[]>();

  for (const [filePath, analysis] of analyses.entries()) {
    const neighbors: string[] = [];
    for (const imp of analysis.imports) {
      if (imp.resolvedPath && analyses.has(imp.resolvedPath)) {
        neighbors.push(imp.resolvedPath);
      }
    }
    adj.set(filePath, neighbors);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const startNode of adj.keys()) {
    if (visited.has(startNode)) continue;

    // Each worklist entry records the node and which neighbor index to explore next.
    // The `path` array mirrors the DFS call stack (nodes currently being explored).
    const worklist: Array<{ node: string; neighborIndex: number }> = [];
    const currentPath: string[] = [];

    // Push the start node
    worklist.push({ node: startNode, neighborIndex: 0 });
    visited.add(startNode);
    inStack.add(startNode);
    currentPath.push(startNode);

    while (worklist.length > 0) {
      const frame = worklist[worklist.length - 1];
      const neighbors = adj.get(frame.node) ?? [];

      if (frame.neighborIndex < neighbors.length) {
        const neighbor = neighbors[frame.neighborIndex];
        frame.neighborIndex++;

        if (inStack.has(neighbor)) {
          // Back-edge → cycle detected
          const cycleStartIndex = currentPath.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            const cyclePath = currentPath.slice(cycleStartIndex);
            cyclePath.push(neighbor); // close the loop
            cycles.push(cyclePath);
          }
        } else if (!visited.has(neighbor)) {
          visited.add(neighbor);
          inStack.add(neighbor);
          currentPath.push(neighbor);
          worklist.push({ node: neighbor, neighborIndex: 0 });
        }
        // Already visited but not in stack → cross/forward edge, skip
      } else {
        // All neighbors exhausted — pop this frame
        worklist.pop();
        inStack.delete(frame.node);
        currentPath.pop();
      }
    }
  }

  return cycles;
}

/**
 * Recursively scans a target directory and validates architectural invariants.
 */
export function scanArchitecture(targetDir: string, projectRoot: string = process.cwd()): ArchitectureReport {
  const analyses = new Map<string, FileAnalysis>();
  const layerCounts: Record<ArchitecturalLayer, number> = {
    DOMAIN: 0,
    APPLICATION: 0,
    INFRASTRUCTURE: 0,
    PRESENTATION: 0,
    UNKNOWN: 0
  };

  // Resolve tsconfig path aliases once for the whole scan
  const aliasMap = resolveTsconfigPaths(projectRoot);

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist" && entry.name !== ".next") {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const relPath = path.relative(projectRoot, fullPath);
        const layer = classifyLayer(relPath);
        layerCounts[layer] = (layerCounts[layer] || 0) + 1;

        const content = fs.readFileSync(fullPath, "utf8");
        const imports = extractImports(content, fullPath, projectRoot, aliasMap);

        const analysis: FileAnalysis = {
          filePath: fullPath,
          relativeFilePath: relPath,
          layer,
          imports,
          violations: []
        };

        analysis.violations = validateLayerInvariants(analysis);
        analyses.set(fullPath, analysis);
      }
    }
  }

  walk(targetDir);

  const cycles = detectCircularDependencies(analyses);

  const flatViolations: Array<{ file: string; rule: string; details: string }> = [];
  for (const analysis of analyses.values()) {
    for (const v of analysis.violations) {
      flatViolations.push({
        file: analysis.relativeFilePath,
        rule: "Hexagonal Layer Invariant",
        details: v
      });
    }
  }

  for (const cycle of cycles) {
    const readable = cycle.map((p) => path.relative(projectRoot, p)).join(" -> ");
    flatViolations.push({
      file: path.relative(projectRoot, cycle[0]),
      rule: "Circular Dependency Detected",
      details: `Circular import cycle: ${readable}`
    });
  }

  // Calculate score (100 base, deduction of 15 per violation, 25 per cycle)
  const deductions = flatViolations.length * 15 + cycles.length * 25;
  const purityScore = Math.max(0, 100 - deductions);

  return {
    scannedFilesCount: analyses.size,
    layersDistribution: layerCounts,
    totalViolations: flatViolations.length,
    violations: flatViolations,
    circularDependencies: cycles.map((c) => c.map((p) => path.relative(projectRoot, p))),
    architecturePurityScore: purityScore,
    isClean: flatViolations.length === 0
  };
}
