/**
 * Bounded local CI/CD demo data. This module does not execute CI stages,
 * generate an SBOM, authorize deployment, or probe a live service.
 */

import crypto from "node:crypto";

export interface CicdStageSpec {
  readonly stageNumber: number;
  readonly id: string;
  readonly name: string;
  readonly scope: string;
}

export interface CicdStageRunResult {
  readonly stageNumber: number;
  readonly id: string;
  readonly status: "SIMULATED_PASS" | "NOT_EXECUTED";
  readonly summary: string;
}

export interface CicdPipelineReceipt {
  readonly pipelineId: "EOS-CICD-SIMULATION";
  readonly schemaVersion: "1.0.0";
  readonly trigger: "BROWSER_DEMO";
  readonly simulation: true;
  readonly scope: "ILLUSTRATIVE_STAGES_ONLY";
  readonly allStagesSimulatedPass: true;
  readonly deploymentPerformed: false;
  readonly sbomGenerated: false;
  readonly stages: readonly CicdStageRunResult[];
  readonly simulationFingerprintSha256: string;
}

export const SOVEREIGN_CICD_STAGES: readonly CicdStageSpec[] = [
  { stageNumber: 1, id: "credential-patterns", name: "Simulation: configured credential patterns", scope: "No repository scan; the real gate uses five configured patterns." },
  { stageNumber: 2, id: "landing-assertions", name: "Simulation: landing and integrity assertions", scope: "No build or browser execution." },
  { stageNumber: 3, id: "runtime-inventory", name: "Simulation: runtime dependency and source inventory", scope: "No SLSA provenance or standard SBOM is generated." },
  { stageNumber: 4, id: "syntax-types-tests", name: "Simulation: syntax, type-check, and tests", scope: "No compiler or test suite is run by this demo." },
  { stageNumber: 5, id: "static-web-checks", name: "Simulation: static web assertions and budgets", scope: "No browser accessibility or Core Web Vitals audit." },
  { stageNumber: 6, id: "handler-smoke-checks", name: "Simulation: API handler smoke checks", scope: "No HTTP server is started; the real local gate uses mock request/response objects." },
  { stageNumber: 7, id: "deployment", name: "Simulation: deployment stage", scope: "No deployment, live probe, rollback, or production state change." }
];

export function simulateCicdGateExecution(_requestedTrigger?: string): CicdPipelineReceipt {
  const stages: CicdStageRunResult[] = SOVEREIGN_CICD_STAGES.map((stage) => ({
    stageNumber: stage.stageNumber,
    id: stage.id,
    status: "SIMULATED_PASS",
    summary: `${stage.name} — simulated only; ${stage.scope}`
  }));
  const simulationFingerprintSha256 = crypto
    .createHash("sha256")
    .update(JSON.stringify({ schemaVersion: "1.0.0", stages }), "utf8")
    .digest("hex");

  return {
    pipelineId: "EOS-CICD-SIMULATION",
    schemaVersion: "1.0.0",
    trigger: "BROWSER_DEMO",
    simulation: true,
    scope: "ILLUSTRATIVE_STAGES_ONLY",
    allStagesSimulatedPass: true,
    deploymentPerformed: false,
    sbomGenerated: false,
    stages,
    simulationFingerprintSha256: `sha256:${simulationFingerprintSha256}`
  };
}
