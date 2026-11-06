/**
 * EOS SYSTEM — ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR & POLYGLOT TOPOLOGY ENGINE (Layer 0)
 * Governed by SPEC-046, CHANGE-039, ADR-052 (v52.0.0)
 *
 * Pure Layer-0 orchestration engine enabling EOS to inspect, onboard, resolve,
 * and verify Tier-0 enterprise polyglot repositories (monorepos, microservices,
 * frontend/mobile clients, cloud-native systems) while strictly enforcing:
 * - Law IV External Write Barrier (zero writes inside external projects on onboard/audit;
 *   6-precondition + LEVEL_2/LEVEL_3 check required before any write-gated access).
 * - Law V Layer-0 Purity (0 external runtime npm dependencies; Node 24 strip-only TS).
 * - Law VI Symlink, Traversal, and Plaintext-Secret Immunity.
 * - Law III Tamper-Evident Cryptographic Receipts in EosDurableSqliteLedger.
 */

import fs from "node:fs";
import path from "node:path";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";
import { EosAntigravityDirector } from "./eosAntigravityDirector.ts";

export type WorkspaceOrchestrator =
  | "turborepo"
  | "nx"
  | "pnpm_workspaces"
  | "npm_workspaces"
  | "cargo_workspace"
  | "go_workspace"
  | "python_uv_poetry"
  | "bazel"
  | "gradle_multi"
  | "melos_flutter"
  | "single_package";

export type EnterpriseLanguage =
  | "typescript"
  | "javascript"
  | "go"
  | "rust"
  | "python"
  | "flutter_dart"
  | "java_kotlin"
  | "cpp_c"
  | "csharp"
  | "sql"
  | "tla_plus";

export type WorkspaceArchitecturalRole =
  | "CONTROL_PLANE_OR_CORE"
  | "BACKEND_OR_SERVICE"
  | "FRONTEND_OR_CLIENT"
  | "SHARED_LIBRARY"
  | "INFRASTRUCTURE_OR_TOOLING";

export type ContractStandard =
  | "openapi"
  | "protobuf"
  | "graphql"
  | "asyncapi"
  | "json_schema"
  | "prisma"
  | "sql_migration"
  | "tla_plus";

export type WorkspaceAccessMode = "READ_ONLY" | "WRITE_GATED";

export interface WorkspaceMember {
  readonly name: string;
  readonly relativeDir: string;
  readonly manifestPath: string;
  readonly language: EnterpriseLanguage;
  readonly architecturalRole: WorkspaceArchitecturalRole;
}

export interface ContractArtifact {
  readonly standard: ContractStandard;
  readonly relativePath: string;
  readonly byteSize: number;
  readonly validSyntax: boolean;
  readonly detail: string;
}

export interface SecretFinding {
  readonly patternName: string;
  readonly relativePath: string;
}

export interface SupplyChainPosture {
  readonly lockfiles: readonly string[];
  readonly hasDeterministicLockfile: boolean;
  readonly containerManifests: readonly string[];
  readonly iacManifests: readonly string[];
  readonly ciWorkflows: readonly string[];
  readonly secretHygieneClean: boolean;
  readonly secretFindings: readonly SecretFinding[];
}

export interface EnterpriseVerificationCommand {
  readonly id: string;
  readonly stack: string;
  readonly command: string;
  readonly rationale: string;
}

export interface EnterpriseWorkspaceTopology {
  readonly workspaceName: string;
  readonly workspaceRoot: string;
  readonly archetype: "POLYGLOT_MONOREPO" | "SINGLE_LANGUAGE_MONOREPO" | "ENTERPRISE_SERVICE" | "MINIMAL_REPOSITORY";
  readonly orchestrators: readonly WorkspaceOrchestrator[];
  readonly languages: readonly EnterpriseLanguage[];
  readonly members: readonly WorkspaceMember[];
  readonly contracts: readonly ContractArtifact[];
  readonly supplyChain: SupplyChainPosture;
  readonly recommendedVerificationCommands: readonly EnterpriseVerificationCommand[];
  readonly scannedFileCount: number;
  readonly skippedSymlinkCount: number;
  readonly enterpriseReadinessSignalsScore: number;
  readonly scoreDisclaimer: string;
  readonly sha256TopologyReceipt: string;
  readonly timestamp: string;
}

export interface InspectWorkspaceOptions {
  readonly maxDepth?: number;
  readonly maxFiles?: number;
}

export interface RegisteredFleetWorkspace {
  readonly id: string;
  readonly name: string;
  readonly localPathEnv?: string;
  readonly localPath?: string;
  readonly resolvedLocalPath: string | null;
  readonly pathExistsOnDisk: boolean;
  readonly remoteUrl: string;
  readonly productionUrl?: string;
  readonly type: string;
  readonly status: string;
  readonly intake: string;
  readonly specification: string;
  readonly audit: string;
  readonly ownerApproval?: string;
  readonly authorization: string;
  readonly writeAuthorizedUnderLawIV: boolean;
  readonly missingLawIVPreconditions: readonly string[];
}

export interface OnboardWorkspaceInput {
  readonly targetPath: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly localPathEnv?: string;
  readonly remoteUrl?: string;
  readonly productionUrl?: string;
  readonly projectType?: string;
  readonly controlPlaneRoot?: string;
  readonly dryRun?: boolean;
  readonly ledgerDbPath?: string;
}

export interface OnboardGeneratedArtifact {
  readonly relativeControlPlanePath: string;
  readonly byteLength: number;
  readonly sha256Digest: string;
}

export interface OnboardWorkspaceResult {
  readonly projectId: string;
  readonly projectName: string;
  readonly externalTargetPath: string;
  readonly controlPlaneRoot: string;
  readonly dryRun: boolean;
  readonly initialAuthorization: "LEVEL_1_READ_ONLY_AUDIT";
  readonly externalBytesWritten: 0;
  readonly topology: EnterpriseWorkspaceTopology;
  readonly generatedArtifacts: readonly OnboardGeneratedArtifact[];
  readonly registryUpdated: boolean;
  readonly ledgerEntryId: string | null;
  readonly sha256OnboardReceipt: string;
}

export interface AuthorizedWorkspaceResolution {
  readonly projectId: string;
  readonly accessMode: WorkspaceAccessMode;
  readonly workspaceRoot: string;
  readonly resolvedTargetPath: string;
  readonly authorizationLevel: string;
  readonly writeBarrierStatus: "AUTHORIZED" | "READ_ONLY_CONFINED";
}

