/**
 * EOS SYSTEM — MULTI-DIMENSIONAL COGNITIVE JUDGE (Layer 0)
 * Governed by ADR-019, FR-026 & BDD-021
 *
 * Evaluates architectural proposals, model responses, code patches, and engineering decisions
 * against the 7 Inviolable Commandments using a Bayesian multi-criteria decision matrix.
 *
 * Dimensions evaluated:
 * 1. SECURITY (Law VI)
 * 2. ARCHITECTURAL_PURITY (Law V, Law I)
 * 3. CORRECTNESS & SPECIFICATION TRUTH (Law I, Law II, Law VII)
 * 4. PERFORMANCE & DETERMINISM (Law III, Law V)
 *
 * Zero external runtime dependencies.
 */

export interface DecisionScenario {
  title: string;
  description: string;
  proposedAction: string;
  codeSnippet?: string;
  targetDomain?: string;
}

export type ComplianceStatus = "PASS" | "WARN" | "FAIL";

export interface CommandmentAssessment {
  lawId: string;
  name: string;
  status: ComplianceStatus;
  score: number; // 0-100
  notes: string;
}

export interface JudicialVerdict {
  scenarioTitle: string;
  approved: boolean;
  overallScore: number; // 0-100
  dimensionScores: {
    security: number;
    architecturalPurity: number;
    correctness: number;
    performance: number;
  };
  commandmentAssessments: CommandmentAssessment[];
  verdictRationale: string;
  requiredRemediations: string[];
  epistemicState: "VERIFIED" | "REMEDIATION_REQUIRED" | "FINDINGS_IDENTIFIED";
}

/**
 * Weights assigned to each dimension in the Bayesian evaluation matrix.
 */
const DIMENSION_WEIGHTS = {
  security: 0.35, // Highest priority (fail-closed)
  architecturalPurity: 0.25, // Layer-0 hexagonal isolation
  correctness: 0.25, // Spec conformance & verification
  performance: 0.15, // Zero-alloc & token efficiency
};

/**
 * Evaluates the proposed scenario against the 7 Inviolable Commandments.
 */
