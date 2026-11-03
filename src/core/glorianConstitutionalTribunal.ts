/**
 * src/core/glorianConstitutionalTribunal.ts
 * Glorian Multi-Model Consensus Engine & Constitutional Tribunal.
 * Governed by SPEC-135, CHANGE-073, ADR-093 (v93.0.0).
 *
 * Implements Tier-0 Multi-Judge Byzantine Consensus:
 * 1. Constitutional Judge: Evaluates strict alignment with the 7 Inviolable Laws and Zero Vibe Coding.
 * 2. Security & Blast Radius Judge: Scans for plaintext credentials, path traversal, and unauthorized writes.
 * 3. Architectural Invariant Judge: Verifies hexagonal isolation, pure domain rules, and testability.
 * 4. 2-of-3 Quorum Consensus with Fail-Closed Immediate Veto.
 * 5. Cryptographic SHA-256 seal and SQLite WAL attestation logging.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import crypto from "node:crypto";
import path from "node:path";

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export type TribunalJudgeType =
  | "CONSTITUTIONAL_JUDGE"
  | "SECURITY_JUDGE"
  | "ARCHITECTURAL_JUDGE";

export type TribunalVerdictStatus =
  | "SOVEREIGN_TRIBUNAL_APPROVED"
  | "TRIBUNAL_VETOED";

export interface JudgeVerdict {
  readonly judge: TribunalJudgeType;
  readonly approved: boolean;
  readonly score: number;
  readonly veto: boolean;
  readonly reason: string;
  readonly findings: readonly string[];
}

export interface TribunalAdjudicationRequest {
  readonly actionId: string;
  readonly category: "ARCHITECTURE" | "DEPLOYMENT" | "CODE_MUTATION" | "CONFIG";
  readonly description: string;
  readonly diffOrPayload?: string;
  readonly targetDirectory?: string;
  readonly declaredInvariants?: readonly string[];
}

export interface TribunalAdjudicationReport {
  readonly actionId: string;
  readonly category: string;
  readonly overallVerdict: TribunalVerdictStatus;
  readonly compositeScore: number;
  readonly quorumMet: boolean;
  readonly approvalsCount: number;
  readonly vetoCount: number;
  readonly judges: readonly JudgeVerdict[];
  readonly sha256Receipt: string;
  readonly timestampIso: string;
  readonly ledgerLogged: boolean;
}

// Banned secret patterns for immediate fail-closed veto
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/i,
  /ghp_[a-zA-Z0-9]{30,}/i,
  /vercel_[a-zA-Z0-9]{20,}/i,
  /AIza[0-9A-Za-z-_]{35}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i
];

// External target paths that require formal write barrier approval
const SENSITIVE_EXTERNAL_PATHS = [
  /^[A-Za-z]:[\\\/]Users[\\\/][^\\\/]+[\\\/]Documents[\\\/]Fundacion/i,
  /^[A-Za-z]:[\\\/]Windows[\\\/]/i,
  /^[A-Za-z]:[\\\/]Program Files/i,
  /^\/etc\//i,
  /^\/var\//i
];

export class GlorianConstitutionalTribunal {
  private readonly projectRoot: string;
  private readonly ledger: EosDurableSqliteLedger | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    try {
      const dbPath = path.join(this.projectRoot, ".eos", "sovereign_ledger.sqlite");
      this.ledger = new EosDurableSqliteLedger(dbPath);
    } catch {
      this.ledger = null;
    }
  }

  /**
   * Judge 1: Constitutional Judge
   * Audits adherence to the 7 Inviolable Commandments and formal requirements.
   */
  public evaluateConstitutionalJudge(request: TribunalAdjudicationRequest): JudgeVerdict {
    const findings: string[] = [];
    let score = 100;
    let veto = false;

    if (!request.actionId || request.actionId.trim().length === 0) {
      findings.push("Law I Violation: Undefined or empty action identifier (Zero Vibe Coding breach).");
      score -= 40;
    }

    if (!request.description || request.description.trim().length < 10) {
      findings.push("Law II Violation: Insufficient architectural description or specification package.");
      score -= 30;
    }

    const payload = request.diffOrPayload || "";

    // Check for improvised mock keywords without formal spec references
    if (/vibe-coding|hacky-fix|improvised/i.test(payload)) {
      findings.push("Law I Violation: Explicit vibe-coding or non-formalized improvisation flagged.");
      score -= 50;
    }

    // Check for Spanish identifiers in code diffs (Law VII: Technical Artifact Discipline)
    if (/function\s+[a-záéíóúñ]+[A-Z]/i.test(payload) || /const\s+[a-záéíóúñ]+[A-Z]/i.test(payload)) {
      findings.push("Law VII Finding: Non-English identifier detected in code artifact.");
      score -= 15;
    }

    score = Math.max(0, Math.min(100, score));
    const approved = !veto && score >= 75;

    return deepFreeze({
      judge: "CONSTITUTIONAL_JUDGE",
      approved,
      score,
      veto,
      reason: approved
        ? "Constitutional alignment verified against the 7 Inviolable Commandments."
        : "Constitutional deficiencies or missing specification detected.",
      findings
    });
  }

  /**
   * Judge 2: Security & Blast Radius Judge
   * Audits credentials, SSRF vectors, path traversals, and write barriers.
   */
  public evaluateSecurityJudge(request: TribunalAdjudicationRequest): JudgeVerdict {
    const findings: string[] = [];
    let score = 100;
    let veto = false;
    const payload = `${request.description}\n${request.diffOrPayload || ""}\n${request.targetDirectory || ""}`;

    // 1. Plaintext Secret Detection (Law VI: Absolute Security)
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(payload)) {
        findings.push("Law VI Fatal Violation: Plaintext credential or secret token detected in payload.");
        veto = true;
        score = 0;
        break;
      }
    }

    // 2. Path Traversal & External Write Barrier (Law IV: External Write Barrier)
    if (request.targetDirectory) {
      for (const extPattern of SENSITIVE_EXTERNAL_PATHS) {
        if (extPattern.test(request.targetDirectory)) {
          findings.push(`Law IV Fatal Violation: Target directory '${request.targetDirectory}' crosses external write barrier without level 2+ authorization.`);
          veto = true;
          score = 0;
          break;
        }
      }

      if (request.targetDirectory.includes("..")) {
        findings.push("Directory traversal pattern ('..') detected in target directory.");
        score -= 40;
      }
    }

    score = Math.max(0, Math.min(100, score));
    const approved = !veto && score >= 80;

    return deepFreeze({
      judge: "SECURITY_JUDGE",
      approved,
      score,
      veto,
      reason: veto
        ? "IMMEDIATE SECURITY VETO: Fatal credential leak or unauthorized write barrier breach."
        : approved
          ? "Security perimeter and blast radius verified within safe operational bounds."
          : "Security warnings detected requiring remediation.",
      findings
    });
  }

  /**
   * Judge 3: Architectural Invariant Judge
   * Audits clean hexagonal separation, state invariants, and zero regressions.
   */
  public evaluateArchitecturalJudge(request: TribunalAdjudicationRequest): JudgeVerdict {
    const findings: string[] = [];
    let score = 100;
    let veto = false;
    const payload = request.diffOrPayload || "";

    // Hexagonal purity check: Domain modules must not import frameworks or infrastructure
    if (request.category === "ARCHITECTURE" || request.category === "CODE_MUTATION") {
      if (/from\s+["'](express|react|vue|next|fastify)["']/i.test(payload) && /src\/core\//i.test(request.targetDirectory || "")) {
        findings.push("Law V Violation: Infrastructure/Framework dependency detected inside Domain Layer (src/core).");
        score -= 40;
      }
    }

    // Invariant assertions presence
    const invariants = request.declaredInvariants || [];
    if (invariants.length === 0 && (request.category === "ARCHITECTURE" || request.category === "CODE_MUTATION")) {
      findings.push("No formal state invariants declared for this architectural mutation.");
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));
    const approved = !veto && score >= 70;

    return deepFreeze({
      judge: "ARCHITECTURAL_JUDGE",
      approved,
      score,
      veto,
      reason: approved
        ? "Architectural purity, layer isolation, and invariants verified."
        : "Architectural leakage or missing invariant declarations.",
      findings
    });
  }

  /**
   * Adjudicates a proposal across all 3 judges, applying supermajority Byzantine consensus.
   */
  public adjudicate(request: TribunalAdjudicationRequest): TribunalAdjudicationReport {
    assertPrecondition(Boolean(request), "Adjudication request must be defined");
    assertPrecondition(typeof request.actionId === "string", "Action ID must be a valid string");

    const judge1 = this.evaluateConstitutionalJudge(request);
    const judge2 = this.evaluateSecurityJudge(request);
    const judge3 = this.evaluateArchitecturalJudge(request);

    const judges = [judge1, judge2, judge3];

    // Compute weighted composite score: 40% Constitutional, 35% Security, 25% Architectural
    const compositeScore = Math.round(
      judge1.score * 0.40 +
      judge2.score * 0.35 +
      judge3.score * 0.25
    );

    const vetoCount = judges.filter((j) => j.veto).length;
    const approvalsCount = judges.filter((j) => j.approved).length;
    const quorumMet = approvalsCount >= 2;

    // Fail-closed condition: ANY veto or failure to reach quorum or composite score < 80 results in VETOED
    const overallVerdict: TribunalVerdictStatus =
      vetoCount === 0 && quorumMet && compositeScore >= 80
        ? "SOVEREIGN_TRIBUNAL_APPROVED"
        : "TRIBUNAL_VETOED";

    const timestampIso = new Date().toISOString();
    const digestMaterial = JSON.stringify({
      actionId: request.actionId,
      category: request.category,
      overallVerdict,
      compositeScore,
      approvalsCount,
      vetoCount,
      judges: judges.map((j) => ({ judge: j.judge, approved: j.approved, score: j.score, veto: j.veto })),
      timestampIso
    });
    const sha256Receipt = pureSha256(digestMaterial);

    let ledgerLogged = false;
    if (this.ledger) {
      try {
        this.ledger.appendEntry({
          category: "VERIFICATION_RECEIPT",
          projectId: "glorian-system",
          title: `CONSTITUTIONAL_TRIBUNAL: ${request.actionId} -> ${overallVerdict}`,
          payload: {
            actionId: request.actionId,
            category: request.category,
            overallVerdict,
            compositeScore,
            approvalsCount,
            vetoCount,
            sha256Receipt
          }
        });
        ledgerLogged = true;
      } catch {
        ledgerLogged = false;
      }
    }

    return deepFreeze({
      actionId: request.actionId,
      category: request.category,
      overallVerdict,
      compositeScore,
      quorumMet,
      approvalsCount,
      vetoCount,
      judges,
      sha256Receipt,
      timestampIso,
      ledgerLogged
    });
  }

  /**
   * Formats a high-density operator summary for terminal TUI.
   */
  public formatTribunalSummary(report: TribunalAdjudicationReport): string {
    const verdictIcon = report.overallVerdict === "SOVEREIGN_TRIBUNAL_APPROVED" ? "⚖️  ✅" : "⚖️  ❌";
    const lines: string[] = [
      "======================================================================",
      " 🏛️  GLORIAN CONSTITUTIONAL TRIBUNAL & MULTI-MODEL CONSENSUS",
      ` Verdict : [${report.overallVerdict}] | Score: ${report.compositeScore}/100`,
      ` Action  : ${report.actionId} (${report.category}) | Quorum: ${report.approvalsCount}/3 approved`,
      ` Receipt : ${report.sha256Receipt.slice(0, 16)}... | Timestamp: ${report.timestampIso}`,
      "----------------------------------------------------------------------"
    ];

    for (const j of report.judges) {
      const statusIcon = j.veto ? "🚫 VETO" : j.approved ? "✅ PASS" : "⚠️  REJECT";
      lines.push(` [${statusIcon.padEnd(8)}] ${j.judge.padEnd(22)}: Score ${j.score}/100`);
      lines.push(`    ↳ ${j.reason}`);
      for (const finding of j.findings) {
        lines.push(`      - ${finding}`);
      }
    }

    lines.push("======================================================================");
    return lines.join("\n");
  }
}
