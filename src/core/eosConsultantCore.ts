/**
 * EOS CONSULTANT CORE — OFFLINE HIGH-LEVEL CONSULTING ENGINE (Layer 0)
 * SPEC-047: Frontier Agent Harness — World-Class Consulting Mode
 *
 * Zero external runtime dependencies. Pure Layer-0 TypeScript.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assertPrecondition, deepFreeze } from "./eosKernelPrimitives.ts";

export type EngagementType =
  | "ARCHITECTURE_REVIEW"
  | "NEW_FEATURE"
  | "BUG_INVESTIGATION"
  | "PERFORMANCE_AUDIT"
  | "SECURITY_AUDIT"
  | "TECH_DEBT_REDUCTION"
  | "MIGRATION"
  | "INCIDENT_POSTMORTEM"
  | "GENERAL";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type TechStack =
  "typescript" | "javascript" | "go" | "rust" | "python" | "java" | "sql" | "terraform" | "kubernetes" | "unknown";

export interface ConsultingRequest {
  readonly problem: string;
  readonly engagementType?: EngagementType;
  readonly techStack?: TechStack;
  readonly context?: string;
  readonly businessImpact?: string;
  readonly currentArchitecture?: string;
  readonly constraints?: string;
}

export interface RiskEntry {
  readonly risk: string;
  readonly probability: "HIGH" | "MEDIUM" | "LOW";
  readonly impact: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly mitigation: string;
  readonly riskScore: number;
}

export interface ImplementationTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly estimatedHours: number;
  readonly doneCriteria: string;
  readonly dependencies: readonly string[];
  readonly priority: "MUST_HAVE" | "SHOULD_HAVE" | "NICE_TO_HAVE";
}

export interface ConsultingDeliverable {
  readonly engagementId: string;
  readonly engagementType: EngagementType;
  readonly techStack: TechStack;
  readonly timestamp: string;
  readonly executiveSummary: string;
  readonly rootCauseAnalysis: {
    readonly symptom: string;
    readonly why1: string;
    readonly why2: string;
    readonly why3: string;
    readonly why4: string;
    readonly why5: string;
    readonly rootCause: string;
  };
  readonly architectureRecommendation: {
    readonly title: string;
    readonly status: "Proposed" | "Accepted";
    readonly context: string;
    readonly decision: string;
    readonly consequences: readonly string[];
    readonly rejectedAlternatives: ReadonlyArray<{ readonly name: string; readonly reason: string }>;
  };
  readonly implementationCode: ReadonlyArray<{
    readonly filename: string;
    readonly language: string;
    readonly content: string;
    readonly description: string;
  }>;
  readonly implementationPlan: readonly ImplementationTask[];
  readonly riskMatrix: readonly RiskEntry[];
  readonly verificationCriteria: readonly string[];
  readonly finOpsEstimate: {
    readonly totalEstimatedHours: number;
    readonly complexityScore: number;
    readonly recommendedTeamSize: number;
    readonly estimatedCostUsd: { readonly low: number; readonly mid: number; readonly high: number };
  };
  readonly integrityHash: string;
}

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
  return "typescript";
}

function generateRootCauseAnalysis(problem: string): ConsultingDeliverable["rootCauseAnalysis"] {
  const lower = problem.toLowerCase();
  if (/slow|latency|performance|memory/.test(lower)) {
    return {
      symptom: `Performance degradation: ${problem.slice(0, 100)}`,
      why1: "The system response time exceeds acceptable SLO thresholds",
      why2: "Resource utilization (CPU, memory, I/O) is disproportionate to request volume",
      why3: "Critical code paths lack caching, indexing, or batch optimization",
      why4: "No performance profiling was integrated into the development or CI pipeline",
      why5: "No explicit performance budget was defined or enforced at architecture time",
      rootCause:
        "Missing performance contracts (SLOs) enforced at design time — optimizations are reactive, not preventive",
    };
  }
  if (/bug|error|crash|fail/.test(lower)) {
    return {
      symptom: `Defect: ${problem.slice(0, 100)}`,
      why1: "The system behavior diverges from the specified contract under certain inputs",
      why2: "The code path for this input combination was not covered by tests",
      why3: "The edge case was not identified during requirements or design review",
      why4: "No formal EARS/BDD specification defined the expected behavior for this state",
      why5: "The development process lacks a spec-first gate that forces test-first implementation",
      rootCause: "Absent spec-driven development: code was written before the acceptance criterion was defined",
    };
  }
  if (/security|vuln|injection/.test(lower)) {
    return {
      symptom: `Security vulnerability: ${problem.slice(0, 100)}`,
      why1: "User-supplied input reaches a sensitive operation without validation",
      why2: "Trust boundaries between layers are not enforced programmatically",
      why3: "Input validation is ad-hoc rather than centralized and auditable",
      why4: "Security requirements were not formalized before implementation",
      why5: "No automated SAST or secret-scanning gate exists in the CI/CD pipeline",
      rootCause: "Security is not a first-class architecture invariant — it is bolted on after implementation",
    };
  }
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

function generateRiskMatrix(engagementType: EngagementType): RiskEntry[] {
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

function generateImplementationPlan(problem: string, engagementType: EngagementType): ImplementationTask[] {
  return [
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
}

function estimateCost(tasks: ImplementationTask[], techStack: TechStack): ConsultingDeliverable["finOpsEstimate"] {
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const rate = TECH_HOURLY_RATES[techStack];
  return {
    totalEstimatedHours: totalHours,
    complexityScore: Math.min(10, Math.ceil(totalHours / 2)),
    recommendedTeamSize: totalHours > 20 ? 2 : 1,
    estimatedCostUsd: {
      low: Math.round(totalHours * rate * 0.8),
      mid: Math.round(totalHours * rate),
      high: Math.round(totalHours * rate * 1.3),
    },
  };
}

export class EosConsultantCore {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  public engage(req: ConsultingRequest): ConsultingDeliverable {
    assertPrecondition(req.problem.trim().length > 0, "Problem description must not be empty.");

    const engagementType = req.engagementType ?? classifyEngagement(req.problem);
    const techStack = req.techStack ?? detectTechStack(req.problem, req.context);
    const engagementId = `ENG-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const lower = req.problem.toLowerCase();
    const matchedPatterns = Object.entries(ARCHITECTURE_PATTERNS)
      .filter(([key]) => lower.includes(key))
      .map(([, value]) => value);

    const archTitle = `${engagementType.replace(/_/g, " ")}: ${req.problem.slice(0, 60)}`;
    const archDecision =
      matchedPatterns.length > 0
        ? matchedPatterns.join(" Additionally: ")
        : "Apply EARS/BDD spec-driven development: define acceptance criteria before writing implementation code. Use TDD (Red-Green-Refactor) cycle. Enforce architectural boundaries via automated CI gate.";

    const rootCause = generateRootCauseAnalysis(req.problem);
    const riskMatrix = generateRiskMatrix(engagementType);
    const implementationPlan = generateImplementationPlan(req.problem, engagementType);
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
        "Performance within defined SLO (verify with benchmark).",
        "Code reviewed by ≥1 additional engineer.",
        "ADR and CHANGELOG updated.",
      ],
      finOpsEstimate: finOps,
      integrityHash: "",
    };

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
          content: [
            `# Blameless Postmortem — INC-${Date.now()}`,
            `## Summary\n**Severity**: P1 | **Duration**: TBD | **Date**: ${new Date().toISOString().slice(0, 10)}`,
            `## Timeline (UTC)\n| Time | Event |\n|------|-------|\n| HH:MM | Issue first detected |\n| HH:MM | Mitigation deployed |`,
            `## Root Cause\n${req.problem.slice(0, 300)}`,
            "## Contributing Factors (5 Whys)\n1. **Why did it fail?** — ...\n2. **Why did that happen?** — ...",
            "## Action Items\n| Action | Owner | Due Date | Priority |\n|--------|-------|----------|----------|\n| Add test case covering failure scenario | @engineer | +1 week | P0 |",
            "---\n*This document is blameless. Systems and processes are improved, not people blamed.*",
          ].join("\n\n"),
        },
      ];
    }

    if (techStack === "typescript" || techStack === "javascript") {
      if (/n\+1|query|orm|database|slow/.test(lower)) {
        return [
          {
            filename: "src/core/queryOptimizer.ts",
            language: "typescript",
            description: "Batched query pattern with DataLoader-style caching to eliminate N+1",
            content: [
              "export class BatchQueryLoader<K, V> {",
              "  private pending: K[] = [];",
              "  private callbacks = new Map<K, { resolve: (v: V | undefined) => void }>();",
              "  private scheduled = false;",
              "  constructor(private readonly batchFn: (keys: K[]) => Promise<Map<K, V>>) {}",
              "  public load(key: K): Promise<V | undefined> {",
              "    return new Promise((resolve) => {",
              "      if (!this.pending.includes(key)) this.pending.push(key);",
              "      this.callbacks.set(key, { resolve });",
              "      if (!this.scheduled) { this.scheduled = true; queueMicrotask(() => this._flush()); }",
              "    });",
              "  }",
              "  private async _flush(): Promise<void> {",
              "    const keys = [...this.pending]; this.pending = []; this.scheduled = false;",
              "    try { const results = await this.batchFn(keys); for (const k of keys) { this.callbacks.get(k)?.resolve(results.get(k)); this.callbacks.delete(k); } }",
              "    catch { for (const k of keys) { this.callbacks.get(k)?.resolve(undefined); this.callbacks.delete(k); } }",
              "  }",
              "}",
            ].join("\n"),
          },
        ];
      }
      if (/auth|jwt|token|session/.test(lower)) {
        return [
          {
            filename: "src/core/authGuard.ts",
            language: "typescript",
            description: "Zero-trust JWT validator with timing-safe comparison",
            content: [
              'import crypto from "node:crypto";',
              "export interface JwtClaims { sub: string; iss: string; aud: string; exp: number; iat: number; }",
              "export function validateJwt(token: string, secret: string, expectedIssuer: string, expectedAudience: string): { valid: boolean; claims?: JwtClaims; error?: string } {",
              '  const parts = token.split("."); if (parts.length !== 3) return { valid: false, error: "Malformed JWT" };',
              '  const [h, p, s] = parts; const expected = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");',
              '  const aBuf = Buffer.from(s, "base64url"); const eBuf = Buffer.from(expected, "base64url");',
              '  if (aBuf.length !== eBuf.length || !crypto.timingSafeEqual(aBuf, eBuf)) return { valid: false, error: "Invalid signature" };',
              '  const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as JwtClaims;',
              '  if (Date.now() / 1000 > claims.exp) return { valid: false, error: "Token expired" };',
              '  if (claims.iss !== expectedIssuer || claims.aud !== expectedAudience) return { valid: false, error: "Invalid issuer/audience" };',
              "  return { valid: true, claims };",
              "}",
            ].join("\n"),
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
          content: `-- Performance optimization migration: ${req.problem.slice(0, 100)}\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL;\nEXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM users WHERE email = 'example@test.com';\nANALYZE users;`,
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
            content:
              'package repository\n\nimport (\n\t"context"\n\t"database/sql"\n)\n\ntype BatchLoader[K comparable, V any] struct {\n\tdb *sql.DB\n\tqueryFn func(ctx context.Context, db *sql.DB, keys []K) (map[K]V, error)\n}\n\nfunc (l *BatchLoader[K, V]) LoadMany(ctx context.Context, keys []K) (map[K]V, error) {\n\tif len(keys) == 0 { return make(map[K]V), nil }\n\treturn l.queryFn(ctx, l.db, keys)\n}',
          },
        ];
      }
      if (/slow|performance|latency|goroutine|concurrent/.test(lower)) {
        return [
          {
            filename: "internal/worker/pool.go",
            language: "go",
            description: "Worker pool with bounded concurrency to prevent goroutine explosion",
            content:
              'package worker\n\nimport (\n\t"context"\n\t"sync"\n)\n\ntype Pool struct { sem chan struct{}; wg sync.WaitGroup }\nfunc NewPool(max int) *Pool { return &Pool{sem: make(chan struct{}, max)} }\nfunc (p *Pool) Submit(ctx context.Context, task func()) error {\n\tselect { case p.sem <- struct{}{}: case <-ctx.Done(): return ctx.Err() }\n\tp.wg.Add(1); go func() { defer func() { <-p.sem; p.wg.Done() }(); task() }(); return nil\n}\nfunc (p *Pool) Wait() { p.wg.Wait() }',
          },
        ];
      }
      return [
        {
          filename: "internal/solution.go",
          language: "go",
          description: `Solution template for: ${req.problem.slice(0, 80)}`,
          content:
            'package internal\n\nimport "context"\n\nfunc Solve(ctx context.Context) error {\n\tpanic("not implemented — write tests first (TDD Red Phase)")\n}',
        },
      ];
    }

    if (techStack === "rust") {
      return [
        {
          filename: "src/solution.rs",
          language: "rust",
          description: `Rust solution template with proper error handling for: ${req.problem.slice(0, 80)}`,
          content:
            '#[derive(Debug)]\npub enum SolutionError { InvalidInput(String) }\npub fn solve(input: &str) -> Result<String, SolutionError> {\n    if input.is_empty() { return Err(SolutionError::InvalidInput("input must not be empty".to_string())); }\n    Ok(input.to_string())\n}\n#[cfg(test)]\nmod tests {\n    use super::*;\n    #[test]\n    fn test_solve_basic() { assert!(solve("test input").is_ok()); }\n}',
        },
      ];
    }

    if (techStack === "python") {
      return [
        {
          filename: "solution.py",
          language: "python",
          description: `Python solution with async/await and proper typing for: ${req.problem.slice(0, 80)}`,
          content:
            'from __future__ import annotations\nfrom typing import Any\n\nclass SolutionError(Exception):\n    def __init__(self, message: str, code: str = "SOLUTION_ERROR") -> None:\n        super().__init__(message); self.code = code\n\nasync def solve(input_data: dict[str, Any]) -> dict[str, Any]:\n    if not input_data: raise SolutionError("input_data must not be empty", code="INVALID_INPUT")\n    raise NotImplementedError("Write tests first — TDD Red Phase")',
        },
      ];
    }

    if (techStack === "terraform") {
      return [
        {
          filename: "modules/solution/main.tf",
          language: "hcl",
          description: `Terraform module template for: ${req.problem.slice(0, 80)}`,
          content:
            'terraform {\n  required_version = ">= 1.6.0"\n}\nvariable "environment" { type = string }\nvariable "name_prefix" { type = string }\noutput "module_status" { value = "DEPLOYED: ${var.name_prefix}-${var.environment}" }',
        },
      ];
    }

    return [
      {
        filename: `src/core/eos${engagementType.replace(/_/g, "")}Solution.ts`,
        language: "typescript",
        description: `Solution template for: ${req.problem.slice(0, 80)}`,
        content: `export interface SolutionInput {}\nexport interface SolutionOutput { success: boolean; }\nexport function solve(_input: SolutionInput): SolutionOutput {\n  throw new Error("Not implemented — write tests in TASK-002 first (TDD Red Phase)");\n}`,
      },
    ];
  }

  public saveDeliverable(deliverable: ConsultingDeliverable): string {
    const dir = path.join(this.projectRoot, "docs", "consulting");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${deliverable.engagementId}-${deliverable.engagementType.toLowerCase()}.md`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, this._formatMarkdown(deliverable), "utf8");
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

    return [
      `# Consulting Deliverable: ${d.engagementId}`,
      `> **Type**: ${d.engagementType} | **Stack**: ${d.techStack} | **Date**: ${d.timestamp}`,
      `## Executive Summary\n\n${d.executiveSummary}`,
      `## Root Cause Analysis (5 Whys)\n\n| Layer | Finding |\n|-------|---------|\n| Symptom | ${d.rootCauseAnalysis.symptom} |\n| Why 1 | ${d.rootCauseAnalysis.why1} |\n| Why 2 | ${d.rootCauseAnalysis.why2} |\n| Why 3 | ${d.rootCauseAnalysis.why3} |\n| Why 4 | ${d.rootCauseAnalysis.why4} |\n| Why 5 | ${d.rootCauseAnalysis.why5} |\n| **Root Cause** | **${d.rootCauseAnalysis.rootCause}** |`,
      `## Architecture Recommendation (ADR)\n\n**Title**: ${d.architectureRecommendation.title}\n**Status**: ${d.architectureRecommendation.status}\n**Context**: ${d.architectureRecommendation.context}\n**Decision**: ${d.architectureRecommendation.decision}\n**Consequences**:\n${d.architectureRecommendation.consequences.map((c) => `- ${c}`).join("\n")}\n**Rejected Alternatives**:\n${d.architectureRecommendation.rejectedAlternatives.map((a) => `- **${a.name}**: ${a.reason}`).join("\n")}`,
      `## Implementation Plan\n\n${tasks}`,
      `## Risk Matrix\n\n| Risk | Probability | Impact | Score | Mitigation |\n|------|-------------|--------|-------|------------|\n${risks}`,
      `## Implementation Code\n\n${code}`,
      `## Verification Criteria\n\n${d.verificationCriteria.map((v, i) => `${i + 1}. ${v}`).join("\n")}`,
      `## FinOps Estimate\n\n- **Total hours**: ${d.finOpsEstimate.totalEstimatedHours}h\n- **Complexity**: ${d.finOpsEstimate.complexityScore}/10\n- **Team size**: ${d.finOpsEstimate.recommendedTeamSize} engineer(s)\n- **Cost range**: $${d.finOpsEstimate.estimatedCostUsd.low} – $${d.finOpsEstimate.estimatedCostUsd.high} USD`,
      `*Integrity: \`${d.integrityHash}\`*\n`,
    ].join("\n\n---\n\n");
  }
}
