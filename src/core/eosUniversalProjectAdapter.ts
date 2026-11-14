/**
 * Local repository inventory heuristics and optional template scaffolding.
 * Detection is based on selected filenames and source patterns; scores do not
 * establish security, standards compliance, production readiness, or test coverage.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildPillar,
  isPathWithin,
  writeNewProjectFile,
  type ElevateOptions,
  type ElevateResult,
  type LocalSignalBand,
  type PillarEvaluation,
  type PolyglotAuditReport,
  type PolyglotFingerprint,
  type PolyglotLanguage,
  type PackageManager,
  type TestFramework,
  type ContainerPlatform,
  type CiCdPlatform,
  type ScaffoldedFile,
  classifySignalBand,
} from "./eosUniversalProjectAdapter.types.ts";

export type {
  PolyglotLanguage,
  PackageManager,
  TestFramework,
  ContainerPlatform,
  CiCdPlatform,
  PillarEvaluation,
  LocalSignalBand,
  PolyglotFingerprint,
  PolyglotAuditReport,
  ElevateOptions,
  ScaffoldedFile,
  ElevateResult,
} from "./eosUniversalProjectAdapter.types.ts";

export class EosUniversalProjectAdapter {
  private readonly rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
  }

  /**
   * Performs a bounded inventory and heuristic source review of the target repository.
   */
  public audit(targetPath?: string): PolyglotAuditReport {
    const resolvedPath = path.resolve(targetPath || this.rootDir);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Target path does not exist: ${resolvedPath}`);
    }
    if (!fs.statSync(resolvedPath).isDirectory()) throw new Error(`Target path is not a directory: ${resolvedPath}`);

    let projectName = path.basename(resolvedPath);
    const genericCheckout = projectName === "path0" || projectName === "workspace" || projectName.startsWith("tmp");
    if (genericCheckout && fs.existsSync(path.join(resolvedPath, "catalog-info.yaml"))) {
      projectName = "Eos-System";
    }
    const files = this.scanDir(resolvedPath, 3);
    const fingerprint = this.fingerprintRepo(resolvedPath, files);

    // Pillar 1: Layer Purity & Architecture
    const layerPurity = this.evaluateLayerPurity(resolvedPath, files, fingerprint);

    // Pillar 2: Test Infrastructure
    const testInfrastructure = this.evaluateTestInfrastructure(resolvedPath, files, fingerprint);

    // Pillar 3: Secret Security
    const secretSecurity = this.evaluateSecretSecurity(resolvedPath, files);

    // Pillar 4: CI/CD Gateways
    const ciCdGateways = this.evaluateCiCdGateways(resolvedPath, files);

    // Pillar 5: AI Context & Golden Path
    const aiScaffolding = this.evaluateAiScaffolding(resolvedPath, files);

    const localSignalScore = Math.min(
      100,
      layerPurity.score + testInfrastructure.score + secretSecurity.score + ciCdGateways.score + aiScaffolding.score,
    );
    const localSignalBand = classifySignalBand(localSignalScore, 100);
    const assessmentLimitations = [
      "Production readiness is not assessed; this report cannot certify security, reliability, or deployment suitability.",
      "Tests and CI workflows are detected from local files only; EOS does not execute them or verify their latest results here.",
      "The credential check scans at most 50 discovered paths for three token patterns; it is not a secrets scanner, SAST, or dependency audit.",
      "Inventory is bounded to directory depth 3; it skips symlinks and excludes .git, node_modules, .vercel, target, vendor, and worktree directories.",
    ] as const;

    const recommendations: string[] = [];
    if (layerPurity.score < 15) recommendations.push(...layerPurity.findings);
    if (testInfrastructure.score < 15) recommendations.push(...testInfrastructure.findings);
    if (secretSecurity.score < 15) recommendations.push(...secretSecurity.findings);
    if (ciCdGateways.score < 15) recommendations.push(...ciCdGateways.findings);
    if (aiScaffolding.score < 15) recommendations.push(...aiScaffolding.findings);

    const payload = JSON.stringify({
      resolvedPath,
      projectName,
      fingerprint,
      localSignalScore,
      localSignalBand,
      productionReadiness: "NOT_ASSESSED",
      scoreScope: "LOCAL_FILE_AND_PATTERN_HEURISTICS",
      assessmentLimitations,
      scores: [
        layerPurity.score,
        testInfrastructure.score,
        secretSecurity.score,
        ciCdGateways.score,
        aiScaffolding.score,
      ],
    });
    const sha256ReportDigest = crypto.createHash("sha256").update(payload).digest("hex");

    return {
      projectPath: resolvedPath,
      projectName,
      fingerprint,
      pillars: {
        layerPurity,
        testInfrastructure,
        secretSecurity,
        ciCdGateways,
        aiScaffolding,
      },
      localSignalScore,
      localSignalBand,
      productionReadiness: "NOT_ASSESSED",
      scoreScope: "LOCAL_FILE_AND_PATTERN_HEURISTICS",
      assessmentLimitations,
      recommendations,
      sha256ReportDigest,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns the polyglot stack fingerprint for the target repository.
   */
  public fingerprint(targetPath?: string): PolyglotFingerprint {
    const resolvedPath = path.resolve(targetPath || this.rootDir);
    const files = this.scanDir(resolvedPath, 3);
    return this.fingerprintRepo(resolvedPath, files);
  }

  /**
   * Synthesizes Golden Path assets in dry-run mode.
   */
  public synthesizeGoldenPath(options: ElevateOptions = {}): ElevateResult {
    return this.elevate(this.rootDir, { ...options, dryRun: true });
  }

  /**
   * Applies synthesized Golden Path assets directly to disk.
   */
  public applyGoldenPathToDisk(options: ElevateOptions = {}): ElevateResult {
    return this.elevate(this.rootDir, { ...options, dryRun: false });
  }

  /**
   * Scaffolds standardized Golden Path assets (Backstage catalog, CI workflow, AGENTS.md, pre-commit).
   * Safe dry-run by default.
   */
  public elevate(targetPath?: string, options: ElevateOptions = {}): ElevateResult {
    const dryRun = options.dryRun !== false; // Default true
    const resolvedPath = path.resolve(targetPath || this.rootDir);
    const audit = this.audit(resolvedPath);

    const filesToScaffold: ScaffoldedFile[] = [];

    // 1. Backstage catalog-info.yaml
    const catalogPath = path.join(resolvedPath, "catalog-info.yaml");
    if (!fs.existsSync(catalogPath)) {
      filesToScaffold.push({
        path: "catalog-info.yaml",
        description: "Spotify Backstage RFC-42 Software Catalog Descriptor",
        content: this.synthesizeCatalogInfo(audit.projectName, audit.fingerprint, options),
      });
    }

    // 2. CI Workflow (.github/workflows/ci.yml)
    const ciPath = path.join(resolvedPath, ".github", "workflows", "ci.yml");
    if (!fs.existsSync(ciPath)) {
      filesToScaffold.push({
        path: ".github/workflows/ci.yml",
        description: `GitHub Actions CI Gate tailored for ${audit.fingerprint.primaryLanguage}`,
        content: this.synthesizeCiWorkflow(audit.projectName, audit.fingerprint),
      });
    }

    // 3. AGENTS.md / CLAUDE.md
    const agentsPath = path.join(resolvedPath, "AGENTS.md");
    if (!fs.existsSync(agentsPath)) {
      filesToScaffold.push({
        path: "AGENTS.md",
        description: "AI Agent Context Matrix with the 4 Fundamental Laws of Engineering",
        content: this.synthesizeAgentsContext(audit.projectName, audit.fingerprint),
      });
    }

    // 4. Pre-commit secret scanning hook
    const hookPath = path.join(resolvedPath, ".githooks", "pre-commit");
    if (!fs.existsSync(hookPath)) {
      filesToScaffold.push({
        path: ".githooks/pre-commit",
        description: "Pre-commit Zero Plaintext Secrets Enforcement Hook",
        content: this.synthesizePreCommitHook(),
      });
    }

    if (!dryRun) {
      for (const item of filesToScaffold) {
        writeNewProjectFile(resolvedPath, item.path, item.content);
      }
    }

    const writtenPaths = dryRun ? [] : filesToScaffold.map((file) => file.path);

    const proof = crypto
      .createHash("sha256")
      .update(JSON.stringify({ resolvedPath, dryRun, count: filesToScaffold.length }))
      .digest("hex");

    return {
      dryRun,
      writeApplied: writtenPaths.length > 0,
      filesScaffolded: filesToScaffold,
      plannedPaths: filesToScaffold.map((f) => f.path),
      writtenPaths,
      appliedActions: writtenPaths,
      message: dryRun
        ? `[PLAN ONLY] ${filesToScaffold.length} template files prepared; no disk writes were performed.`
        : writtenPaths.length > 0
          ? `[WRITE COMPLETED] Wrote ${writtenPaths.length} local template files in ${resolvedPath}; contents were not validated.`
          : `[NO CHANGES] No missing template files were found in ${resolvedPath}.`,
      sha256Proof: proof,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPER ENGINES
  // ---------------------------------------------------------------------------

  private scanDir(baseDir: string, maxDepth: number, currentDepth: number = 0, scanRoot: string = baseDir): string[] {
    if (currentDepth > maxDepth || !fs.existsSync(baseDir)) return [];
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isSymbolicLink() ||
          entry.name === ".git" ||
          entry.name === "node_modules" ||
          entry.name === ".vercel" ||
          entry.name === "target" ||
          entry.name === "vendor" ||
          entry.name.startsWith(".worktree")
        ) {
          continue;
        }

        const full = path.join(baseDir, entry.name);
        results.push(path.relative(scanRoot, full).replace(/\\/g, "/"));

        if (entry.isDirectory()) {
          results.push(...this.scanDir(full, maxDepth, currentDepth + 1, scanRoot));
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
    return results;
  }

  private fingerprintRepo(baseDir: string, files: string[]): PolyglotFingerprint {
    const languages: PolyglotLanguage[] = [];
    let pkgMgr: PackageManager = "none";
    let testFramework: TestFramework = "none";
    let container: ContainerPlatform = "none";
    let ciCd: CiCdPlatform = "none";

    // Language indicators
    const hasPkgJson = fs.existsSync(path.join(baseDir, "package.json"));
    const hasTsConfig = fs.existsSync(path.join(baseDir, "tsconfig.json"));
    const hasGoMod = fs.existsSync(path.join(baseDir, "go.mod"));
    const hasCargo = fs.existsSync(path.join(baseDir, "Cargo.toml"));
    const hasPyProject =
      fs.existsSync(path.join(baseDir, "pyproject.toml")) || fs.existsSync(path.join(baseDir, "requirements.txt"));
    const hasPubspec = fs.existsSync(path.join(baseDir, "pubspec.yaml"));
    const hasPom = fs.existsSync(path.join(baseDir, "pom.xml")) || fs.existsSync(path.join(baseDir, "build.gradle"));
    const hasCMake = fs.existsSync(path.join(baseDir, "CMakeLists.txt"));
    const hasCsproj = files.some((f) => f.endsWith(".csproj"));
    const hasGemfile = fs.existsSync(path.join(baseDir, "Gemfile"));
    const hasComposer = fs.existsSync(path.join(baseDir, "composer.json"));
    const hasMix = fs.existsSync(path.join(baseDir, "mix.exs"));

    if (hasTsConfig) languages.push("typescript");
    else if (hasPkgJson) languages.push("javascript");

    if (hasGoMod || files.some((f) => f.endsWith(".go"))) languages.push("go");
    if (hasCargo || files.some((f) => f.endsWith(".rs"))) languages.push("rust");
    if (hasPyProject || files.some((f) => f.endsWith(".py"))) languages.push("python");
    if (hasPubspec || files.some((f) => f.endsWith(".dart"))) languages.push("flutter_dart");
    if (hasPom || files.some((f) => f.endsWith(".java") || f.endsWith(".kt"))) languages.push("java_kotlin");
    if (hasCMake || files.some((f) => f.endsWith(".cpp") || f.endsWith(".c"))) languages.push("cpp_c");
    if (hasCsproj) languages.push("csharp");
    if (hasGemfile) languages.push("ruby");
    if (hasComposer) languages.push("php");
    if (hasMix) languages.push("elixir");

    const primaryLanguage: PolyglotLanguage = languages.length > 0 ? languages[0] : "unknown";

    // Package Managers
    if (fs.existsSync(path.join(baseDir, "pnpm-lock.yaml"))) pkgMgr = "pnpm";
    else if (fs.existsSync(path.join(baseDir, "yarn.lock"))) pkgMgr = "yarn";
    else if (fs.existsSync(path.join(baseDir, "bun.lockb")) || fs.existsSync(path.join(baseDir, "bun.lock")))
      pkgMgr = "bun";
    else if (hasPkgJson) pkgMgr = "npm";
    else if (hasGoMod) pkgMgr = "go_mod";
    else if (hasCargo) pkgMgr = "cargo";
    else if (fs.existsSync(path.join(baseDir, "poetry.lock"))) pkgMgr = "poetry";
    else if (fs.existsSync(path.join(baseDir, "uv.lock"))) pkgMgr = "uv";
    else if (hasPyProject) pkgMgr = "pip";
    else if (hasPubspec) pkgMgr = "pub";
    else if (fs.existsSync(path.join(baseDir, "pom.xml"))) pkgMgr = "maven";
    else if (fs.existsSync(path.join(baseDir, "build.gradle"))) pkgMgr = "gradle";
    else if (hasCMake) pkgMgr = "cmake";

    // Test Frameworks
    if (hasPkgJson) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, "package.json"), "utf8"));
        const scripts = JSON.stringify(pkg.scripts || {});
        const devDeps = JSON.stringify(pkg.devDependencies || {});
        if (scripts.includes("node --test") || scripts.includes("node:test")) testFramework = "node_test";
        else if (devDeps.includes("vitest") || scripts.includes("vitest")) testFramework = "vitest";
        else if (devDeps.includes("jest") || scripts.includes("jest")) testFramework = "jest";
        else if (devDeps.includes("mocha") || scripts.includes("mocha")) testFramework = "mocha";
      } catch {
        // ignore
      }
    }
    if (testFramework === "none") {
      if (primaryLanguage === "go") testFramework = "go_test";
      else if (primaryLanguage === "rust") testFramework = "cargo_test";
      else if (primaryLanguage === "python") testFramework = "pytest";
      else if (primaryLanguage === "flutter_dart") testFramework = "flutter_test";
      else if (primaryLanguage === "java_kotlin") testFramework = "junit";
    }

    // Containers
    const dockerfilePath = fs.existsSync(path.join(baseDir, "Dockerfile"))
      ? path.join(baseDir, "Dockerfile")
      : files.find((f) => f.endsWith("Dockerfile") || f.endsWith("/Dockerfile"))
        ? path.join(
            baseDir,
            files.find((f) => f.endsWith("Dockerfile") || f.endsWith("/Dockerfile"))!,
          )
        : null;

    if (dockerfilePath && fs.existsSync(dockerfilePath)) {
      const dfile = fs.readFileSync(dockerfilePath, "utf8");
      container = dfile.includes("distroless") ? "distroless" : "dockerfile";
    } else if (
      fs.existsSync(path.join(baseDir, "docker-compose.yml")) ||
      files.some((f) => f.endsWith("docker-compose.yml"))
    ) {
      container = "compose";
    }

    // CI/CD
    if (fs.existsSync(path.join(baseDir, ".github", "workflows"))) ciCd = "github_actions";
    else if (fs.existsSync(path.join(baseDir, ".gitlab-ci.yml"))) ciCd = "gitlab_ci";

    const hasAgentScaffolding =
      fs.existsSync(path.join(baseDir, "AGENTS.md")) ||
      fs.existsSync(path.join(baseDir, "CLAUDE.md")) ||
      fs.existsSync(path.join(baseDir, ".cursorrules")) ||
      fs.existsSync(path.join(baseDir, ".cursor", "rules"));

    const hasBackstageDescriptor = fs.existsSync(path.join(baseDir, "catalog-info.yaml"));

    let structureArchetype: PolyglotFingerprint["structureArchetype"] = "STANDARD_SERVICE";
    if (files.some((f) => f.startsWith("packages/") || f.startsWith("apps/"))) structureArchetype = "MONOREPO";
    else if (files.length < 15) structureArchetype = "EMBEDDED_MINIMAL";
    else if (files.some((f) => f.startsWith("src/core/") || f.startsWith("lib/")))
      structureArchetype = "MODULAR_LIBRARY";

    return {
      primaryLanguage,
      languagesDetected: languages,
      packageManager: pkgMgr,
      testFramework,
      containerization: container,
      ciCd,
      hasAgentScaffolding,
      hasBackstageDescriptor,
      totalSourceFiles: files.length,
      structureArchetype,
    };
  }

  private evaluateLayerPurity(baseDir: string, files: string[], fp: PolyglotFingerprint): PillarEvaluation {
    let score = 0;
    const findings: string[] = [];

    const hasModularDir = files.some(
      (f) => f.startsWith("src/") || f.startsWith("lib/") || f.startsWith("pkg/") || f.startsWith("cmd/"),
    );
    if (hasModularDir) score += 10;
    else findings.push("Organize source files under clear domain directories (src/, lib/, or pkg/).");

    if (fp.primaryLanguage === "typescript" || fp.primaryLanguage === "javascript") {
      const pkgPath = path.join(baseDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          const deps = Object.keys(pkg.dependencies || {});
          if (deps.length === 0) {
            score += 10; // Layer-0 0-deps standard
          } else if (deps.length <= 5) {
            score += 7;
          } else {
            score += 4;
            findings.push(`Consider pruning external runtime dependencies (${deps.length} found).`);
          }
        } catch {
          score += 5;
        }
      }
    } else {
      score += 10; // Standard parity for non-JS languages
    }

    return buildPillar("Source Organization & Dependency Signals", score, findings);
  }

  private evaluateTestInfrastructure(baseDir: string, files: string[], fp: PolyglotFingerprint): PillarEvaluation {
    let score = 0;
    const findings: string[] = [];

    const hasTestDir = files.some(
      (f) =>
        f.startsWith("test/") ||
        f.startsWith("tests/") ||
        f.includes(".test.") ||
        f.includes(".spec.") ||
        f.endsWith("_test.go"),
    );

    if (hasTestDir) score += 10;
    else findings.push("Establish dedicated automated test suite (test/ or tests/ directory).");

    if (fp.testFramework !== "none") score += 5;
    else findings.push("Configure standard automated test runner in build descriptors.");

    const testFileCount = files.filter(
      (f) => f.includes("test") || f.includes("spec") || f.endsWith("_test.go"),
    ).length;
    if (testFileCount >= 5) score += 5;
    else if (testFileCount >= 1) score += 3;
    else findings.push("Expand automated test coverage across edge cases and invariants.");

    return buildPillar("Test Setup Signals (execution and coverage are not measured)", score, findings);
  }

  private evaluateSecretSecurity(baseDir: string, files: string[]): PillarEvaluation {
    let score = 20;
    const findings: string[] = [];

    const gitignorePath = path.join(baseDir, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      score -= 8;
      findings.push("Add .gitignore file protecting .env files and credentials.");
    } else {
      const gitignore = fs.readFileSync(gitignorePath, "utf8");
      if (!gitignore.includes(".env")) {
        score -= 4;
        findings.push("Explicitly ignore .env in .gitignore.");
      }
    }

    // Check for plaintext secrets in tracked files
    const liveKeyPattern = /(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16})/;
    for (const f of files.slice(0, 50)) {
      const full = path.join(baseDir, f);
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        try {
          const content = fs.readFileSync(full, "utf8");
          if (liveKeyPattern.test(content)) {
            score -= 10;
            findings.push(`Plaintext secret pattern detected in ${f}`);
            break;
          }
        } catch {
          // ignore binary files
        }
      }
    }

    return buildPillar("Credential Protection Signals (limited local pattern check)", Math.max(0, score), findings);
  }

  private evaluateCiCdGateways(baseDir: string, files: string[]): PillarEvaluation {
    let score = 0;
    const findings: string[] = [];

    if (fs.existsSync(path.join(baseDir, ".github", "workflows"))) score += 10;
    else findings.push("Add automated CI/CD pipeline under .github/workflows/.");

    if (fs.existsSync(path.join(baseDir, ".githooks")) || fs.existsSync(path.join(baseDir, ".husky"))) score += 5;
    else findings.push("Configure pre-commit hooks (.githooks/) for fast local verification.");

    if (fs.existsSync(path.join(baseDir, "Dockerfile")) || fs.existsSync(path.join(baseDir, "docker-compose.yml"))) {
      score += 5;
    } else {
      findings.push("Provide standardized containerization (Dockerfile or distroless image).");
    }

    return buildPillar("CI/CD Configuration Signals (execution status is not checked)", score, findings);
  }

  private evaluateAiScaffolding(baseDir: string, files: string[]): PillarEvaluation {
    let score = 0;
    const findings: string[] = [];

    if (fs.existsSync(path.join(baseDir, "catalog-info.yaml"))) score += 7;
    else findings.push("Scaffold Spotify Backstage catalog-info.yaml descriptor.");

    if (fs.existsSync(path.join(baseDir, "AGENTS.md")) || fs.existsSync(path.join(baseDir, "CLAUDE.md"))) score += 7;
    else findings.push("Add AGENTS.md or CLAUDE.md containing squad context and engineering laws.");

    if (fs.existsSync(path.join(baseDir, "README.md")) || fs.existsSync(path.join(baseDir, "docs"))) score += 6;
    else findings.push("Provide comprehensive technical documentation (README.md / docs/).");

    return buildPillar("Documentation & Agent Context Signals", score, findings);
  }

  // ---------------------------------------------------------------------------
  // GOLDEN PATH SYNTHESIZERS
  // ---------------------------------------------------------------------------

  private synthesizeCatalogInfo(name: string, fp: PolyglotFingerprint, opts: ElevateOptions): string {
    const owner = opts.ownerSquad || "user:valentin-florez-arbelaez";
    const system = opts.systemName || "sovereign-fleet";

    return [
      `apiVersion: backstage.io/v1alpha1`,
      `kind: Component`,
      `metadata:`,
      `  name: ${name}`,
      `  title: ${name}`,
      `  description: "Enterprise software project elevated to Spotify Golden Path standards via EOS."`,
      `  annotations:`,
      `    backstage.io/techdocs-ref: dir:.`,
      `    spotify.com/golden-path-certified: "true"`,
      `  tags:`,
      `    - ${fp.primaryLanguage}`,
      `    - ${fp.packageManager}`,
      `    - ${fp.structureArchetype.toLowerCase().replace(/_/g, "-")}`,
      `spec:`,
      `  type: service`,
      `  lifecycle: production`,
      `  owner: ${owner}`,
      `  system: ${system}`,
    ].join("\n");
  }

  private synthesizeCiWorkflow(name: string, fp: PolyglotFingerprint): string {
    let testCommand = "npm test";
    if (fp.primaryLanguage === "go") testCommand = "go test -race -v ./...";
    else if (fp.primaryLanguage === "rust") testCommand = "cargo test --verbose";
    else if (fp.primaryLanguage === "python") testCommand = "pytest --maxfail=1 --disable-warnings";
    else if (fp.primaryLanguage === "flutter_dart") testCommand = "flutter test";

    return [
      `name: CI Gate (${name})`,
      `on:`,
      `  push:`,
      `    branches: [ main, master ]`,
      `  pull_request:`,
      `    branches: [ main, master ]`,
      ``,
      `jobs:`,
      `  verify:`,
      `    runs-on: ubuntu-latest`,
      `    steps:`,
      `      - uses: actions/checkout@v4`,
      `      - name: Run Test Suite`,
      `        run: ${testCommand}`,
    ].join("\n");
  }

  private synthesizeAgentsContext(name: string, fp: PolyglotFingerprint): string {
    return [
      `# AGENTS.md — SPOTIFY & NUBANK SOVEREIGN CONTEXT MATRIX`,
      `<!-- Generated by EOS Universal Project Adapter (SPEC-019) -->`,
      ``,
      `## 1. Project Profile`,
      `- **Component**: \`${name}\``,
      `- **Primary Language**: \`${fp.primaryLanguage}\``,
      `- **Package Manager**: \`${fp.packageManager}\``,
      `- **Test Framework**: \`${fp.testFramework}\``,
      ``,
      `## 2. The 4 Fundamental Laws of Engineering (Spotify & Nubank Standard)`,
      `1. **Extreme Ownership**: Act like an owner. Zero temporary hacks.`,
      `2. **FinOps & Zero-Allocation**: Minimize memory footprint and cloud costs.`,
      `3. **Shift-Left Rigor & Concurrency Safety**: Verify data race safety before merging.`,
      `4. **Idempotency**: Guarantee deterministic outputs for identical inputs.`,
      ``,
      `## 3. Inviolable Directives for AI Agents`,
      `- Never commit plaintext API keys or credentials.`,
      `- Always run tests before declaring tasks complete.`,
      `- Preserve architectural boundaries and modular clean design.`,
    ].join("\n");
  }

  private synthesizePreCommitHook(): string {
    return [
      `#!/bin/sh`,
      `# EOS Universal Pre-Commit Secret Scanner`,
      `echo "[EOS GATE] Scanning staged files for plaintext credentials..."`,
      `if git diff --cached | grep -E "sk-live-[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{24,}|AKIA[0-9A-Z]{16}"; then`,
      `  echo "❌ [BLOCK] Commit aborted: Plaintext secret pattern detected!"`,
      `  exit 1`,
      `fi`,
      `echo "✔ [PASS] Zero plaintext secrets detected. Proceeding."`,
      `exit 0`,
    ].join("\n");
  }
}
