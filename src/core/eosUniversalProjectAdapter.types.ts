/**
 * Extracted types and bounded path-safety helpers for EosUniversalProjectAdapter (SPEC-019 / SPEC-036).
 */

import fs from "node:fs";
import path from "node:path";

export function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function writeNewProjectFile(rootPath: string, relativePath: string, content: string): void {
  const root = fs.realpathSync(rootPath);
  const fullPath = path.resolve(root, relativePath);
  if (!isPathWithin(root, fullPath)) throw new Error("Generated file path escapes the selected project.");

  let existingAncestor = path.dirname(fullPath);
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error("Could not find a safe existing project directory.");
    existingAncestor = parent;
  }
  const realAncestor = fs.realpathSync(existingAncestor);
  if (!isPathWithin(root, realAncestor))
    throw new Error("Generated file parent resolves outside the selected project.");

  const parentPath = path.dirname(fullPath);
  fs.mkdirSync(parentPath, { recursive: true });
  const realParent = fs.realpathSync(parentPath);
  if (!isPathWithin(root, realParent)) throw new Error("Generated file parent resolves outside the selected project.");

  const descriptor = fs.openSync(fullPath, "wx");
  try {
    fs.writeFileSync(descriptor, content, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

export type PolyglotLanguage =
  | "typescript"
  | "javascript"
  | "go"
  | "rust"
  | "python"
  | "flutter_dart"
  | "java_kotlin"
  | "cpp_c"
  | "csharp"
  | "ruby"
  | "php"
  | "elixir"
  | "unknown";

export type PackageManager =
  | "npm"
  | "pnpm"
  | "yarn"
  | "bun"
  | "go_mod"
  | "cargo"
  | "pip"
  | "poetry"
  | "uv"
  | "pub"
  | "maven"
  | "gradle"
  | "cmake"
  | "nuget"
  | "bundler"
  | "composer"
  | "mix"
  | "none";

export type TestFramework =
  | "node_test"
  | "jest"
  | "vitest"
  | "mocha"
  | "go_test"
  | "cargo_test"
  | "pytest"
  | "unittest"
  | "flutter_test"
  | "junit"
  | "ctest"
  | "xunit"
  | "rspec"
  | "none";

export type ContainerPlatform = "dockerfile" | "compose" | "distroless" | "devcontainer" | "none";
export type CiCdPlatform = "github_actions" | "gitlab_ci" | "circle_ci" | "jenkins" | "bitbucket" | "none";
export type LocalSignalBand = "MANY_SIGNALS" | "SOME_SIGNALS" | "FEW_SIGNALS";

export interface PillarEvaluation {
  readonly name: string;
  readonly score: number;
  readonly maxScore: number;
  readonly signalBand: LocalSignalBand;
  readonly findings: readonly string[];
}

export function classifySignalBand(score: number, maxScore: number): LocalSignalBand {
  if (maxScore <= 0) return "FEW_SIGNALS";
  const ratio = score / maxScore;
  if (ratio >= 0.75) return "MANY_SIGNALS";
  if (ratio >= 0.5) return "SOME_SIGNALS";
  return "FEW_SIGNALS";
}

export function buildPillar(name: string, score: number, findings: readonly string[]): PillarEvaluation {
  return { name, score, maxScore: 20, signalBand: classifySignalBand(score, 20), findings };
}

export interface PolyglotFingerprint {
  readonly primaryLanguage: PolyglotLanguage;
  readonly languagesDetected: readonly PolyglotLanguage[];
  readonly packageManager: PackageManager;
  readonly testFramework: TestFramework;
  readonly containerization: ContainerPlatform;
  readonly ciCd: CiCdPlatform;
  readonly hasAgentScaffolding: boolean;
  readonly hasBackstageDescriptor: boolean;
  readonly totalSourceFiles: number;
  readonly structureArchetype: "MONOREPO" | "STANDARD_SERVICE" | "MODULAR_LIBRARY" | "EMBEDDED_MINIMAL";
}

export interface PolyglotAuditReport {
  readonly projectPath: string;
  readonly projectName: string;
  readonly fingerprint: PolyglotFingerprint;
  readonly pillars: {
    readonly layerPurity: PillarEvaluation;
    readonly testInfrastructure: PillarEvaluation;
    readonly secretSecurity: PillarEvaluation;
    readonly ciCdGateways: PillarEvaluation;
    readonly aiScaffolding: PillarEvaluation;
  };
  readonly localSignalScore: number;
  readonly localSignalBand: LocalSignalBand;
  readonly productionReadiness: "NOT_ASSESSED";
  readonly scoreScope: "LOCAL_FILE_AND_PATTERN_HEURISTICS";
  readonly assessmentLimitations: readonly string[];
  readonly recommendations: readonly string[];
  readonly sha256ReportDigest: string;
  readonly timestamp: string;
}

export interface ElevateOptions {
  readonly dryRun?: boolean;
  readonly ownerSquad?: string;
  readonly systemName?: string;
}

export interface ScaffoldedFile {
  readonly path: string;
  readonly description: string;
  readonly content: string;
}

export interface ElevateResult {
  readonly dryRun: boolean;
  readonly writeApplied: boolean;
  readonly filesScaffolded: readonly ScaffoldedFile[];
  readonly plannedPaths: readonly string[];
  readonly writtenPaths: readonly string[];
  readonly appliedActions: readonly string[];
  readonly message: string;
  readonly sha256Proof: string;
}
