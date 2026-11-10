/**
 * EOS ENTERPRISE WORKSPACE GOVERNOR — Type Definitions
 * Governed by SPEC-046, ADR-052 (v52.0.0)
 *
 * All public types, interfaces, and enums for the workspace topology engine.
 * Extracted from eosEnterpriseWorkspaceGovernor.ts for module cohesion.
 */

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
  "openapi" | "protobuf" | "graphql" | "asyncapi" | "json_schema" | "prisma" | "sql_migration" | "tla_plus";

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

export const IGNORED_SCAN_DIRS: ReadonlySet<string> = new Set([
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
  "_sandbox",
]);

export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
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
  ".lockb",
]);

export const CREDENTIAL_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: "Live Stripe/OpenAI Key", regex: new RegExp("sk-" + "live-[0-9a-zA-Z]{16,}") },
  { name: "GitHub Personal Access Token", regex: new RegExp("ghp_" + "[0-9a-zA-Z]{24,}") },
  { name: "AWS Access Key ID", regex: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Google API Key", regex: new RegExp("AIza" + "[0-9A-Za-z\\-_]{35}") },
  { name: "PEM Private Key Block", regex: new RegExp("-----BEGIN " + "(RSA |EC |OPENSSH )?PRIVATE KEY-----") },
];

export const DETERMINISTIC_LOCKFILE_NAMES: ReadonlySet<string> = new Set([
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
  "Pipfile.lock",
]);

export function inferArchitecturalRole(
  relativeDir: string,
  language: EnterpriseLanguage,
  manifestContent: string,
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
  if (/(?:^|\/)(?:infra|terraform|deploy|k8s|helm|scripts|tools)(?:\/|$)/.test(lowerDir)) {
    return "INFRASTRUCTURE_OR_TOOLING";
  }
  if (
    language === "flutter_dart" ||
    /(?:^|\/)(?:web|frontend|client|ui|mobile|app-web|dashboard)(?:\/|$)/.test(lowerDir) ||
    /"(?:next|react|vue|svelte|astro|nuxt)"/.test(lowerContent)
  ) {
    return "FRONTEND_OR_CLIENT";
  }
  if (/(?:^|\/)(?:packages|libs|shared|common|sdk)(?:\/|$)/.test(lowerDir)) {
    return "SHARED_LIBRARY";
  }
  return "BACKEND_OR_SERVICE";
}

export function buildOnboardIntakeMarkdown(params: {
  projectId: string;
  projectName: string;
  localPathEnv: string;
  remoteUrl: string;
  topology: EnterpriseWorkspaceTopology;
}): string {
  const { projectId, projectName, localPathEnv, remoteUrl, topology } = params;
  return [
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
          (m) =>
            `- **\`${m.name}\`** (\`${m.manifestPath}\`) — Language: \`${m.language}\`, Role: \`${m.architecturalRole}\``,
        )
      : ["- No package manifests discovered at current scan depth."]),
    "",
    "## Discovered Formal Interface & Data Contracts",
    ...(topology.contracts.length > 0
      ? topology.contracts.map(
          (c) =>
            `- **\`${c.standard}\`**: \`${c.relativePath}\` (${c.byteSize} bytes, validSyntax: \`${c.validSyntax}\`)`,
        )
      : ["- No formal OpenAPI/Protobuf/GraphQL/Schema contracts detected yet."]),
    "",
  ].join("\n");
}

