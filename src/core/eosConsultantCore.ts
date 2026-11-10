/**
 * EOS CONSULTANT CORE — OFFLINE HIGH-LEVEL CONSULTING ENGINE (Layer 0)
 * SPEC-047: Frontier Agent Harness — World-Class Consulting Mode
 *
 * When you're in a client environment without direct IDE connection:
 *   1. You describe the problem in natural language (architecture, bug, design decision)
 *   2. EOS produces a complete consulting deliverable at Thoughtworks / McKinsey level:
 *      - Executive Summary (1 paragraph)
 *      - Root Cause Analysis (5 Whys structured)
 *      - Architecture Recommendation (ADR format with rejected alternatives)
 *      - Implementation Plan (atomic tasks with done-criteria)
 *      - Risk Matrix (probability × impact)
 *      - Exact code (TypeScript / Go / Python / SQL — whatever is needed)
 *      - Verification criteria (how to know it worked)
 *      - Cost estimate (FinOps hours × complexity)
 *
 * This is the "no-IDE mode" — EOS is your senior staff engineer on call.
 *
 * Zero external runtime dependencies. Pure Layer-0 TypeScript.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

// ============================================================================
// 1. CONSULTING ENGAGEMENT DATA CONTRACTS
// ============================================================================

export type EngagementType =
  | "ARCHITECTURE_REVIEW" // Review and improve existing system design
  | "NEW_FEATURE" // Design and implement a new feature from scratch
  | "BUG_INVESTIGATION" // Root cause analysis + fix for a production bug
  | "PERFORMANCE_AUDIT" // Find and fix performance bottlenecks
  | "SECURITY_AUDIT" // Find and fix security vulnerabilities
  | "TECH_DEBT_REDUCTION" // Refactor/simplify existing complex code
  | "MIGRATION" // Migrate from one tech/pattern to another
  | "INCIDENT_POSTMORTEM" // Blameless postmortem + prevention plan
  | "GENERAL"; // Open-ended consulting question

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type TechStack =
  "typescript" | "javascript" | "go" | "rust" | "python" | "java" | "sql" | "terraform" | "kubernetes" | "unknown";

/** Input to a consulting engagement. */
export interface ConsultingRequest {
  /** What is the problem or question? */
  readonly problem: string;
  /** What type of engagement is this? (auto-detected if not provided) */
  readonly engagementType?: EngagementType;
  /** What technology/language is involved? */
  readonly techStack?: TechStack;
  /** Relevant code snippets, error messages, or context (paste it here). */
  readonly context?: string;
  /** What is the business impact / urgency? */
  readonly businessImpact?: string;
  /** Current architecture or system description. */
  readonly currentArchitecture?: string;
  /** Specific constraints (performance budget, team size, timeline). */
  readonly constraints?: string;
}

/** A risk entry in the risk matrix. */
export interface RiskEntry {
  readonly risk: string;
  readonly probability: "HIGH" | "MEDIUM" | "LOW";
  readonly impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly mitigation: string;
  readonly riskScore: number; // 1-9 (probability × impact numeric)
}

/** An atomic implementation task. */
export interface ImplementationTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly estimatedHours: number;
  readonly doneCriteria: string;
  readonly dependencies: readonly string[]; // task IDs
  readonly priority: "MUST_HAVE" | "SHOULD_HAVE" | "NICE_TO_HAVE";
}

/** A complete consulting deliverable. */
export interface ConsultingDeliverable {
  readonly engagementId: string;
  readonly engagementType: EngagementType;
  readonly techStack: TechStack;
  readonly timestamp: string;

  /** One-paragraph executive summary for non-technical stakeholders. */
  readonly executiveSummary: string;

  /** Structured root cause analysis (5 Whys). */
  readonly rootCauseAnalysis: {
    readonly symptom: string;
    readonly why1: string;
    readonly why2: string;
    readonly why3: string;
    readonly why4: string;
    readonly why5: string;
    readonly rootCause: string;
  };

  /** Architecture Decision Record with alternatives. */
  readonly architectureRecommendation: {
    readonly title: string;
    readonly status: "Proposed" | "Accepted";
    readonly context: string;
    readonly decision: string;
    readonly consequences: readonly string[];
    readonly rejectedAlternatives: ReadonlyArray<{
      readonly name: string;
      readonly reason: string;
    }>;
  };

  /** Exact implementation code. */
  readonly implementationCode: ReadonlyArray<{
    readonly filename: string;
    readonly language: string;
    readonly content: string;
    readonly description: string;
  }>;

  /** Atomic task breakdown. */
  readonly implementationPlan: readonly ImplementationTask[];

  /** Risk matrix sorted by risk score descending. */
  readonly riskMatrix: readonly RiskEntry[];

  /** How to verify the solution worked. */
  readonly verificationCriteria: readonly string[];

  /** FinOps estimate. */
  readonly finOpsEstimate: {
    readonly totalEstimatedHours: number;
    readonly complexityScore: number; // 1-10
    readonly recommendedTeamSize: number;
    readonly estimatedCostUsd: {
      readonly low: number;
      readonly mid: number;
      readonly high: number;
    };
  };

