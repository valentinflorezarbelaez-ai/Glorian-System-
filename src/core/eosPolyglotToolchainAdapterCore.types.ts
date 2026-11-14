/**
 * SPEC-235 / CHANGE-120 — Layer-0 Polyglot Toolchain Adapter Types.
 * Zero external runtime dependencies (EOS Law V).
 */

import type { JarvisValidationInput } from "./eosJarvisSdlcOrchestratorCore.types.ts";

export type PolyglotStackId = "java-maven" | "java-gradle" | "go" | "python" | "rust" | "typescript-node";

export interface DetectPolyglotStackOptions {
  readonly stackId?: PolyglotStackId;
  readonly repoPath?: string;
  readonly projectRoot?: string;
  readonly serviceName?: string;
}

export interface PolyglotCommandMatrix {
  readonly build: string;
  readonly test: string;
  readonly coverage: string;
  readonly lint: string;
  readonly typecheck: string;
  readonly securityAudit: string;
}

export interface HexagonalDirectoryMap {
  readonly domain: string;
  readonly application: string;
  readonly ports: string;
  readonly adapters: string;
  readonly tests: string;
}

export interface PolyglotToolchainProfile {
  readonly stackId: PolyglotStackId;
  readonly language: string;
  readonly buildTool: string;
  readonly detectedManifests: readonly string[];
  readonly commands: PolyglotCommandMatrix;
  readonly hexagonalDirectories: HexagonalDirectoryMap;
  readonly goldenPathTemplateId: string;
  readonly profileDigestSha256: string;
}

export interface NormalizePolyglotReportInput {
  readonly stackId: PolyglotStackId;
  readonly rawOutput?: string;
  readonly testsPassed?: number;
  readonly totalTests?: number;
  readonly coveragePercent?: number;
  readonly domainImportsInfrastructure?: boolean;
  readonly plainSecretsCount?: number;
  readonly runtimeDependenciesCount?: number;
  readonly lintErrorsCount?: number;
}

export interface NormalizedPolyglotVerification {
  readonly stackId: PolyglotStackId;
  readonly validation: JarvisValidationInput;
  readonly parsedFromRawOutput: boolean;
  readonly reportDigestSha256: string;
}