export interface StructuralGateResult {
  readonly gateId: string;
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface EnterpriseWorkspaceVerificationReport {
  readonly workspaceName: string;
  readonly workspaceRoot: string;
  readonly epistemicState: "VERIFIED" | "FINDINGS_IDENTIFIED";
  readonly overallPassed: boolean;
  readonly gates: readonly StructuralGateResult[];
  readonly recommendedCommands: readonly EnterpriseVerificationCommand[];
  readonly ledgerEntryId: string | null;
  readonly sha256VerificationReceipt: string;
  readonly timestamp: string;
}

const IGNORED_SCAN_DIRS: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  ".eos",
  ".vercel",
  ".turbo",
  ".nx",
  "coverage",
  "_sandbox"
]);

const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".sqlite",
  ".sqlite-wal",
  ".sqlite-shm",
  ".db",
  ".lockb"
]);

const CREDENTIAL_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: "Live Stripe/OpenAI Key", regex: new RegExp("sk-" + "live-[0-9a-zA-Z]{16,}") },
  { name: "GitHub Personal Access Token", regex: new RegExp("ghp_" + "[0-9a-zA-Z]{24,}") },
  { name: "AWS Access Key ID", regex: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Google API Key", regex: new RegExp("AIza" + "[0-9A-Za-z\\-_]{35}") },
  { name: "PEM Private Key Block", regex: new RegExp("-----BEGIN " + "(RSA |EC |OPENSSH )?PRIVATE KEY-----") }
];

const DETERMINISTIC_LOCKFILE_NAMES: ReadonlySet<string> = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
  "uv.lock",
  "poetry.lock",
  "pubspec.lock",
  "gradle.lockfile",
  "Pipfile.lock"
]);

function toPosixRelative(rootDir: string, targetPath: string): string {
  const rel = path.relative(rootDir, targetPath).replace(/\\/g, "/");
  return rel === "" ? "." : rel;
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function sanitizeProjectId(rawId: string): string {
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  assertPrecondition(
    normalized.length >= 2 && normalized.length <= 64,
    "projectId must contain 2..64 alphanumeric/hyphen characters"
  );
  return normalized;
}

function defaultEnvVarForProject(projectId: string): string {
  const upper = projectId.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  return `EOS_FLEET_${upper}_PATH`;
}

function safeReadUtf8(filePath: string, maxBytes: number = 256 * 1024): string | null {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
      return null;
    }
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

interface ScannedWorkspaceFiles {
  readonly files: readonly string[];
  readonly skippedSymlinkCount: number;
}

function scanWorkspaceTree(
  rootDir: string,
  maxDepth: number,
  maxFiles: number
): ScannedWorkspaceFiles {
  const collected: string[] = [];
  let skippedSymlinkCount = 0;

  const visit = (currentDir: string, depth: number): void => {
    if (depth > maxDepth || collected.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (collected.length >= maxFiles) break;
      if (IGNORED_SCAN_DIRS.has(entry.name) || entry.name.startsWith(".worktree")) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        skippedSymlinkCount += 1;
        continue;
      }
      if (stat.isDirectory()) {
        visit(fullPath, depth + 1);
      } else if (stat.isFile()) {
        collected.push(fullPath);
      }
    }
  };

  visit(rootDir, 0);
  return { files: collected, skippedSymlinkCount };
}

function inferArchitecturalRole(
  relativeDir: string,
  language: EnterpriseLanguage,
  manifestContent: string
): WorkspaceArchitecturalRole {
  const lowerDir = relativeDir.toLowerCase();
  const lowerContent = manifestContent.toLowerCase();

  if (
    /(?:^|\/)(?:core|domain|kernel)(?:\/|$)/.test(lowerDir) ||
    lowerContent.includes("control-plane") ||
    lowerContent.includes("eos-system")
  ) {
    return "CONTROL_PLANE_OR_CORE";
  }
  if (
    /(?:^|\/)(?:infra|terraform|deploy|k8s|helm|scripts|tools)(?:\/|$)/.test(lowerDir)
  ) {
    return "INFRASTRUCTURE_OR_TOOLING";
  }
  if (
    language === "flutter_dart" ||
    /(?:^|\/)(?:web|frontend|client|ui|mobile|app-web|dashboard)(?:\/|$)/.test(lowerDir) ||
    /"(?:next|react|vue|svelte|astro|nuxt)"/.test(lowerContent)
  ) {
    return "FRONTEND_OR_CLIENT";
  }
  if (
    /(?:^|\/)(?:packages|libs|shared|common|sdk)(?:\/|$)/.test(lowerDir)
  ) {
    return "SHARED_LIBRARY";
  }
  return "BACKEND_OR_SERVICE";
}