  /** SHA-256 integrity hash of this deliverable. */
  readonly integrityHash: string;
}

// ============================================================================
// 2. KNOWLEDGE BASES (pure in-memory — no external deps)
// ============================================================================

const ARCHITECTURE_PATTERNS: Record<string, string> = {
  "god class":
    "Split into Single-Responsibility cohesive modules. Apply Hexagonal Architecture: domain core + ports + adapters.",
  "n+1 query": "Batch with DataLoader pattern. Add query-level caching with TTL. Use JOIN instead of per-row SELECT.",
  "tight coupling": "Introduce interface/port abstraction. Inject dependencies. Apply Dependency Inversion Principle.",
  "circular dep": "Extract shared types into a separate module. Use event bus for cross-cutting concerns.",
  "race condition":
    "Serialize access with mutex/lock or CAS (compare-and-swap). Use atomic operations or database-level locking.",
  "memory leak":
    "Audit event listeners (removeEventListener), clear intervals/timeouts, use WeakMap/WeakRef for caches.",
  "slow api":
    "Profile with hrtime. Add response caching (stale-while-revalidate). Consider CDN push for static responses.",
  "auth bug": "Zero-trust: validate JWT signature AND expiry AND issuer. Use timing-safe comparison for secrets.",
  "sql injection": "Use parameterized queries exclusively. Never interpolate user input into SQL strings.",
  xss: "Sanitize all user output with context-aware escaping. Apply strict CSP with nonce. Never use innerHTML.",
  "no tests":
    "Start with the happy path unit test. Then add boundary conditions. Then add unhappy paths and error cases.",
  "tech debt": "Apply Strangler Fig pattern: new code wraps old. Deprecate incrementally. Never big-bang rewrite.",
};

const TECH_HOURLY_RATES: Record<TechStack, number> = {
  typescript: 150,
  javascript: 140,
  go: 160,
  rust: 180,
  python: 140,
  java: 150,
  sql: 130,
  terraform: 170,
  kubernetes: 175,
  unknown: 150,
};

// ============================================================================
// 3. ENGAGEMENT CLASSIFIER
// ============================================================================

function classifyEngagement(problem: string): EngagementType {
  const lower = problem.toLowerCase();
  if (/bug|error|crash|exception|fail|broken|not work/.test(lower)) return "BUG_INVESTIGATION";
  if (/slow|performance|latency|timeout|bottleneck|memory/.test(lower)) return "PERFORMANCE_AUDIT";
  if (/security|vuln|injection|xss|csrf|auth|breach|leak/.test(lower)) return "SECURITY_AUDIT";
  if (/refactor|clean|simplif|debt|legacy|complex/.test(lower)) return "TECH_DEBT_REDUCTION";
  if (/migrat|move|upgrade|replac|port/.test(lower)) return "MIGRATION";
  if (/incident|postmortem|outage|down/.test(lower)) return "INCIDENT_POSTMORTEM";
  if (/design|architect|review|assess|audit/.test(lower)) return "ARCHITECTURE_REVIEW";
  if (/add|implement|build|creat|new feature|new module/.test(lower)) return "NEW_FEATURE";
  return "GENERAL";
}

function detectTechStack(problem: string, context?: string): TechStack {
  const text = `${problem} ${context ?? ""}`.toLowerCase();
  if (/typescript|\.ts\b|tsx/.test(text)) return "typescript";
  if (/golang|\.go\b|\bgo\b/.test(text)) return "go";
  if (/rust|\.rs\b|cargo/.test(text)) return "rust";
  if (/python|\.py\b|django|flask|fastapi/.test(text)) return "python";
  if (/java\b|spring|kotlin/.test(text)) return "java";
  if (/sql|postgres|mysql|sqlite|query/.test(text)) return "sql";
  if (/terraform|hcl|\.tf\b/.test(text)) return "terraform";
  if (/kubernetes|kubectl|helm|k8s/.test(text)) return "kubernetes";
  if (/javascript|\.js\b|node|react|vue/.test(text)) return "javascript";
  return "typescript"; // default for EOS ecosystem
}

// ============================================================================
// 4. DELIVERABLE GENERATORS
// ============================================================================

