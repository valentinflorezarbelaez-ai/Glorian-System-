/**
 * SPEC-234 / CHANGE-119 — Layer-0 Jarvis Autonomous SDLC Orchestrator Core.
 * Deterministic state machine for enterprise DNA assimilation, ticket-to-EARS/BDD
 * mission initiation, bounded FDIR self-healing, Backstage Soundcheck synthesis,
 * and unified IDE autopilot rule compilation.
 *
 * Zero external runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AssimilateCompanyDnaOptions,
  CompanyDnaProfile,
  CompanyPresetId,
  CompileAutopilotRulesOptions,
  FeatureFlagGuardContract,
  IdeAutopilotRulesPackage,
  JarvisFailureCategory,
  JarvisHealDiagnosis,
  JarvisMissionState,
  JarvisSdlcDirective,
  JarvisValidationInput,
  SdlcExecutionTrack,
  SoundcheckEvaluation,
} from "./eosJarvisSdlcOrchestratorCore.types.ts";

const MAX_TICKET_ID_CHARS = 64;
const MAX_TICKET_TITLE_CHARS = 240;
const MAX_TICKET_DESC_CHARS = 8192;
const DEFAULT_MAX_HEAL_ATTEMPTS = 3;
const MAX_ALLOWED_HEAL_ATTEMPTS = 10;

interface PresetTemplate {
  readonly companyName: string;
  readonly squadOwner: string;
  readonly tribe: string;
  readonly gitStrategy: string;
  readonly maxBranchLifetimeHours: number;
  readonly featureFlagStrategy: string;
  readonly testingModel: string;
  readonly minCoveragePercent: number;
  readonly supportedStacks: readonly string[];
  readonly backstageEnabled: boolean;
}

const COMPANY_DNA_PRESETS: Readonly<Record<CompanyPresetId, PresetTemplate>> = {
  spotify: {
    companyName: "Spotify Engineering",
    squadOwner: "music-expression-squad",
    tribe: "music-expression",
    gitStrategy: "TRUNK_BASED_DEVELOPMENT",
    maxBranchLifetimeHours: 24,
    featureFlagStrategy: "CONFIDENCE_DARK_LAUNCH",
    testingModel: "TESTING_HONEYCOMB",
    minCoveragePercent: 85,
    supportedStacks: ["typescript", "react", "java", "python", "go"],
    backstageEnabled: true,
  },
  nubank: {
    companyName: "Nubank Engineering",
    squadOwner: "core-banking-squad",
    tribe: "platform-foundation",
    gitStrategy: "TRUNK_BASED_DEVELOPMENT",
    maxBranchLifetimeHours: 24,
    featureFlagStrategy: "PROGRESSIVE_ROLLOUT_CANARY",
    testingModel: "CONTRACT_AND_INTEGRATION_PYRAMID",
    minCoveragePercent: 90,
    supportedStacks: ["clojure", "go", "rust", "typescript", "dart"],
    backstageEnabled: true,
  },
  google: {
    companyName: "Google Engineering",
    squadOwner: "eng-productivity-team",
    tribe: "core-systems",
    gitStrategy: "TRUNK_BASED_DEVELOPMENT",
    maxBranchLifetimeHours: 24,
    featureFlagStrategy: "MENDEL_FLAG_GATED",
    testingModel: "HERMETIC_TESTING_PYRAMID",
    minCoveragePercent: 85,
    supportedStacks: ["cpp", "go", "java", "python", "typescript"],
    backstageEnabled: false,
  },
  "generic-enterprise": {
    companyName: "Enterprise Engineering",
    squadOwner: "platform-core-squad",
    tribe: "digital-platform",
    gitStrategy: "SHORT_LIVED_FEATURE_BRANCHES",
    maxBranchLifetimeHours: 48,
    featureFlagStrategy: "DARK_LAUNCH_FEATURE_FLAGS",
    testingModel: "TESTING_HONEYCOMB",
    minCoveragePercent: 85,
    supportedStacks: ["typescript", "node", "python", "go", "java"],
    backstageEnabled: true,
  },
};

const HEXAGONAL_LAYER_RULES: readonly string[] = [
  "Domain must remain 100% pure with zero Infrastructure or Presentation imports.",
  "Application use cases orchestrate Domain models exclusively through Port interfaces.",
  "Infrastructure Adapters implement Domain Ports and validate all external payloads.",
  "Layer-0 core modules enforce zero third-party runtime dependencies (dependencies: {}).",
];

const REMEDIATION_RECIPES: Readonly<Record<JarvisFailureCategory, string>> = {
  UNIT_AND_INTEGRATION_TESTS_FAILED: "Inspect failing assertions and repair domain/integration invariants.",
  BEYONCE_COVERAGE_BELOW_THRESHOLD: "Add behavioral BDD/Honeycomb tests for uncovered branches (Beyonce Rule).",
  HEXAGONAL_BOUNDARY_VIOLATION: "Decouple Domain imports from Infrastructure/Presentation behind abstract Ports.",
  PLAIN_SECRET_EXPOSURE: "Purge hardcoded credentials and replace with opaque secret handles or env bindings.",
  LAYER0_RUNTIME_DEPENDENCY_VIOLATION: "Remove third-party runtime packages and use Node.js built-in modules.",
  STATIC_LINT_OR_TYPE_VIOLATION: "Resolve all TypeScript strict-mode and ESLint diagnostics with zero warnings.",
};

const HEAVY_TRACK_KEYWORDS: readonly string[] = [
  "microservice",
  "migration",
  "security",
  "schema",
  "architecture",
  "oauth",
  "billing",
  "database",
  "compliance",
  "kafka",
  "backstage",
  "audio",
  "dsp",
];

function sha256Hex(payload: string): string {
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function slugify(value: string, maxLength: number): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "task").slice(0, maxLength).replace(/-+$/g, "") || "task";
}

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const rel = path.relative(rootPath, candidatePath);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function resolveNearestExistingRealPath(targetPath: string): string {
  let cursor = path.resolve(targetPath);
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return fs.realpathSync(cursor);
}

function assertConfinedPath(projectRoot: string, targetPath: string): string {
  const resolvedRoot = fs.realpathSync(path.resolve(projectRoot));
  const candidate = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(resolvedRoot, targetPath);
  if (!isWithinRoot(resolvedRoot, candidate)) {
    throw new Error(`Path traversal rejected: target escapes projectRoot (${targetPath}).`);
  }
  const existingAncestor = resolveNearestExistingRealPath(candidate);
  if (!isWithinRoot(resolvedRoot, existingAncestor)) {
    throw new Error(`Symlink traversal rejected: resolved path escapes projectRoot (${targetPath}).`);
  }
  return candidate;
}

function assertBoundedString(value: unknown, fieldName: string, maxChars: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxChars) {
    throw new RangeError(`${fieldName} must be between 1 and ${maxChars} characters.`);
  }
  return trimmed;
}

function resolveMaxHealAttempts(rawAttempts?: number): number {
  if (rawAttempts === undefined) return DEFAULT_MAX_HEAL_ATTEMPTS;
  if (!Number.isInteger(rawAttempts) || rawAttempts < 1 || rawAttempts > MAX_ALLOWED_HEAL_ATTEMPTS) {
    throw new RangeError(`maxHealAttempts must be an integer between 1 and ${MAX_ALLOWED_HEAL_ATTEMPTS}.`);
  }
  return rawAttempts;
}

function detectRepoSignals(repoDir: string): string[] {
  const signalFiles = ["catalog-info.yaml", "package.json", "go.mod", "pom.xml", "pyproject.toml", "Cargo.toml"];
  const found: string[] = [];
  for (const name of signalFiles) {
    if (fs.existsSync(path.join(repoDir, name))) {
      found.push(name);
    }
  }
  return found;
}

function classifyTrack(directive: JarvisSdlcDirective): SdlcExecutionTrack {
  if (directive.track === "FAST_TRACK_TDD" || directive.track === "HEAVY_TRACK_SDD") {
    return directive.track;
  }
  const combined = `${directive.ticketTitle} ${directive.ticketDescription}`.toLowerCase();
  const hasArchitecturalSignal = HEAVY_TRACK_KEYWORDS.some((kw) => combined.includes(kw));
  return hasArchitecturalSignal || directive.ticketDescription.length > 220 ? "HEAVY_TRACK_SDD" : "FAST_TRACK_TDD";
}

function buildFeatureFlagGuard(directive: JarvisSdlcDirective, dna: CompanyDnaProfile): FeatureFlagGuardContract {
  const rawKey = directive.featureFlagKey?.trim();
  const flagKey = rawKey
    ? slugify(rawKey, 48).replace(/-/g, "_")
    : `ff_${slugify(directive.ticketId, 24).replace(/-/g, "_")}_${slugify(directive.ticketTitle, 24).replace(/-/g, "_")}`;
  const rolloutStage = dna.preset === "spotify" ? "CANARY_1_PERCENT" : "DARK_LAUNCH_0_PERCENT";
  return {
    flagKey,
    strategy: dna.featureFlagStrategy,
    defaultEnabled: false,
    rolloutStage,
  };
}

function buildEarsRequirements(
  directive: JarvisSdlcDirective,
  guard: FeatureFlagGuardContract,
  dna: CompanyDnaProfile,
): string[] {
  const cleanTitle = directive.ticketTitle.replace(/[\r\n]+/g, " ");
  return [
    `WHEN ${directive.ticketId} (${cleanTitle}) is triggered with valid bounded input, THE SYSTEM SHALL execute the domain behavior under feature flag "${guard.flagKey}" without breaking existing contracts.`,
    `WHILE feature flag "${guard.flagKey}" is disabled, THE SYSTEM SHALL preserve zero user-facing side effects across stable production paths.`,
    `IF invalid parameters, plain secrets, or cross-layer imports are detected, THEN THE SYSTEM SHALL fail closed and preserve ${dna.companyName} invariants.`,
  ];
}

function buildBddScenarios(directive: JarvisSdlcDirective, guard: FeatureFlagGuardContract): string[] {
  return [
    `SCENARIO: ${directive.ticketId} happy-path behind dark-launch flag ${guard.flagKey} | GIVEN flag ${guard.flagKey} enabled in sandbox WHEN executing ${directive.ticketTitle} THEN tests and contracts pass 100%`,
    `SCENARIO: ${directive.ticketId} zero-regression when flag disabled | GIVEN flag ${guard.flagKey} disabled WHEN traffic hits trunk THEN legacy behavior stays unchanged`,
    `SCENARIO: ${directive.ticketId} fail-closed boundary guard | GIVEN malformed input or secret leak WHEN validation runs THEN system rejects mutation cleanly`,
  ];
}

function validateMetricsInput(validation: JarvisValidationInput): void {
  if (!Number.isInteger(validation.totalTests) || validation.totalTests < 1) {
    throw new RangeError("totalTests must be a positive integer.");
  }
  if (
    !Number.isInteger(validation.testsPassed) ||
    validation.testsPassed < 0 ||
    validation.testsPassed > validation.totalTests
  ) {
    throw new RangeError("testsPassed must be an integer between 0 and totalTests.");
  }
  if (
    !Number.isFinite(validation.coveragePercent) ||
    validation.coveragePercent < 0 ||
    validation.coveragePercent > 100
  ) {
    throw new RangeError("coveragePercent must be a finite number between 0 and 100.");
  }
  if (!Number.isInteger(validation.plainSecretsCount) || validation.plainSecretsCount < 0) {
    throw new RangeError("plainSecretsCount must be a non-negative integer.");
  }
  if (!Number.isInteger(validation.runtimeDependenciesCount) || validation.runtimeDependenciesCount < 0) {
    throw new RangeError("runtimeDependenciesCount must be a non-negative integer.");
  }
  if (!Number.isInteger(validation.lintErrorsCount) || validation.lintErrorsCount < 0) {
    throw new RangeError("lintErrorsCount must be a non-negative integer.");
  }
}

function collectFailureCategories(
  validation: JarvisValidationInput,
  minCoveragePercent: number,
): JarvisFailureCategory[] {
  const failures: JarvisFailureCategory[] = [];
  if (validation.testsPassed < validation.totalTests) failures.push("UNIT_AND_INTEGRATION_TESTS_FAILED");
  if (validation.coveragePercent < minCoveragePercent) failures.push("BEYONCE_COVERAGE_BELOW_THRESHOLD");
  if (validation.domainImportsInfrastructure) failures.push("HEXAGONAL_BOUNDARY_VIOLATION");
  if (validation.plainSecretsCount > 0) failures.push("PLAIN_SECRET_EXPOSURE");
  if (validation.runtimeDependenciesCount > 0) failures.push("LAYER0_RUNTIME_DEPENDENCY_VIOLATION");
  if (validation.lintErrorsCount > 0) failures.push("STATIC_LINT_OR_TYPE_VIOLATION");
  return failures;
}

function buildHealDiagnosis(
  failures: readonly JarvisFailureCategory[],
  attempt: number,
  maxAttempts: number,
  errorLog?: string,
): JarvisHealDiagnosis {
  const canRetry = attempt < maxAttempts;
  const steps = failures.map((cat) => REMEDIATION_RECIPES[cat]);
  const baseSummary = `Detected ${failures.length} gate violation(s) on verification attempt ${attempt}/${maxAttempts}: ${failures.join(", ")}.`;
  const rootCauseSummary = errorLog?.trim() ? `${baseSummary} Detail: ${errorLog.trim().slice(0, 240)}` : baseSummary;
  return {
    attempt,
    maxAttempts,
    failureCategories: failures,
    rootCauseSummary,
    surgicalRemediationSteps: steps,
    canRetry,
  };
}

function buildBackstageCatalogYaml(state: JarvisMissionState, score: number, attestationDigest: string): string {
  const componentName = `glorian-${slugify(state.directive.ticketId, 32)}`;
  return [
    "apiVersion: backstage.io/v1alpha1",
    "kind: Component",
    "metadata:",
    `  name: ${componentName}`,
    "  annotations:",
    `    eos.glorian.io/spec-id: "SPEC-234"`,
    `    eos.glorian.io/ticket-id: "${state.directive.ticketId}"`,
    `    eos.glorian.io/feature-flag: "${state.featureFlagGuard.flagKey}"`,
    `    eos.glorian.io/attestation-sha256: "${attestationDigest}"`,
    `    spotify.com/soundcheck-score: "${score}"`,
    "spec:",
    "  type: service",
    "  lifecycle: production",
    `  owner: ${state.companyDna.squadOwner}`,
    `  system: ${state.companyDna.tribe}`,
  ].join("\n");
}

function evaluateSoundcheck(state: JarvisMissionState, validation: JarvisValidationInput): SoundcheckEvaluation {
  const hexagonalIsolationVerified = !validation.domainImportsInfrastructure;
  const zeroPlainSecretsVerified = validation.plainSecretsCount === 0;
  const slsaLayer0Verified = validation.runtimeDependenciesCount === 0;
  const beyonceCoverageVerified =
    validation.coveragePercent >= state.companyDna.minCoveragePercent &&
    validation.testsPassed === validation.totalTests &&
    validation.lintErrorsCount === 0;

  const score =
    (hexagonalIsolationVerified ? 25 : 0) +
    (zeroPlainSecretsVerified ? 25 : 0) +
    (slsaLayer0Verified ? 25 : 0) +
    (beyonceCoverageVerified ? 25 : 0);
  const passed = score === 100;
  const attestationDigestSha256 = sha256Hex(
    `${state.missionId}:${state.workflowId}:${score}:${passed}:${validation.coveragePercent}`,
  );
  const backstageCatalogYaml = buildBackstageCatalogYaml(state, score, attestationDigestSha256);

  return {
    passed,
    score,
    hexagonalIsolationVerified,
    zeroPlainSecretsVerified,
    slsaLayer0Verified,
    beyonceCoverageVerified,
    backstageCatalogYaml,
    attestationDigestSha256,
  };
}

function buildApprovedPrDraft(
  state: JarvisMissionState,
  validation: JarvisValidationInput,
  soundcheck: SoundcheckEvaluation,
  approvalDiffSha256: string,
): { readonly bullets: readonly string[]; readonly markdown: string } {
  const bullets: readonly string[] = [
    `Implemented ${state.directive.ticketId} (${state.directive.ticketTitle}) under ${state.track} behind dark-launch flag "${state.featureFlagGuard.flagKey}".`,
    `Verified ${validation.testsPassed}/${validation.totalTests} tests (${validation.coveragePercent}% coverage), 0 secrets, and clean Hexagonal Layer-0 isolation.`,
    `Earned ${soundcheck.score}/100 Fleet Soundcheck and Backstage catalog readiness; apply with: node bin/eos.mjs flow apply . ${state.workflowId} --confirm-diff=${approvalDiffSha256}`,
  ];
  const markdown = [
    `## PR Summary: ${state.directive.ticketId} — ${state.directive.ticketTitle}`,
    "",
    `- **Company DNA**: ${state.companyDna.companyName} (${state.companyDna.squadOwner} / ${state.companyDna.tribe})`,
    `- **Branch & Worktree**: \`${state.branchName}\` in \`${state.worktreePath}\``,
    `- **Feature Flag Guard**: \`${state.featureFlagGuard.flagKey}\` (${state.featureFlagGuard.rolloutStage})`,
    `- **Fleet Soundcheck**: ${soundcheck.score}/100 (PASS)`,
    `- **Approval Command**: \`node bin/eos.mjs flow apply . ${state.workflowId} --confirm-diff=${approvalDiffSha256}\``,
  ].join("\n");
  return { bullets, markdown };
}

function renderAutopilotMarkdown(dna: CompanyDnaProfile): string {
  return [
    "# JARVIS SDLC AUTOPILOT PROTOCOL (SPEC-234)",
    "",
    `Active Enterprise DNA: **${dna.companyName}** (\`${dna.preset}\`)`,
    `Squad: \`${dna.squadOwner}\` | Tribe: \`${dna.tribe}\` | Git: \`${dna.gitStrategy}\` (<=${dna.maxBranchLifetimeHours}h)`,
    `Testing Model: \`${dna.testingModel}\` (Beyonce Rule >= ${dna.minCoveragePercent}% coverage)`,
    `Feature Flag Policy: \`${dna.featureFlagStrategy}\``,
    "",
    "## Mandatory Execution Sequence",
    "1. **Assimilate & Specify (Law I/II)**: Translate ticket into EARS requirements and Gherkin BDD scenarios before editing code.",
    "2. **Isolate in Worktree**: Operate strictly inside the isolated worktree branch behind a dark-launch feature flag.",
    "3. **Enforce Hexagonal Layer-0 Purity (Law V/VI)**: Zero plain secrets, zero runtime npm dependencies (`dependencies: {}`), and Domain isolated from Infrastructure.",
    "4. **Bounded FDIR Self-Healing**: Run tests and static gates; diagnose and repair up to `maxAttempts` (default 3) before escalating.",
    "5. **Executive Handoff**: Present a 3-bullet summary, Backstage `catalog-info.yaml` Soundcheck score, and `--confirm-diff=<sha256>` command.",
    "",
  ].join("\n");
}

export class EosJarvisSdlcOrchestratorCore {
  /**
   * Assimilates organizational engineering rules (Spotify, Nubank, Google, or generic enterprise)
   * and optionally inspects local repository manifests within confined bounds.
   */
  public static assimilateCompanyDna(options: AssimilateCompanyDnaOptions = {}): CompanyDnaProfile {
    const preset: CompanyPresetId = options.preset ?? "spotify";
    if (!Object.hasOwn(COMPANY_DNA_PRESETS, preset)) {
      throw new TypeError(`Unsupported company preset "${String(preset)}".`);
    }

    const template = COMPANY_DNA_PRESETS[preset];
    const companyName = options.companyName?.trim() || template.companyName;
    const squadOwner = options.squadOwner?.trim() || template.squadOwner;
    const tribe = options.tribe?.trim() || template.tribe;

    let detectedRepoSignals: string[] = [];
    if (options.repoPath) {
      const rootBoundary = options.projectRoot ?? options.repoPath;
      const confinedRepo = assertConfinedPath(rootBoundary, options.repoPath);
      if (fs.existsSync(confinedRepo) && fs.statSync(confinedRepo).isDirectory()) {
        detectedRepoSignals = detectRepoSignals(confinedRepo);
      }
    }

    const corePayload = {
      preset,
      companyName,
      squadOwner,
      tribe,
      gitStrategy: template.gitStrategy,
      maxBranchLifetimeHours: template.maxBranchLifetimeHours,
      featureFlagStrategy: template.featureFlagStrategy,
      testingModel: template.testingModel,
      minCoveragePercent: template.minCoveragePercent,
      supportedStacks: template.supportedStacks,
      detectedRepoSignals,
      hexagonalLayerRules: HEXAGONAL_LAYER_RULES,
      backstageEnabled: template.backstageEnabled,
    };

    return {
      ...corePayload,
      dnaDigestSha256: sha256Hex(JSON.stringify(corePayload)),
    };
  }

  /**
   * Initiates a deterministic Jarvis SDLC mission from a ticket directive.
   */
  public static initiateMission(directive: JarvisSdlcDirective): JarvisMissionState {
    const ticketId = assertBoundedString(directive.ticketId, "ticketId", MAX_TICKET_ID_CHARS);
    const ticketTitle = assertBoundedString(directive.ticketTitle, "ticketTitle", MAX_TICKET_TITLE_CHARS);
    const ticketDescription = assertBoundedString(
      directive.ticketDescription,
      "ticketDescription",
      MAX_TICKET_DESC_CHARS,
    );
    const maxAttempts = resolveMaxHealAttempts(directive.maxHealAttempts);

    const normalizedDirective: JarvisSdlcDirective = {
      ...directive,
      ticketId,
      ticketTitle,
      ticketDescription,
      maxHealAttempts: maxAttempts,
    };

    const companyDna = this.assimilateCompanyDna({
      preset: directive.companyPreset ?? "spotify",
      squadOwner: directive.squadOwner,
      tribe: directive.tribe,
    });

    const track = classifyTrack(normalizedDirective);
    const seedHex = sha256Hex(`${ticketId}:${ticketTitle}:${companyDna.preset}:${track}`);
    const missionId = `jarvis-${slugify(ticketId, 16)}-${seedHex.slice(0, 8)}`;
    const workflowId = `flow-${seedHex.slice(0, 8)}-${seedHex.slice(8, 12)}-${seedHex.slice(12, 16)}`;
    const branchName = `feat/${slugify(ticketId, 16)}-${slugify(ticketTitle, 28)}`;
    const worktreePath = `.worktrees/${workflowId}`;

    const featureFlagGuard = buildFeatureFlagGuard(normalizedDirective, companyDna);
    const earsRequirements = buildEarsRequirements(normalizedDirective, featureFlagGuard, companyDna);
    const bddScenarios = buildBddScenarios(normalizedDirective, featureFlagGuard);
    const impactedLayers = ["Domain", "Application", "Ports & Adapters", "Tests (Honeycomb)"];

    const executiveSummaryBullets = [
      `Assimilated ${companyDna.companyName} DNA (${companyDna.gitStrategy}, ${companyDna.testingModel}) for ${ticketId}.`,
      `Classified track ${track} with dark-launch flag "${featureFlagGuard.flagKey}" on branch "${branchName}".`,
      `Synthesized ${earsRequirements.length} EARS requirements and ${bddScenarios.length} BDD scenarios inside "${worktreePath}".`,
    ];

    const prMarkdownDraft = [
      `## Draft PR: ${ticketId} — ${ticketTitle}`,
      "",
      `- **Track**: ${track}`,
      `- **Worktree**: \`${worktreePath}\``,
      `- **Feature Flag**: \`${featureFlagGuard.flagKey}\``,
      `- **Status**: AWAITING_IMPLEMENTATION`,
    ].join("\n");

    const receiptSha256 = sha256Hex(
      JSON.stringify({ missionId, workflowId, ticketId, companyDigest: companyDna.dnaDigestSha256, track }),
    );

    return {
      missionId,
      workflowId,
      status: "AWAITING_IMPLEMENTATION",
      directive: normalizedDirective,
      companyDna,
      track,
      branchName,
      worktreePath,
      featureFlagGuard,
      earsRequirements,
      bddScenarios,
      impactedLayers,
      attempt: 0,
      maxAttempts,
      executiveSummaryBullets,
      prMarkdownDraft,
      receiptSha256,
    };
  }

  /**
   * Executes verification gates and bounded FDIR self-healing diagnostics on a mission.
   */
  public static verifyAndHealMission(state: JarvisMissionState, validation: JarvisValidationInput): JarvisMissionState {
    if (!state || typeof state.missionId !== "string" || !state.companyDna) {
      throw new TypeError("Valid JarvisMissionState is required.");
    }
    validateMetricsInput(validation);

    const nextAttempt = state.attempt + 1;
    const failures = collectFailureCategories(validation, state.companyDna.minCoveragePercent);

    if (failures.length > 0) {
      const diagnosis = buildHealDiagnosis(failures, nextAttempt, state.maxAttempts, validation.errorLog);
      const nextStatus = diagnosis.canRetry ? "HEALING" : "FAILED";
      const summaryBullets = [
        `${state.directive.ticketId} failed ${failures.length} verification gate(s) on attempt ${nextAttempt}/${state.maxAttempts}.`,
        `Categories: ${failures.join(", ")}.`,
        diagnosis.canRetry
          ? `FDIR healing triggered; apply surgical fixes and re-verify.`
          : `Max heal attempts reached; mission escalated fail-closed to human architect.`,
      ];
      return {
        ...state,
        status: nextStatus,
        attempt: nextAttempt,
        lastDiagnosis: diagnosis,
        soundcheck: undefined,
        approvalDiffSha256: undefined,
        executiveSummaryBullets: summaryBullets,
        receiptSha256: sha256Hex(`${state.receiptSha256}:${nextAttempt}:${nextStatus}:${failures.join("|")}`),
      };
    }

    const soundcheck = evaluateSoundcheck(state, validation);
    const approvalDiffSha256 = sha256Hex(
      `${state.missionId}:${state.workflowId}:${nextAttempt}:${soundcheck.attestationDigestSha256}`,
    );
    const approved = buildApprovedPrDraft(state, validation, soundcheck, approvalDiffSha256);

    return {
      ...state,
      status: "READY_FOR_APPROVAL",
      attempt: nextAttempt,
      lastDiagnosis: undefined,
      soundcheck,
      approvalDiffSha256,
      executiveSummaryBullets: approved.bullets,
      prMarkdownDraft: approved.markdown,
      receiptSha256: sha256Hex(`${state.receiptSha256}:${nextAttempt}:READY_FOR_APPROVAL:${approvalDiffSha256}`),
    };
  }

  /**
   * Compiles unified IDE autopilot rules (.eos/rules/jarvis-autopilot.md) with strict path confinement.
   */
  public static compileAutopilotRulesPackage(options: CompileAutopilotRulesOptions = {}): IdeAutopilotRulesPackage {
    const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    const relRulePath = options.outputRelPath?.trim() || path.join(".eos", "rules", "jarvis-autopilot.md");
    const resolvedRulePath = assertConfinedPath(projectRoot, relRulePath);
    const normalizedRelPath = path.relative(fs.realpathSync(projectRoot), resolvedRulePath).replace(/\\/g, "/");

    const dna = this.assimilateCompanyDna({
      preset: options.companyPreset ?? "spotify",
      squadOwner: options.squadOwner,
      tribe: options.tribe,
    });

    const markdownContent = renderAutopilotMarkdown(dna);
    let writtenToDisk = false;
    if (options.writeToDisk === true) {
      fs.mkdirSync(path.dirname(resolvedRulePath), { recursive: true });
      fs.writeFileSync(resolvedRulePath, markdownContent, "utf8");
      writtenToDisk = true;
    }

    return {
      canonicalRulePath: normalizedRelPath,
      markdownContent,
      targetIdeBindings: [
        "Cursor (.cursor/rules)",
        "Antigravity (AGENTS.md)",
        "Claude Code (CLAUDE.md)",
        "Kiro (.kiro/steering)",
      ],
      writtenToDisk,
      rulesDigestSha256: sha256Hex(markdownContent),
    };
  }
}