export class EosEnterpriseWorkspaceGovernor {
  /**
   * Performs a bounded, symlink-safe deep polyglot architectural, contract,
   * and supply-chain topology inspection of any target workspace directory.
   */
  public static inspectWorkspace(
    targetPath: string,
    options?: InspectWorkspaceOptions
  ): EnterpriseWorkspaceTopology {
    assertPrecondition(
      typeof targetPath === "string" && targetPath.trim().length > 0,
      "targetPath must be a non-empty string"
    );

    const candidateRoot = path.resolve(targetPath.trim());
    assertPrecondition(fs.existsSync(candidateRoot), `Workspace path does not exist: ${candidateRoot}`);
    const rootLstat = fs.lstatSync(candidateRoot);
    assertPrecondition(!rootLstat.isSymbolicLink(), "Symbolic-link workspace roots are rejected");
    assertPrecondition(rootLstat.isDirectory(), `Workspace path is not a directory: ${candidateRoot}`);

    const realRoot = fs.realpathSync(candidateRoot);
    const maxDepth = Math.min(Math.max(options?.maxDepth ?? 6, 1), 8);
    const maxFiles = Math.min(Math.max(options?.maxFiles ?? 4000, 50), 10000);

    const { files, skippedSymlinkCount } = scanWorkspaceTree(realRoot, maxDepth, maxFiles);
    const relSet = new Set<string>(files.map((f) => toPosixRelative(realRoot, f)));

    // 1. Detect workspace orchestrators
    const orchestrators: WorkspaceOrchestrator[] = [];
    if (relSet.has("turbo.json")) orchestrators.push("turborepo");
    if (relSet.has("nx.json")) orchestrators.push("nx");
    if (relSet.has("pnpm-workspace.yaml")) orchestrators.push("pnpm_workspaces");

    const rootPkgText = safeReadUtf8(path.join(realRoot, "package.json"));
    if (rootPkgText) {
      try {
        const parsed = JSON.parse(rootPkgText);
        if (parsed && parsed.workspaces) {
          orchestrators.push("npm_workspaces");
        }
      } catch {
        // Invalid JSON will be surfaced by contract/structural verification.
      }
    }

    const rootCargoText = safeReadUtf8(path.join(realRoot, "Cargo.toml"));
    if (rootCargoText && /\[workspace\]/.test(rootCargoText)) {
      orchestrators.push("cargo_workspace");
    }
    if (relSet.has("go.work")) {
      orchestrators.push("go_workspace");
    }
    const rootPyproject = safeReadUtf8(path.join(realRoot, "pyproject.toml"));
    if (rootPyproject && /\[(?:tool\.uv|tool\.poetry|project)\]/.test(rootPyproject)) {
      orchestrators.push("python_uv_poetry");
    }
    if (relSet.has("MODULE.bazel") || relSet.has("WORKSPACE") || relSet.has("WORKSPACE.bazel")) {
      orchestrators.push("bazel");
    }
    if (relSet.has("settings.gradle") || relSet.has("settings.gradle.kts")) {
      orchestrators.push("gradle_multi");
    }
    if (relSet.has("melos.yaml")) {
      orchestrators.push("melos_flutter");
    }
    if (orchestrators.length === 0) {
      orchestrators.push("single_package");
    }

    // 2. Detect languages, workspace members, contracts, supply chain, and secrets
    const languageSet = new Set<EnterpriseLanguage>();
    const members: WorkspaceMember[] = [];
    const contracts: ContractArtifact[] = [];
    const lockfiles: string[] = [];
    const containerManifests: string[] = [];
    const iacManifests: string[] = [];
    const ciWorkflows: string[] = [];
    const secretFindings: SecretFinding[] = [];
    let hasExternalPackageDependencies = false;

    for (const fullFile of files) {
      const relPath = toPosixRelative(realRoot, fullFile);
      const baseName = path.basename(fullFile);
      const lowerBase = baseName.toLowerCase();
      const ext = path.extname(fullFile).toLowerCase();
      const relDir = path.posix.dirname(relPath);

      // Language signals from source extensions
      if (ext === ".ts" || ext === ".tsx") languageSet.add("typescript");
      else if (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".jsx") languageSet.add("javascript");
      else if (ext === ".go") languageSet.add("go");
      else if (ext === ".rs") languageSet.add("rust");
      else if (ext === ".py") languageSet.add("python");
      else if (ext === ".dart") languageSet.add("flutter_dart");
      else if (ext === ".java" || ext === ".kt") languageSet.add("java_kotlin");
      else if (ext === ".c" || ext === ".cc" || ext === ".cpp" || ext === ".h" || ext === ".hpp") languageSet.add("cpp_c");
      else if (ext === ".cs") languageSet.add("csharp");
      else if (ext === ".sql") languageSet.add("sql");
      else if (ext === ".tla") languageSet.add("tla_plus");

      // Deterministic lockfiles
      if (DETERMINISTIC_LOCKFILE_NAMES.has(baseName)) {
        lockfiles.push(relPath);
      }

      // Containerization & IaC & CI/CD
      if (
        lowerBase === "dockerfile" ||
        lowerBase.startsWith("dockerfile.") ||
        lowerBase === "containerfile" ||
        /^docker-compose.*\.(?:yml|yaml)$/.test(lowerBase)
      ) {
        containerManifests.push(relPath);
      }
      if (
        ext === ".tf" ||
        lowerBase === "chart.yaml" ||
        lowerBase === "vercel.json" ||
        lowerBase === "fly.toml" ||
        lowerBase === "railway.json" ||
        /(?:^|\/)(?:k8s|kubernetes|helm)\/.*\.(?:yml|yaml)$/.test(relPath.toLowerCase())
      ) {
        iacManifests.push(relPath);
      }
      if (
        /^\.github\/workflows\/.*\.(?:yml|yaml)$/.test(relPath) ||
        lowerBase === ".gitlab-ci.yml" ||
        relPath === ".circleci/config.yml" ||
        lowerBase === "jenkinsfile" ||
        lowerBase === "azure-pipelines.yml"
      ) {
        ciWorkflows.push(relPath);
      }

      // Workspace member manifests
      if (baseName === "package.json") {
        const text = safeReadUtf8(fullFile) || "";
        let pkgName = relDir === "." ? path.basename(realRoot) : relDir;
        let hasTs = relSet.has(relDir === "." ? "tsconfig.json" : `${relDir}/tsconfig.json`);
        try {
          const pkg = JSON.parse(text);
          if (typeof pkg.name === "string" && pkg.name.trim().length > 0) {
            pkgName = pkg.name.trim();
          }
          if (
            (pkg.devDependencies && pkg.devDependencies.typescript) ||
            (pkg.dependencies && pkg.dependencies.typescript)
          ) {
            hasTs = true;
          }
          const depCount =
            Object.keys(pkg.dependencies || {}).length +
            Object.keys(pkg.devDependencies || {}).length +
            Object.keys(pkg.optionalDependencies || {}).length;
          if (depCount > 0) {
            hasExternalPackageDependencies = true;
          }
        } catch {
          // Handled during structural verification
        }
        const lang: EnterpriseLanguage = hasTs ? "typescript" : "javascript";
        languageSet.add(lang);
        members.push({
          name: pkgName,
          relativeDir: relDir,
          manifestPath: relPath,
          language: lang,
          architecturalRole: inferArchitecturalRole(relDir, lang, text)
        });
      } else if (baseName === "go.mod") {
        const text = safeReadUtf8(fullFile) || "";
        if (/^\s*require\b/m.test(text)) {
          hasExternalPackageDependencies = true;
        }
        const modMatch = text.match(/^\s*module\s+(\S+)/m);
        const modName = modMatch ? modMatch[1] : (relDir === "." ? path.basename(realRoot) : relDir);
        languageSet.add("go");
        members.push({
          name: modName,
          relativeDir: relDir,
          manifestPath: relPath,
          language: "go",
          architecturalRole: inferArchitecturalRole(relDir, "go", text)
        });
      } else if (baseName === "Cargo.toml") {
        const text = safeReadUtf8(fullFile) || "";
        if (/\[(?:dev-)?dependencies\]\s*\n\s*[A-Za-z0-9_-]+\s*=/.test(text)) {
          hasExternalPackageDependencies = true;
        }
        const nameMatch = text.match(/\[package\][\s\S]*?^\s*name\s*=\s*"([^"]+)"/m);
        if (nameMatch) {
          languageSet.add("rust");
          members.push({
            name: nameMatch[1],
            relativeDir: relDir,
            manifestPath: relPath,
            language: "rust",
            architecturalRole: inferArchitecturalRole(relDir, "rust", text)
          });
        }
      } else if (baseName === "pyproject.toml") {
        const text = safeReadUtf8(fullFile) || "";
        const nameMatch = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
        languageSet.add("python");
        members.push({
          name: nameMatch ? nameMatch[1] : (relDir === "." ? path.basename(realRoot) : relDir),
          relativeDir: relDir,
          manifestPath: relPath,
          language: "python",
          architecturalRole: inferArchitecturalRole(relDir, "python", text)
        });
      } else if (baseName === "pubspec.yaml") {
        const text = safeReadUtf8(fullFile) || "";
        const nameMatch = text.match(/^\s*name:\s*([A-Za-z0-9_-]+)/m);
        languageSet.add("flutter_dart");
        members.push({
          name: nameMatch ? nameMatch[1] : (relDir === "." ? path.basename(realRoot) : relDir),
          relativeDir: relDir,
          manifestPath: relPath,
          language: "flutter_dart",
          architecturalRole: "FRONTEND_OR_CLIENT"
        });
      } else if (baseName === "pom.xml" || baseName === "build.gradle" || baseName === "build.gradle.kts") {
        const text = safeReadUtf8(fullFile) || "";
        languageSet.add("java_kotlin");
        members.push({
          name: relDir === "." ? path.basename(realRoot) : relDir,
          relativeDir: relDir,
          manifestPath: relPath,
          language: "java_kotlin",
          architecturalRole: inferArchitecturalRole(relDir, "java_kotlin", text)
        });
      }

      // Formal Interface & Schema Contracts
      const statSize = (() => {
        try {
          return fs.lstatSync(fullFile).size;
        } catch {
          return 0;
        }
      })();

      if (
        /^(?:openapi|swagger)\.(?:json|ya?ml)$/.test(lowerBase) ||
        /\.(?:openapi|swagger)\.(?:json|ya?ml)$/.test(lowerBase)
      ) {
        const content = safeReadUtf8(fullFile) || "";
        let validSyntax = content.trim().length > 0;
        if (ext === ".json") {
          try {
            const parsed = JSON.parse(content);
            validSyntax = Boolean(parsed && (parsed.openapi || parsed.swagger));
          } catch {
            validSyntax = false;
          }
        } else {
          validSyntax = /(?:^|\n)\s*(?:openapi|swagger)\s*:/i.test(content);
        }
        contracts.push({
          standard: "openapi",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "Valid OpenAPI/Swagger specification header" : "Malformed OpenAPI/Swagger specification"
        });
      } else if (/^asyncapi\.(?:json|ya?ml)$/.test(lowerBase)) {
        const content = safeReadUtf8(fullFile) || "";
        const validSyntax = /asyncapi/i.test(content);
        contracts.push({
          standard: "asyncapi",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "AsyncAPI event contract" : "Missing asyncapi root field"
        });
      } else if (ext === ".proto") {
        const content = safeReadUtf8(fullFile) || "";
        const validSyntax = /\bsyntax\s*=\s*"proto[23]"\s*;|\bmessage\s+[A-Za-z_]/.test(content);
        contracts.push({
          standard: "protobuf",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "Protocol Buffers IDL contract" : "Incomplete .proto definition"
        });
      } else if (ext === ".graphql" || ext === ".gql") {
        const content = safeReadUtf8(fullFile) || "";
        const validSyntax = /\b(?:type|query|mutation|schema|input|interface)\b/.test(content);
        contracts.push({
          standard: "graphql",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "GraphQL schema definition" : "Empty or invalid GraphQL schema"
        });
      } else if (lowerBase.endsWith(".schema.json")) {
        const content = safeReadUtf8(fullFile) || "";
        let validSyntax = false;
        try {
          const parsed = JSON.parse(content);
          validSyntax = typeof parsed === "object" && parsed !== null;
        } catch {
          validSyntax = false;
        }
        contracts.push({
          standard: "json_schema",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "Valid JSON Schema contract" : "Invalid JSON in schema file"
        });
      } else if (ext === ".prisma") {
        const content = safeReadUtf8(fullFile) || "";
        const validSyntax = /\b(?:datasource|model|generator)\b/.test(content);
        contracts.push({
          standard: "prisma",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "Prisma relational data schema" : "Incomplete Prisma schema"
        });
      } else if (ext === ".sql" && /(?:^|\/)(?:migrations|db|sql|schema)(?:\/|$)/i.test(relPath)) {
        contracts.push({
          standard: "sql_migration",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax: statSize > 0,
          detail: "SQL database migration / schema script"
        });
      } else if (ext === ".tla") {
        const content = safeReadUtf8(fullFile) || "";
        const validSyntax = /----+\s*MODULE\s+[A-Za-z0-9_]+\s*----+/.test(content);
        contracts.push({
          standard: "tla_plus",
          relativePath: relPath,
          byteSize: statSize,
          validSyntax,
          detail: validSyntax ? "TLA+ formal state-machine specification" : "Malformed TLA+ module header"
        });
      }

      // Bounded Plaintext Secret Hygiene Scan (Law VI)
      if (!BINARY_EXTENSIONS.has(ext)) {
        const text = safeReadUtf8(fullFile, 512 * 1024);
        if (text !== null) {
          for (const pat of CREDENTIAL_PATTERNS) {
            if (pat.regex.test(text)) {
              secretFindings.push({
                patternName: pat.name,
                relativePath: relPath
              });
            }
          }
        }
      }
    }

