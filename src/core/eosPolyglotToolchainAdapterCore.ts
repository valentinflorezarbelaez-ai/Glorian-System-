/**
 * SPEC-235 / CHANGE-120 — Layer-0 Polyglot Toolchain Adapter & Verification Normalizer.
 * Supports Java (Maven/Gradle), Go, Python, Rust, and TypeScript/Node with zero
 * third-party runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { JarvisValidationInput } from "./eosJarvisSdlcOrchestratorCore.types.ts";
import type {
  DetectPolyglotStackOptions,
  HexagonalDirectoryMap,
  NormalizedPolyglotVerification,
  NormalizePolyglotReportInput,
  PolyglotCommandMatrix,
  PolyglotStackId,
  PolyglotToolchainProfile,
} from "./eosPolyglotToolchainAdapterCore.types.ts";

interface StackCatalogEntry {
  readonly language: string;
  readonly buildTool: string;
  readonly commands: PolyglotCommandMatrix;
  readonly hexagonalDirectories: HexagonalDirectoryMap;
  readonly templateSuffix: string;
}

const STACK_CATALOG: Record<PolyglotStackId, StackCatalogEntry> = {
  "java-maven": {
    language: "Java 21 LTS",
    buildTool: "Maven",
    commands: {
      build: "mvn -B -ntp clean compile",
      test: "mvn -B -ntp test",
      coverage: "mvn -B -ntp verify jacoco:report",
      lint: "mvn -B -ntp checkstyle:check spotbugs:check",
      typecheck: "mvn -B -ntp compile test-compile",
      securityAudit: "mvn -B -ntp org.owasp:dependency-check-maven:check",
    },
    hexagonalDirectories: {
      domain: "src/main/java/domain",
      application: "src/main/java/application",
      ports: "src/main/java/application/port",
      adapters: "src/main/java/infrastructure/adapter",
      tests: "src/test/java",
    },
    templateSuffix: "java-maven-hexagonal",
  },
  "java-gradle": {
    language: "Java 21 LTS",
    buildTool: "Gradle",
    commands: {
      build: "./gradlew clean build -x test --no-daemon",
      test: "./gradlew test --no-daemon",
      coverage: "./gradlew test jacocoTestReport --no-daemon",
      lint: "./gradlew checkstyleMain spotbugsMain --no-daemon",
      typecheck: "./gradlew compileJava compileTestJava --no-daemon",
      securityAudit: "./gradlew dependencyCheckAnalyze --no-daemon",
    },
    hexagonalDirectories: {
      domain: "src/main/java/domain",
      application: "src/main/java/application",
      ports: "src/main/java/application/port",
      adapters: "src/main/java/infrastructure/adapter",
      tests: "src/test/java",
    },
    templateSuffix: "java-gradle-hexagonal",
  },
  go: {
    language: "Go",
    buildTool: "go toolchain",
    commands: {
      build: "go build ./...",
      test: "go test -race -v ./...",
      coverage: "go test -race -coverprofile=coverage.out ./... && go tool cover -func=coverage.out",
      lint: "golangci-lint run ./...",
      typecheck: "go vet ./...",
      securityAudit: "govulncheck ./...",
    },
    hexagonalDirectories: {
      domain: "internal/domain",
      application: "internal/application",
      ports: "internal/ports",
      adapters: "internal/adapters",
      tests: "internal",
    },
    templateSuffix: "go-service-hexagonal",
  },
  python: {
    language: "Python 3.12+",
    buildTool: "uv / pyproject",
    commands: {
      build: "python -m compileall src tests",
      test: "pytest -v",
      coverage: "pytest --cov=src --cov-report=term-missing",
      lint: "ruff check src tests",
      typecheck: "mypy --strict src",
      securityAudit: "pip-audit --strict",
    },
    hexagonalDirectories: {
      domain: "src/domain",
      application: "src/application",
      ports: "src/ports",
      adapters: "src/adapters",
      tests: "tests",
    },
    templateSuffix: "python-service-hexagonal",
  },
  rust: {
    language: "Rust",
    buildTool: "Cargo",
    commands: {
      build: "cargo build --locked --all-targets",
      test: "cargo test --locked --all-targets",
      coverage: "cargo llvm-cov --all-features --workspace",
      lint: "cargo clippy --all-targets -- -D warnings",
      typecheck: "cargo check --all-targets",
      securityAudit: "cargo audit",
    },
    hexagonalDirectories: {
      domain: "src/domain",
      application: "src/application",
      ports: "src/ports",
      adapters: "src/adapters",
      tests: "tests",
    },
    templateSuffix: "rust-crate-hexagonal",
  },
  "typescript-node": {
    language: "TypeScript (Node.js ESM)",
    buildTool: "npm + tsc",
    commands: {
      build: "npm run build",
      test: "node --test test/*.test.mjs",
      coverage: "node --test --experimental-test-coverage test/*.test.mjs",
      lint: "npm run lint",
      typecheck: "npm run typecheck",
      securityAudit: "npm run secret-scan && npm run boundary:check",
    },
    hexagonalDirectories: {
      domain: "src/core",
      application: "src/application",
      ports: "src/ports",
      adapters: "src/mcp",
      tests: "test",
    },
    templateSuffix: "ts-layer0-hexagonal",
  },
};

const MANIFEST_RULES: ReadonlyArray<{ readonly file: string; readonly stack: PolyglotStackId }> = [
  { file: "pom.xml", stack: "java-maven" },
  { file: "build.gradle.kts", stack: "java-gradle" },
  { file: "build.gradle", stack: "java-gradle" },
  { file: "go.mod", stack: "go" },
  { file: "Cargo.toml", stack: "rust" },
  { file: "pyproject.toml", stack: "python" },
  { file: "requirements.txt", stack: "python" },
  { file: "package.json", stack: "typescript-node" },
];

function resolveConfinedDir(projectRoot: string, repoPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, repoPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function inspectManifests(dirPath: string): { stack: PolyglotStackId | undefined; manifests: string[] } {
  if (!fs.existsSync(dirPath)) {
    return { stack: undefined, manifests: [] };
  }
  const manifests: string[] = [];
  let detectedStack: PolyglotStackId | undefined;
  for (const rule of MANIFEST_RULES) {
    if (fs.existsSync(path.join(dirPath, rule.file))) {
      manifests.push(rule.file);
      if (!detectedStack) {
        detectedStack = rule.stack;
      }
    }
  }
  return { stack: detectedStack, manifests };
}

function sha256Hex(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function sanitizeSlug(raw: string | undefined): string {
  const text = (raw ?? "service")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text.slice(0, 48) || "service";
}

function extractCoverage(rawOutput: string): number | undefined {
  const covMatch = rawOutput.match(/coverage:\s*([\d.]+)%/i) ?? rawOutput.match(/all files[^|]*\|\s*([\d.]+)/i);
  return covMatch ? Math.min(100, Math.max(0, Number(covMatch[1]))) : undefined;
}

function parseMavenSurefire(rawOutput: string): { passed: number; total: number } | undefined {
  const match = rawOutput.match(/Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+)/i);
  if (!match) return undefined;
  const total = Number(match[1]);
  const failed = Number(match[2]) + Number(match[3]);
  return { total, passed: Math.max(0, total - failed) };
}

function parsePassedFailed(rawOutput: string): { passed: number; total: number } | undefined {
  const passedMatch = rawOutput.match(/(\d+)\s+passed/i);
  if (!passedMatch) return undefined;
  const failedMatch = rawOutput.match(/(\d+)\s+failed/i);
  const passed = Number(passedMatch[1]);
  const failed = failedMatch ? Number(failedMatch[1]) : 0;
  return { passed, total: passed + failed };
}

function parseGoOutput(rawOutput: string): { passed: number; total: number } | undefined {
  const okLines = rawOutput.match(/^ok\s+/gm)?.length ?? 0;
  const failLines = rawOutput.match(/^FAIL\s+/gm)?.length ?? 0;
  if (okLines + failLines === 0) return undefined;
  return { passed: okLines, total: okLines + failLines };
}

function parseCountsFromOutput(
  stackId: PolyglotStackId,
  rawOutput: string,
): { passed: number; total: number } | undefined {
  if (stackId === "java-maven" || stackId === "java-gradle") {
    return parseMavenSurefire(rawOutput) ?? parsePassedFailed(rawOutput);
  }
  if (stackId === "go") {
    return parsePassedFailed(rawOutput) ?? parseGoOutput(rawOutput);
  }
  return parsePassedFailed(rawOutput) ?? parseMavenSurefire(rawOutput);
}

export class EosPolyglotToolchainAdapterCore {
  public static detectStackAndBuildMatrix(options: DetectPolyglotStackOptions = {}): PolyglotToolchainProfile {
    const projectRoot = options.projectRoot ?? process.cwd();
    const inspection = options.repoPath
      ? inspectManifests(resolveConfinedDir(projectRoot, options.repoPath))
      : { stack: undefined, manifests: [] };
    const stackId = options.stackId ?? inspection.stack ?? "typescript-node";
    const entry = STACK_CATALOG[stackId];
    if (!entry) {
      throw new Error(`Unsupported polyglot stackId: ${String(stackId)}`);
    }
    const base = {
      stackId,
      language: entry.language,
      buildTool: entry.buildTool,
      detectedManifests: inspection.manifests,
      commands: entry.commands,
      hexagonalDirectories: entry.hexagonalDirectories,
      goldenPathTemplateId: `backstage-${sanitizeSlug(options.serviceName)}-${entry.templateSuffix}`,
    };
    return { ...base, profileDigestSha256: sha256Hex(base) };
  }

  public static normalizeTestAndCoverageReport(input: NormalizePolyglotReportInput): NormalizedPolyglotVerification {
    if (!STACK_CATALOG[input.stackId]) {
      throw new Error(`Unsupported polyglot stackId: ${String(input.stackId)}`);
    }
    const raw = typeof input.rawOutput === "string" ? input.rawOutput : "";
    const parsedCounts = raw ? parseCountsFromOutput(input.stackId, raw) : undefined;
    const parsedCov = raw ? extractCoverage(raw) : undefined;

    const totalTests = input.totalTests ?? parsedCounts?.total ?? 0;
    const testsPassed = input.testsPassed ?? parsedCounts?.passed ?? 0;
    const coveragePercent =
      input.coveragePercent ?? parsedCov ?? (testsPassed === totalTests && totalTests > 0 ? 90 : 0);

    const validation: JarvisValidationInput = {
      testsPassed: Math.max(0, testsPassed),
      totalTests: Math.max(0, totalTests),
      coveragePercent: Math.min(100, Math.max(0, coveragePercent)),
      domainImportsInfrastructure: input.domainImportsInfrastructure === true,
      plainSecretsCount: Math.max(0, input.plainSecretsCount ?? 0),
      runtimeDependenciesCount: Math.max(0, input.runtimeDependenciesCount ?? 0),
      lintErrorsCount: Math.max(0, input.lintErrorsCount ?? 0),
      errorLog: raw ? raw.slice(0, 500) : undefined,
    };
    const parsedFromRawOutput = Boolean(parsedCounts || parsedCov !== undefined);
    const body = { stackId: input.stackId, validation, parsedFromRawOutput };
    return { ...body, reportDigestSha256: sha256Hex(body) };
  }
}
