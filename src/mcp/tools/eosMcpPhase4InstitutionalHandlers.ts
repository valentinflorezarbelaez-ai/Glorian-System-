/**
 * EOS SYSTEM — PHASE-4 INSTITUTIONAL MCP HANDLERS (SPEC-155 / Big Tech wave)
 * Extracts residual institutional / supply-chain / doctrine tools from the god-file switch.
 * Doctrine analogs only: Nubank Datomic/Sachem, Spotify Golden Path/Canary, SLSA, Apex/Black Triad.
 * Explicitly NOT vendor production control or Level 5.
 */

import {
  evaluateNubankArchitectureHealth,
  verifySachemContract,
  synthesizeNubankBlamelessPostmortem,
  transactDatomic,
  createEmptyDatomicDb
} from "../../core/eosNubankCodex.ts";
import {
  evaluateSpotifyArchitectureHealth,
  verifyBackstageGoldenPath,
  evaluateCanaryStage,
  planFleetshiftMigration
} from "../../core/eosSpotifyInstitutionalCodex.ts";
import { EosSlsaProvenanceSbom } from "../../core/eosSlsaProvenanceSbom.ts";
import { EosPlanetaryApexDoctrine } from "../../core/eosPlanetaryApexDoctrine.ts";
import { EosBlackProjectsTriad } from "../../core/eosBlackProjectsTriad.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";
import { PHASE4_MIGRATED_TOOL_NAMES } from "./eosMcpPhase4ToolNames.ts";

export { PHASE4_MIGRATED_TOOL_NAMES };