    const languages = Array.from(languageSet).sort();
    const hasMultiOrchestrator = orchestrators.some((o) => o !== "single_package");
    const archetype: EnterpriseWorkspaceTopology["archetype"] =
      (hasMultiOrchestrator || members.length > 1) && languages.length > 1
        ? "POLYGLOT_MONOREPO"
        : hasMultiOrchestrator || members.length > 1
          ? "SINGLE_LANGUAGE_MONOREPO"
          : files.length >= 10
            ? "ENTERPRISE_SERVICE"
            : "MINIMAL_REPOSITORY";

    const hasDeterministicLockfile = lockfiles.length > 0 || !hasExternalPackageDependencies;

    const supplyChain: SupplyChainPosture = {
      lockfiles,
      hasDeterministicLockfile,
      containerManifests,
      iacManifests,
      ciWorkflows,
      secretHygieneClean: secretFindings.length === 0,
      secretFindings
    };

    const recommendedVerificationCommands = this.synthesizeVerificationCommands(
      realRoot,
      relSet,
      languages,
      orchestrators
    );

    // Weighted bounded structural signals (0..100) — explicitly labeled as structural signal count
    let signalPoints = 0;
    if (members.length > 0) signalPoints += 20;
    if (contracts.length > 0 && contracts.every((c) => c.validSyntax)) signalPoints += 20;
    else if (contracts.length > 0) signalPoints += 8;
    if (supplyChain.hasDeterministicLockfile) signalPoints += 20;
    if (supplyChain.secretHygieneClean) signalPoints += 25;
    if (supplyChain.ciWorkflows.length > 0 || supplyChain.containerManifests.length > 0 || supplyChain.iacManifests.length > 0) {
      signalPoints += 15;
    }

