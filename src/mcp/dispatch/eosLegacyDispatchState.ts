import { EosCellBasedBulkheadGovernor } from "../../core/eosCellBasedBulkheadGovernor.ts";
import { EosMultiWindowSloGovernor } from "../../core/eosMultiWindowSloGovernor.ts";
import { EosAdaptiveHedgedDeadlineMesh } from "../../core/eosAdaptiveHedgedDeadlineMesh.ts";
import { EosAdaptiveConcurrencyGovernor } from "../../core/eosAdaptiveConcurrencyGovernor.ts";
import { EosPredictiveRemediationEngine } from "../../core/eosPredictiveRemediationEngine.ts";
import { EosUnifiedKernelOrchestrator } from "../../core/eosUnifiedKernelOrchestrator.ts";
import { EosBigTechTranscendenceNexus } from "../../core/eosBigTechTranscendenceNexus.ts";
import { EosEliteDesignStudioEngine } from "../../core/eosEliteDesignStudioEngine.ts";
import { EosPlanetaryMonorepoGovernor } from "../../core/eosPlanetaryMonorepoGovernor.ts";

export const globalBulkheadGovernor = new EosCellBasedBulkheadGovernor({ cellCount: 8, cellCapacity: 100 });
export const globalSloGovernor = new EosMultiWindowSloGovernor();
export const globalHedgedMesh = new EosAdaptiveHedgedDeadlineMesh();
export const globalConcurrencyGovernor = new EosAdaptiveConcurrencyGovernor();
export const globalRemediationEngine = new EosPredictiveRemediationEngine();
export const globalKernelOrchestrator = EosUnifiedKernelOrchestrator.getInstance();
export const globalTranscendenceNexus = EosBigTechTranscendenceNexus.getInstance();
export const globalDesignStudio = EosEliteDesignStudioEngine.getInstance();
export const globalPlanetaryGovernor = EosPlanetaryMonorepoGovernor.getInstance();
