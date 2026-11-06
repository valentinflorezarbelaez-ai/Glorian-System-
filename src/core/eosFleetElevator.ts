/**
 * Reads local fleet registry entries and reports heuristic file-presence checks.
 * Optional catalog scaffolding requires explicit apply mode and one project ID.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EosSpotifyCodex } from "./eosSpotifyCodex.ts";

export interface ProjectElevationReport {
  readonly id: string;
  readonly name: string;
  readonly pathExists: boolean;
  readonly localInventoryScore: number;
  readonly catalogInfoStatus: "PRESENT_UNCHECKED" | "SCAFFOLDED" | "MISSING";
  readonly hooksStatus: "PRESENT_UNCHECKED" | "MISSING";
  readonly recommendations: readonly string[];
}

export interface FleetElevationReport {
  readonly totalProjects: number;
  readonly projectsAboveHeuristicThreshold: number;
  readonly meanLocalInventoryScore: number;
  readonly projects: readonly ProjectElevationReport[];
  readonly resultFingerprintSha256: string;
  readonly timestamp: string;
}

export class EosFleetElevator {
  private readonly projectRoot: string;
  private readonly registryPath: string;
  private readonly codex: EosSpotifyCodex;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.registryPath = path.join(this.projectRoot, "docs", "projects", "registry.json");
    this.codex = new EosSpotifyCodex(this.projectRoot);
  }

  /**
   * Reads a registry snapshot and checks a small set of local path-presence heuristics.
   */
  public elevateFleet(options: { dryRun?: boolean; targetProject?: string } = {}): FleetElevationReport {
    const dryRun = options.dryRun !== false;
    if (!dryRun && !options.targetProject) {
      throw new Error("Applying a fleet change requires one explicit targetProject; use dryRun for a registry-wide report.");
    }
    if (!fs.existsSync(this.registryPath)) {
      throw new Error(`Registry not found at ${this.registryPath}`);
    }

    const registry = JSON.parse(fs.readFileSync(this.registryPath, "utf8"));
    const rawProjects = Array.isArray(registry.projects) ? registry.projects : [];
    if (options.targetProject && !rawProjects.some((project: { id?: string }) => project.id === options.targetProject)) {
      throw new Error(`Unknown fleet project ID: ${options.targetProject}`);
    }

    const reports: ProjectElevationReport[] = [];
    let totalScore = 0;

    for (const proj of rawProjects) {
      if (options.targetProject && proj.id !== options.targetProject) {
        continue;
      }

      const envName = typeof proj.localPathEnv === "string" ? proj.localPathEnv : "";
      const envPath = envName && /^EOS_FLEET_[A-Z0-9_]+_PATH$/.test(envName) ? process.env[envName] : undefined;
      const pPath = proj.id === "eos-system"
        ? this.projectRoot
        : typeof envPath === "string" && envPath.trim() ? path.resolve(this.projectRoot, envPath.trim()) : null;
      const exists = pPath !== null && fs.existsSync(pPath);
      let catalogStatus: ProjectElevationReport["catalogInfoStatus"] = "MISSING";
      let hooksStatus: ProjectElevationReport["hooksStatus"] = "MISSING";
      let score = 0;
      const recs: string[] = [];

      if (exists && pPath) {
        // Local inventory only; no external standards or hooks are executed.
        const audit = this.codex.auditUniversalProject(pPath);
        score = audit.localInventoryScore;
        recs.push(...audit.recommendations);

        const catalogPath = path.join(pPath, "catalog-info.yaml");
        if (fs.existsSync(catalogPath)) {
          catalogStatus = "PRESENT_UNCHECKED";
        } else if (!dryRun) {
          // Explicit apply mode can scaffold a missing descriptor.
          try {
            this.codex.scaffoldBackstageCatalog(pPath, {
              name: proj.id,
              owner: "user:unassigned",
              description: proj.name
            });
            catalogStatus = "SCAFFOLDED";
            score = this.codex.auditUniversalProject(pPath).localInventoryScore;
          } catch {
            catalogStatus = "MISSING";
          }
        }

        // Check Git Hooks
        const hookPath = path.join(pPath, ".githooks", "pre-commit");
        if (fs.existsSync(hookPath)) {
          hooksStatus = "PRESENT_UNCHECKED";
        } else {
          hooksStatus = "MISSING";
          recs.push("Install .githooks/pre-commit for SecDevOps 0-secrets gate");
        }
      } else {
        score = 0;
        const pathDescription = envName || "a local checkout setting";
        recs.push(`Local checkout is unavailable; configure ${pathDescription} before auditing or changing this project.`);
      }

      totalScore += score;
      reports.push({
        id: proj.id,
        name: proj.name,
        pathExists: exists,
        localInventoryScore: score,
        catalogInfoStatus: catalogStatus,
        hooksStatus,
        recommendations: recs
      });
    }

    const count = reports.length || 1;
    const fleetScore = Number((totalScore / count).toFixed(1));

    const snapshotData = reports.map((r) => `${r.id}:${r.localInventoryScore}:${r.catalogInfoStatus}`).join("|");
    const resultFingerprintSha256 = crypto.createHash("sha256").update(snapshotData).digest("hex");

    const finalReport: FleetElevationReport = {
      totalProjects: reports.length,
      projectsAboveHeuristicThreshold: reports.filter((r) => r.localInventoryScore >= 70).length,
      meanLocalInventoryScore: fleetScore,
      projects: reports,
      resultFingerprintSha256,
      timestamp: new Date().toISOString()
    };

    // Seal receipt if not in dry-run
    if (!dryRun) {
      const receiptName = `FLEET-ELEVATION-RECEIPT-${finalReport.timestamp.replace(/[:.]/g, "-")}.json`;
      const receiptPath = path.join(this.projectRoot, "docs", "evidence", receiptName);
      fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
      fs.writeFileSync(receiptPath, JSON.stringify(finalReport, null, 2), "utf8");
    }

    return finalReport;
  }
}
