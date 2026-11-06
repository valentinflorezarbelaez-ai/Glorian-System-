/**
 * EOS SPEC DRIFT DETECTOR (Layer 0)
 * SPEC-049: Constitutional Law I enforcement — Specification as Supreme Truth.
 *
 * Detects drift between source code and formal specifications:
 *   - A module was modified more recently than its corresponding spec
 *   - A module exists in src/core/ but has no spec in openspec/specs/
 *   - A spec references a module that no longer exists
 *
 * Zero external runtime dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createLogger } from "./eosLogger.ts";

const _log = createLogger("eosSpecDriftDetector");

export type DriftSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface DriftViolation {
  readonly id: string;
  readonly severity: DriftSeverity;
  readonly type:
    | "MODULE_WITHOUT_SPEC"       // Code exists, no spec found
    | "SPEC_WITHOUT_MODULE"       // Spec references module that doesn't exist
    | "CODE_NEWER_THAN_SPEC"      // Module modified after its spec (drift threshold exceeded)
    | "SPEC_NUMBER_GAP";          // SPEC numbering has gaps
  readonly modulePath: string;
  readonly specPath: string | null;
  readonly moduleModifiedAt: string | null;
  readonly specModifiedAt: string | null;
  readonly driftDays: number;
  readonly message: string;
  readonly remediation: string;
}

export interface SpecDriftReport {
  readonly isClean: boolean;
  readonly totalModulesScanned: number;
  readonly totalSpecsScanned: number;
  readonly violations: readonly DriftViolation[];
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly driftScore: number; // 0=perfect, 100=maximum drift
  readonly scannedAt: string;
  readonly sha256: string;
}

export interface DriftDetectorOptions {
  /** Days of drift before a violation is raised. Default: 7. */
  readonly driftThresholdDays?: number;
  /** Only modules matching this pattern are checked. Default: all. */
  readonly modulePattern?: RegExp;
  /** If true, SPEC_WITHOUT_MODULE violations are included. Default: true. */
  readonly checkOrphanSpecs?: boolean;
}