export function createPhase4InstitutionalHandlers(
  projectRoot: string
): Readonly<Record<string, McpToolHandler>> {
  return {
    eos_nubank_audit: (args) =>
      evaluateNubankArchitectureHealth({
        hasMutableStateInDomain: args.hasMutableStateInDomain === true,
        usesHexagonalLayerIsolation:
          args.usesHexagonalLayerIsolation === undefined || args.usesHexagonalLayerIsolation === true,
        usesContractTestingInsteadOfE2E:
          args.usesContractTestingInsteadOfE2E === undefined ||
          args.usesContractTestingInsteadOfE2E === true,
        enforcesKafkaIdempotencyTokens:
          args.enforcesKafkaIdempotencyTokens === undefined ||
          args.enforcesKafkaIdempotencyTokens === true,
        usesImmutableBitemporalLedgers:
          args.usesImmutableBitemporalLedgers === undefined ||
          args.usesImmutableBitemporalLedgers === true,
        hasBlamelessPostmortemProcess:
          args.hasBlamelessPostmortemProcess === undefined ||
          args.hasBlamelessPostmortemProcess === true,
        unitTestCoveragePercent: Number(args.unitTestCoveragePercent) || 90
      }),

    eos_nubank_sachem_verify: (args) => {
      if (!args.previousSchema || !args.proposedSchema) {
        throw new Error("Missing previousSchema or proposedSchema argument");
      }
      return verifySachemContract(args.previousSchema, args.proposedSchema);
    },

    eos_nubank_postmortem: (args) => synthesizeNubankBlamelessPostmortem(args as never),

    eos_nubank_datomic_transact: (args) => {
      const txData = Array.isArray(args.txData) ? args.txData : [];
      const db = createEmptyDatomicDb();
      return transactDatomic(db, txData);
    },

    eos_spotify_audit_institutional: (args) =>
      evaluateSpotifyArchitectureHealth({
        usesGoldenPath: args.usesGoldenPath !== false,
        hasCatalogInfoYaml: args.hasCatalogInfoYaml !== false,
        hasTechDocsAndRunbook: args.hasTechDocsAndRunbook !== false,
        compliesWithBS1770Loudness: args.compliesWithBS1770Loudness !== false,
        hasProgressiveCanaryPipeline: args.hasProgressiveCanaryPipeline !== false,
        hasAutomatedKillSwitch: args.hasAutomatedKillSwitch !== false,
        hasBlamelessPostmortemProcess: args.hasBlamelessPostmortemProcess !== false,
        unitTestCoveragePercent: Number(args.unitTestCoveragePercent) || 90
      }),

    eos_spotify_golden_path_verify: (args) =>
      verifyBackstageGoldenPath({
        serviceName: String(args.serviceName || "service"),
        filesPresent: Array.isArray(args.filesPresent) ? args.filesPresent : [],
        catalogInfoContent: args.catalogInfoContent ? String(args.catalogInfoContent) : undefined
      }),

    eos_spotify_canary_gate: (args) =>
      evaluateCanaryStage({
        stage: args.stage || "5%",
        trafficPercentage: Number(args.trafficPercentage) || 5,
        totalRequests: Number(args.totalRequests) || 10000,
        errorCount: Number(args.errorCount) || 0,
        p99LatencyMs: Number(args.p99LatencyMs) || 30,
        maxAllowedP99Ms: Number(args.maxAllowedP99Ms) || 50,
        observationWindowMinutes: Number(args.observationWindowMinutes) || 15
      }),

    eos_spotify_fleetshift_plan: (args) =>
      planFleetshiftMigration({
        migrationId: String(args.migrationId || "MIG-AUTO"),
        description: String(args.description || "Automated Fleet Migration"),
        targetRepos: Array.isArray(args.targetRepos) ? args.targetRepos : [],
        action: String(args.action || "apply_golden_path")
      }),

    eos_slsa_provenance_sbom: (args) => {
      const mode = String(args?.mode || "both").toLowerCase();
      const commitSha = args?.commitSha ? String(args.commitSha) : undefined;
      const recordToLedger = args?.recordToLedger !== false;

      if (mode === "verify") {
        const sbomPath = args?.sbomPath ? String(args.sbomPath) : undefined;
        const provenancePath = args?.provenancePath ? String(args.provenancePath) : undefined;
        return {
          verification: EosSlsaProvenanceSbom.verifySupplyChain(
            projectRoot,
            sbomPath,
            provenancePath
          )
        };
      }
      const result: {
        sbom?: ReturnType<typeof EosSlsaProvenanceSbom.generateCycloneDxSbom>;
        slsa?: ReturnType<typeof EosSlsaProvenanceSbom.generateSlsaProvenance>;
      } = {};
      if (mode === "sbom" || mode === "both") {
        result.sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(projectRoot);
        if (recordToLedger) {
          EosSlsaProvenanceSbom.recordReceiptInLedger(result.sbom, projectRoot);
        }
      }
      if (mode === "slsa" || mode === "both") {
        result.slsa = EosSlsaProvenanceSbom.generateSlsaProvenance(projectRoot, commitSha);
        if (recordToLedger) {
          EosSlsaProvenanceSbom.recordReceiptInLedger(result.slsa, projectRoot);
        }
      }
      return result;
    },

    eos_planetary_doctrine_audit: (args) => {
      const doctrine = new EosPlanetaryApexDoctrine(projectRoot);
      const report = doctrine.auditPillars();
      const format = String(args?.format || "json").toLowerCase();
      if (format === "summary") {
        return {
          status: report.status,
          overallScore: report.overallScore,
          totalDurationUs: report.totalDurationUs,
          pillarsAudited: report.pillars.length,
          sha256Receipt: report.sha256Receipt,
          pillars: report.pillars.map((p) => ({
            pillarId: p.pillarId,
            name: p.name,
            compliant: p.compliant,
            score: p.score,
            latencyUs: p.latencyUs,
            details: p.details
          }))
        };
      }
      return report;
    },

    eos_black_projects_triad_audit: (args) => {
      const triad = new EosBlackProjectsTriad(projectRoot);
      const report = triad.auditTriad();
      const format = String(args?.format || "json").toLowerCase();
      if (format === "summary") {
        return {
          status: report.status,
          overallScore: report.overallScore,
          totalDurationUs: report.totalDurationUs,
          pillarsAudited: report.pillars.length,
          epistemicState: report.epistemicState,
          claimsDenied: report.claimsDenied,
          sha256Receipt: report.sha256Receipt,
          pillars: report.pillars.map((p) => ({
            pillarId: p.pillarId,
            name: p.name,
            compliant: p.compliant,
            score: p.score,
            latencyUs: p.latencyUs,
            details: p.details
          }))
        };
      }
      return report;
    }
  };
}