export function inspectContractFile(params: {
  lowerBase: string;
  ext: string;
  relPath: string;
  statSize: number;
  readContent: () => string;
}): ContractArtifact | null {
  const { lowerBase, ext, relPath, statSize, readContent } = params;
  if (
    /^(?:openapi|swagger)\.(?:json|ya?ml)$/.test(lowerBase) ||
    /\.(?:openapi|swagger)\.(?:json|ya?ml)$/.test(lowerBase)
  ) {
    const content = readContent();
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
    return {
      standard: "openapi",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "Valid OpenAPI/Swagger specification header" : "Malformed OpenAPI/Swagger specification",
    };
  }
  if (/^asyncapi\.(?:json|ya?ml)$/.test(lowerBase)) {
    const validSyntax = /asyncapi/i.test(readContent());
    return {
      standard: "asyncapi",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "AsyncAPI event contract" : "Missing asyncapi root field",
    };
  }
  if (ext === ".proto") {
    const validSyntax = /\bsyntax\s*=\s*"proto[23]"\s*;|\bmessage\s+[A-Za-z_]/.test(readContent());
    return {
      standard: "protobuf",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "Protocol Buffers IDL contract" : "Incomplete .proto definition",
    };
  }
  if (ext === ".graphql" || ext === ".gql") {
    const validSyntax = /\b(?:type|query|mutation|schema|input|interface)\b/.test(readContent());
    return {
      standard: "graphql",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "GraphQL schema definition" : "Empty or invalid GraphQL schema",
    };
  }
  if (lowerBase.endsWith(".schema.json")) {
    let validSyntax = false;
    try {
      const parsed = JSON.parse(readContent());
      validSyntax = typeof parsed === "object" && parsed !== null;
    } catch {}
    return {
      standard: "json_schema",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "Valid JSON Schema contract" : "Invalid JSON in schema file",
    };
  }
  if (ext === ".prisma") {
    const validSyntax = /\b(?:datasource|model|generator)\b/.test(readContent());
    return {
      standard: "prisma",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "Prisma relational data schema" : "Incomplete Prisma schema",
    };
  }
  if (ext === ".sql" && /(?:^|\/)(?:migrations|db|sql|schema)(?:\/|$)/i.test(relPath)) {
    return {
      standard: "sql_migration",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax: statSize > 0,
      detail: "SQL database migration / schema script",
    };
  }
  if (ext === ".tla") {
    const validSyntax = /----+\s*MODULE\s+[A-Za-z0-9_]+\s*----+/.test(readContent());
    return {
      standard: "tla_plus",
      relativePath: relPath,
      byteSize: statSize,
      validSyntax,
      detail: validSyntax ? "TLA+ formal state-machine specification" : "Malformed TLA+ module header",
    };
  }
  return null;
}

export function synthesizeWorkspaceVerificationCommands(
  rootPkgText: string | null,
  relSet: ReadonlySet<string>,
  languages: readonly EnterpriseLanguage[],
  orchestrators: readonly WorkspaceOrchestrator[],
): EnterpriseVerificationCommand[] {
  const commands: EnterpriseVerificationCommand[] = [];
  const usesPnpm = orchestrators.includes("pnpm_workspaces") || relSet.has("pnpm-lock.yaml");

  if (relSet.has("tsconfig.typecheck.json")) {
    commands.push({
      id: "ts-typecheck-strict",
      stack: "typescript",
      command: "npx tsc --project tsconfig.typecheck.json --noEmit",
      rationale: "Strict TypeScript compiler verification across configured project graph",
    });
  } else if (relSet.has("tsconfig.json") || languages.includes("typescript")) {
    commands.push({
      id: "ts-typecheck",
      stack: "typescript",
      command: "npx tsc --noEmit",
      rationale: "Static TypeScript type-safety verification without emitting build artifacts",
    });
  }

  if (rootPkgText) {
    try {
      const pkg = JSON.parse(rootPkgText);
      if (pkg?.scripts?.["verify:strict"]) {
        commands.push({
          id: "node-verify-strict",
          stack: "nodejs",
          command: usesPnpm ? "pnpm run verify:strict" : "npm run verify:strict",
          rationale: "Execute repository-declared strict verification pipeline",
        });
      } else if (pkg?.scripts?.test) {
        commands.push({
          id: "node-test-suite",
          stack: "nodejs",
          command: usesPnpm ? "pnpm test" : "npm test",
          rationale: "Execute declared package test suite",
        });
      }
    } catch {}
  }

  if (languages.includes("go")) {
    commands.push({
      id: "go-vet-race",
      stack: "go",
      command: "go vet ./... && go test -race ./...",
      rationale: "Static Go analyzer and data-race detector test execution",
    });
  }
  if (languages.includes("rust")) {
    commands.push({
      id: "cargo-check-test",
      stack: "rust",
      command: "cargo check --workspace && cargo test --workspace",
      rationale: "Borrow-checker verification and workspace crate test suite",
    });
  }
  if (languages.includes("python")) {
    commands.push({
      id: "python-pytest",
      stack: "python",
      command: "pytest --maxfail=1",
      rationale: "Python automated test suite verification",
    });
  }
  if (languages.includes("flutter_dart")) {
    commands.push({
      id: "dart-analyze",
      stack: "flutter_dart",
      command: "dart analyze --fatal-infos",
      rationale: "Static Dart/Flutter analyzer with zero-warning tolerance",
    });
  }
  return commands;
}

