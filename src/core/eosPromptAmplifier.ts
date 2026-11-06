/**
 * EOS SYSTEM — PROMETHEUS PROMPT AMPLIFICATION ENGINE (Layer 0)
 * Governed by ADR-019, FR-024 & BDD-019
 *
 * Converts a prompt into an editable EARS/BDD-style draft and model-labelled
 * instructions. This deterministic helper does not verify requirements or call a model.
 *
 * Zero external runtime dependencies.
 */

export type ModelFamily = "grok" | "claude" | "openai" | "gemini" | "deepseek" | "llama" | "universal";

export type SovereignModelId = "grok" | "gemini" | "claude" | "gpt" | "deepseek";

export interface ModelRoutingProfile {
  readonly id: SovereignModelId;
  readonly provider: "xAI" | "Google" | "Anthropic" | "OpenAI" | "DeepSeek";
  readonly primaryRole: string;
  readonly finOpsTier: "ULTRA_LOW_COST" | "BALANCED_HIGH_CONTEXT" | "FRONTIER_SURGICAL";
  readonly systemConstraintInjection: string;
}

export const SOVEREIGN_FIVE_MATRIX: Readonly<Record<SovereignModelId, ModelRoutingProfile>> = Object.freeze({
  grok: {
    id: "grok",
    provider: "xAI",
    primaryRole: "Low-Level Systems, Reverse Engineering & Real-Time Telemetry",
    finOpsTier: "FRONTIER_SURGICAL",
    systemConstraintInjection: "ENFORCE: xAI Colossus grade concurrency, zero-copy memory layout, and brutal technical precision."
  },
  gemini: {
    id: "gemini",
    provider: "Google",
    primaryRole: "Full-Repo Semantic Graph Context & Antigravity Orchestration",
    finOpsTier: "BALANCED_HIGH_CONTEXT",
    systemConstraintInjection: "ENFORCE: Cross-repository Blast Radius (<150µs) awareness and Google Borg declarative reconciliation."
  },
  claude: {
    id: "claude",
    provider: "Anthropic",
    primaryRole: "AST Surgical Code Synthesis & Spotify Honk/Xirp Execution",
    finOpsTier: "FRONTIER_SURGICAL",
    systemConstraintInjection: "ENFORCE: Layer-0 Hexagonal purity, 0 runtime dependencies, and strict EARS/BDD test-first implementation."
  },
  gpt: {
    id: "gpt",
    provider: "OpenAI",
    primaryRole: "Constitutional Bayesian Judge & Formal Specification Verification",
    finOpsTier: "FRONTIER_SURGICAL",
    systemConstraintInjection: "ENFORCE: ISO 29148 EARS formalization, TLA+ safety/liveness invariants, and zero ambiguity."
  },
  deepseek: {
    id: "deepseek",
    provider: "DeepSeek",
    primaryRole: "FinOps Token Optimization, Algorithmic Complexity & Bulk Verification",
    finOpsTier: "ULTRA_LOW_COST",
    systemConstraintInjection: "ENFORCE: Minimum Big-O time/space complexity, deterministic mathematical proof, and token economy."
  }
});

/**
 * Automatically selects the optimal model from the Sovereign Five matrix based on prompt intent.
 */
export function selectOptimalSovereignModel(directive: string): ModelRoutingProfile {
  const d = directive.toLowerCase();
  if (d.includes("optimiz") || d.includes("math") || d.includes("cost") || d.includes("benchmark") || d.includes("finops")) {
    return SOVEREIGN_FIVE_MATRIX.deepseek;
  }
  if (d.includes("reverse") || d.includes("kernel") || d.includes("simd") || d.includes("rdma") || d.includes("concurrency")) {
    return SOVEREIGN_FIVE_MATRIX.grok;
  }
  if (d.includes("graph") || d.includes("blast") || d.includes("fleet") || d.includes("repo") || d.includes("antigravity")) {
    return SOVEREIGN_FIVE_MATRIX.gemini;
  }
  if (d.includes("judge") || d.includes("spec") || d.includes("ears") || d.includes("architecture") || d.includes("constitution")) {
    return SOVEREIGN_FIVE_MATRIX.gpt;
  }
  return SOVEREIGN_FIVE_MATRIX.claude;
}

export type StrictnessLevel = "standard" | "hardened" | "sovereign";

export type EarsType = "EVENT_DRIVEN" | "STATE_DRIVEN" | "UNWANTED_CONDITION" | "UBIQUITOUS";

export interface EarsRequirement {
  id: string;
  type: EarsType;
  syntax: string;
  description: string;
}

export interface BddScenario {
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
  and: string[];
}