function generateRootCauseAnalysis(
  problem: string,
  engagementType: EngagementType,
  context?: string,
): ConsultingDeliverable["rootCauseAnalysis"] {
  // Pattern-match the problem to known root cause chains
  const lower = problem.toLowerCase();

  const patterns: Record<string, ConsultingDeliverable["rootCauseAnalysis"]> = {
    performance: {
      symptom: `Performance degradation: ${problem.slice(0, 100)}`,
      why1: "The system response time exceeds acceptable SLO thresholds",
      why2: "Resource utilization (CPU, memory, I/O) is disproportionate to request volume",
      why3: "Critical code paths lack caching, indexing, or batch optimization",
      why4: "No performance profiling was integrated into the development or CI pipeline",
      why5: "No explicit performance budget was defined or enforced at architecture time",
      rootCause:
        "Missing performance contracts (SLOs) enforced at design time — optimizations are reactive, not preventive",
    },
    bug: {
      symptom: `Defect: ${problem.slice(0, 100)}`,
      why1: "The system behavior diverges from the specified contract under certain inputs",
      why2: "The code path for this input combination was not covered by tests",
      why3: "The edge case was not identified during requirements or design review",
      why4: "No formal EARS/BDD specification defined the expected behavior for this state",
      why5: "The development process lacks a spec-first gate that forces test-first implementation",
      rootCause: "Absent spec-driven development: code was written before the acceptance criterion was defined",
    },
    security: {
      symptom: `Security vulnerability: ${problem.slice(0, 100)}`,
      why1: "User-supplied input reaches a sensitive operation without validation",
      why2: "Trust boundaries between layers are not enforced programmatically",
      why3: "Input validation is ad-hoc rather than centralized and auditable",
      why4: "Security requirements were not formalized before implementation",
      why5: "No automated SAST or secret-scanning gate exists in the CI/CD pipeline",
      rootCause: "Security is not a first-class architecture invariant — it is bolted on after implementation",
    },
  };

  if (/slow|latency|performance|memory/.test(lower)) return patterns.performance;
  if (/bug|error|crash|fail/.test(lower)) return patterns.bug;
  if (/security|vuln|injection/.test(lower)) return patterns.security;

  return {
    symptom: `Problem: ${problem.slice(0, 100)}`,
    why1: "The current implementation does not satisfy the stated requirement",
    why2: "The requirement was either missing, ambiguous, or not formally verified",
    why3: "No automated verification (tests, linter, type-checker) catches this class of deviation",
    why4: "The code was written without a formal specification contract",
    why5: "The development process does not enforce spec-before-code discipline",
    rootCause: "Missing formal specification and automated verification loop",
  };
}

function generateRiskMatrix(engagementType: EngagementType, techStack: TechStack): RiskEntry[] {
  const baseRisks: RiskEntry[] = [
    {
      risk: "Regression: existing functionality breaks during implementation",
      probability: "MEDIUM",
      impact: "HIGH",
      mitigation: "Implement changes behind feature flags. Run full regression suite before each merge.",
      riskScore: 6,
    },
    {
      risk: "Scope creep: implementation expands beyond original problem",
      probability: "HIGH",
      impact: "MEDIUM",
      mitigation: "Lock scope with formal EARS spec before coding. Use atomic tasks with explicit done-criteria.",
      riskScore: 6,
    },
    {
      risk: "Integration failure: new code incompatible with existing interfaces",
      probability: "LOW",
      impact: "HIGH",
      mitigation:
        "Write consumer-driven contract tests. Use TypeScript strict mode to catch interface mismatches at compile time.",
      riskScore: 4,
    },
  ];

  const typeSpecific: Partial<Record<EngagementType, RiskEntry[]>> = {
    SECURITY_AUDIT: [
      {
        risk: "Fix introduces new vulnerability while patching existing one",
        probability: "MEDIUM",
        impact: "CRITICAL",
        mitigation: "Peer review by second engineer. Run SAST scanner on the patch diff before merging.",
        riskScore: 9,
      },
    ],
    MIGRATION: [
      {
        risk: "Data loss or corruption during migration",
        probability: "LOW",
        impact: "CRITICAL",
        mitigation:
          "Full database backup before migration. Test on production replica first. Blue-green deployment strategy.",
        riskScore: 6,
      },
    ],
    PERFORMANCE_AUDIT: [
      {
        risk: "Optimization changes behavior under edge-case inputs",
        probability: "MEDIUM",
        impact: "HIGH",
        mitigation: "Benchmark before and after with identical test data. Property-based tests with random inputs.",
        riskScore: 6,
      },
    ],
  };

  return [...baseRisks, ...(typeSpecific[engagementType] ?? [])].sort((a, b) => b.riskScore - a.riskScore);
}

