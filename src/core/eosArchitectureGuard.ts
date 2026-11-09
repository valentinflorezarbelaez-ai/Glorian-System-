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
  if (
    norm.includes("src/components/") ||
    norm.includes("src/ui/") ||
    norm.includes("js/") ||
    norm.includes("css/") ||
    norm.includes("pages/")
  ) {
    return "PRESENTATION";
  }
  return "UNKNOWN";
}

/**
 * Extracts import/require statements from source code text.
 */
export function extractImports(sourceCode: string, sourceFilePath: string, projectRoot: string): FileImport[] {
  const imports: FileImport[] = [];
  const lines = sourceCode.split(/\r?\n/);

  // Regex patterns for static imports and dynamic imports/requires
  const staticImportRegex = /import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      return; // Skip comments
    }

    const checkMatch = (regex: RegExp) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const specifier = match[1];
        const isExternal = !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:");
        let resolved: string | null = null;

        if (specifier.startsWith(".")) {
          // Resolve relative path
          const sourceDir = path.dirname(sourceFilePath);
          const candidate = path.resolve(sourceDir, specifier);

          const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".jsx", "/index.ts", "/index.js"];
          for (const ext of extensions) {
            const testPath = candidate + ext;
            if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
              resolved = path.resolve(testPath);
              break;
            }
          }
        }

        imports.push({
          rawSpecifier: specifier,
          resolvedPath: resolved,
          isExternal,
          lineNumber: idx + 1,
        });
      }
    };

    checkMatch(staticImportRegex);
    checkMatch(requireRegex);
    checkMatch(dynamicImportRegex);
  });

  return imports;
}

/**
 * Disallowed external frameworks and browser globals for Domain Layer (Layer 0 Core).
 * Globals MUST be exact-specifier matches only — never substring `.includes("window")`,
 * which false-positives on `./eosContextWindowManager.ts` / `./eosMultiWindowSloGovernor.ts`.
 */
const FORBIDDEN_DOMAIN_FRAMEWORKS = ["react", "vue", "angular", "express", "next", "koa", "fastify"];

const FORBIDDEN_DOMAIN_GLOBALS = ["window", "document"] as const;

/**
 * Exact bare-global match for Domain purity (Law V).
 * Rejects substring traps such as `eosContextWindowManager` containing `window`.
 */
export function isForbiddenDomainGlobalSpecifier(rawSpecifier: string): boolean {
  const lowerSpec = String(rawSpecifier || "")
    .trim()
    .toLowerCase();
  return (FORBIDDEN_DOMAIN_GLOBALS as readonly string[]).includes(lowerSpec);
}

/**
 * Inspects imports of a file against Hexagonal Layer invariants.
 */
export function validateLayerInvariants(analysis: FileAnalysis): string[] {
  const violations: string[] = [];

  if (analysis.layer === "DOMAIN") {
    for (const imp of analysis.imports) {
      // 1. Domain must not import UI / framework libraries or browser globals
      const lowerSpec = imp.rawSpecifier.toLowerCase();
      const isForbiddenFramework = FORBIDDEN_DOMAIN_FRAMEWORKS.some(
        (f) => lowerSpec === f || lowerSpec.startsWith(`${f}/`) || lowerSpec.startsWith(`@${f}/`),
      );
      const isForbiddenGlobal = isForbiddenDomainGlobalSpecifier(imp.rawSpecifier);
      const isForbiddenInternal =
        !imp.isExternal &&
        (lowerSpec.includes("/components/") ||
          lowerSpec.includes("\\components\\") ||
          lowerSpec.startsWith("components/"));

      if (isForbiddenFramework || isForbiddenGlobal || isForbiddenInternal) {
        violations.push(
          `Domain Purity Violation at line ${imp.lineNumber}: Domain module cannot import '${imp.rawSpecifier}' (Law V).`,
        );
      }

      // 2. Domain must not import Presentation components
      if (imp.resolvedPath) {
        const rel = imp.resolvedPath.replace(/\\/g, "/").toLowerCase();
        if (rel.includes("src/components") || rel.includes("src/ui") || rel.includes("/js/")) {
          violations.push(
            `Inward Dependency Violation at line ${imp.lineNumber}: Domain module cannot import Presentation module '${imp.rawSpecifier}'.`,
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
            `Inward Dependency Violation at line ${imp.lineNumber}: Application module cannot import Presentation module '${imp.rawSpecifier}'.`,
          );
        }
      }
    }
  }

  return violations;
}

/**
 * Detects circular dependencies in the module import graph using Depth-First Search (DFS).
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
  const stack: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Cycle detected
        const cycleStartIndex = stack.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cyclePath = stack.slice(cycleStartIndex);
          cyclePath.push(neighbor); // Close loop
          cycles.push(cyclePath);
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
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
    UNKNOWN: 0,
  };

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
        const imports = extractImports(content, fullPath, projectRoot);

        const analysis: FileAnalysis = {
          filePath: fullPath,
          relativeFilePath: relPath,
          layer,
          imports,
          violations: [],
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
        details: v,
      });
    }
  }

  for (const cycle of cycles) {
    const readable = cycle.map((p) => path.relative(projectRoot, p)).join(" -> ");
    flatViolations.push({
      file: path.relative(projectRoot, cycle[0]),
      rule: "Circular Dependency Detected",
      details: `Circular import cycle: ${readable}`,
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
    isClean: flatViolations.length === 0,
  };
}