export interface ModelReasoningScaffold {
  family: ModelFamily;
  thinkingStrategy: string;
  scaffoldingDirectives: string[];
  antiHallucinationRules: string[];
}

export interface AmplifiedPromptRequest {
  rawPrompt: string;
  targetModel?: ModelFamily;
  contextFiles?: string[];
  strictLevel?: StrictnessLevel;
  projectDomain?: string;
}

export interface AmplifiedPromptResult {
  originalPrompt: string;
  targetModel: ModelFamily;
  detectedDomain: string;
  identifiedIntent: string;
  earsRequirements: EarsRequirement[];
  bddScenarios: BddScenario[];
  invariants: string[];
  modelScaffold: ModelReasoningScaffold;
  synthesizedSystemPrompt: string;
  synthesizedUserPrompt: string;
  executionSteps: string[];
}

/**
 * Domain keywords for heuristic classification.
 */
const DOMAIN_HEURISTICS: Record<string, string[]> = {
  "SECURITY_GATE": ["auth", "token", "jwt", "secret", "owasp", "vulnerability", "password", "sanitize", "cve", "guard"],
  "DATA_PERSISTENCE": ["db", "database", "sql", "postgres", "migration", "schema", "table", "query", "orm", "index", "acid"],
  "API_INTEGRATION": ["api", "endpoint", "rest", "graphql", "http", "fetch", "mcp", "route", "handler", "serverless", "jsonrpc"],
  "PERFORMANCE_SYSTEM": ["cache", "speed", "nanosecond", "latency", "benchmark", "optimize", "memory", "l1", "soa", "simd", "inp", "cwv"],
  "ARCHITECTURE_REFACTOR": ["refactor", "hexagonal", "clean", "boundary", "decouple", "modular", "interface", "port", "adapter", "layer"],
  "TESTING_EVIDENCE": ["test", "coverage", "chaos", "fuzz", "unit", "e2e", "bdd", "assert", "mock", "evidence", "sarif"],
  "FRONTEND_INTERFACE": ["ui", "component", "css", "html", "wcag", "dialog", "button", "accessibility", "responsive", "theme"]
};

/**
 * Analyzes the raw prompt to extract its operational domain.
 */
export function detectDomain(prompt: string): string {
  const lower = prompt.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_HEURISTICS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return domain;
    }
  }
  return "GENERAL_SYSTEMS_ENGINEERING";
}

/**
 * Generates proposed EARS-style requirement text. A reviewer must check its assumptions.
 */
export function synthesizeEarsRequirements(prompt: string, domain: string): EarsRequirement[] {
  const reqs: EarsRequirement[] = [];
  const cleanPrompt = prompt.trim().replace(/\.+$/, "");

  // 1. Event-Driven requirement
  reqs.push({
    id: "EARS-001",
    type: "EVENT_DRIVEN",
    syntax: `WHEN the approved trigger for "${cleanPrompt}" occurs, THE SYSTEM SHALL perform the behavior defined by the reviewed ${domain} contract.`,
    description: "Governs positive action on user or system invocation."
  });

  // 2. Unwanted / Error Condition requirement
  reqs.push({
    id: "EARS-002",
    type: "UNWANTED_CONDITION",
    syntax: `IF an input or precondition for "${cleanPrompt}" is invalid, THEN THE SYSTEM SHALL reject it according to the reviewed error contract.`,
    description: "Governs error mitigation, boundary protection, and zero-panic recovery."
  });

  // 3. State-Driven requirement
  reqs.push({
    id: "EARS-003",
    type: "STATE_DRIVEN",
    syntax: `WHILE handling "${cleanPrompt}" in the ${domain} context, THE SYSTEM SHALL preserve the state and boundaries defined by the approved design.`,
    description: "Governs steady-state invariant preservation during active processing."
  });

  // 4. Ubiquitous requirement
  reqs.push({
    id: "EARS-004",
    type: "UBIQUITOUS",
    syntax: `THE SYSTEM SHALL apply the project's reviewed security and data-handling requirements to "${cleanPrompt}".`,
    description: "Permanent non-negotiable architectural invariant."
  });

  return reqs;
}

/**
 * Generates BDD GIVEN-WHEN-THEN acceptance criteria.
 */