    const workspaceName = path.basename(realRoot);
    const canonicalSummary = JSON.stringify({
      workspaceName,
      archetype,
      orchestrators,
      languages,
      members: members.map((m) => `${m.manifestPath}:${m.language}:${m.architecturalRole}`),
      contracts: contracts.map((c) => `${c.standard}:${c.relativePath}:${c.validSyntax}`),
      lockfiles,
      secretHygieneClean: supplyChain.secretHygieneClean,
      scannedFileCount: files.length
    });
    const sha256TopologyReceipt = pureSha256(canonicalSummary);
    assertPostcondition(sha256TopologyReceipt.length === 64, "Topology receipt must be 64-char SHA-256 hex");

    return deepFreeze({
      workspaceName,
      workspaceRoot: realRoot,
      archetype,
      orchestrators,
      languages,
      members,
      contracts,
      supplyChain,
      recommendedVerificationCommands,
      scannedFileCount: files.length,
      skippedSymlinkCount,
      enterpriseReadinessSignalsScore: Math.min(100, signalPoints),
      scoreDisclaimer:
        "Bounded local structural signal count (0..100); does not certify runtime reliability, full SAST, or production readiness.",
      sha256TopologyReceipt,
      timestamp: new Date().toISOString()
    });
  }

  private static synthesizeVerificationCommands(
    realRoot: string,
    relSet: ReadonlySet<string>,
    languages: readonly EnterpriseLanguage[],
    orchestrators: readonly WorkspaceOrchestrator[]
  ): EnterpriseVerificationCommand[] {
    const commands: EnterpriseVerificationCommand[] = [];
    const usesPnpm = orchestrators.includes("pnpm_workspaces") || relSet.has("pnpm-lock.yaml");

    if (relSet.has("tsconfig.typecheck.json")) {
      commands.push({
        id: "ts-typecheck-strict",
        stack: "typescript",
        command: "npx tsc --project tsconfig.typecheck.json --noEmit",
        rationale: "Strict TypeScript compiler verification across configured project graph"
      });
    } else if (relSet.has("tsconfig.json") || languages.includes("typescript")) {
      commands.push({
        id: "ts-typecheck",
        stack: "typescript",
        command: "npx tsc --noEmit",
        rationale: "Static TypeScript type-safety verification without emitting build artifacts"
      });
    }

    const rootPkgText = safeReadUtf8(path.join(realRoot, "package.json"));
    if (rootPkgText) {
      try {
        const pkg = JSON.parse(rootPkgText);
        if (pkg?.scripts?.["verify:strict"]) {
          commands.push({
            id: "node-verify-strict",
            stack: "nodejs",
            command: usesPnpm ? "pnpm run verify:strict" : "npm run verify:strict",
            rationale: "Execute repository-declared strict verification pipeline"
          });
        } else if (pkg?.scripts?.test) {
          commands.push({
            id: "node-test-suite",
            stack: "nodejs",
            command: usesPnpm ? "pnpm test" : "npm test",
            rationale: "Execute declared package test suite"
          });
        }
      } catch {
        // Ignored here; caught in JSON structural gate
      }
    }

    if (languages.includes("go")) {
      commands.push({
        id: "go-vet-race",
        stack: "go",
        command: "go vet ./... && go test -race ./...",
        rationale: "Static Go analyzer and data-race detector test execution"
      });
    }
    if (languages.includes("rust")) {
      commands.push({
        id: "cargo-check-test",
        stack: "rust",
        command: "cargo check --workspace && cargo test --workspace",
        rationale: "Borrow-checker verification and workspace crate test suite"
      });
    }
    if (languages.includes("python")) {
      commands.push({
        id: "python-pytest",
        stack: "python",
        command: "pytest --maxfail=1",
        rationale: "Python automated test suite verification"
      });
    }
    if (languages.includes("flutter_dart")) {
      commands.push({
        id: "dart-analyze",
        stack: "flutter_dart",
        command: "dart analyze --fatal-infos",
        rationale: "Static Dart/Flutter analyzer with zero-warning tolerance"
      });
    }

    return commands;
  }

  /**
   * Lists all registered fleet & enterprise workspaces declared in docs/projects/registry.json,
   * evaluating their local filesystem presence and Law IV 6-precondition write status.
   */
  public static listRegisteredWorkspaces(
    controlPlaneRoot: string = process.cwd()
  ): readonly RegisteredFleetWorkspace[] {
    const resolvedControlPlane = fs.realpathSync(path.resolve(controlPlaneRoot));
    const registryPath = path.join(resolvedControlPlane, "docs", "projects", "registry.json");
    if (!fs.existsSync(registryPath)) {
      return deepFreeze([]);
    }

    const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const entries = Array.isArray(raw?.projects) ? raw.projects : [];
    const synthesizedFleetEnv = EosAntigravityDirector.synthesizeAntigravityMcpEntry(resolvedControlPlane).env;
    const results: RegisteredFleetWorkspace[] = [];

    for (const p of entries) {
      const id = String(p.id || "");
      const envName = typeof p.localPathEnv === "string" ? p.localPathEnv : undefined;
      const envVal = envName ? (process.env[envName] || synthesizedFleetEnv[envName]) : undefined;
      const candidatePath =
        id === "eos-system"
          ? resolvedControlPlane
          : typeof envVal === "string" && envVal.trim().length > 0
            ? path.resolve(envVal.trim())
            : typeof p.localPath === "string" && p.localPath.trim().length > 0
              ? path.resolve(p.localPath.trim())
              : null;

      let pathExistsOnDisk = false;
      let resolvedLocalPath: string | null = candidatePath;
      if (candidatePath && fs.existsSync(candidatePath)) {
        try {
          const lst = fs.lstatSync(candidatePath);
          if (lst.isDirectory() && !lst.isSymbolicLink()) {
            resolvedLocalPath = fs.realpathSync(candidatePath);
            pathExistsOnDisk = true;
          }
        } catch {
          pathExistsOnDisk = false;
        }
      }

      const missing: string[] = [];
      if (p.status !== "REGISTERED") missing.push("REGISTERED");
      if (p.intake !== "INTAKE_COMPLETE") missing.push("INTAKE_COMPLETE");
      if (p.specification !== "SPECIFICATION_APPROVED") missing.push("SPECIFICATION_APPROVED");
      if (p.audit !== "AUDIT_COMPLETE") missing.push("AUDIT_COMPLETE");
      const auth = String(p.authorization || "NONE");
      const hasLevel2Plus = /^LEVEL_[23]/.test(auth);
      if (p.ownerApproval !== "OWNER_APPROVAL" && !hasLevel2Plus) {
        missing.push("OWNER_APPROVAL");
      }
      if (!hasLevel2Plus) {
        missing.push("IMPLEMENTATION_AUTHORIZED_LEVEL_2_PLUS");
      }

      results.push({
        id,
        name: String(p.name || id),
        localPathEnv: envName,
        localPath: typeof p.localPath === "string" ? p.localPath : undefined,
        resolvedLocalPath,
        pathExistsOnDisk,
        remoteUrl: String(p.remoteUrl || "NOT_DECLARED"),
        productionUrl: typeof p.productionUrl === "string" ? p.productionUrl : undefined,
        type: String(p.type || "enterprise-workspace"),
        status: String(p.status || "UNREGISTERED"),
        intake: String(p.intake || "MISSING"),
        specification: String(p.specification || "MISSING"),
        audit: String(p.audit || "MISSING"),
        ownerApproval: typeof p.ownerApproval === "string" ? p.ownerApproval : undefined,
        authorization: auth,
        writeAuthorizedUnderLawIV: missing.length === 0,
        missingLawIVPreconditions: missing
      });
    }

    return deepFreeze(results);
  }

  /**
   * Resolves a target path inside a registered workspace in docs/projects/registry.json,
   * rejecting path traversal and symlinks, and strictly enforcing Law IV External Write Barrier
   * whenever accessMode === "WRITE_GATED".
   */
  public static resolveAuthorizedWorkspace(
    projectId: string,
    relativeSubPath: string = ".",
    accessMode: WorkspaceAccessMode = "READ_ONLY",
    controlPlaneRoot: string = process.cwd()
  ): AuthorizedWorkspaceResolution {
    const cleanId = sanitizeProjectId(projectId);
    const fleet = this.listRegisteredWorkspaces(controlPlaneRoot);
    const matched = fleet.find((w) => w.id.toLowerCase() === cleanId);

    if (!matched) {
      throw new Error(
        `[UNREGISTERED_WORKSPACE] Project '${cleanId}' is not registered in docs/projects/registry.json.`
      );
    }
    if (!matched.resolvedLocalPath || !matched.pathExistsOnDisk) {
      throw new Error(
        `[WORKSPACE_PATH_UNAVAILABLE] Registered project '${cleanId}' local path is not present on disk (check ${matched.localPathEnv || "localPath"}).`
      );
    }

    if (accessMode === "WRITE_GATED" && !matched.writeAuthorizedUnderLawIV) {
      throw new Error(
        `[LAW_IV_WRITE_BARRIER_BLOCKED] External writes to '${cleanId}' are prohibited; missing preconditions: ${matched.missingLawIVPreconditions.join(", ")}.`
      );
    }

    const workspaceRoot = matched.resolvedLocalPath;
    const sub = relativeSubPath && relativeSubPath.trim().length > 0 ? relativeSubPath.trim() : ".";
    const candidate = path.resolve(workspaceRoot, sub);
    if (!isPathWithin(workspaceRoot, candidate)) {
      throw new Error(
        `[BOUNDARY_ESCAPE_BLOCKED] Requested subpath '${sub}' escapes registered workspace '${cleanId}'.`
      );
    }
    if (fs.existsSync(candidate)) {
      const lst = fs.lstatSync(candidate);
      if (lst.isSymbolicLink()) {
        throw new Error("[SYMLINK_REJECTED] Symbolic-link targets inside registered workspaces are rejected.");
      }
      const realCandidate = fs.realpathSync(candidate);
      if (!isPathWithin(workspaceRoot, realCandidate)) {
        throw new Error(
          `[BOUNDARY_ESCAPE_BLOCKED] Resolved realpath escapes registered workspace '${cleanId}'.`
        );
      }
    }

    return deepFreeze({
      projectId: matched.id,
      accessMode,
      workspaceRoot,
      resolvedTargetPath: candidate,
      authorizationLevel: matched.authorization,
      writeBarrierStatus: accessMode === "WRITE_GATED" ? "AUTHORIZED" : "READ_ONLY_CONFINED"
    });
  }

  /**
   * Brings an external enterprise repository under EOS Constitutional Governance
   * while strictly honoring Law IV (0 bytes written into the external target repository!).
   * All governance artifacts are written exclusively inside controlPlaneRoot, and the
   * project is registered at LEVEL_1_READ_ONLY_AUDIT until explicit human OWNER_APPROVAL.
   */
  public static onboardWorkspace(input: OnboardWorkspaceInput): OnboardWorkspaceResult {
    assertPrecondition(Boolean(input && typeof input.targetPath === "string"), "targetPath is required");
    const topology = this.inspectWorkspace(input.targetPath);

    const projectId = sanitizeProjectId(input.projectId || topology.workspaceName);
    const projectName = (input.projectName || topology.workspaceName).trim();
    const localPathEnv = (input.localPathEnv || defaultEnvVarForProject(projectId)).trim();
    const remoteUrl = (input.remoteUrl || "NOT_DECLARED").trim();
    const projectType = (input.projectType || topology.archetype.toLowerCase().replace(/_/g, "-")).trim();
    const dryRun = input.dryRun === true;
    const controlPlaneRoot = fs.realpathSync(path.resolve(input.controlPlaneRoot || process.cwd()));

    const intakeRel = `docs/intake/${projectId}/PROJECT_CONTEXT.md`;
    const inventoryRel = `docs/intake/${projectId}/inventory.json`;
    const specRel = `docs/specs/${projectId}/SPEC-001-BASELINE.md`;
    const auditRel = `docs/audits/${projectId}/AUDIT-001-BASELINE.json`;

    const intakeMd = [
      `# PROJECT CONTEXT — ${projectName} (${projectId})`,
      "",
      `* **Project ID**: \`${projectId}\``,
      `* **Archetype**: \`${topology.archetype}\``,
      `* **Workspace Orchestrators**: ${topology.orchestrators.map((o) => `\`${o}\``).join(", ")}`,
      `* **Detected Languages**: ${topology.languages.map((l) => `\`${l}\``).join(", ") || "`none`"}`,
      `* **Local Path Environment Variable**: \`${localPathEnv}\``,
      `* **Remote URL**: \`${remoteUrl}\``,
      `* **Governance Tier**: \`LEVEL_1_READ_ONLY_AUDIT\` (Law IV External Write Barrier Active)`,
      `* **Topology SHA-256**: \`${topology.sha256TopologyReceipt}\``,
      "",
      "## Discovered Workspace Members",
      ...(topology.members.length > 0
        ? topology.members.map(
            (m) => `- **\`${m.name}\`** (\`${m.manifestPath}\`) — Language: \`${m.language}\`, Role: \`${m.architecturalRole}\``
          )
        : ["- No package manifests discovered at current scan depth."]),
      "",
      "## Discovered Formal Interface & Data Contracts",
      ...(topology.contracts.length > 0
        ? topology.contracts.map(
            (c) => `- **\`${c.standard}\`**: \`${c.relativePath}\` (${c.byteSize} bytes, validSyntax: \`${c.validSyntax}\`)`
          )
        : ["- No formal OpenAPI/Protobuf/GraphQL/Schema contracts detected yet."]),
      ""
    ].join("\n");

    const inventoryJson = JSON.stringify(topology, null, 2) + "\n";

    const specMd = [
      `# SPEC-001-BASELINE: CONSTITUTIONAL GOVERNANCE BASELINE FOR ${projectName.toUpperCase()}`,
      "",
      `* **Project ID**: \`${projectId}\``,
      `* **Status**: \`SPECIFICATION_APPROVED\` (Baseline Read-Only Governance)`,
      `* **External Write Authorization**: \`LEVEL_1_READ_ONLY_AUDIT\` (Requires explicit human \`OWNER_APPROVAL\` + \`LEVEL_2\`+ for external mutations)`,
      "",
      "## 1. Formal Functional Requirements (IEEE 830 / EARS)",
      "",
      "* **FR-BASE-001 (Zero-Secret Supply Chain Invariant)**:",
      "  `EL SISTEMA mantendrá cero credenciales, llaves privadas o tokens de API en texto plano dentro de los archivos rastreados del workspace.`",
      "",
      "* **FR-BASE-002 (Deterministic Lockfile & Contract Integrity)**:",
      "  `CUANDO se modifique una dependencia o contrato de interfaz (OpenAPI, Protobuf, GraphQL, JSON Schema, Prisma), EL SISTEMA validará la sintaxis del contrato y la consistencia del lockfile antes de autorizar despliegues.`",
      "",
      "* **FR-BASE-003 (Law IV External Write Containment)**:",
      "  `MIENTRAS el nivel de autorización sea LEVEL_1_READ_ONLY_AUDIT, EL SISTEMA permitirá únicamente auditorías e inspecciones sin mutar archivos en el repositorio externo.`",
      "",
      "## 2. Formal Acceptance Criteria (Gherkin BDD)",
      "",
      "```gherkin",
      `ESCENARIO: BDD-BASE-001 — Verificación estructural limpia sobre ${projectId}`,
      `  DADO el workspace registrado ${projectId} bajo gobernanza EOS`,
      "  CUANDO se ejecuta eos project verify en modo estructural de solo lectura",
      "  ENTONCES todos los contratos declarados son sintácticamente válidos y el escaneo de secretos reporta 0 hallazgos",
      "  Y se registra un recibo criptográfico SHA-256 en EosDurableSqliteLedger",
      "```",
      ""
    ].join("\n");

    const auditJson =
      JSON.stringify(
        {
          projectId,
          projectName,
          auditedAt: new Date().toISOString(),
          epistemicState:
            topology.supplyChain.secretHygieneClean &&
            topology.contracts.every((c) => c.validSyntax)
              ? "AUDIT_EXECUTED"
              : "FINDINGS_IDENTIFIED",
          secretHygieneClean: topology.supplyChain.secretHygieneClean,
          hasDeterministicLockfile: topology.supplyChain.hasDeterministicLockfile,
          contractsCount: topology.contracts.length,
          invalidContractsCount: topology.contracts.filter((c) => !c.validSyntax).length,
          enterpriseReadinessSignalsScore: topology.enterpriseReadinessSignalsScore,
          sha256TopologyReceipt: topology.sha256TopologyReceipt
        },
        null,
        2
      ) + "\n";

    const fileEntries: ReadonlyArray<{ readonly rel: string; readonly content: string }> = [
      { rel: intakeRel, content: intakeMd },
      { rel: inventoryRel, content: inventoryJson },
      { rel: specRel, content: specMd },
      { rel: auditRel, content: auditJson }
    ];

    const generatedArtifacts: OnboardGeneratedArtifact[] = fileEntries.map((entry) => ({
      relativeControlPlanePath: entry.rel,
      byteLength: Buffer.byteLength(entry.content, "utf8"),
      sha256Digest: pureSha256(entry.content)
    }));

    let registryUpdated = false;
    let ledgerEntryId: string | null = null;

    if (!dryRun) {
      for (const entry of fileEntries) {
        const dest = path.resolve(controlPlaneRoot, entry.rel);
        assertPrecondition(
          isPathWithin(controlPlaneRoot, dest),
          "Onboarding artifact destination escaped controlPlaneRoot"
        );
        // Double-check we NEVER write inside externalTargetPath unless externalTargetPath IS controlPlaneRoot itself
        if (!isPathWithin(controlPlaneRoot, topology.workspaceRoot)) {
          assertPrecondition(
            !isPathWithin(topology.workspaceRoot, dest),
            "Law IV Violation: Onboarding attempted to write inside external target repository"
          );
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, entry.content, "utf8");
      }

      const registryPath = path.join(controlPlaneRoot, "docs", "projects", "registry.json");
      assertPrecondition(
        isPathWithin(controlPlaneRoot, registryPath),
        "Registry path escaped controlPlaneRoot"
      );
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });

      const registryDoc = fs.existsSync(registryPath)
        ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
        : {
            version: "10.2.0-portable-fleet-registry",
            updatedAt: new Date().toISOString(),
            masterOrchestrator: "EOS System control plane",
            complianceStandard: "EOS_CONSTITUTION_LAW_IV_EXTERNAL_WRITE_BARRIER",
            projects: []
          };

      if (!Array.isArray(registryDoc.projects)) {
        registryDoc.projects = [];
      }

      const existingIdx = registryDoc.projects.findIndex(
        (p: Record<string, unknown>) => String(p.id || "").toLowerCase() === projectId
      );

      const newEntry: Record<string, unknown> = {
        id: projectId,
        name: projectName,
        localPathEnv,
        localPath: topology.workspaceRoot,
        remoteUrl,
        ...(input.productionUrl ? { productionUrl: input.productionUrl.trim() } : {}),
        type: projectType,
        status: "REGISTERED",
        intake: "INTAKE_COMPLETE",
        specification: "SPECIFICATION_APPROVED",
        audit: "AUDIT_COMPLETE",
        authorization: "LEVEL_1_READ_ONLY_AUDIT",
        cicdGateScript:
          topology.recommendedVerificationCommands[0]?.command || "eos project verify"
      };

      if (existingIdx >= 0) {
        const prev = registryDoc.projects[existingIdx];
        // Preserve existing higher-level human authorization if already granted
        if (typeof prev.authorization === "string" && /^LEVEL_[23]/.test(prev.authorization)) {
          newEntry.authorization = prev.authorization;
        }
        if (prev.ownerApproval === "OWNER_APPROVAL") {
          newEntry.ownerApproval = "OWNER_APPROVAL";
        }
        registryDoc.projects[existingIdx] = { ...prev, ...newEntry };
      } else {
        registryDoc.projects.push(newEntry);
      }

      registryDoc.updatedAt = new Date().toISOString();
      fs.writeFileSync(registryPath, JSON.stringify(registryDoc, null, 2) + "\n", "utf8");
      registryUpdated = true;

      const ledgerPath =
        input.ledgerDbPath || EosDurableSqliteLedger.defaultLedgerPath(controlPlaneRoot);
      const ledger = new EosDurableSqliteLedger(ledgerPath);
      try {
        const rec = ledger.appendEntry({
          category: "ARCHITECTURE_DECISION",
          projectId,
          title: `Enterprise Workspace Onboarded (${topology.archetype}) at LEVEL_1_READ_ONLY_AUDIT`,
          payload: {
            projectId,
            projectName,
            archetype: topology.archetype,
            orchestrators: topology.orchestrators,
            languages: topology.languages,
            membersCount: topology.members.length,
            contractsCount: topology.contracts.length,
            externalBytesWritten: 0,
            sha256TopologyReceipt: topology.sha256TopologyReceipt
          },
          engramTopicKey: `eos/enterprise-onboard/${projectId}`
        });
        ledgerEntryId = rec.entryId;
      } finally {
        ledger.close();
      }
    }

    const sha256OnboardReceipt = pureSha256(
      JSON.stringify({
        projectId,
        dryRun,
        externalBytesWritten: 0,
        topologyReceipt: topology.sha256TopologyReceipt,
        artifacts: generatedArtifacts.map((a) => `${a.relativeControlPlanePath}:${a.sha256Digest}`)
      })
    );
    assertPostcondition(sha256OnboardReceipt.length === 64, "Onboard receipt must be 64-char SHA-256");

    return deepFreeze({
      projectId,
      projectName,
      externalTargetPath: topology.workspaceRoot,
      controlPlaneRoot,
      dryRun,
      initialAuthorization: "LEVEL_1_READ_ONLY_AUDIT",
      externalBytesWritten: 0,
      topology,
      generatedArtifacts,
      registryUpdated,
      ledgerEntryId,
      sha256OnboardReceipt
    });
  }

  /**
   * Executes bounded, non-mutating structural verification gates across any
   * enterprise workspace (JSON manifest validity, formal API/data contract syntax,
   * deterministic lockfile presence, and plaintext secret hygiene), sealing a
   * cryptographic verification receipt in EosDurableSqliteLedger.
   */
  public static verifyWorkspace(
    targetPath: string,
    options?: {
      readonly controlPlaneRoot?: string;
      readonly projectId?: string;
      readonly recordLedger?: boolean;
      readonly ledgerDbPath?: string;
    }
  ): EnterpriseWorkspaceVerificationReport {
    const topology = this.inspectWorkspace(targetPath);
    const { files } = scanWorkspaceTree(topology.workspaceRoot, 5, 2500);

    // Gate 1: JSON Manifest Structural Integrity (package.json, tsconfig*.json, *.json contracts)
    const malformedJsonFiles: string[] = [];
    for (const f of files) {
      const base = path.basename(f).toLowerCase();
      if (
        base === "package.json" ||
        base === "turbo.json" ||
        base === "nx.json" ||
        base === "vercel.json" ||
        base.endsWith(".schema.json") ||
        base === "openapi.json" ||
        base === "swagger.json"
      ) {
        const text = safeReadUtf8(f, 512 * 1024);
        if (text !== null) {
          try {
            JSON.parse(text);
          } catch {
            malformedJsonFiles.push(toPosixRelative(topology.workspaceRoot, f));
          }
        }
      }
    }

    const invalidContracts = topology.contracts.filter((c) => !c.validSyntax);

    const gates: StructuralGateResult[] = [
      {
        gateId: "GATE-01-WORKSPACE-MANIFESTS",
        label: "Workspace & Package Manifest JSON Integrity",
        passed: malformedJsonFiles.length === 0,
        detail:
          malformedJsonFiles.length === 0
            ? `All inspected JSON manifests parsed cleanly (${topology.members.length} workspace member(s)).`
            : `Malformed JSON manifests detected: ${malformedJsonFiles.join(", ")}`
      },
      {
        gateId: "GATE-02-FORMAL-CONTRACTS",
        label: "API, Schema & Formal Specification Contracts",
        passed: invalidContracts.length === 0,
        detail:
          invalidContracts.length === 0
            ? `${topology.contracts.length} formal contract(s) verified with valid syntax.`
            : `Invalid contract syntax in: ${invalidContracts.map((c) => c.relativePath).join(", ")}`
      },
      {
        gateId: "GATE-03-SUPPLY-CHAIN-LOCKFILE",
        label: "Deterministic Supply-Chain Lockfile Posture",
        passed: topology.supplyChain.hasDeterministicLockfile,
        detail: topology.supplyChain.hasDeterministicLockfile
          ? `Deterministic lockfile posture satisfied (${topology.supplyChain.lockfiles.join(", ") || "no external package lock required"}).`
          : "Missing deterministic lockfile (e.g. package-lock.json, pnpm-lock.yaml, Cargo.lock, go.sum, uv.lock)."
      },
      {
        gateId: "GATE-04-ZERO-PLAIN-SECRETS",
        label: "Law VI Zero Plaintext Credential Scan",
        passed: topology.supplyChain.secretHygieneClean,
        detail: topology.supplyChain.secretHygieneClean
          ? `0 credential patterns matched across ${topology.scannedFileCount} workspace file(s).`
          : `Credential leak(s) detected: ${topology.supplyChain.secretFindings
              .map((s) => `${s.patternName} in ${s.relativePath}`)
              .join("; ")}`
      }
    ];

    const overallPassed = gates.every((g) => g.passed);
    const epistemicState = overallPassed ? "VERIFIED" : "FINDINGS_IDENTIFIED";
    const sha256VerificationReceipt = pureSha256(
      JSON.stringify({
        workspaceRoot: topology.workspaceRoot,
        topologyReceipt: topology.sha256TopologyReceipt,
        gates
      })
    );

    let ledgerEntryId: string | null = null;
    if (options?.recordLedger !== false && (options?.controlPlaneRoot || options?.ledgerDbPath)) {
      const ledgerPath =
        options.ledgerDbPath ||
        EosDurableSqliteLedger.defaultLedgerPath(path.resolve(options.controlPlaneRoot!));
      const ledger = new EosDurableSqliteLedger(ledgerPath);
      try {
        const rec = ledger.appendEntry({
          category: "VERIFICATION_RECEIPT",
          projectId: options.projectId || sanitizeProjectId(topology.workspaceName),
          title: `Enterprise Workspace Verification: ${epistemicState}`,
          payload: {
            workspaceName: topology.workspaceName,
            epistemicState,
            overallPassed,
            gates,
            sha256VerificationReceipt
          }
        });
        ledgerEntryId = rec.entryId;
      } finally {
        ledger.close();
      }
    }

    return deepFreeze({
      workspaceName: topology.workspaceName,
      workspaceRoot: topology.workspaceRoot,
      epistemicState,
      overallPassed,
      gates,
      recommendedCommands: topology.recommendedVerificationCommands,
      ledgerEntryId,
      sha256VerificationReceipt,
      timestamp: new Date().toISOString()
    });
  }
}