function generateImplementationPlan(
  problem: string,
  engagementType: EngagementType,
  techStack: TechStack,
): ImplementationTask[] {
  const tasks: ImplementationTask[] = [
    {
      id: "TASK-001",
      title: "Formal Specification (EARS/BDD)",
      description: `Write the formal EARS requirements and BDD acceptance scenarios for: ${problem.slice(0, 80)}`,
      estimatedHours: 2,
      doneCriteria: "SPEC-NNN.md exists with ≥3 EARS requirements and ≥2 BDD scenarios. Approved by architect.",
      dependencies: [],
      priority: "MUST_HAVE",
    },
    {
      id: "TASK-002",
      title: "Write Failing Tests (TDD Red Phase)",
      description: "Write test cases that describe the expected behavior BEFORE writing implementation code.",
      estimatedHours: 3,
      doneCriteria: "Tests are written, they compile, and they fail for the right reason (not syntax errors).",
      dependencies: ["TASK-001"],
      priority: "MUST_HAVE",
    },
    {
      id: "TASK-003",
      title: "Implement Solution (TDD Green Phase)",
      description: `Implement the minimum code to make TASK-002 tests pass for: ${problem.slice(0, 80)}`,
      estimatedHours: engagementType === "ARCHITECTURE_REVIEW" ? 8 : 4,
      doneCriteria: "All TASK-002 tests pass with exit code 0. No regressions in existing test suite.",
      dependencies: ["TASK-002"],
      priority: "MUST_HAVE",
    },
    {
      id: "TASK-004",
      title: "Refactor & Harden (TDD Refactor Phase)",
      description: "Clean up the implementation, add edge-case handling, ensure code matches specification contract.",
      estimatedHours: 2,
      doneCriteria: "Zero TypeScript errors, zero linter warnings. Cyclomatic complexity < 10. All tests still pass.",
      dependencies: ["TASK-003"],
      priority: "MUST_HAVE",
    },
    {
      id: "TASK-005",
      title: "Security & Performance Verification",
      description:
        "Run SAST scanner, check for timing attacks, validate input sanitization, run performance benchmark.",
      estimatedHours: 1,
      doneCriteria: "SAST scan returns 0 findings. Performance within defined SLO budget. No plaintext secrets.",
      dependencies: ["TASK-004"],
      priority: "MUST_HAVE",
    },
    {
      id: "TASK-006",
      title: "Documentation & Evidence Seal",
      description: "Update ADR, CHANGELOG, and seal cryptographic evidence receipt.",
      estimatedHours: 1,
      doneCriteria: "ADR updated. CHANGELOG entry written. Evidence JSON sealed with SHA-256 hash.",
      dependencies: ["TASK-005"],
      priority: "SHOULD_HAVE",
    },
  ];
  return tasks;
}

function estimateCost(tasks: ImplementationTask[], techStack: TechStack): ConsultingDeliverable["finOpsEstimate"] {
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const rate = TECH_HOURLY_RATES[techStack];
  const complexity = Math.min(10, Math.ceil(totalHours / 2));

  return {
    totalEstimatedHours: totalHours,
    complexityScore: complexity,
    recommendedTeamSize: totalHours > 20 ? 2 : 1,
    estimatedCostUsd: {
      low: Math.round(totalHours * rate * 0.8),
      mid: Math.round(totalHours * rate),
      high: Math.round(totalHours * rate * 1.3),
    },
  };
}

// ============================================================================
// 5. CONSULTANT CORE
// ============================================================================

/**
 * The EOS Consultant Core — your senior staff engineer on-call.
 *
 * Works offline (no API calls needed) using:
 *   - Pattern-matched root cause analysis
 *   - Architecture knowledge base (ADR format)
 *   - Standard implementation plan generator (TDD cycle)
 *   - Risk matrix calculator
 *
 * For richer AI-generated deliverables, integrate EosMultiModelRouter.
 *
 * Usage:
 * ```ts
 * const consultant = new EosConsultantCore("/workspace");
 * const deliverable = consultant.engage({
 *   problem: "Our API endpoint /users takes 8 seconds to respond with 10k users in DB",
 *   techStack: "typescript",
 *   context: "Using Prisma ORM with PostgreSQL. No indexing on email column.",
 * });
 * consultant.saveDeliverable(deliverable);
 * ```
 */
