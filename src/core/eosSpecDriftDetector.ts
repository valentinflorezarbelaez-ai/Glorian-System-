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
    | "MODULE_WITHOUT_SPEC" // Code exists, no spec found
    | "SPEC_WITHOUT_MODULE" // Spec references module that doesn't exist
    | "CODE_NEWER_THAN_SPEC" // Module modified after its spec (drift threshold exceeded)
    | "SPEC_NUMBER_GAP"; // SPEC numbering has gaps
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

/**
 * Declarative Layer-0 mapping of core architectural modules to their formal OpenSpecs.
 */
const KNOWN_MODULE_SPECS: Readonly<Record<string, number>> = Object.freeze({
  "EosAin.ts": 10,
  "EosAstral.ts": 10,
  "EosElohim.ts": 10,
  "eosAgiTypes.ts": 1,
  "eosAntiEntropyMerkleSync.ts": 70,
  "eosApexDoctrineScorecard.ts": 139,
  "eosArchitectureGuard.ts": 2,
  "eosBigTechPantheon.ts": 139,
  "eosCicdPipeline.ts": 96,
  "eosDeterministicArtifact.ts": 67,
  "eosErrorCatalog.ts": 35,
  "eosFleetDispatcher.ts": 36,
  "eosFleetPulseEngine.ts": 38,
  "eosLinuxKernelCore.ts": 73,
  "eosMcpToolTaxonomy.ts": 82,
  "eosMindLevelsIntrospector.ts": 8,
  "eosNanosecondEngine.ts": 19,
  "eosNeuralVectorCore.ts": 10,
  "eosOmegaSingularity.ts": 28,
  "eosOpenSpecSync.ts": 44,
  "eosPatchValidator.ts": 12,
  "eosProductDeliveryOrchestrator.ts": 106,
  "eosPromptAmplifier.ts": 15,
  "eosTurboEngine.ts": 7,
  "eosWorktreeOrchestrator.ts": 3,
  "eosAutonomousHealer.ts": 5,
  "eosCognitiveEval.ts": 8,
  "eosJarvisMonad.ts": 9,
  "eosConsistentHashRing.ts": 29,
  "eosContainerSandbox.ts": 11,
  "eosContextOptimizer.ts": 25,
  "eosControlPlaneHealthProbes.ts": 16,
  "eosGoAccelerator.ts": 11,
  "eosAudioDspKernel.ts": 13,
  "eosWasmSandboxEngine.ts": 26,
  "eosSemanticGraph.ts": 7,
  "eosTokenBucketRateLimiter.ts": 30,
  "eosEngineeringWorkflow.ts": 28,
  "eosFleetElevator.ts": 14,
  "eosFleetRagGoldenPath.ts": 14,
  "eosSpotifyCodex.ts": 24,
  "eosSpotifyCodex.types.ts": 24,
  "eosSpotifyNubankEngine.ts": 16,
  "eosNubankCodex.ts": 23,
  "eosNocturnalEvolutionEngine.ts": 43,
  "eosCognitiveJudge.ts": 8,
  "glorianFleetHealthWatchdog.ts": 38,
  "samaelCodex.ts": 21,
  "eosThreeMountainsCompass.ts": 10,
  "eosAdaptiveL0Autotuner.ts": 19,
});

