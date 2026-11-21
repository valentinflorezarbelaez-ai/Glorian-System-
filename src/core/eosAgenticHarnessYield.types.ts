/**
 * Glorian System — Agentic Harness Engineering, First-Pass PR Yield &
 * Token Rework Telemetry Engine (SPEC-339 / CHANGE-201)
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type HarnessErrorCode =
  "HARNESS_INVALID_PARAMETERS" | "HARNESS_SPEC_INCOMPLETE" | "HARNESS_MAX_RETRIES_EXCEEDED";

export type HarnessStageName = "TYPECHECK" | "LINT_FORMAT" | "UNIT_BDD" | "FORMAL_TLC" | "SECURITY_HYGIENE";

export interface SpecReadinessInput {
  taskId?: string;
  earsRequirements: number;
  bddScenarios: number;
  adrCount: number;
  hasFormalTlaModel: boolean;
  ambiguityScore: number;
}

export interface SpecReadinessReport {
  taskId: string;
  readinessScore: number;
  earsRequirements: number;
  bddScenarios: number;
  adrCount: number;
  hasFormalTlaModel: boolean;
  ambiguityScore: number;
  missingCriteria: string[];
  approved: boolean;
}

export interface HarnessStageAttempt {
  stage: HarnessStageName;
  attempt: number;
  passed: boolean;
  tokensConsumed: number;
  reworkTokens: number;
  durationMs: number;
}

export interface HarnessExecutionConfig {
  spec: SpecReadinessInput;
  maxRetries?: number;
  stageFailures?: Partial<Record<HarnessStageName, number>>;
  tokenCostPer1kUsd?: number;
  firstPassStageTokens?: Partial<Record<HarnessStageName, number>>;
  repairTokensPerRetry?: number;
}

export interface HarnessExecutionResult {
  taskId: string;
  specReport: SpecReadinessReport;
  stagesExecuted: HarnessStageName[];
  attempts: HarnessStageAttempt[];
  firstPassSuccess: boolean;
  totalRetries: number;
  firstPassTokens: number;
  reworkTokens: number;
  totalTokens: number;
  reworkAmplificationFactor: number;
  estimatedCostUsd: number;
  prReady: boolean;
}

export interface PrTelemetryRecord {
  prId: string;
  methodology: "SDD_HARNESS" | "VIBE_CODING";
  firstPassSuccess: boolean;
  retries: number;
  firstPassTokens: number;
  reworkTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface CohortTelemetrySummary {
  cohortSize: number;
  firstPassCount: number;
  firstPassYieldRatio: number;
  meanReworkAmplificationFactor: number;
  totalTokens: number;
  firstPassTokens: number;
  wastedReworkTokens: number;
  totalCostUsd: number;
  meanCostPerMergedPrUsd: number;
}

export interface CohortBenchmarkReport {
  sddCohort: CohortTelemetrySummary;
  vibeCohort: CohortTelemetrySummary;
  yieldUpliftRatio: number;
  rafReductionRatio: number;
  tokenSavingsRatio: number;
  costSavingsUsd: number;
}

export type StoryTargetLayer = "BACKEND" | "FRONTEND" | "DATABASE";

export type PlaywrightQaScenarioCategory = "HAPPY_PATH" | "BOUNDARY" | "NEGATIVE" | "BUSINESS_RULE";

export interface PlaywrightQaScenarioItem {
  id: string;
  category: PlaywrightQaScenarioCategory;
  title: string;
  assertion: string;
}

export interface UserStoryEnrichmentInput {
  ticketId: string;
  title: string;
  rawStory: string;
  affectedLayers?: ReadonlyArray<StoryTargetLayer>;
  alreadyEnriched?: boolean;
  forceReEnrich?: boolean;
}

export interface UserStoryEnrichmentReport {
  ticketId: string;
  status: "ENRICHED" | "SKIPPED_ALREADY_ENRICHED" | "BLOCKED_ON_CLARIFICATIONS";
  decisionsClosed: boolean;
  forbiddenHedgesFound: string[];
  compoundCriteriaFound: string[];
  blockingQuestions: string[];
  affectedLayers: StoryTargetLayer[];
  originalSection: string;
  enhancedSection: string;
  playwrightQaCatalog: PlaywrightQaScenarioItem[];
  mandatoryVerificationSteps: string[];
  targetJiraStatus: "Pending refinement validation" | "To refine" | "Unchanged";
}

export type MultiAgentRoleName = "REFINER" | "ARCHITECT_PLANNER" | "IMPLEMENTER" | "INDEPENDENT_REVIEWER";

export interface MultiAgentRoleAllocation {
  role: MultiAgentRoleName;
  modelTier: "FRONTIER_HIGH_REASONING" | "FAST_EXECUTION";
  tokensConsumed: number;
  costUsd: number;
}

export interface SmartSpecPipelineInput {
  taskId?: string;
  architectureDocLines: number;
  rawRepoExplorationTokens?: number;
  frontierCostPer1kUsd?: number;
  cheapExecutionCostPer1kUsd?: number;
}

export interface SmartSpecPipelineReport {
  taskId: string;
  architectureMemoryCompliant: boolean;
  architectureDocLines: number;
  maxArchitectureDocLines: number;
  roles: MultiAgentRoleAllocation[];
  smartSpecTotalTokens: number;
  monolithicExplorationTokens: number;
  smartSpecCostUsd: number;
  monolithicFrontierCostUsd: number;
  costSavingsUsd: number;
  costSavingsRatio: number;
  tokenSavingsRatio: number;
}

export type RtkCommandType = "test" | "git" | "grep";

export interface RtkCompressionInput {
  commandType: RtkCommandType;
  rawOutput: string;
}

export interface RtkCompressionReport {
  commandType: RtkCommandType;
  rawChars: number;
  compressedChars: number;
  rawTokensEstimate: number;
  compressedTokensEstimate: number;
  savingsRatio: number;
  savingsPercent: number;
  targetBandMet: boolean;
  preservedSignals: string[];
  compressedOutput: string;
}

export interface AgenticHarnessAuditReceipt {
  specRef: "SPEC-339";
  specGateEnforced: boolean;
  harnessLoopConverged: boolean;
  retryCeilingEnforced: boolean;
  firstPassYieldComputed: boolean;
  sddOutperformsVibe: boolean;
  storyEnrichmentVerified: boolean;
  smartSpecMultiAgentVerified: boolean;
  rtkTokenCompressionVerified: boolean;
  sddFirstPassYieldRatio: number;
  vibeFirstPassYieldRatio: number;
  tokenSavingsRatio: number;
  allPassed: boolean;
  sha256Digest: string;
}

export const MAX_ARCHITECTURE_SHARED_MEMORY_LINES = 200;

export const FORBIDDEN_SPEC_HEDGES: readonly string[] = [
  "si aplica",
  "si es necesario",
  "if applicable",
  "if needed",
  "maybe",
  "quizás",
  "o similar",
  "etc.",
];

export const CRITICAL_RTK_PATTERNS = [
  /FAIL/i,
  /ERROR/i,
  /✖/,
  /AssertionError/,
  /fatal:/i,
  /modified:/,
  /ℹ/,
  /\bPASS\b/,
  /^===/,
  /^---/,
];

export const ROUTINE_RTK_PATTERNS = [/^\s*✔/, /^\s*ok\b/i, /\(unchanged\)/, /^\s*at node:internal/];

export function isStoryAlreadyEnriched(input: UserStoryEnrichmentInput): boolean {
  if (input.alreadyEnriched === true) return true;
  const hasJiraSections = input.rawStory.includes("[original]") && input.rawStory.includes("[enhanced]");
  const hasMarkdownHeadings = input.rawStory.includes("## Original") && input.rawStory.includes("## Enhanced");
  return hasJiraSections || hasMarkdownHeadings;
}

export function detectStoryAmbiguities(rawStory: string): {
  hedges: string[];
  compounds: string[];
  questions: string[];
} {
  const lower = rawStory.toLowerCase();
  const hedges = FORBIDDEN_SPEC_HEDGES.filter((term) => lower.includes(term));
  const compounds = rawStory
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => /\b(y además|y ademas|and also|así como|asi como|and additionally)\b/i.test(s));
  const questions = [
    ...hedges.map((h) => `Resolve ambiguous hedge "${h}" with an explicit deterministic rule.`),
    ...compounds.map((c) => `Split compound criterion into single-sentence atomic tasks: "${c.slice(0, 72)}"`),
  ];
  return { hedges, compounds, questions };
}

export function buildPlaywrightCatalog(
  ticketId: string,
  title: string,
  hasFrontend: boolean,
): PlaywrightQaScenarioItem[] {
  if (!hasFrontend) return [];
  return [
    {
      id: `${ticketId}-E2E-01`,
      category: "HAPPY_PATH",
      title: `${title}: primary flow succeeds`,
      assertion: "Visible confirmation rendered and persisted",
    },
    {
      id: `${ticketId}-E2E-02`,
      category: "BOUNDARY",
      title: `${title}: field length and min/max limits`,
      assertion: "Boundary inputs accepted or bounded accurately",
    },
    {
      id: `${ticketId}-E2E-03`,
      category: "NEGATIVE",
      title: `${title}: invalid payload and 4xx handling`,
      assertion: "Validation alert shown without crash",
    },
    {
      id: `${ticketId}-E2E-04`,
      category: "BUSINESS_RULE",
      title: `${title}: authz and state invariant check`,
      assertion: "Unauthorized mutations rejected cleanly",
    },
  ];
}

export function buildMandatorySteps(ticketId: string, hasFrontend: boolean): string[] {
  const steps = [
    `Step 0: Create feature branch feature/${ticketId.toLowerCase()}`,
    "Step N+1: Run unit tests with pre/post DB state baseline & restoration report",
    "Step N+2: Agent-executed manual curl endpoint verification (200/201/400/404) & DB cleanup",
  ];
  if (hasFrontend) steps.push("Step N+3: Agent-executed Playwright MCP E2E workflow verification");
  steps.push("Step N+4: Update technical documentation & archive delta specs");
  return steps;
}

export function stripAnsiControlCodes(text: string): string {
  const esc = String.fromCharCode(27);
  return text.replace(new RegExp(`${esc}\\[[0-9;]*m`, "g"), "");
}

export function isCriticalRtkLine(line: string): boolean {
  return CRITICAL_RTK_PATTERNS.some((re) => re.test(line)) || /\.(ts|mjs|js|py|go|rs):\d+/.test(line);
}

export function isRoutineRtkLine(line: string): boolean {
  return !line.trim() || ROUTINE_RTK_PATTERNS.some((re) => re.test(line));
}