export function synthesizeBddScenarios(prompt: string, domain: string): BddScenario[] {
  const clean = prompt.trim().replace(/\.+$/, "");
  return [
    {
      id: "BDD-001",
      title: `Nominal Execution of "${clean}"`,
      given: `the system is initialized in a clean epistemic state with all preconditions satisfied`,
      when: `the directive "${clean}" is invoked with inputs accepted by the reviewed contract`,
      then: `the operation returns the behavior and result defined by the approved requirements`,
      and: [
        `no architectural boundaries are breached`,
        `verification is reported only after the relevant checks have actually run`
      ]
    },
    {
      id: "BDD-002",
      title: `Fault Tolerance and Invalid Input Rejection in ${domain}`,
      given: `the execution environment receives an invalid or out-of-boundary parameter`,
      when: `the implementation validates the request`,
      then: `the response matches the reviewed error contract`,
      and: [
        `tests cover the expected state after rejection`,
        `diagnostics follow the format selected by the project`
      ]
    }
  ];
}

/**
 * Builds model-specific cognitive reasoning scaffolding.
 */
export function buildModelScaffold(family: ModelFamily, strictLevel: StrictnessLevel): ModelReasoningScaffold {
  const isSovereign = strictLevel === "sovereign";

  switch (family) {
    case "claude":
      return {
        family: "claude",
        thinkingStrategy: "Extended Multi-Perspective Thinking with Architectural Refinement",
        scaffoldingDirectives: [
          "Use deep internal thinking to survey the entire codebase structure before generating any modification.",
          "Cite exact clickable file:// paths and line ranges for all references.",
          "Formulate multiple candidate solutions, evaluate trade-offs, and reject inferior alternatives with explicit rationale.",
          "Ensure zero runtime external dependencies and preserve all existing comments and docstrings."
        ],
        antiHallucinationRules: [
          "Never assume a module or function exists; verify its declaration in the file tree first.",
          "Do not produce partial snippets or placeholders like '// rest of code'; provide drop-in complete blocks.",
          "Always verify syntax with `node --check` or equivalent static typecheck before claiming success."
        ]
      };

    case "openai":
      return {
        family: "openai",
        thinkingStrategy: "Rigorous Step-by-Step Chain-of-Thought with Invariant Verification",
        scaffoldingDirectives: [
          "Decompose the objective into an atomic directed acyclic graph (DAG) of verification steps.",
          "Validate all mathematical bounds, data structures, and edge-case invariants prior to synthesis.",
          "Ensure strict type contracts matching TypeScript strict mode with no implicit `any`."
        ],
        antiHallucinationRules: [
          "Verify all imports resolve against local source directories.",
          "Never emit synthetic API keys or placeholder tokens.",
          "Demand executable verification evidence (exit code 0) for every assertion."
        ]
      };

    case "gemini":
      return {
        family: "gemini",
        thinkingStrategy: "Multimodal Systematic Decomposition and High-Fidelity Synthesis",
        scaffoldingDirectives: [
          "Structure responses with crystal-clear markdown hierarchy, tables, and sequence diagrams where applicable.",
          "Prioritize high-performance, cache-friendly data structures and zero-overhead idioms.",
          "Verify conformance with official SDK specifications and avoid deprecated interfaces."
        ],
        antiHallucinationRules: [
          "Adhere strictly to verified facts in the project knowledge store.",
          "Never guess tool arguments; inspect MCP tool schemas before calling.",
          "Preserve Hexagonal isolation between presentation, application, and domain layers."
        ]
      };

    case "deepseek":
      return {
        family: "deepseek",
        thinkingStrategy: "Deep Mathematical Reasoning, Counter-Example Exploration & Formal Verification",
        scaffoldingDirectives: [
          "Conduct an adversarial counter-example analysis: prove why naive implementations will fail under edge cases.",
          "Verify time complexity O(N) and spatial footprint O(1) across all core algorithmic pathways.",
          "Enforce formal state machine invariants across all concurrent transitions."
        ],
        antiHallucinationRules: [
          "Reject informal vibe assumptions; test each hypothesis against formal logic.",
          "Confirm zero memory leaks in hot loops and buffer allocations."
        ]
      };

    case "grok":
      return {
        family: "grok",
        thinkingStrategy: "Low-Level Concurrency, SIMD/RDMA Systems, Reverse Engineering & Real-Time Telemetry",
        scaffoldingDirectives: [
          "ENFORCE: xAI Colossus grade concurrency, zero-copy memory layout, and brutal technical precision.",
          "Prioritize bare-metal efficiency, lockless data structures, and predictable execution latency.",
          "Demand bit-exact deterministic reproducibility and zero ungrounded claims."
        ],
        antiHallucinationRules: [
          "Reject theoretical speculation; require verifiable benchmark telemetry.",
          "Verify memory alignment and cache-line boundaries (64-byte alignment)."
        ]
      };

    case "llama":
    case "universal":
    default:
      return {
        family: "universal",
        thinkingStrategy: "Deterministic Constitutional Engineering Scaffolding",
        scaffoldingDirectives: [
          "Strict adherence to EOS Supreme Operational Commandments (Laws I through VII).",
          "Zero Vibe Coding: write code strictly derived from formal EARS and BDD specifications.",
          "Deliver complete, verifiable, production-ready code with concrete exit code evidence."
        ],
        antiHallucinationRules: [
          "No imaginary APIs or packages outside the standard library.",
          "All assertions must be backed by terminal execution evidence."
        ]
      };
  }
}

