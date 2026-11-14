/**
 * EOS SYSTEM — TLA+ SOURCE INVENTORY & BOUNDED JAVASCRIPT SIMULATIONS
 * This script extracts text from TLA+ files and runs separate, bounded JS simulations.
 * It does not parse TLA+ syntax or perform exhaustive TLC model checking.
 *
 * The simulation assertions are useful regression checks, not proofs of the TLA+ models.
 *
 * Invariant: Zero external dependencies (dependencies: {}).
 */

import { parseTlaModule } from "./tla/tlaShared.mjs";
import {
  verifyLmaxDisruptorModel,
  verifyDatomicLedgerModel,
  verifyHermesConsensusModel,
  verifyChaosDisruptorModel,
  verifyProductFoundryModel,
  verifyOmegaTranscendentalModel,
  verifyContinuousRefactorModel,
  verifyFleetSyncMctsCanaryModel,
  verifyAntigravityControlPlaneModel,
  verifyGentlemanEosSynergyMeshModel,
  verifyGentlemanAutoUpdateModel,
  verifyEnterpriseWorkspaceGovernorModel,
  verifyEvolutionaryHarnessModel,
  verifyAgentTopologyMeshModel,
} from "./tla/tlaSimulationsPart1.mjs";
import {
  verifyColumnarTelemetryEngineModel,
  verifyCellBasedBulkheadGovernorModel,
  verifyMultiWindowSloGovernorModel,
  verifyAdaptiveHedgedDeadlineMeshModel,
  verifyAdaptiveConcurrencyGovernorModel,
  verifyTailBasedTraceSamplerModel,
  verifyPredictiveRemediationEngineModel,
  verifyUnifiedKernelOrchestratorModel,
  verifyBigTechTranscendenceNexusModel,
  verifyEliteDesignStudioModel,
  verifyAgenticFinOpsGovernorModel,
  verifyPlanetaryMonorepoGovernorModel,
  verifyCrossFleetNeuralSynapseModel,
} from "./tla/tlaSimulationsPart2.mjs";
import {
  verifyVercelCanaryObservabilityModel,
  verifyBftAgentSwarmSlashingModel,
  verifyConsciousWitnessHotPatchingModel,
  verifyPropertyFuzzingTimeTravelHypervisorModel,
  verifySamaelUnitotalNexusModel,
  verifyFleetProductionVerificationModel,
  verifyTelemetryDashboardModel,
  verifyMicroVmSandboxModel,
  verifyGithubActionsPrGateModel,
  verifyTlcFormalModelCheckerModel,
  verifyAutonomousClosedLoopHealingModel,
  verifyContractEvolutionGovernanceModel,
  verifyInvariantVerificationEngineModel,
  verifyPlanetaryMultiCloudEvacuationModel,
} from "./tla/tlaSimulationsPart3.mjs";
import {
  verifySurfaceCodeQecModel,
  verifyLeoOpticalIslRoutingModel,
  verifyUhvGridDcOpfModel,
  verifyLawsonFusionIgnitionModel,
} from "./tla/tlaSimulationsPart4.mjs";

export {
  parseTlaModule,
  verifyLmaxDisruptorModel,
  verifyDatomicLedgerModel,
  verifyHermesConsensusModel,
  verifyChaosDisruptorModel,
  verifyProductFoundryModel,
  verifyOmegaTranscendentalModel,
  verifyContinuousRefactorModel,
  verifyFleetSyncMctsCanaryModel,
  verifyAntigravityControlPlaneModel,
  verifyGentlemanEosSynergyMeshModel,
  verifyGentlemanAutoUpdateModel,
  verifyEnterpriseWorkspaceGovernorModel,
  verifyEvolutionaryHarnessModel,
  verifyAgentTopologyMeshModel,
  verifyColumnarTelemetryEngineModel,
  verifyCellBasedBulkheadGovernorModel,
  verifyMultiWindowSloGovernorModel,
  verifyAdaptiveHedgedDeadlineMeshModel,
  verifyAdaptiveConcurrencyGovernorModel,
  verifyTailBasedTraceSamplerModel,
  verifyPredictiveRemediationEngineModel,
  verifyUnifiedKernelOrchestratorModel,
  verifyBigTechTranscendenceNexusModel,
  verifyEliteDesignStudioModel,
  verifyAgenticFinOpsGovernorModel,
  verifyPlanetaryMonorepoGovernorModel,
  verifyCrossFleetNeuralSynapseModel,
  verifyPlanetaryMultiCloudEvacuationModel,
  verifyVercelCanaryObservabilityModel,
  verifyBftAgentSwarmSlashingModel,
  verifyConsciousWitnessHotPatchingModel,
  verifyPropertyFuzzingTimeTravelHypervisorModel,
  verifySamaelUnitotalNexusModel,
  verifyFleetProductionVerificationModel,
  verifyTelemetryDashboardModel,
  verifyMicroVmSandboxModel,
  verifyGithubActionsPrGateModel,
  verifyTlcFormalModelCheckerModel,
  verifyAutonomousClosedLoopHealingModel,
  verifyContractEvolutionGovernanceModel,
  verifyInvariantVerificationEngineModel,
  verifySurfaceCodeQecModel,
  verifyLeoOpticalIslRoutingModel,
  verifyUhvGridDcOpfModel,
  verifyLawsonFusionIgnitionModel,
};