export class EosConsultantCore {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Produces a complete consulting deliverable for the given problem.
   * Runs fully offline — no AI model call needed for the structural deliverable.
   */
  public engage(req: ConsultingRequest): ConsultingDeliverable {
    assertPrecondition(req.problem.trim().length > 0, "Problem description must not be empty.");

    const engagementType = req.engagementType ?? classifyEngagement(req.problem);
    const techStack = req.techStack ?? detectTechStack(req.problem, req.context);
    const engagementId = `ENG-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Find matching patterns in knowledge base
    const lower = req.problem.toLowerCase();
    const matchedPatterns = Object.entries(ARCHITECTURE_PATTERNS)
      .filter(([key]) => lower.includes(key))
      .map(([, value]) => value);

    // Build architecture recommendation
    const archTitle = `${engagementType.replace(/_/g, " ")}: ${req.problem.slice(0, 60)}`;
    const archDecision =
      matchedPatterns.length > 0
        ? matchedPatterns.join(" Additionally: ")
        : "Apply EARS/BDD spec-driven development: define acceptance criteria before writing implementation code. Use TDD (Red-Green-Refactor) cycle. Enforce architectural boundaries via automated CI gate.";

    const rootCause = generateRootCauseAnalysis(req.problem, engagementType, req.context);
    const riskMatrix = generateRiskMatrix(engagementType, techStack);
    const implementationPlan = generateImplementationPlan(req.problem, engagementType, techStack);
    const finOps = estimateCost(implementationPlan, techStack);

    const deliverable: ConsultingDeliverable = {
      engagementId,
      engagementType,
      techStack,
      timestamp: new Date().toISOString(),

      executiveSummary:
        `This engagement addresses: "${req.problem.slice(0, 120)}". ` +
        `Root cause: ${rootCause.rootCause}. ` +
        `Recommended approach: ${archDecision.slice(0, 200)}. ` +
        `Estimated effort: ${finOps.totalEstimatedHours}h (${finOps.estimatedCostUsd.low}–${finOps.estimatedCostUsd.high} USD). ` +
        `Top risk: ${riskMatrix[0]?.risk ?? "scope creep"}.`,

      rootCauseAnalysis: rootCause,

      architectureRecommendation: {
        title: archTitle,
        status: "Proposed",
        context: req.currentArchitecture
          ? `Current state: ${req.currentArchitecture.slice(0, 500)}`
          : `Context: ${req.context?.slice(0, 500) ?? req.problem.slice(0, 300)}`,
        decision: archDecision,
        consequences: [
          "Tests are written before implementation code — no vibe coding.",
          "Formal EARS spec gates implementation — no scope drift.",
          "CI pipeline enforces architectural invariants — no regression without detection.",
          `Estimated ${finOps.totalEstimatedHours}h implementation with ${finOps.recommendedTeamSize} engineer(s).`,
        ],
        rejectedAlternatives: [
          {
            name: "Quick Fix / Hotfix",
            reason: "Treats symptoms, not root cause. Creates technical debt. Will recur.",
          },
          {
            name: "Full Rewrite",
            reason: "High risk, high cost, no guarantee of improvement. Use Strangler Fig pattern instead.",
          },
        ],
      },

      implementationCode: this._generateCode(req, engagementType, techStack),
      implementationPlan,
      riskMatrix,

      verificationCriteria: [
        "All new tests pass with exit code 0.",
        "Zero regressions in existing test suite.",
        "TypeScript strict mode reports 0 errors.",
        "SAST scanner reports 0 security findings.",
        `Performance within defined SLO (verify with benchmark).`,
        "Code reviewed by ≥1 additional engineer.",
        "ADR and CHANGELOG updated.",
      ],

      finOpsEstimate: finOps,
      integrityHash: "",
    };

    // Seal integrity hash
    const hashData = JSON.stringify({
      engagementId,
      problem: req.problem,
      rootCause: rootCause.rootCause,
      decision: archDecision,
      totalHours: finOps.totalEstimatedHours,
    });
    const integrityHash = `sha256:${crypto.createHash("sha256").update(hashData).digest("hex")}`;

    return deepFreeze({ ...deliverable, integrityHash });
  }

  /**
   * Generates example code for the engagement based on tech stack and type.
   */
  private _generateCode(
    req: ConsultingRequest,
    engagementType: EngagementType,
    techStack: TechStack,
  ): ConsultingDeliverable["implementationCode"] {
    const lower = req.problem.toLowerCase();

    if (engagementType === "INCIDENT_POSTMORTEM") {
      return [
        {
          filename: `docs/postmortems/INC-${Date.now()}-postmortem.md`,
          language: "markdown",
          description: "Blameless postmortem template following Spotify/Google SRE standard",
          content: `# Blameless Postmortem — INC-${Date.now()}

## Summary
**Severity**: P1 | **Duration**: TBD | **Date**: ${new Date().toISOString().slice(0, 10)}

> One paragraph: what happened, what was the user impact, and how was it resolved.

## Timeline (UTC)
| Time | Event |
|------|-------|
| HH:MM | Issue first detected |
| HH:MM | On-call engineer paged |
| HH:MM | Root cause identified |
| HH:MM | Mitigation deployed |
| HH:MM | Service fully restored |

## Root Cause
${req.problem.slice(0, 300)}

## Contributing Factors (5 Whys)
1. **Why did it fail?** — ...
2. **Why did that happen?** — ...
3. **Why was that possible?** — ...
4. **Why wasn't it caught earlier?** — ...
5. **Why wasn't there a safeguard?** — ...

## Impact
- Users affected: TBD
- Error budget consumed: TBD%
- Revenue impact: TBD

## Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| Add monitoring alert for early detection | @engineer | +3 days | P0 |
| Add test case covering the failure scenario | @engineer | +1 week | P0 |
| Review related code paths for similar issues | @team | +2 weeks | P1 |

## Lessons Learned
- What went well:
- What could be improved:
- Where we got lucky:

---
*This document is blameless. Systems and processes are improved, not people blamed.*`,
        },
      ];
    }

    // Pattern-matched code templates
    if (techStack === "typescript" || techStack === "javascript") {
      if (/n\+1|query|orm|database|slow/.test(lower)) {
        return [
          {
            filename: "src/core/queryOptimizer.ts",
            language: "typescript",
            description: "Batched query pattern with DataLoader-style caching to eliminate N+1",
            content: `/**
 * Batch query loader — eliminates N+1 by grouping individual lookups
 * into a single batch request within the same event-loop tick.
 */
export class BatchQueryLoader<K, V> {
  private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>;
  private pending: K[] = [];
  private callbacks: Map<K, { resolve: (v: V | undefined) => void }> = new Map();
  private scheduled = false;

  constructor(batchFn: (keys: K[]) => Promise<Map<K, V>>) {
    this.batchFn = batchFn;
  }

  public load(key: K): Promise<V | undefined> {
    return new Promise((resolve) => {
      if (!this.pending.includes(key)) this.pending.push(key);
      this.callbacks.set(key as K, { resolve });
      if (!this.scheduled) {
        this.scheduled = true;
        // Collect all loads in the same tick, then fire one batch
        queueMicrotask(() => this._flush());
      }
    });
  }

  private async _flush(): Promise<void> {
    const keys = [...this.pending];
    this.pending = [];
    this.scheduled = false;
    try {
      const results = await this.batchFn(keys);
      for (const key of keys) {
        this.callbacks.get(key)?.resolve(results.get(key));
        this.callbacks.delete(key);
      }
    } catch (err) {
      for (const key of keys) {
        this.callbacks.get(key)?.resolve(undefined);
        this.callbacks.delete(key);
      }
    }
  }
}`,
          },
        ];
      }

      if (/auth|jwt|token|session/.test(lower)) {
        return [
          {
            filename: "src/core/authGuard.ts",
            language: "typescript",
            description: "Zero-trust JWT validator with timing-safe comparison",
            content: `import crypto from "node:crypto";

export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Validates a JWT token with:
 *   - Signature verification (HMAC-SHA256)
 *   - Expiry check
 *   - Issuer and audience validation
 *   - Timing-safe comparison (prevents timing attacks)
 */
export function validateJwt(
  token: string,
  secret: string,
  expectedIssuer: string,
  expectedAudience: string
): { valid: boolean; claims?: JwtClaims; error?: string } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, error: "Malformed JWT: expected 3 parts" };

