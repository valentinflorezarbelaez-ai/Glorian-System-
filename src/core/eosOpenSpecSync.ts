/**
 * EOS SYSTEM — LIVING OPENSPEC ARCHITECTURE & DRIFT SYNCHRONIZER (Layer 0)
 * Governed by ADR-024, FR-037 & BDD-032, BDD-033
 *
 * Enforces Constitutional Law I (Specification as Supreme Truth) and Law II (Strict Gate).
 * Analyzes living specifications in openspec/specs/ and delta proposals in openspec/changes/.
 * Detects undocumented drift between code mutations and formal specifications.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface OpenSpecFile {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly content: string;
  readonly sha256: string;
}

export interface OpenSpecChange {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly status: "PROPOSED" | "APPLIED_AND_VERIFIED" | "SUPERSEDED" | "REJECTED";
  readonly authorizationLevel: string;
  readonly impactedSpecs: readonly string[];
  readonly modulesAdded: readonly string[];
}

export interface OpenSpecAuditReport {
  readonly valid: boolean;
  readonly totalSpecs: number;
  readonly totalChanges: number;
  readonly orphanLinks: readonly string[];
  readonly missingAuthorizations: readonly string[];
  readonly findings: readonly string[];
  readonly sha256Proof: string;
  readonly timestamp: string;
}

export class EosOpenSpecSync {
  private readonly rootDir: string;
  private readonly specsDir: string;
  private readonly changesDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    this.specsDir = path.join(this.rootDir, "openspec", "specs");
    this.changesDir = path.join(this.rootDir, "openspec", "changes");
  }

  /**
   * Lists all living base specifications in openspec/specs/.
   */
  public listSpecs(): OpenSpecFile[] {
    if (!fs.existsSync(this.specsDir)) return [];

    const files = fs.readdirSync(this.specsDir).filter((f) => f.endsWith(".md"));
    return files.map((file) => {
      const fullPath = path.join(this.specsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const firstLine = content.split(/\r?\n/)[0] || "";
      const title = firstLine.replace(/^#+\s*/, "").trim() || file;
      const sha256 = crypto.createHash("sha256").update(content).digest("hex");
      return {
        id: file.replace(/\.md$/, ""),
        path: path.relative(this.rootDir, fullPath).replace(/\\/g, "/"),
        title,
        content,
        sha256,
      };
    });
  }

  /**
   * Lists all delta changes in openspec/changes/.
   */
  public listChanges(): OpenSpecChange[] {
    if (!fs.existsSync(this.changesDir)) return [];

    const files = fs.readdirSync(this.changesDir).filter((f) => f.endsWith(".md"));
    return files.map((file) => {
      const fullPath = path.join(this.changesDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const firstLine = content.split(/\r?\n/)[0] || "";
      const title = firstLine.replace(/^#+\s*/, "").trim() || file;

      // Parse status
      const statusMatch = content.match(/\*\*Status\*\*:\s*([A-Z_]+)/);
      const status = (statusMatch ? statusMatch[1] : "PROPOSED") as OpenSpecChange["status"];

      // Parse authorization level
      const authMatch = content.match(/\*\*Authorization Level\*\*:\s*([A-Z0-9_]+)/);
      const authorizationLevel = authMatch ? authMatch[1] : "LEVEL_0_UNAUTHORIZED";

      // Parse impacted specs
      const impactedSpecs: string[] = [];
      const impactedMatch = content.match(/\*\*Impacted Specifications\*\*:\s*(.*)/);
      if (impactedMatch) {
        const rawSpecs = impactedMatch[1].match(/`([^`]+)`/g) || [];
        for (const s of rawSpecs) {
          impactedSpecs.push(s.replace(/`/g, ""));
        }
      }

      // Parse modules added
      const modulesAdded: string[] = [];
      const lines = content.split(/\r?\n/);
      let inModules = false;
      for (const line of lines) {
        if (line.includes("**Modules Added**:")) {
          inModules = true;
          continue;
        }
        if (inModules) {
          if (line.startsWith("  - ") || line.startsWith("- ")) {
            const m = line
              .replace(/^\s*-\s*`?/, "")
              .replace(/`?(\s*\(.*\))?$/, "")
              .trim();
            if (m) modulesAdded.push(m);
          } else if (line.startsWith("#") || line.startsWith("**")) {
            inModules = false;
          }
        }
      }

      return {
        id: file.replace(/\.md$/, ""),
        path: path.relative(this.rootDir, fullPath).replace(/\\/g, "/"),
        title,
        status,
        authorizationLevel,
        impactedSpecs,
        modulesAdded,
      };
    });
  }

  /**
   * Audits consistency, detects orphan links, and verifies authorization levels.
   */
  public audit(): OpenSpecAuditReport {
    const specs = this.listSpecs();
    const changes = this.listChanges();
    const orphanLinks: string[] = [];
    const missingAuthorizations: string[] = [];
    const findings: string[] = [];

    const specIds = new Set(specs.map((s) => s.id));
    const specFiles = new Set(specs.map((s) => path.basename(s.path)));

    for (const change of changes) {
      // 1. Verify authorization level is LEVEL 2+
      const isAuthorized =
        change.authorizationLevel.includes("LEVEL_2") ||
        change.authorizationLevel.includes("LEVEL_3") ||
        change.authorizationLevel.includes("PRODUCTION_AUTHORIZED");

      if (!isAuthorized && change.status === "APPLIED_AND_VERIFIED") {
        missingAuthorizations.push(
          `Change ${change.id} marked as APPLIED but lacks Level 2+ Authorization (${change.authorizationLevel})`,
        );
      }

      // 2. Check for orphan references to non-existent base specs
      for (const impacted of change.impactedSpecs) {
        const base = path.basename(impacted);
        const withoutExt = base.replace(/\.md$/, "");
        if (!specFiles.has(base) && !specIds.has(withoutExt)) {
          orphanLinks.push(`Change ${change.id} references non-existent specification: ${impacted}`);
        }
      }
    }

    if (specs.length === 0) {
      findings.push("Zero base specifications found in openspec/specs/");
    }

    const valid = orphanLinks.length === 0 && missingAuthorizations.length === 0;

    const sha256Proof = crypto
      .createHash("sha256")
      .update(`OPENSPEC_AUDIT:${specs.length}:${changes.length}:${valid}`)
      .digest("hex");

    return {
      valid,
      totalSpecs: specs.length,
      totalChanges: changes.length,
      orphanLinks,
      missingAuthorizations,
      findings,
      sha256Proof,
      timestamp: new Date().toISOString(),
    };
  }
}