export function runAllFormalVerifications() {
  return [
    verifyLmaxDisruptorModel(),
    verifyDatomicLedgerModel(),
    verifyHermesConsensusModel(),
    verifyChaosDisruptorModel(),
    verifyProductFoundryModel(),
    verifyOmegaTranscendentalModel(),
    verifyContinuousRefactorModel(),
    verifyFleetSyncMctsCanaryModel(),
    verifyAntigravityControlPlaneModel(),
    verifyGentlemanEosSynergyMeshModel(),
    verifyGentlemanAutoUpdateModel(),
    verifyEnterpriseWorkspaceGovernorModel(),
    verifyEvolutionaryHarnessModel(),
    verifyAgentTopologyMeshModel(),
    verifyInvariantVerificationEngineModel(),
    verifyContractEvolutionGovernanceModel(),
    verifyAutonomousClosedLoopHealingModel(),
    verifyTlcFormalModelCheckerModel(),
    verifyGithubActionsPrGateModel(),
    verifyMicroVmSandboxModel(),
    verifyTelemetryDashboardModel(),
    verifyFleetProductionVerificationModel(),
    verifySamaelUnitotalNexusModel(),
    verifyPropertyFuzzingTimeTravelHypervisorModel(),
    verifyConsciousWitnessHotPatchingModel(),
    verifyBftAgentSwarmSlashingModel(),
    verifyVercelCanaryObservabilityModel(),
    verifyColumnarTelemetryEngineModel(),
    verifyCellBasedBulkheadGovernorModel(),
    verifyMultiWindowSloGovernorModel(),
    verifyAdaptiveHedgedDeadlineMeshModel(),
    verifyAdaptiveConcurrencyGovernorModel(),
    verifyTailBasedTraceSamplerModel(),
    verifyPredictiveRemediationEngineModel(),
    verifyUnifiedKernelOrchestratorModel(),
    verifyBigTechTranscendenceNexusModel(),
    verifyEliteDesignStudioModel(),
    verifyAgenticFinOpsGovernorModel(),
    verifyPlanetaryMonorepoGovernorModel(),
    verifyCrossFleetNeuralSynapseModel(),
    verifyPlanetaryMultiCloudEvacuationModel(),
    verifySurfaceCodeQecModel(),
    verifyLeoOpticalIslRoutingModel(),
    verifyUhvGridDcOpfModel(),
    verifyLawsonFusionIgnitionModel(),
  ];
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("verify-formal-tla.mjs")) {
  console.log("======================================================================");
  console.log(" EOS SYSTEM — TLA+ SOURCE INVENTORY & BOUNDED JS SIMULATIONS          ");
  console.log(" TLA+ text is not parsed or model-checked by TLC in this command.       ");
  console.log("======================================================================\n");

  const results = runAllFormalVerifications();
  let totalSteps = 0;

  results.forEach((res) => {
    totalSteps += res.stepsExecuted;
    console.log(`[SOURCE + SIMULATION] ${res.specification} (module label: ${res.moduleName})`);
    console.log(`  ↳ Variable names extracted : ${res.extractedVariables.join(", ") || "none"}`);
    console.log(`  ↳ Invariant names extracted: ${res.extractedInvariantNames.join(", ") || "none"}`);
    console.log(`  ↳ JS simulation steps       : ${res.stepsExecuted}`);
    console.log(`  ↳ Simulation assertions     : ${res.simulationAssertionsPassed ? "PASS" : "FAIL"}\n`);
  });

  console.log(`----------------------------------------------------------------------`);
  console.log(
    `RESULT: ${results.length} bounded JS simulations passed (${totalSteps} steps); no formal model checking was run.`,
  );
  console.log(`======================================================================`);
}