export class EosSpecDriftDetector {
  private readonly projectRoot: string;
  private readonly coreDir:     string;
  private readonly specsDir:    string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.coreDir     = path.join(this.projectRoot, "src", "core");
    this.specsDir    = path.join(this.projectRoot, "openspec", "specs");
  }

  /**
   * Scans all modules in src/core/ and checks for spec drift.
   */
  public detect(options: DriftDetectorOptions = {}): SpecDriftReport {
    const driftThresholdDays = options.driftThresholdDays ?? 7;
    const checkOrphanSpecs   = options.checkOrphanSpecs  ?? true;

    _log.info("Spec drift detection started", { driftThresholdDays });

    const violations: DriftViolation[] = [];
    const modules = this._scanModules();
    const specs   = this._scanSpecs();

    // Build spec lookup: module name fragment → spec path
    const specByModule = new Map<string, string>();
    for (const specPath of specs) {
      const specName = path.basename(specPath, ".md").toLowerCase();
      specByModule.set(specName, specPath);
    }

    // Check every module
    for (const modulePath of modules) {
      if (options.modulePattern && !options.modulePattern.test(modulePath)) continue;

      const moduleName = path.basename(modulePath, ".ts").toLowerCase();
      const moduleShort = moduleName.replace(/^eos/, "");

      // Find matching spec (flexible match)
      let matchedSpec: string | null = null;
      for (const [specName, specPath] of specByModule.entries()) {
        if (specName.includes(moduleShort) || moduleShort.includes(specName.replace(/^spec-\d+-/, ""))) {
          matchedSpec = specPath;
          break;
        }
      }

      const modStat = fs.statSync(path.join(this.coreDir, modulePath));
      const modMtime = modStat.mtimeMs;

      if (!matchedSpec) {
        // Critical: module exists but no spec
        violations.push({
          id:               `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          severity:         "HIGH",
          type:             "MODULE_WITHOUT_SPEC",
          modulePath:       `src/core/${modulePath}`,
          specPath:         null,
          moduleModifiedAt: new Date(modMtime).toISOString(),
          specModifiedAt:   null,
          driftDays:        0,
          message:          `src/core/${modulePath} has no corresponding spec in openspec/specs/`,
          remediation:      `Create openspec/specs/SPEC-NNN-${moduleShort.toUpperCase()}.md with EARS requirements`,
        });
        continue;
      }

      // Check if module is newer than spec
      const specStat = fs.statSync(matchedSpec);
      const specMtime = specStat.mtimeMs;
      const driftMs   = modMtime - specMtime;
      const driftDays = driftMs / (1000 * 60 * 60 * 24);

      if (driftDays > driftThresholdDays) {
        const severity: DriftSeverity = driftDays > 30 ? "CRITICAL" : driftDays > 14 ? "HIGH" : "MEDIUM";
        violations.push({
          id:               `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          severity,
          type:             "CODE_NEWER_THAN_SPEC",
          modulePath:       `src/core/${modulePath}`,
          specPath:         path.relative(this.projectRoot, matchedSpec),
          moduleModifiedAt: new Date(modMtime).toISOString(),
          specModifiedAt:   new Date(specMtime).toISOString(),
          driftDays:        Math.round(driftDays),
          message:          `src/core/${modulePath} was modified ${Math.round(driftDays)} days after its spec — spec may be stale`,
          remediation:      `Update ${path.basename(matchedSpec)} to reflect the code changes, then run eos spec check`,
        });
      }
    }

    // Check for orphan specs (specs referencing non-existent modules)
    if (checkOrphanSpecs) {
      for (const specPath of specs) {
        const specName = path.basename(specPath, ".md").toLowerCase().replace(/^spec-\d+-/, "");
        const hasModule = modules.some(m =>
          m.toLowerCase().replace(/^eos/, "").includes(specName) ||
          specName.includes(m.toLowerCase().replace(/^eos/, ""))
        );
        if (!hasModule && specName.length > 3) {
          violations.push({
            id:               `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
            severity:         "LOW",
            type:             "SPEC_WITHOUT_MODULE",
            modulePath:       "(none)",
            specPath:         path.relative(this.projectRoot, specPath),
            moduleModifiedAt: null,
            specModifiedAt:   new Date(fs.statSync(specPath).mtimeMs).toISOString(),
            driftDays:        0,
            message:          `${path.basename(specPath)} has no matching module in src/core/`,
            remediation:      `Either implement the module or archive the spec to openspec/specs/archived/`,
          });
        }
      }
    }

    const criticalCount = violations.filter(v => v.severity === "CRITICAL").length;
    const highCount     = violations.filter(v => v.severity === "HIGH").length;
    const mediumCount   = violations.filter(v => v.severity === "MEDIUM").length;
    const driftScore    = Math.min(100, Math.round((violations.length / Math.max(modules.length, 1)) * 100));

    const report: SpecDriftReport = {
      isClean:             violations.length === 0,
      totalModulesScanned: modules.length,
      totalSpecsScanned:   specs.length,
      violations:          Object.freeze(violations),
      criticalCount,
      highCount,
      mediumCount,
      driftScore,
      scannedAt:           new Date().toISOString(),
      sha256:              `sha256:${crypto.createHash("sha256").update(JSON.stringify(violations)).digest("hex")}`,
    };

    _log.info("Spec drift detection complete", {
      violations: violations.length,
      criticalCount,
      highCount,
      driftScore,
    });

    return Object.freeze(report);
  }

  private _scanModules(): string[] {
    if (!fs.existsSync(this.coreDir)) return [];
    return fs.readdirSync(this.coreDir)
      .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .sort();
  }

  private _scanSpecs(): string[] {
    if (!fs.existsSync(this.specsDir)) return [];
    return fs.readdirSync(this.specsDir)
      .filter(f => f.endsWith(".md"))
      .map(f => path.join(this.specsDir, f))
      .sort();
  }
}
