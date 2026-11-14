/**
 * SPEC-243 / CHANGE-122 — Layer-0 Fleet Multi-Repo Ship Orchestrator Core.
 * Validates all registered fleet projects against EOS Constitution Law IV
 * (6 mandatory preconditions) and computes ship readiness without side effects.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  FleetProjectRecordInput,
  FleetRepoShipStatus,
  FleetShipOrchestrationReport,
  FleetVerdictStatus,
  OrchestrateFleetShipOptions,
} from "./eosFleetMultiRepoShipOrchestratorCore.types.ts";

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function collectMissingLawIvGates(project: FleetProjectRecordInput): readonly string[] {
  const missing: string[] = [];
  if (project.status !== "REGISTERED") missing.push("REGISTERED");
  if (project.intake !== "INTAKE_COMPLETE") missing.push("INTAKE_COMPLETE");
  if (project.specification !== "SPECIFICATION_APPROVED") missing.push("SPECIFICATION_APPROVED");
  if (project.audit !== "AUDIT_COMPLETE") missing.push("AUDIT_COMPLETE");
  if (project.ownerApproval !== "OWNER_APPROVAL") missing.push("OWNER_APPROVAL");
  if (!/^LEVEL_[23]/.test(project.authorization ?? "")) missing.push("IMPLEMENTATION_AUTHORIZED(LEVEL_2+)");
  return missing;
}

function checkLocalCheckout(rootAbs: string, project: FleetProjectRecordInput, probe: boolean): boolean {
  if (!probe) return project.id === "eos-system";
  if (project.id === "eos-system") return fs.existsSync(rootAbs);
  const siblingName = (project.resolvedLocalDir ?? "").trim();
  if (!siblingName || siblingName.includes("..") || siblingName.includes("/") || siblingName.includes("\\")) {
    return false;
  }
  const siblingDir = path.join(path.dirname(rootAbs), siblingName);
  return fs.existsSync(siblingDir);
}

function evaluateSingleProject(
  rootAbs: string,
  project: FleetProjectRecordInput,
  probeLocal: boolean,
): FleetRepoShipStatus {
  const missingPreconditions = collectMissingLawIvGates(project);
  const lawIvBarrierPassed = missingPreconditions.length === 0;
  const readinessScore = Math.max(0, Math.min(100, 100 - missingPreconditions.length * 16));
  const localCheckoutPresent = checkLocalCheckout(rootAbs, project, probeLocal);
  const shipReady = lawIvBarrierPassed;

  const digestPayload = {
    id: project.id,
    name: project.name,
    lawIvBarrierPassed,
    missingPreconditions,
    shipReady,
    readinessScore,
  };
  const repoDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(digestPayload)).digest("hex");

  return {
    ...digestPayload,
    localCheckoutPresent,
    repoDigestSha256,
  };
}

export class EosFleetMultiRepoShipOrchestratorCore {
  static orchestrateFleetShipReadiness(options: OrchestrateFleetShipOptions = {}): FleetShipOrchestrationReport {
    const rootAbs = path.resolve(options.projectRoot ?? process.cwd());
    const registryRelPath = options.registryRelPath ?? "docs/projects/registry.json";
    const resolvedRegistryPath = resolveConfinedPath(rootAbs, registryRelPath);

    let projects: readonly FleetProjectRecordInput[] = options.projectsOverride ?? [];
    if (!options.projectsOverride) {
      const raw = fs.readFileSync(resolvedRegistryPath, "utf8");
      const parsed = JSON.parse(raw) as { projects?: FleetProjectRecordInput[] };
      projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    }

    const probeLocal = options.probeLocalCheckouts === true;
    const projectStatuses = projects.map((p) => evaluateSingleProject(rootAbs, p, probeLocal));
    const totalProjects = projectStatuses.length;
    const authorizedProjects = projectStatuses.filter((p) => p.shipReady).length;
    const blockedProjects = totalProjects - authorizedProjects;
    const averageReadinessScore =
      totalProjects > 0 ? Math.round(projectStatuses.reduce((sum, p) => sum + p.readinessScore, 0) / totalProjects) : 0;
    const fleetVerdict: FleetVerdictStatus =
      totalProjects > 0 && blockedProjects === 0 ? "FLEET_SHIP_READY" : "FLEET_PARTIAL_BLOCK";

    const payload = {
      totalProjects,
      authorizedProjects,
      blockedProjects,
      averageReadinessScore,
      fleetVerdict,
      projectStatuses,
    };
    const fleetShipDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return deepFreeze({ ...payload, fleetShipDigestSha256 });
  }
}