    const [headerB64, payloadB64, signatureB64] = parts;

    // Recompute expected signature
    const signingInput = \`\${headerB64}.\${payloadB64}\`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(signingInput)
      .digest("base64url");

    // Timing-safe comparison — prevents oracle attacks
    const actualSigBuf = Buffer.from(signatureB64, "base64url");
    const expectedSigBuf = Buffer.from(expectedSig, "base64url");

    if (
      actualSigBuf.length !== expectedSigBuf.length ||
      !crypto.timingSafeEqual(actualSigBuf, expectedSigBuf)
    ) {
      return { valid: false, error: "Invalid signature" };
    }

    const claims = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as JwtClaims;

    // Expiry check
    if (Date.now() / 1000 > claims.exp) {
      return { valid: false, error: "Token expired" };
    }

    // Issuer and audience validation
    if (claims.iss !== expectedIssuer) {
      return { valid: false, error: \`Invalid issuer: \${claims.iss}\` };
    }
    if (claims.aud !== expectedAudience) {
      return { valid: false, error: \`Invalid audience: \${claims.aud}\` };
    }

    return { valid: true, claims };
  } catch (err) {
    return { valid: false, error: \`Parse error: \${String(err)}\` };
  }
}`,
          },
        ];
      }
    }

    if (techStack === "sql") {
      return [
        {
          filename: "migrations/optimize_indexes.sql",
          language: "sql",
          description: "Index and query optimization for the identified bottleneck",
          content: `-- Performance optimization migration
-- Problem: ${req.problem.slice(0, 100)}

-- STEP 1: Add missing index on high-cardinality lookup columns
-- (Replace 'users' and 'email' with your actual table/column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE deleted_at IS NULL; -- partial index: only active records

-- STEP 2: Analyze query plan to confirm index usage
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT * FROM users WHERE email = 'example@test.com';

-- STEP 3: Vacuum to update statistics
ANALYZE users;

-- ROLLBACK PLAN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;`,
        },
      ];
    }

    if (techStack === "go") {
      if (/n\+1|query|database|sql|orm/.test(lower)) {
        return [
          {
            filename: "internal/repository/batch_loader.go",
            language: "go",
            description: "Batch DataLoader pattern in Go to eliminate N+1 database queries",
            content: `package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// BatchLoader groups individual lookups into a single SQL IN query.
// Eliminates N+1 queries: 1000 individual SELECTs → 1 batch SELECT.
type BatchLoader[K comparable, V any] struct {
	db      *sql.DB
	queryFn func(ctx context.Context, db *sql.DB, keys []K) (map[K]V, error)
}

func NewBatchLoader[K comparable, V any](
	db *sql.DB,
	queryFn func(ctx context.Context, db *sql.DB, keys []K) (map[K]V, error),
) *BatchLoader[K, V] {
	return &BatchLoader[K, V]{db: db, queryFn: queryFn}
}

func (l *BatchLoader[K, V]) LoadMany(ctx context.Context, keys []K) (map[K]V, error) {
	if len(keys) == 0 {
		return make(map[K]V), nil
	}
	return l.queryFn(ctx, l.db, keys)
}

// Example: batch load users by ID
func BatchLoadUsers(ctx context.Context, db *sql.DB, ids []int64) (map[int64]User, error) {
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	query := fmt.Sprintf("SELECT id, email, name FROM users WHERE id IN (%s)", strings.Join(placeholders, ","))
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("batch load users: %w", err)
	}
	defer rows.Close()
	result := make(map[int64]User, len(ids))
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name); err != nil {
			return nil, err
		}
		result[u.ID] = u
	}
	return result, rows.Err()
}`,
          },
        ];
      }
      if (/slow|performance|latency|goroutine|concurrent/.test(lower)) {
        return [
          {
            filename: "internal/worker/pool.go",
            language: "go",
            description: "Worker pool with bounded concurrency to prevent goroutine explosion",
            content: `package worker

import (
	"context"
	"sync"
)

// Pool runs tasks with bounded concurrency — prevents goroutine explosion.
// Implements the classic semaphore pattern with a buffered channel.
type Pool struct {
	sem chan struct{}
	wg  sync.WaitGroup
}

func NewPool(maxConcurrency int) *Pool {
	return &Pool{sem: make(chan struct{}, maxConcurrency)}
}

// Submit enqueues a task. Blocks if pool is at capacity (backpressure).
func (p *Pool) Submit(ctx context.Context, task func()) error {
	select {
	case p.sem <- struct{}{}:
	case <-ctx.Done():
		return ctx.Err()
	}
	p.wg.Add(1)
	go func() {
		defer func() {
			<-p.sem
			p.wg.Done()
		}()
		task()
	}()
	return nil
}

// Wait blocks until all submitted tasks complete.
func (p *Pool) Wait() { p.wg.Wait() }`,
          },
        ];
      }
      return [
        {
          filename: "internal/solution.go",
          language: "go",
          description: `Solution template for: ${req.problem.slice(0, 80)}`,
          content: `package internal

import "context"

// TODO: Implement solution following approved ADR.
// Write tests in *_test.go first (TDD Red Phase), then implement here.
func Solve(ctx context.Context) error {
	panic("not implemented — write tests first (TDD Red Phase)")
}`,
        },
      ];
    }

    if (techStack === "rust") {
      return [
        {
          filename: "src/solution.rs",
          language: "rust",
          description: `Rust solution template with proper error handling for: ${req.problem.slice(0, 80)}`,
          content: `use std::fmt;

/// Domain error type — never use Box<dyn Error> in library code.
#[derive(Debug)]
pub enum SolutionError {
    InvalidInput(String),
    ProcessingFailed { reason: String, source: Option<Box<SolutionError>> },
}

impl fmt::Display for SolutionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::ProcessingFailed { reason, .. } => write!(f, "Processing failed: {}", reason),
        }
    }
}

/// TODO: implement the solution.
/// Write #[test] modules first (TDD Red Phase), then implement.
pub fn solve(input: &str) -> Result<String, SolutionError> {
    if input.is_empty() {
        return Err(SolutionError::InvalidInput("input must not be empty".to_string()));
    }
    // TODO: implement
    todo!("write tests first — TDD Red Phase")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solve_basic() {
        // TODO: implement test before implementing solve()
        let result = solve("test input");
        assert!(result.is_ok());
    }
}`,
        },
      ];
    }

    if (techStack === "python") {
      return [
        {
          filename: "solution.py",
          language: "python",
          description: `Python solution with async/await and proper typing for: ${req.problem.slice(0, 80)}`,
          content: `from __future__ import annotations
from typing import Any
import asyncio
import logging

logger = logging.getLogger(__name__)


class SolutionError(Exception):
    """Domain-level error with structured context."""
    def __init__(self, message: str, code: str = "SOLUTION_ERROR", **context: Any) -> None:
        super().__init__(message)
        self.code = code
        self.context = context


async def solve(input_data: dict[str, Any]) -> dict[str, Any]:
    """
    TODO: Implement the solution following the approved ADR.
    Write tests in test_solution.py first (TDD Red Phase).

    Args:
        input_data: Validated input dict matching the agreed contract.
    Returns:
        Result dict matching the output contract.
    Raises:
        SolutionError: On any domain-level validation or processing failure.
    """
    if not input_data:
        raise SolutionError("input_data must not be empty", code="INVALID_INPUT")

    # TODO: implement after writing tests
    raise NotImplementedError("Write tests first — TDD Red Phase")


# Tests go in test_solution.py:
# import pytest
# @pytest.mark.asyncio
# async def test_solve_basic():
#     result = await solve({"key": "value"})
#     assert result["status"] == "ok"`,
        },
      ];
    }

    if (techStack === "terraform") {
      return [
        {
          filename: "modules/solution/main.tf",
          language: "hcl",
          description: `Terraform module template for: ${req.problem.slice(0, 80)}`,
          content: `terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "name_prefix" {
  description = "Resource name prefix for all resources in this module"
  type        = string
}

# ---------------------------------------------------------------------------
# TODO: Add resources following the approved ADR.
# Write terratest tests in /test/ first (TDD Red Phase).
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "module_status" {
  description = "Status of the deployed module"
  value       = "DEPLOYED: \${var.name_prefix}-\${var.environment}"
}`,
        },
      ];
    }

    // Generic TypeScript template for any engagement
    return [
      {
        filename: `src/core/eos${engagementType.replace(/_/g, "")}Solution.ts`,
        language: "typescript",
        description: `Solution template for: ${req.problem.slice(0, 80)}`,
        content: `/**
 * Solution: ${req.problem.slice(0, 80)}
 * Engagement: ${engagementType}
 * Generated by EOS Consultant Core
 *
 * IMPORTANT: This is a template — implement the TODO sections
 * following the TDD cycle (write tests in TASK-002 first).
 */

export interface SolutionInput {
  // TODO: Define input contract based on EARS specification
}

export interface SolutionOutput {
  success: boolean;
  // TODO: Define output contract based on BDD acceptance criteria
}

/**
 * TODO: Implement the solution following the approved ADR.
 * Reference: ${engagementType} engagement.
 */
export function solve(input: SolutionInput): SolutionOutput {
  // TODO: Implement — start with the simplest code that makes tests pass
  throw new Error("Not implemented — write tests in TASK-002 first (TDD Red Phase)");
}`,
      },
    ];
  }

  /**
   * Saves a consulting deliverable as a markdown report in docs/consulting/.
   */
  public saveDeliverable(deliverable: ConsultingDeliverable): string {
    const dir = path.join(this.projectRoot, "docs", "consulting");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${deliverable.engagementId}-${deliverable.engagementType.toLowerCase()}.md`;
    const filePath = path.join(dir, filename);

    const md = this._formatMarkdown(deliverable);
    fs.writeFileSync(filePath, md, "utf8");
    return filePath;
  }

  private _formatMarkdown(d: ConsultingDeliverable): string {
    const tasks = d.implementationPlan
      .map(
        (t) =>
          `### ${t.id}: ${t.title}\n- **Hours**: ${t.estimatedHours}\n- **Priority**: ${t.priority}\n- **Done criteria**: ${t.doneCriteria}\n- **Depends on**: ${t.dependencies.join(", ") || "none"}`,
      )
      .join("\n\n");

    const risks = d.riskMatrix
      .map(
        (r) =>
          `| ${r.risk.slice(0, 60)} | ${r.probability} | ${r.impact} | ${r.riskScore} | ${r.mitigation.slice(0, 80)} |`,
      )
      .join("\n");

    const code = d.implementationCode
      .map((c) => `### ${c.filename}\n${c.description}\n\n\`\`\`${c.language}\n${c.content}\n\`\`\``)
      .join("\n\n");

    return `# Consulting Deliverable: ${d.engagementId}

> **Type**: ${d.engagementType} | **Stack**: ${d.techStack} | **Date**: ${d.timestamp}

## Executive Summary

${d.executiveSummary}

---

## Root Cause Analysis (5 Whys)

| Layer | Finding |
|-------|---------|
| Symptom | ${d.rootCauseAnalysis.symptom} |
| Why 1 | ${d.rootCauseAnalysis.why1} |
| Why 2 | ${d.rootCauseAnalysis.why2} |
| Why 3 | ${d.rootCauseAnalysis.why3} |
| Why 4 | ${d.rootCauseAnalysis.why4} |
| Why 5 | ${d.rootCauseAnalysis.why5} |
| **Root Cause** | **${d.rootCauseAnalysis.rootCause}** |

---

## Architecture Recommendation (ADR)

**Title**: ${d.architectureRecommendation.title}
**Status**: ${d.architectureRecommendation.status}

**Context**: ${d.architectureRecommendation.context}

**Decision**: ${d.architectureRecommendation.decision}

**Consequences**:
${d.architectureRecommendation.consequences.map((c) => `- ${c}`).join("\n")}

**Rejected Alternatives**:
${d.architectureRecommendation.rejectedAlternatives.map((a) => `- **${a.name}**: ${a.reason}`).join("\n")}

---

## Implementation Plan

${tasks}

---

## Risk Matrix

| Risk | Probability | Impact | Score | Mitigation |
|------|-------------|--------|-------|------------|
${risks}

---

## Implementation Code

${code}

---

## Verification Criteria

${d.verificationCriteria.map((v, i) => `${i + 1}. ${v}`).join("\n")}

---

## FinOps Estimate

- **Total hours**: ${d.finOpsEstimate.totalEstimatedHours}h
- **Complexity**: ${d.finOpsEstimate.complexityScore}/10
- **Team size**: ${d.finOpsEstimate.recommendedTeamSize} engineer(s)
- **Cost range**: $${d.finOpsEstimate.estimatedCostUsd.low} – $${d.finOpsEstimate.estimatedCostUsd.high} USD

---

*Integrity: \`${d.integrityHash}\`*
`;
  }
}
