/**
 * SPEC-128: Tier S-0 Design Engineering Matrix & Machine-Readable Visual Governor
 *
 * Enforces the supreme design engineering doctrine (Palantir, Anduril, Linear, Vercel)
 * across markup, stylesheets, and design contracts.
 *
 * Strict Hexagonal Layer-0: Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface DesignFinding {
  severity: "BLOCKING" | "WARNING";
  rule: string;
  description: string;
  file?: string;
  line?: number;
  matchedSnippet?: string;
}

export interface DesignAuditReport {
  timestamp: string;
  contractVerified: boolean;
  totalFilesAudited: number;
  blockingViolationsCount: number;
  warningsCount: number;
  perfectionIndex: number; // 0 to 100
  status: "CONFORMING" | "FINDINGS_IDENTIFIED";
  findings: DesignFinding[];
  evidenceDigestSha256: string;
}

export type VisualAuditReport = DesignAuditReport;

export class EosS0DesignSystemGovernor {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Validates the integrity of the constitutional DESIGN.md specification.
   */
  public auditDesignContract(): { valid: boolean; missingSections: string[] } {
    const designPath = path.join(this.projectRoot, "DESIGN.md");
    if (!fs.existsSync(designPath)) {
      return { valid: false, missingSections: ["DESIGN.md missing from repository root"] };
    }

    const content = fs.readFileSync(designPath, "utf8");
    const requiredSections = [
      "Tier 1: Core Primitives",
      "Tier 2: Semantic Tokens",
      "Tier 3: Component-Level Tokens",
      "4px Rigid Grid",
      "ANTI-PATTERN BLACKLIST",
      "MASTER COMPONENT CATALOG",
    ];

    const missingSections = requiredSections.filter((sec) => !content.includes(sec));
    return {
      valid: missingSections.length === 0,
      missingSections,
    };
  }

  /**
   * Audits a single text snippet (HTML, CSS, TSX) for design anti-patterns.
   */
  public auditMarkup(content: string, filePath: string = "inline"): DesignFinding[] {
    const findings: DesignFinding[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNum = i + 1;

      // Rule 1: Banned generic fuzzy shadows
      if (/box-shadow:\s*0\s+10px\s+15px/i.test(lineText) || /\bshadow-lg\b/i.test(lineText)) {
        findings.push({
          severity: "BLOCKING",
          rule: "ANTI_PATTERN_FUZZY_SHADOW",
          description:
            "Generic fuzzy drop shadows are prohibited by DESIGN.md. Use 1px hairline borders + radial top lighting.",
          file: filePath,
          line: lineNum,
          matchedSnippet: lineText.trim(),
        });
      }

      // Rule 2: Banned linear transition curves (state transitions must use spring/cubic-bezier)
      if (/transition:\s*[^;]*\blinear\b/i.test(lineText)) {
        findings.push({
          severity: "BLOCKING",
          rule: "ANTI_PATTERN_LINEAR_TRANSITION",
          description:
            "Linear transition curves are prohibited for state changes. All motion must use spring physics or cubic-bezier(0.16, 1, 0.3, 1).",
          file: filePath,
          line: lineNum,
          matchedSnippet: lineText.trim(),
        });
      } else if (/animation:\s*[^;]*\blinear\b/i.test(lineText) && !/(?:rotate|spin)/i.test(lineText)) {
        findings.push({
          severity: "BLOCKING",
          rule: "ANTI_PATTERN_LINEAR_TRANSITION",
          description:
            "Linear animation curves are prohibited for non-rotational animations. Use spring or cubic-bezier.",
          file: filePath,
          line: lineNum,
          matchedSnippet: lineText.trim(),
        });
      }

      // Rule 3: 4px Geometric Spacing Violations (e.g. padding: 13px, margin: 7px)
      const spacingMatch = lineText.match(/(?:padding|margin|gap):\s*(\d+)px/i);
      if (spacingMatch && spacingMatch[1]) {
        const val = parseInt(spacingMatch[1], 10);
        if (val > 0 && val % 4 !== 0) {
          findings.push({
            severity: "WARNING",
            rule: "NON_4PX_GRID_SPACING",
            description: `Spacing value ${val}px violates the 4px rigid grid rule from DESIGN.md.`,
            file: filePath,
            line: lineNum,
            matchedSnippet: lineText.trim(),
          });
        }
      }
    }

    return findings;
  }

  /**
   * Audits the target directory for design system conformity.
   */
  public auditDirectory(targetDir: string = this.projectRoot): DesignAuditReport {
    const contract = this.auditDesignContract();
    const findings: DesignFinding[] = [];
    let filesAudited = 0;

    if (!contract.valid) {
      for (const m of contract.missingSections) {
        findings.push({
          severity: "BLOCKING",
          rule: "DESIGN_CONTRACT_INCOMPLETE",
          description: `Contract section missing: ${m}`,
          file: "DESIGN.md",
        });
      }
    }

    const exts = new Set([".html", ".css"]);
    const ignoreDirs = new Set(["node_modules", ".git", ".vercel", "dist", ".cache"]);

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            walk(path.join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (exts.has(ext)) {
            filesAudited++;
            const fullPath = path.join(dir, entry.name);
            const content = fs.readFileSync(fullPath, "utf8");
            const rel = path.relative(targetDir, fullPath);
            const res = new EosS0DesignSystemGovernor(targetDir).auditMarkup(content, rel);
            findings.push(...res);
          }
        }
      }
    }

    walk(targetDir);

    const blockingCount = findings.filter((f) => f.severity === "BLOCKING").length;
    const warningsCount = findings.filter((f) => f.severity === "WARNING").length;

    // Calculate Perfection Index (0-100)
    let perfectionIndex = 100;
    perfectionIndex -= blockingCount * 25;
    perfectionIndex -= warningsCount * 2;
    if (perfectionIndex < 0) perfectionIndex = 0;

    const status = blockingCount === 0 ? "CONFORMING" : "FINDINGS_IDENTIFIED";

    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify({ contract, blockingCount, warningsCount, perfectionIndex }))
      .digest("hex");

    return {
      timestamp: new Date().toISOString(),
      contractVerified: contract.valid,
      totalFilesAudited: filesAudited,
      blockingViolationsCount: blockingCount,
      warningsCount,
      perfectionIndex,
      status,
      findings,
      evidenceDigestSha256: digest,
    };
  }

  /**
   * Audits workspace files against the S-0 design system rules.
   */
  public auditWorkspace(targetPaths?: string[]): {
    compliant: boolean;
    inspectedFiles: number;
    violations: DesignFinding[];
    warnings: DesignFinding[];
    score: number;
    contractHash: string;
  } {
    const contract = this.auditDesignContract();
    const violations: DesignFinding[] = [];
    const warnings: DesignFinding[] = [];

    if (!contract.valid) {
      for (const m of contract.missingSections) {
        violations.push({
          severity: "BLOCKING",
          rule: "DESIGN_CONTRACT_INCOMPLETE",
          description: `Contract section missing: ${m}`,
          file: "DESIGN.md",
        });
      }
    }

    const filesToAudit = targetPaths && targetPaths.length > 0 ? targetPaths : ["index.html", "css/eos.css"];

    let inspectedFiles = 0;
    for (const relPath of filesToAudit) {
      const fullPath = path.isAbsolute(relPath) ? relPath : path.join(this.projectRoot, relPath);
      if (fs.existsSync(fullPath)) {
        inspectedFiles++;
        const content = fs.readFileSync(fullPath, "utf8");
        const findings = this.auditMarkup(content, relPath);
        for (const f of findings) {
          if (f.severity === "BLOCKING") violations.push(f);
          else warnings.push(f);
        }
      }
    }

    let score = 100 - violations.length * 20 - warnings.length * 2;
    if (score < 0) score = 0;

    const contractHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ valid: contract.valid, violations: violations.length, score }))
      .digest("hex");

    return {
      compliant: violations.length === 0,
      inspectedFiles,
      violations,
      warnings,
      score,
      contractHash,
    };
  }
}