export function inspectWorkspaceMemberManifest(params: {
  baseName: string;
  relPath: string;
  relDir: string;
  defaultName: string;
  relSet: Set<string>;
  readContent: () => string;
}): { member: WorkspaceMember | null; hasExternalDeps: boolean } {
  const { baseName, relPath, relDir, defaultName, relSet, readContent } = params;
  if (baseName === "package.json") {
    const text = readContent();
    let pkgName = relDir === "." ? defaultName : relDir;
    let hasTs = relSet.has(relDir === "." ? "tsconfig.json" : `${relDir}/tsconfig.json`);
    let hasExternalDeps = false;
    try {
      const pkg = JSON.parse(text);
      if (typeof pkg.name === "string" && pkg.name.trim().length > 0) pkgName = pkg.name.trim();
      if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) hasTs = true;
      const depCount =
        Object.keys(pkg.dependencies || {}).length +
        Object.keys(pkg.devDependencies || {}).length +
        Object.keys(pkg.optionalDependencies || {}).length;
      if (depCount > 0) hasExternalDeps = true;
    } catch {}
    const lang: EnterpriseLanguage = hasTs ? "typescript" : "javascript";
    return {
      hasExternalDeps,
      member: {
        name: pkgName,
        relativeDir: relDir,
        manifestPath: relPath,
        language: lang,
        architecturalRole: inferArchitecturalRole(relDir, lang, text),
      },
    };
  }
  if (baseName === "go.mod") {
    const text = readContent();
    const modMatch = text.match(/^\s*module\s+(\S+)/m);
    return {
      hasExternalDeps: /^\s*require\b/m.test(text),
      member: {
        name: modMatch ? modMatch[1] : relDir === "." ? defaultName : relDir,
        relativeDir: relDir,
        manifestPath: relPath,
        language: "go",
        architecturalRole: inferArchitecturalRole(relDir, "go", text),
      },
    };
  }
  if (baseName === "Cargo.toml") {
    const text = readContent();
    const hasExternalDeps = /\[(?:dev-)?dependencies\]\s*\n\s*[A-Za-z0-9_-]+\s*=/.test(text);
    const nameMatch = text.match(/\[package\][\s\S]*?^\s*name\s*=\s*"([^"]+)"/m);
    return {
      hasExternalDeps,
      member: nameMatch
        ? {
            name: nameMatch[1],
            relativeDir: relDir,
            manifestPath: relPath,
            language: "rust",
            architecturalRole: inferArchitecturalRole(relDir, "rust", text),
          }
        : null,
    };
  }
  if (baseName === "pyproject.toml") {
    const text = readContent();
    const nameMatch = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
    return {
      hasExternalDeps: false,
      member: {
        name: nameMatch ? nameMatch[1] : relDir === "." ? defaultName : relDir,
        relativeDir: relDir,
        manifestPath: relPath,
        language: "python",
        architecturalRole: inferArchitecturalRole(relDir, "python", text),
      },
    };
  }
  if (baseName === "pubspec.yaml") {
    const text = readContent();
    const nameMatch = text.match(/^\s*name:\s*([A-Za-z0-9_-]+)/m);
    return {
      hasExternalDeps: false,
      member: {
        name: nameMatch ? nameMatch[1] : relDir === "." ? defaultName : relDir,
        relativeDir: relDir,
        manifestPath: relPath,
        language: "flutter_dart",
        architecturalRole: "FRONTEND_OR_CLIENT",
      },
    };
  }
  if (baseName === "pom.xml" || baseName === "build.gradle" || baseName === "build.gradle.kts") {
    const text = readContent();
    return {
      hasExternalDeps: false,
      member: {
        name: relDir === "." ? defaultName : relDir,
        relativeDir: relDir,
        manifestPath: relPath,
        language: "java_kotlin",
        architecturalRole: inferArchitecturalRole(relDir, "java_kotlin", text),
      },
    };
  }
  return { member: null, hasExternalDeps: false };
}

export function buildOnboardSpecMarkdown(projectId: string, projectName: string): string {
  return [
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
    "",
  ].join("\n");
}