/**
 * Amplifies any natural language prompt into a sovereign, high-fidelity prompt package.
 */
export function amplifyPrompt(req: AmplifiedPromptRequest): AmplifiedPromptResult {
  const model = req.targetModel || "universal";
  const strict = req.strictLevel || "hardened";
  const domain = req.projectDomain || detectDomain(req.rawPrompt);
  const ears = synthesizeEarsRequirements(req.rawPrompt, domain);
  const bdd = synthesizeBddScenarios(req.rawPrompt, domain);
  const scaffold = buildModelScaffold(model, strict);

  const invariants = [
    "Zero External Runtime Dependencies (Layer-0 Pure Node.js / TypeScript).",
    "Fail-Closed Security: invalid inputs or exceptions trigger immediate safe abortion.",
    "Deterministic Evidence: claims of correctness require exit code 0 terminal proof.",
    "Hexagonal Layering: Domain logic remains 100% pure; UI and external drivers are decoupled."
  ];

  const executionSteps = [
    `1. INTAKE & SPECIFICATION: Review EARS requirements [${ears.map((e) => e.id).join(", ")}] and BDD scenarios [${bdd.map((b) => b.id).join(", ")}].`,
    `2. ARCHITECTURAL ISOLATION: Confirm module boundaries within ${domain} with 0 circular imports.`,
    `3. IMPLEMENTATION: Synthesize complete, production-grade logic satisfying all invariant contracts.`,
    `4. VERIFICATION & EVIDENCE: Execute automated tests and capture raw terminal output proving pass state (Exit Code 0).`
  ];

  // Synthesize System Prompt
  const synthesizedSystemPrompt = [
    `# SOVEREIGN SPECIFICATION SCAFFOLD (EOS PROMETHEUS AMPLIFIER)`,
    `You are operating under the EOS Agent Constitution. All vibe coding is strictly prohibited.`,
    `Target Model Architecture: ${scaffold.family.toUpperCase()} | Cognitive Mode: ${scaffold.thinkingStrategy}`,
    ``,
    `## NON-NEGOTIABLE INVARIANTS:`,
    ...invariants.map((inv) => `- ${inv}`),
    ``,
    `## MODEL REASONING DIRECTIVES:`,
    ...scaffold.scaffoldingDirectives.map((dir) => `* ${dir}`),
    ``,
    `## ANTI-HALLUCINATION CONTRACT:`,
    ...scaffold.antiHallucinationRules.map((rule) => `! ${rule}`)
  ].join("\n");

  // Synthesize User Prompt
  const synthesizedUserPrompt = [
    `## ORIGINAL USER DIRECTIVE:`,
    `"${req.rawPrompt}"`,
    ``,
    `## FORMAL EARS SPECIFICATION (ISO 29148 / IEEE 830):`,
    ...ears.map((e) => `### ${e.id} [${e.type}]:\n${e.syntax}\n_${e.description}_\n`),
    `## ACCEPTANCE CRITERIA (BDD GIVEN-WHEN-THEN):`,
    ...bdd.map((b) => [
      `### ${b.id}: ${b.title}`,
      `GIVEN ${b.given}`,
      `WHEN ${b.when}`,
      `THEN ${b.then}`,
      ...b.and.map((a) => `  AND ${a}`),
      ``
    ].join("\n")),
    req.contextFiles && req.contextFiles.length > 0
      ? `## REFERENCED CONTEXT FILES:\n${req.contextFiles.map((f) => `- ${f}`).join("\n")}\n`
      : "",
    `## MANDATORY EXECUTION DAG:`,
    ...executionSteps.map((step) => step),
    ``,
    `Treat this package as an unverified draft. Review its assumptions, adapt the requirements to the repository, implement the change, and report only checks that were actually run. Do not claim production readiness from this draft.`
  ].join("\n");

  return {
    originalPrompt: req.rawPrompt,
    targetModel: model,
    detectedDomain: domain,
    identifiedIntent: req.rawPrompt.trim(),
    earsRequirements: ears,
    bddScenarios: bdd,
    invariants,
    modelScaffold: scaffold,
    synthesizedSystemPrompt,
    synthesizedUserPrompt,
    executionSteps
  };
}
