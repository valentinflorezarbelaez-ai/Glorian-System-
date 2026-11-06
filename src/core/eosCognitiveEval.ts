/**
 * EOS SYSTEM — LOCAL HEURISTIC SOURCE REVIEW (Layer 0)
 * Governed by ADR-023, FR-036 & BDD-030, BDD-031
 *
 * Applies string patterns and local checks over one input. It is not a model
 * evaluation, complete SAST, standards audit, TypeScript compiler, or release gate.
 *
 * Emits a heuristic score and a SHA-256 result fingerprint. Neither is a certificate.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";

export type EpistemicVerdict = "LOCAL_RULES_PASSED" | "REVIEW_REQUIRED" | "FINDINGS_IDENTIFIED";

export interface DimensionResult {
  readonly score: number; // 0 - 100
  readonly weight: number; // percentage (sum = 100)
  readonly passed: boolean;
  readonly findings: readonly string[];
}

export interface CognitiveEvalResult {
  readonly target: string;
  readonly compositeScore: number; // 0 - 100
  readonly verdict: EpistemicVerdict;
  readonly dimensions: {
    readonly hallucinationRisk: DimensionResult;
    readonly earsBddConformance: DimensionResult;
    readonly hexagonalPurity: DimensionResult;
    readonly securityOwasp: DimensionResult;
    readonly astSyntax: DimensionResult;
  };
  readonly totalLinesScanned: number;
  readonly durationUs: number;
  readonly resultFingerprintSha256: string;
  readonly timestamp: string;
}

export interface EvalOptions {
  readonly isText?: boolean;
  readonly expectedDomain?: string;
  readonly strictMode?: boolean;
}

const FORBIDDEN_SECRET_PATTERNS = [
  { name: "OpenAI Secret Key", regex: /sk-[a-zA-Z0-9_\-]{20,}/ },
  { name: "GitHub Personal Access Token", regex: /ghp_[a-zA-Z0-9]{20,}/ },
  { name: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Generic Bearer Token", regex: /Bearer\s+['"][a-zA-Z0-9_\-\.]{25,}['"]/ },
  { name: "Unsafe Dynamic Eval", regex: /\beval\s*\(/ },
  { name: "Destructive Shell Execution", regex: /\b(exec|execSync)\s*\(\s*['"][^'"]*rm\s+-rf\b/ }
];

const UNGROUNDED_FRAMEWORK_PATTERNS = [
  /\bfrom\s+['"](express|koa|fastify|axios|lodash|moment|jquery)['"]/i,
  /\brequire\s*\(\s*['"](express|koa|fastify|axios|lodash|moment|jquery)['"]\s*\)/i
];

export class EosCognitiveEval {
  /**
   * Evaluates a file or code block across the 5 sovereign dimensions.
   */
  public evaluate(targetPathOrCode: string, options: EvalOptions = {}): CognitiveEvalResult {
    const startTime = process.hrtime.bigint();
    let content = "";
    let isFile = false;
    let targetLabel = "raw_input";

    if (options.isText || targetPathOrCode.includes("\n") || targetPathOrCode.includes("{")) {
      content = targetPathOrCode;
      targetLabel = "in-memory-code";
    } else if (fs.existsSync(targetPathOrCode)) {
      content = fs.readFileSync(targetPathOrCode, "utf8");
      isFile = true;
      targetLabel = targetPathOrCode;
    } else {
      content = targetPathOrCode;
      targetLabel = "string_text";
    }

    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // Dimension 1: Security & Zero Secrets (Weight: 30%)
    const securityResult = this.evalSecurity(content);

    // Dimension 2: Hexagonal Architectural Purity (Weight: 25%)
    const hexagonalResult = this.evalHexagonalPurity(content, targetLabel);

    // Dimension 3: AST Syntax & Strict Typing (Weight: 20%)
    const astResult = this.evalAstSyntax(content, isFile ? targetPathOrCode : undefined);

    // Dimension 4: EARS & BDD Conformance (Weight: 15%)
    const earsBddResult = this.evalEarsBdd(content);

    // Dimension 5: Hallucination Risk (Weight: 10%)
    const hallucinationResult = this.evalHallucinationRisk(content);

    // Calculate Composite Score
    const compositeScore = Math.round(
      securityResult.score * (securityResult.weight / 100) +
      hexagonalResult.score * (hexagonalResult.weight / 100) +
      astResult.score * (astResult.weight / 100) +
      earsBddResult.score * (earsBddResult.weight / 100) +
      hallucinationResult.score * (hallucinationResult.weight / 100)
    );

    let verdict: EpistemicVerdict = "FINDINGS_IDENTIFIED";
    if (compositeScore >= 80 && securityResult.passed && astResult.passed) {
      verdict = "LOCAL_RULES_PASSED";
    } else if (compositeScore >= 50) {
      verdict = "REVIEW_REQUIRED";
    }

    const endTime = process.hrtime.bigint();
    const durationUs = Number(endTime - startTime) / 1000;

    const resultFingerprintSha256 = crypto
      .createHash("sha256")
      .update(`EOS_EVAL:${targetLabel}:${compositeScore}:${verdict}:${durationUs}`)
      .digest("hex");

    return {
      target: targetLabel,
      compositeScore,
      verdict,
      dimensions: {
        securityOwasp: securityResult,
        hexagonalPurity: hexagonalResult,
        astSyntax: astResult,
        earsBddConformance: earsBddResult,
        hallucinationRisk: hallucinationResult
      },
      totalLinesScanned: totalLines,
      durationUs,
      resultFingerprintSha256,
      timestamp: new Date().toISOString()
    };
  }

  private evalSecurity(content: string): DimensionResult {
    const findings: string[] = [];
    for (const pat of FORBIDDEN_SECRET_PATTERNS) {
      if (pat.regex.test(content)) {
        findings.push(`Security violation detected: ${pat.name}`);
      }
    }

    const passed = findings.length === 0;
    const score = passed ? 100 : Math.max(0, 100 - findings.length * 35);
    return { score, weight: 30, passed, findings };
  }

  private evalHexagonalPurity(content: string, filePath: string): DimensionResult {
    const findings: string[] = [];
    const isDomain = filePath.includes("core") || filePath.includes("domain");

    if (isDomain) {
      for (const pat of UNGROUNDED_FRAMEWORK_PATTERNS) {
        if (pat.test(content)) {
          findings.push("Domain purity violation: External framework import detected in core");
        }
      }
      if (/\bfrom\s+['"].*(react|vue|svelte|components|ui).*['"]/i.test(content)) {
        findings.push("Unidirectional rule violation: Domain imports UI component");
      }
    }

    const passed = findings.length === 0;
    const score = passed ? 100 : Math.max(0, 100 - findings.length * 40);
    return { score, weight: 25, passed, findings };
  }

  private evalAstSyntax(content: string, filePath?: string): DimensionResult {
    const findings: string[] = [];

    // Quick regex validation for unbalanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      findings.push(`Syntax error: Unbalanced braces (open: ${openBraces}, close: ${closeBraces})`);
    }

    // Try node --check using temp file
    if (filePath && (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".ts"))) {
      try {
        const ext = path.extname(filePath);
        const tmpFile = path.join(os.tmpdir(), `eval-check-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
        fs.writeFileSync(tmpFile, content, "utf8");
        try {
          execFileSync(process.execPath, ["--check", tmpFile], { stdio: "ignore" });
        } finally {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
      } catch (err: any) {
        findings.push(`AST syntax parse failed: ${err.message || String(err)}`);
      }
    }

    const passed = findings.length === 0;
    const score = passed ? 100 : Math.max(0, 100 - findings.length * 50);
    return { score, weight: 20, passed, findings };
  }

  private evalEarsBdd(content: string): DimensionResult {
    const findings: string[] = [];
    const hasEarsKeywords =
      /(CUANDO|WHEN|MIENTRAS|WHILE|SI|IF|EL SISTEMA|THE SYSTEM)/i.test(content);
    const hasBddKeywords =
      /(DADO|GIVEN|CUANDO|WHEN|ENTONCES|THEN|ESCENARIO|SCENARIO)/i.test(content);

    let score = 50;
    if (hasEarsKeywords && hasBddKeywords) {
      score = 100;
    } else if (hasEarsKeywords || hasBddKeywords) {
      score = 75;
    } else {
      findings.push("Missing formal EARS syntax or BDD Gherkin scenarios in specification/documentation");
      score = 40;
    }

    return {
      score,
      weight: 15,
      passed: score >= 70,
      findings
    };
  }

  private evalHallucinationRisk(content: string): DimensionResult {
    const findings: string[] = [];
    // Check for common hallucinated patterns in code
    if (/\bimport\s+.*\s+from\s+['"](eos-unknown|nonexistent-lib|magic-ai-api)['"]/i.test(content)) {
      findings.push("Hallucination alert: Detected import of non-existent synthetic package");
    }

    // Check for unverified TODOs or placeholder mocks
    const placeholders = content.match(/\b(TODO|FIXME|PLACEHOLDER|REPLACE_ME)\b/gi) || [];
    if (placeholders.length > 5) {
      findings.push(`Unfinished code: Found ${placeholders.length} placeholder tokens`);
    }

    const passed = findings.length === 0;
    const score = passed ? 100 : Math.max(0, 100 - findings.length * 30);
    return { score, weight: 10, passed, findings };
  }
}