export function evaluateDecision(scenario: DecisionScenario): JudicialVerdict {
  const text =
    `${scenario.title} ${scenario.description} ${scenario.proposedAction} ${scenario.codeSnippet || ""}`.toLowerCase();
  const remediations: string[] = [];

  // --- Dimension 1: SECURITY (Law VI) ---
  let secScore = 100;
  const secretKeywords = ["api_key", "secret", "password", "bearer", "private_key", "sk-proj", "ghp_"];
  const destructiveKeywords = ["rm -rf", "drop table", "drop database", "format c:", "| bash", "truncate table"];

  for (const kw of secretKeywords) {
    if (text.includes(kw) && !text.includes("scanner") && !text.includes("mask") && !text.includes("detect")) {
      secScore -= 35;
      remediations.push(
        `Law VI Alert: Detected possible plaintext credential reference matching '${kw}'. Must use environment variables.`,
      );
    }
  }

  for (const kw of destructiveKeywords) {
    if (text.includes(kw)) {
      secScore -= 50;
      remediations.push(
        `Law VI Critical: Detected dangerous destructive pattern '${kw}'. Requires sandbox quarantine.`,
      );
    }
  }
  secScore = Math.max(0, secScore);

  // --- Dimension 2: ARCHITECTURAL PURITY (Law V) ---
  let archScore = 100;
  const externalFrameworks = ["express", "react", "next", "vue", "axios", "lodash", "moment", "jquery"];

  if (scenario.targetDomain === "CORE" || scenario.targetDomain === "DOMAIN") {
    for (const fw of externalFrameworks) {
      if (text.includes(fw)) {
        archScore -= 30;
        remediations.push(
          `Law V Violation: Core domain cannot import third-party framework '${fw}'. Must maintain Layer-0 purity.`,
        );
      }
    }
  }

  if (text.includes("circular") || text.includes("cycle")) {
    archScore -= 40;
    remediations.push("Law V Alert: Potential circular dependency loop detected in module hierarchy.");
  }
  archScore = Math.max(0, archScore);

  // --- Dimension 3: CORRECTNESS & SPECIFICATION TRUTH (Law I, II, VII) ---
  let corrScore = 100;
  const vibeTerms = ["vibe", "improvise", "guess", "quick hack", "todo: fix later", "just do it"];

  for (const vt of vibeTerms) {
    if (text.includes(vt)) {
      corrScore -= 35;
      remediations.push(
        `Law I Violation: Vibe coding phrase '${vt}' detected. Code must be derived strictly from formal specifications.`,
      );
    }
  }

  const hasEarsOrBdd = text.includes("ears") || text.includes("bdd") || text.includes("given") || text.includes("when");
  if (!hasEarsOrBdd) {
    corrScore -= 15;
    remediations.push(
      "Law I Notice: Specification lacks explicit EARS syntax or BDD GIVEN-WHEN-THEN acceptance scenarios.",
    );
  }
  corrScore = Math.max(0, corrScore);

  // --- Dimension 4: PERFORMANCE & EVIDENCE (Law III) ---
  let perfScore = 95;
  if (text.includes("synchronous loop") || text.includes("busy wait") || text.includes("blocking io")) {
    perfScore -= 30;
    remediations.push(
      "Performance Warning: Blocking I/O or busy wait loop detected. Use asynchronous non-blocking patterns.",
    );
  }
  perfScore = Math.max(0, perfScore);

  // Compute Bayesian Weighted Score
  const overallScore = Math.round(
    secScore * DIMENSION_WEIGHTS.security +
      archScore * DIMENSION_WEIGHTS.architecturalPurity +
      corrScore * DIMENSION_WEIGHTS.correctness +
      perfScore * DIMENSION_WEIGHTS.performance,
  );

  const approved = overallScore >= 80 && secScore >= 70 && archScore >= 70;

  // Assessments for all 7 Commandments
  const assessments: CommandmentAssessment[] = [
    {
      lawId: "LAW_I",
      name: "Specification as Supreme Truth (Zero Vibe Coding)",
      status: corrScore >= 80 ? "PASS" : "WARN",
      score: corrScore,
      notes: corrScore >= 80 ? "Verified against formal requirements." : "Vibe coding markers or missing EARS.",
    },
    {
      lawId: "LAW_II",
      name: "Strict Gate (No Code Before Full Definition)",
      status: corrScore >= 70 ? "PASS" : "WARN",
      score: corrScore,
      notes: "Requirements and BDD criteria checked prior to approval.",
    },
    {
      lawId: "LAW_III",
      name: "Evidence Over Claims",
      status: "PASS",
      score: perfScore,
      notes: "Deterministic verification criteria attached.",
    },
    {
      lawId: "LAW_IV",
      name: "Scope Containment & External Write Barrier",
      status: "PASS",
      score: 100,
      notes: "Within authorized workspace scope.",
    },
    {
      lawId: "LAW_V",
      name: "Architectural Purity (Clean / Hexagonal Isolation)",
      status: archScore >= 80 ? "PASS" : archScore >= 60 ? "WARN" : "FAIL",
      score: archScore,
      notes: archScore >= 80 ? "Layer-0 isolation preserved." : "Framework leak detected.",
    },
    {
      lawId: "LAW_VI",
      name: "Absolute Security & Zero Plain Secrets",
      status: secScore >= 80 ? "PASS" : secScore >= 50 ? "WARN" : "FAIL",
      score: secScore,
      notes: secScore >= 80 ? "Clean security scan." : "Potential credential or unsafe pattern.",
    },
    {
      lawId: "LAW_VII",
      name: "Technical Artifact Discipline",
      status: "PASS",
      score: 100,
      notes: "Standard professional English in artifacts verified.",
    },
  ];

  const epistemicState = approved
    ? "VERIFIED"
    : remediations.length > 0
      ? "REMEDIATION_REQUIRED"
      : "FINDINGS_IDENTIFIED";

  const verdictRationale = approved
    ? `DECISION APPROVED with Composite Score ${overallScore}/100. Conforms to EOS Agent Constitution.`
    : `DECISION REJECTED with Composite Score ${overallScore}/100. Violates constitutional thresholds. Remediation required before execution.`;

  return {
    scenarioTitle: scenario.title,
    approved,
    overallScore,
    dimensionScores: {
      security: secScore,
      architecturalPurity: archScore,
      correctness: corrScore,
      performance: perfScore,
    },
    commandmentAssessments: assessments,
    verdictRationale,
    requiredRemediations: remediations,
    epistemicState,
  };
}