export class EosSpecDriftDetector {
  private readonly projectRoot: string;
  private readonly coreDir: string;
  private readonly specsDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.coreDir = path.join(this.projectRoot, "src", "core");
    this.specsDir = path.join(this.projectRoot, "openspec", "specs");
  }

  /**
   * Scans all modules in src/core/ and checks for spec drift.
   */
  public detect(options: DriftDetectorOptions = {}): SpecDriftReport {
    const driftThresholdDays = options.driftThresholdDays ?? 7;
    const checkOrphanSpecs = options.checkOrphanSpecs ?? true;

    _log.info("Spec drift detection started", { driftThresholdDays });

    const violations: DriftViolation[] = [];
    const modules = this._scanModules();
    const specs = this._scanSpecs();

    // Build spec lookup maps:
    // 1. By SPEC number (e.g. 5 -> /.../SPEC-005-AUTONOMOUS-HEALER.md)
    // 2. By cleaned name (e.g. "autonomoushealer" -> /.../SPEC-005-AUTONOMOUS-HEALER.md)
    const specByNumber = new Map<number, string>();
    const specByCleanName = new Map<string, string>();
    for (const specPath of specs) {
      const base = path.basename(specPath, ".md");
      const numMatch = base.match(/SPEC-(\d+)/i);
      if (numMatch) {
        specByNumber.set(parseInt(numMatch[1], 10), specPath);
      }
      const cleanName = base
        .toLowerCase()
        .replace(/^spec-\d+-/i, "")
        .replace(/[-_.]/g, "");
      specByCleanName.set(cleanName, specPath);
    }

    const matchedSpecPaths = new Set<string>();

    // Check every module
    for (const modulePath of modules) {
      if (options.modulePattern && !options.modulePattern.test(modulePath)) continue;

      const fullModulePath = path.join(this.coreDir, modulePath);
      const moduleName = path.basename(modulePath, ".ts").toLowerCase();
      const moduleShort = moduleName.replace(/^eos/, "");

      let matchedSpec: string | null = null;

      // Tier 0: Known declarative module mapping
      if (!matchedSpec && KNOWN_MODULE_SPECS[modulePath]) {
        const specNum = KNOWN_MODULE_SPECS[modulePath];
        if (specByNumber.has(specNum)) {
          matchedSpec = specByNumber.get(specNum)!;
        }
      }

      // Tier 1: Check explicit SPEC-NNN in file comments (first 4KB)
      try {
        const headerSnippet = fs.readFileSync(fullModulePath, "utf8").slice(0, 4096);
        const headerMatches = headerSnippet.match(/SPEC-(\d+)/gi);
        if (headerMatches) {
          for (const m of headerMatches) {
            const num = parseInt(m.replace(/SPEC-/i, ""), 10);
            if (specByNumber.has(num)) {
              matchedSpec = specByNumber.get(num)!;
              break;
            }
          }
        }
      } catch {}

      // Tier 2: Clean name exact or substring match
      if (!matchedSpec) {
        const moduleClean = moduleName.replace(/^(eos|glorian|samael)/i, "").replace(/[-_.]/g, "");
        for (const [sClean, sPath] of specByCleanName.entries()) {
          if (
            sClean === moduleClean ||
            (moduleClean.length >= 5 && (sClean.includes(moduleClean) || moduleClean.includes(sClean)))
          ) {
            matchedSpec = sPath;
            break;
          }
        }
      }

      // Tier 3: Token-based overlap
      if (!matchedSpec) {
        const mTokens = modulePath
          .replace(/([a-zA-Z])([A-Z][a-z])/g, "$1 $2")
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 4 && w !== "spec" && w !== "core" && w !== "types" && w !== "eos");

        if (mTokens.length > 0) {
          for (const sPath of specs) {
            const sBase = path.basename(sPath, ".md").toLowerCase();
            const sTokens = sBase
              .replace(/[^a-z0-9]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length >= 4);
            const overlap = mTokens.filter((t) => sTokens.includes(t));
            if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length >= 7)) {
              matchedSpec = sPath;
              break;
            }
          }
        }
      }

      const modStat = fs.statSync(fullModulePath);
      const modMtime = modStat.mtimeMs;

      if (!matchedSpec) {
        // Critical: module exists but no spec
        violations.push({
          id: `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          severity: "HIGH",
          type: "MODULE_WITHOUT_SPEC",
          modulePath: `src/core/${modulePath}`,
          specPath: null,
          moduleModifiedAt: new Date(modMtime).toISOString(),
          specModifiedAt: null,
          driftDays: 0,
          message: `src/core/${modulePath} has no corresponding spec in openspec/specs/`,
          remediation: `Create openspec/specs/SPEC-NNN-${moduleShort.toUpperCase()}.md with EARS requirements`,
        });
        continue;
      }

      matchedSpecPaths.add(matchedSpec);

      // Check if module is newer than spec
      const specStat = fs.statSync(matchedSpec);
      const specMtime = specStat.mtimeMs;
      const driftMs = modMtime - specMtime;
      const driftDays = driftMs / (1000 * 60 * 60 * 24);

      if (driftDays > driftThresholdDays) {
        const severity: DriftSeverity = driftDays > 30 ? "CRITICAL" : driftDays > 14 ? "HIGH" : "MEDIUM";
        violations.push({
          id: `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          severity,
          type: "CODE_NEWER_THAN_SPEC",
          modulePath: `src/core/${modulePath}`,
          specPath: path.relative(this.projectRoot, matchedSpec),
          moduleModifiedAt: new Date(modMtime).toISOString(),
          specModifiedAt: new Date(specMtime).toISOString(),
          driftDays: Math.round(driftDays),
          message: `src/core/${modulePath} was modified ${Math.round(driftDays)} days after its spec — spec may be stale`,
          remediation: `Update ${path.basename(matchedSpec)} to reflect the code changes, then run eos spec check`,
        });
      }
    }

    // Check for orphan specs (specs referencing non-existent modules)
    if (checkOrphanSpecs) {
      for (const specPath of specs) {
        if (matchedSpecPaths.has(specPath)) continue;
        const specName = path
          .basename(specPath, ".md")
          .toLowerCase()
          .replace(/^spec-\d+-/, "");

        // Check if this spec belongs to an external fleet repository or fleet elevation
        try {
          const specContent = fs.readFileSync(specPath, "utf8").slice(0, 2048);
          if (
            /project\s*id\**:\s*[`"]?(?!eos-system|glorian)[a-z0-9_-]+/i.test(specContent) ||
            specContent.includes("Registered Fleet Repositories") ||
            specName.includes("elevation") ||
            specName.includes("attendance-control") ||
            specName.includes("fleet-registry-sync") ||
            specName.includes("samael")
          ) {
            continue;
          }
        } catch {}

        // Foundational, UI, terminal, or cross-cutting specs
        const isCrossCutting =
          /spec-00[1-4]-/i.test(path.basename(specPath)) ||
          specName.includes("constitution") ||
          specName.includes("sdlc") ||
          specName.includes("whitepaper") ||
          specName.includes("pantheon") ||
          specName.includes("mission-control") ||
          specName.includes("reusable-gate") ||
          specName.includes("mcp-stream") ||
          specName.includes("disruptor") ||
          specName.includes("finops") ||
          specName.includes("arbiter") ||
          specName.includes("apex") ||
          specName.includes("gnostic") ||
          specName.includes("transcendental") ||
          specName.includes("secret-scan") ||
          specName.includes("autotuner") ||
          specName.includes("untrusted-browser-data") ||
          specName.includes("verifiable-api-results") ||
          specName.includes("safe-agent-harness") ||
          specName.includes("sovereign-21step-loop");

        if (isCrossCutting) continue;

        const hasModule = modules.some(
          (m) =>
            m.toLowerCase().replace(/^eos/, "").includes(specName) ||
            specName.includes(m.toLowerCase().replace(/^eos/, "")),
        );
        if (!hasModule && specName.length > 3) {
          violations.push({
            id: `DRIFT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
            severity: "LOW",
            type: "SPEC_WITHOUT_MODULE",
            modulePath: "(none)",
            specPath: path.relative(this.projectRoot, specPath),
            moduleModifiedAt: null,
            specModifiedAt: new Date(fs.statSync(specPath).mtimeMs).toISOString(),
            driftDays: 0,
            message: `${path.basename(specPath)} has no matching module in src/core/`,
            remediation: `Either implement the module or archive the spec to openspec/specs/archived/`,
          });
        }
      }
    }

    const criticalCount = violations.filter((v) => v.severity === "CRITICAL").length;
    const highCount = violations.filter((v) => v.severity === "HIGH").length;
    const mediumCount = violations.filter((v) => v.severity === "MEDIUM").length;
    const driftScore = Math.min(100, Math.round((violations.length / Math.max(modules.length, 1)) * 100));

    const report: SpecDriftReport = {
      isClean: violations.length === 0,
      totalModulesScanned: modules.length,
      totalSpecsScanned: specs.length,
      violations: Object.freeze(violations),
      criticalCount,
      highCount,
      mediumCount,
      driftScore,
      scannedAt: new Date().toISOString(),
      sha256: `sha256:${crypto.createHash("sha256").update(JSON.stringify(violations)).digest("hex")}`,
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
    return fs
      .readdirSync(this.coreDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .sort();
  }

  private _scanSpecs(): string[] {
    if (!fs.existsSync(this.specsDir)) return [];
    return fs
      .readdirSync(this.specsDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(this.specsDir, f))
      .sort();
  }
}
