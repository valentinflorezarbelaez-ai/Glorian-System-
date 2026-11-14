/**
 * EOS MCP Phase 7 Enterprise Frontier Handlers Extension 2 (SPEC-234..SPEC-246 / CHANGE-119..CHANGE-123)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 22.18+ Strip-Only TypeScript.
 * Enforces strict line count ceiling <= 800 lines across all MCP handler modules.
 */

import { EosJarvisSdlcOrchestratorCore } from "../../core/eosJarvisSdlcOrchestratorCore.ts";
import type {
  CompanyPresetId,
  JarvisMissionState,
  JarvisValidationInput,
  SdlcExecutionTrack,
} from "../../core/eosJarvisSdlcOrchestratorCore.types.ts";
import { EosPolyglotToolchainAdapterCore } from "../../core/eosPolyglotToolchainAdapterCore.ts";
import type { PolyglotStackId } from "../../core/eosPolyglotToolchainAdapterCore.types.ts";
import { EosIssueToPrCanaryBridgeCore } from "../../core/eosIssueToPrCanaryBridgeCore.ts";
import type { DiffFileEntry, IssueSourceSystem } from "../../core/eosIssueToPrCanaryBridgeCore.types.ts";
import { EosStaffEngineerAdversarialJudgeCore } from "../../core/eosStaffEngineerAdversarialJudgeCore.ts";
import type { StaffPillarScores } from "../../core/eosStaffEngineerAdversarialJudgeCore.types.ts";
import { EosLiveGitDiffPrInspectorCore } from "../../core/eosLiveGitDiffPrInspectorCore.ts";
import { EosRepoMapSymbolCompressorCore } from "../../core/eosRepoMapSymbolCompressorCore.ts";
import type { RepoMapSourceFileInput } from "../../core/eosRepoMapSymbolCompressorCore.types.ts";
import { EosPropertyBasedShrinkingFuzzerCore } from "../../core/eosPropertyBasedShrinkingFuzzerCore.ts";
import { EosApiContractSemanticDiffCore } from "../../core/eosApiContractSemanticDiffCore.ts";
import { EosSarifDiagnosticPatchSynthesizerCore } from "../../core/eosSarifDiagnosticPatchSynthesizerCore.ts";
import type { DiagnosticFindingInput } from "../../core/eosSarifDiagnosticPatchSynthesizerCore.types.ts";
import { EosFleetMultiRepoShipOrchestratorCore } from "../../core/eosFleetMultiRepoShipOrchestratorCore.ts";
import type { FleetProjectRecordInput } from "../../core/eosFleetMultiRepoShipOrchestratorCore.types.ts";
import { EosLiveGitContractEvolutionCore } from "../../core/eosLiveGitContractEvolutionCore.ts";
import type { ContractFilePairOverride } from "../../core/eosLiveGitContractEvolutionCore.types.ts";
import { EosInTotoSlsaEd25519AttestorCore } from "../../core/eosInTotoSlsaEd25519AttestorCore.ts";
import { EosGoldenSweBenchmarkHarnessCore } from "../../core/eosGoldenSweBenchmarkHarnessCore.ts";
import type { SweBenchmarkCaseInput } from "../../core/eosGoldenSweBenchmarkHarnessCore.types.ts";
import { EosEdaEquivalenceTimingProverCore } from "../../core/eosEdaEquivalenceTimingProverCore.ts";
import type { InformationFlowEdgeInput, TimingNodeInput } from "../../core/eosEdaEquivalenceTimingProverCore.types.ts";
import { EosApolloAirGappedBundleOrchestratorCore } from "../../core/eosApolloAirGappedBundleOrchestratorCore.ts";
import type {
  AirGappedArtifactInput,
  AirGappedBundleConstraints,
  AirGappedTargetNodeSpec,
} from "../../core/eosApolloAirGappedBundleOrchestratorCore.types.ts";
import { EosAladdinSystemicRiskStressCore } from "../../core/eosAladdinSystemicRiskStressCore.ts";
import { EosCliCatalogAndHygieneGovernorCore } from "../../core/eosCliCatalogAndHygieneGovernorCore.ts";
import type { ModuleLineCountInput } from "../../core/eosCliCatalogAndHygieneGovernorCore.types.ts";
import { EosCrdtStateSyncCore } from "../../core/eosCrdtStateSyncCore.ts";
import { EosMerkleMountainRangeCore } from "../../core/eosMerkleMountainRangeCore.ts";
import { EosVerifiableSecretSharingCore } from "../../core/eosVerifiableSecretSharingCore.ts";
import { type Phase7DomainHandlerDeps, isPlainRecord } from "./eosMcpPhase7Shared.ts";

function numOr(val: unknown, fallback: number): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function strOr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.trim() ? val : fallback;
}

function buildDefaultValidation(raw?: Record<string, unknown>): JarvisValidationInput {
  return {
    testsPassed: numOr(raw?.testsPassed, 10),
    totalTests: numOr(raw?.totalTests, 10),
    coveragePercent: numOr(raw?.coveragePercent, 92),
    domainImportsInfrastructure: raw?.domainImportsInfrastructure === true,
    plainSecretsCount: numOr(raw?.plainSecretsCount, 0),
    runtimeDependenciesCount: numOr(raw?.runtimeDependenciesCount, 0),
    lintErrorsCount: numOr(raw?.lintErrorsCount, 0),
    errorLog: typeof raw?.errorLog === "string" ? raw.errorLog : undefined,
  };
}

function resolveMissionState(args: Record<string, any> | undefined): JarvisMissionState {
  if (isPlainRecord(args?.missionState)) {
    return args.missionState as unknown as JarvisMissionState;
  }
  return EosJarvisSdlcOrchestratorCore.initiateMission({
    ticketId: strOr(args?.ticketId, "SPOT-402"),
    ticketTitle: strOr(args?.ticketTitle, "Autonomous SDLC mission"),
    ticketDescription: strOr(
      args?.ticketDescription,
      "Implement specification-driven behavior behind dark-launch feature flag.",
    ),
    companyPreset: (args?.companyPreset as CompanyPresetId | undefined) ?? "spotify",
    squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
    tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
    track: args?.track as SdlcExecutionTrack | undefined,
    featureFlagKey: typeof args?.featureFlagKey === "string" ? args.featureFlagKey : undefined,
    maxHealAttempts: typeof args?.maxHealAttempts === "number" ? args.maxHealAttempts : undefined,
  });
}

function dispatchLiveShipActions(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "live_diff_inspect") {
    const report = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: deps.projectRoot,
      baseRef: typeof args?.baseRef === "string" ? args.baseRef : undefined,
      ticketId: typeof args?.ticketId === "string" ? args.ticketId : undefined,
      title: typeof args?.title === "string" ? args.title : undefined,
      numstatOverride: typeof args?.numstatOverride === "string" ? args.numstatOverride : undefined,
      patchOverride: typeof args?.patchOverride === "string" ? args.patchOverride : undefined,
      writeBundle: args?.writeBundle === true,
    });
    return { ...report, action: "live_diff_inspect" };
  }
  if (action === "repomap_compress") {
    const report = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      projectRoot: deps.projectRoot,
      targetDir: typeof args?.targetDir === "string" ? args.targetDir : "src/core",
      maxTokenBudget: typeof args?.maxTokenBudget === "number" ? args.maxTokenBudget : undefined,
      maxFiles: typeof args?.maxFiles === "number" ? args.maxFiles : undefined,
      sourceFilesOverride: Array.isArray(args?.sourceFilesOverride)
        ? (args.sourceFilesOverride as RepoMapSourceFileInput[])
        : undefined,
    });
    return { ...report, action: "repomap_compress" };
  }
  if (action === "pbt_shrink_check") {
    const suite = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(numOr(args?.seed, 1337));
    return { ...suite, action: "pbt_shrink_check" };
  }
  if (action === "jarvis_ship_readiness") {
    const ticketId = strOr(args?.ticketId, "SHIP-240");
    const liveDiff = EosLiveGitDiffPrInspectorCore.inspectLiveGitDiff({
      projectRoot: deps.projectRoot,
      ticketId,
      numstatOverride: typeof args?.numstatOverride === "string" ? args.numstatOverride : undefined,
      patchOverride: typeof args?.patchOverride === "string" ? args.patchOverride : undefined,
    });
    const repoMap = EosRepoMapSymbolCompressorCore.buildCompressedRepoMap({
      projectRoot: deps.projectRoot,
      targetDir: "src/core",
      maxTokenBudget: 1200,
      maxFiles: 25,
    });
    const propertySuite = EosPropertyBasedShrinkingFuzzerCore.runBuiltInSuite(numOr(args?.seed, 1337));
    const staffJudge = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: ticketId,
      plainSecretsDetected: liveDiff.secretMatchesCount > 0,
      unsafeMigrationDetected: liveDiff.diffAudit.migrationPattern === "UNSAFE_BREAKING_DDL",
      missingTestsForProdChanges: !liveDiff.diffAudit.beyonceRuleSatisfied,
    });
    const canaryPlan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
      ticketId,
      featureFlagKey: `ff_${ticketId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      workflowId: "flow-ship-mcp",
      approvalDiffSha256: liveDiff.inspectionDigestSha256,
    });
    const approved = liveDiff.readyToShip && propertySuite.allPassed && staffJudge.verdict === "APPROVED";
    return {
      action: "jarvis_ship_readiness",
      shipReadinessVerdict: approved ? "SHIP_APPROVED" : "SHIP_BLOCKED",
      liveDiff,
      repoMap,
      propertySuite,
      staffJudge,
      canaryPlan,
    };
  }
  return dispatchContractSarifFleetActions(action, args, deps);
}

function dispatchContractSarifFleetActions(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "api_contract_diff") {
    const report = EosApiContractSemanticDiffCore.compareContracts({
      contractId: typeof args?.contractId === "string" ? args.contractId : undefined,
      baselineSource: strOr(args?.baselineSource, "export function ping(id: string) {}"),
      candidateSource: strOr(args?.candidateSource, "export function ping(id: string) {}"),
    });
    return { ...report, action: "api_contract_diff" };
  }
  if (action === "sarif_patch_synthesize") {
    const findings: DiagnosticFindingInput[] = Array.isArray(args?.findings) ? args.findings : [];
    const report = EosSarifDiagnosticPatchSynthesizerCore.synthesizeSarifAndPatches({
      projectRoot: deps.projectRoot,
      runTitle: typeof args?.runTitle === "string" ? args.runTitle : undefined,
      findings,
      writeSarifToDisk: args?.writeSarifToDisk === true,
      outputRelPath: typeof args?.outputRelPath === "string" ? args.outputRelPath : undefined,
    });
    return { ...report, action: "sarif_patch_synthesize" };
  }
  if (action === "fleet_ship_orchestrate") {
    const report = EosFleetMultiRepoShipOrchestratorCore.orchestrateFleetShipReadiness({
      projectRoot: deps.projectRoot,
      registryRelPath: typeof args?.registryRelPath === "string" ? args.registryRelPath : undefined,
      projectsOverride: Array.isArray(args?.projectsOverride)
        ? (args.projectsOverride as FleetProjectRecordInput[])
        : undefined,
      probeLocalCheckouts: args?.probeLocalCheckouts === true,
    });
    return { ...report, action: "fleet_ship_orchestrate" };
  }
  return dispatchLiveContractAttestBenchActions(action, args, deps);
}

function optStringArg(args: Record<string, unknown> | undefined, key: string): string | undefined {
  const val = args?.[key];
  return typeof val === "string" ? val : undefined;
}

function handleLiveContractEvolution(
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> {
  const filePairsOverride = Array.isArray(args?.filePairsOverride)
    ? (args.filePairsOverride as NonNullable<
        Parameters<typeof EosLiveGitContractEvolutionCore.auditLiveGitContracts>[0]
      >["filePairsOverride"])
    : undefined;
  const report = EosLiveGitContractEvolutionCore.auditLiveGitContracts({
    projectRoot: deps.projectRoot,
    repoPath: optStringArg(args, "repoPath"),
    baseRef: optStringArg(args, "baseRef"),
    filePairsOverride,
  });
  return { ...report, action: "live_contract_evolution" };
}

function handleInTotoSlsaAttest(
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> {
  const bundle = EosInTotoSlsaEd25519AttestorCore.issueShipAttestation({
    projectRoot: deps.projectRoot,
    ticketId: optStringArg(args, "ticketId"),
    headCommitSha: optStringArg(args, "headCommitSha"),
    diffDigestSha256: optStringArg(args, "diffDigestSha256"),
    sarifDigestSha256: optStringArg(args, "sarifDigestSha256"),
    contractDiffDigestSha256: optStringArg(args, "contractDiffDigestSha256"),
    staffVerdict: optStringArg(args, "staffVerdict"),
    keySeed: optStringArg(args, "keySeed"),
    writeAttestationToDisk: args?.writeAttestationToDisk === true,
    outputRelPath: optStringArg(args, "outputRelPath"),
  });
  return { ...bundle, action: "intoto_slsa_attest" };
}

function handleGoldenSweBenchmark(args: Record<string, unknown> | undefined): Record<string, unknown> {
  const casesOverride = Array.isArray(args?.casesOverride)
    ? (args.casesOverride as NonNullable<
        Parameters<typeof EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark>[0]
      >["casesOverride"])
    : undefined;
  const report = EosGoldenSweBenchmarkHarnessCore.runGoldenBenchmark({ casesOverride });
  return { ...report, action: "golden_swe_benchmark" };
}

function dispatchLiveContractAttestBenchActions(
  action: string,
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> | undefined {
  if (action === "live_contract_evolution") return handleLiveContractEvolution(args, deps);
  if (action === "intoto_slsa_attest") return handleInTotoSlsaAttest(args, deps);
  if (action === "golden_swe_benchmark") return handleGoldenSweBenchmark(args);
  return dispatchEdaApolloAladdinActions(action, args, deps);
}

function optNumArg(args: Record<string, unknown> | undefined, key: string): number | undefined {
  const val = args?.[key];
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function handleEdaEquivalenceTimingProve(args: Record<string, unknown> | undefined): Record<string, unknown> {
  const report = EosEdaEquivalenceTimingProverCore.proveEquivalenceTimingAndIsolation({
    circuitId: optStringArg(args, "circuitId"),
    clockBudgetMicros: optNumArg(args, "clockBudgetMicros"),
    timingDag: Array.isArray(args?.timingDag) ? (args.timingDag as TimingNodeInput[]) : undefined,
    flows: Array.isArray(args?.flows) ? (args.flows as InformationFlowEdgeInput[]) : undefined,
  });
  return { ...report, action: "eda_equivalence_timing_prove" };
}

function handleApolloAirGapBundle(
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> {
  const report = EosApolloAirGappedBundleOrchestratorCore.compileAndVerifyAirGappedBundle({
    projectRoot: deps.projectRoot,
    bundleId: optStringArg(args, "bundleId"),
    version: optStringArg(args, "version"),
    artifacts: Array.isArray(args?.artifacts) ? (args.artifacts as AirGappedArtifactInput[]) : undefined,
    recalledVersions: Array.isArray(args?.recalledVersions) ? (args.recalledVersions as string[]) : undefined,
    constraints: isPlainRecord(args?.constraints) ? (args.constraints as AirGappedBundleConstraints) : undefined,
    targetNode: isPlainRecord(args?.targetNode) ? (args.targetNode as unknown as AirGappedTargetNodeSpec) : undefined,
    keySeed: optStringArg(args, "keySeed"),
    writeBundleToDisk: args?.writeBundleToDisk === true,
    outputRelPath: optStringArg(args, "outputRelPath"),
  });
  return { ...report, action: "apollo_airgap_bundle" };
}

function handleAladdinSystemicStress(
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> {
  const report = EosAladdinSystemicRiskStressCore.runSystemicStressSimulation({
    projectRoot: deps.projectRoot,
    registryRelPath: optStringArg(args, "registryRelPath"),
    trials: optNumArg(args, "trials"),
    seed: optNumArg(args, "seed"),
    shockProbability: optNumArg(args, "shockProbability"),
    contagionCoupling: optNumArg(args, "contagionCoupling"),
    portfolioCountOverride: optNumArg(args, "portfolioCountOverride"),
  });
  return { ...report, action: "aladdin_systemic_stress" };
}

function handleCliHygieneAudit(
  args: Record<string, unknown> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> {
  const registeredCommands = Array.isArray(args?.registeredCommands)
    ? (args.registeredCommands as string[])
    : undefined;
  const moduleLineCounts = Array.isArray(args?.moduleLineCounts)
    ? (args.moduleLineCounts as ModuleLineCountInput[])
    : undefined;
  const report = EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
    projectRoot: optStringArg(args, "projectRoot") ?? deps.projectRoot,
    registeredCommands,
    helpCatalogText: optStringArg(args, "helpCatalogText"),
    developerGuideText: optStringArg(args, "developerGuideText"),
    moduleLineCounts,
    hardLimitLines: optNumArg(args, "hardLimitLines"),
    minRequiredHeadroomLines: optNumArg(args, "minRequiredHeadroomLines"),
  });
  return { ...report, action: "cli_hygiene_audit" };
}

function handleCrdtMmrAction(
  action: string,
  args: Record<string, any> | undefined,
): Record<string, unknown> | undefined {
  if (action === "crdt_mutate") {
    const nodeId = typeof args?.nodeId === "string" ? args.nodeId : "mcp-node";
    const core = new EosCrdtStateSyncCore(nodeId);
    core.setRegister("status", "ACTIVE");
    core.addToSet("keys", "key-1");
    core.insertSequence("stream", "X");
    const snapshot = core.exportSnapshot();
    return {
      action: "crdt_mutate",
      nodeId: snapshot.nodeId,
      stateHashSha256: snapshot.stateHashSha256,
      vectorClock: snapshot.vectorClock,
    };
  }
  if (action === "crdt_merge") {
    const nodeA = new EosCrdtStateSyncCore("node-A");
    const nodeB = new EosCrdtStateSyncCore("node-B");
    nodeA.setRegister("key", "A");
    nodeB.setRegister("key", "B");
    const resA = nodeA.mergeSnapshot(nodeB.exportSnapshot());
    const resB = nodeB.mergeSnapshot(nodeA.exportSnapshot());
    return {
      action: "crdt_merge",
      converged: resA.stateHashSha256 === resB.stateHashSha256,
      stateHashSha256: resA.stateHashSha256,
      receipt: resA.receipt,
    };
  }
  if (action === "crdt_delta") {
    const node1 = new EosCrdtStateSyncCore("node-1");
    const node2 = new EosCrdtStateSyncCore("node-2");
    node1.setRegister("val", 42);
    const delta = node1.getDelta(node2.vectorClock);
    const mergeRes = node2.mergeDelta(delta);
    return {
      action: "crdt_delta",
      converged: mergeRes.converged,
      stateHashSha256: mergeRes.stateHashSha256,
      receipt: mergeRes.receipt,
    };
  }
  if (action === "mmr_append") {
    const mmr = new EosMerkleMountainRangeCore();
    const count = typeof args?.count === "number" ? Math.max(1, args.count) : 5;
    for (let i = 0; i < count; i++) mmr.append(`mcp-leaf-${i}`);
    return {
      action: "mmr_append",
      leafCount: mmr.getLeafCount(),
      mmrSize: mmr.getSize(),
      root: mmr.getRoot(),
      peakCount: mmr.getPeaks().length,
    };
  }
  if (action === "mmr_prove" || action === "mmr_verify") {
    const mmr = new EosMerkleMountainRangeCore();
    for (let i = 0; i < 7; i++) mmr.append(`entry-${i}`);
    const proof = mmr.getInclusionProof(2);
    if (action === "mmr_prove") {
      return {
        action: "mmr_prove",
        leafIndex: proof.leafIndex,
        leafPos: proof.leafPos,
        root: proof.root,
        siblingCount: proof.siblings.length,
      };
    }
    const verifyRes = mmr.verifyInclusion(proof);
    return {
      action: "mmr_verify",
      valid: verifyRes.valid,
      verificationTimeMs: verifyRes.verificationTimeMs,
      receipt: verifyRes.receipt,
    };
  }
  return undefined;
}

function handleVssSplit(args: Record<string, any> | undefined): Record<string, unknown> {
  if (typeof args?.secret !== "string" || args.secret.length === 0) {
    throw new TypeError("Pass a non-empty secret explicitly; no default secret is used.");
  }
  const k = args?.k === undefined ? 3 : args.k;
  const n = args?.n === undefined ? 5 : args.n;
  if (args?.scheme !== undefined && args.scheme !== "feldman" && args.scheme !== "pedersen") {
    throw new TypeError("VSS scheme must be feldman or pedersen.");
  }
  const scheme = args?.scheme === "feldman" ? "feldman" : "pedersen";
  const deal = EosVerifiableSecretSharingCore.splitSecret(args.secret, k, n, scheme);
  return {
    action: "vss_split",
    mode: "dealer-only",
    securityStatus: "experimental-not-for-production-secrets",
    distributionNote:
      "This response contains every private share. Send only one share to each participant; never broadcast the full response.",
    scheme: deal.scheme,
    k: deal.k,
    n: deal.n,
    commitmentsCount: deal.commitments.commitmentsHex.length,
    commitments: deal.commitments,
    sharesCount: deal.shares.length,
    shares: deal.shares,
  };
}

function dispatchCrdtMmrVssActions(
  action: string,
  args: Record<string, any> | undefined,
): Record<string, unknown> | undefined {
  const crdtMmr = handleCrdtMmrAction(action, args);
  if (crdtMmr !== undefined) return crdtMmr;
  if (action === "vss_split") return handleVssSplit(args);
  if (action === "vss_verify") {
    const usingInput = args?.share !== undefined || args?.commitments !== undefined;
    if (usingInput && (!args?.share || !args?.commitments)) {
      throw new TypeError("Provide both share and commitments for VSS verification.");
    }
    const demo = usingInput
      ? undefined
      : EosVerifiableSecretSharingCore.splitSecret("mcp-vss-demo-only", 3, 5, "pedersen");
    const share = usingInput ? args?.share : demo!.shares[0];
    const commitments = usingInput ? args?.commitments : demo!.commitments;
    const res = EosVerifiableSecretSharingCore.verifyShare(share, commitments);
    return {
      action: "vss_verify",
      mode: usingInput ? "provided-input" : "demo",
      securityStatus: "experimental-not-for-production-secrets",
      participantId: Number.isSafeInteger(share?.id) ? share.id : -1,
      valid: res.valid,
      reason: res.reason,
    };
  }
  if (action === "vss_reconstruct") {
    const hasSupplied = args?.shares !== undefined || args?.commitments !== undefined;
    if (hasSupplied && (!Array.isArray(args?.shares) || !args?.commitments || args?.k === undefined)) {
      throw new TypeError("Provide shares, commitments, and k for VSS reconstruction.");
    }
    const demo = hasSupplied
      ? undefined
      : EosVerifiableSecretSharingCore.splitSecret("mcp-vss-demo-only", 3, 5, "pedersen");
    const shares = hasSupplied ? args!.shares : [demo!.shares[0], demo!.shares[2], demo!.shares[4]];
    const commitments = hasSupplied ? args!.commitments : demo!.commitments;
    const k = hasSupplied ? args!.k : 3;
    const res = EosVerifiableSecretSharingCore.reconstruct(shares, k, commitments);
    return {
      action: "vss_reconstruct",
      mode: hasSupplied ? "provided-input" : "demo",
      securityStatus: "experimental-not-for-production-secrets",
      secretHex: res.secretHex,
      secretString: res.secretString,
      validShareCount: res.validShareCount,
      cheatersCount: res.cheatersIdentified.length,
      cheatersIdentified: res.cheatersIdentified,
    };
  }
  return undefined;
}

function dispatchEdaApolloAladdinActions(
  action: string,
  args: Record<string, any> | undefined,
  deps: { readonly projectRoot: string },
): Record<string, unknown> | undefined {
  if (action === "eda_equivalence_timing_prove") return handleEdaEquivalenceTimingProve(args);
  if (action === "apollo_airgap_bundle") return handleApolloAirGapBundle(args, deps);
  if (action === "aladdin_systemic_stress") return handleAladdinSystemicStress(args, deps);
  if (action === "cli_hygiene_audit") return handleCliHygieneAudit(args, deps);
  return dispatchCrdtMmrVssActions(action, args);
}

function dispatchPolyglotOrBridge(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "polyglot_detect") {
    const profile = EosPolyglotToolchainAdapterCore.detectStackAndBuildMatrix({
      stackId: args?.stackId as PolyglotStackId | undefined,
      repoPath: typeof args?.repoPath === "string" ? args.repoPath : undefined,
      projectRoot: deps.projectRoot,
      serviceName: typeof args?.serviceName === "string" ? args.serviceName : undefined,
    });
    return { ...profile, action: "polyglot_detect" };
  }
  if (action === "polyglot_normalize") {
    const res = EosPolyglotToolchainAdapterCore.normalizeTestAndCoverageReport({
      stackId: (args?.stackId as PolyglotStackId | undefined) ?? "go",
      rawOutput: typeof args?.rawOutput === "string" ? args.rawOutput : undefined,
      testsPassed: typeof args?.testsPassed === "number" ? args.testsPassed : undefined,
      totalTests: typeof args?.totalTests === "number" ? args.totalTests : undefined,
      coveragePercent: typeof args?.coveragePercent === "number" ? args.coveragePercent : undefined,
      domainImportsInfrastructure: args?.domainImportsInfrastructure === true,
      plainSecretsCount: typeof args?.plainSecretsCount === "number" ? args.plainSecretsCount : undefined,
      lintErrorsCount: typeof args?.lintErrorsCount === "number" ? args.lintErrorsCount : undefined,
    });
    return { ...res, action: "polyglot_normalize" };
  }
  if (action === "issue_bridge_parse") {
    const issue = EosIssueToPrCanaryBridgeCore.parseIssuePayload({
      ticketId: typeof args?.ticketId === "string" ? args.ticketId : undefined,
      key: typeof args?.key === "string" ? args.key : undefined,
      sourceSystem: args?.sourceSystem as IssueSourceSystem | undefined,
      title: typeof args?.title === "string" ? args.title : undefined,
      description: typeof args?.description === "string" ? args.description : undefined,
      priority: typeof args?.priority === "string" ? args.priority : undefined,
      acceptanceCriteria: Array.isArray(args?.acceptanceCriteria) ? args.acceptanceCriteria : undefined,
    });
    return { ...issue, action: "issue_bridge_parse" };
  }
  if (action === "diff_migration_audit") {
    const changedFiles: DiffFileEntry[] = Array.isArray(args?.changedFiles)
      ? args.changedFiles
      : [
          { path: "src/core/service.ts", additions: 20 },
          { path: "test/service.test.mjs", additions: 30 },
        ];
    const report = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles,
      sqlMigrationSnippet: typeof args?.sqlMigrationSnippet === "string" ? args.sqlMigrationSnippet : undefined,
    });
    return { ...report, action: "diff_migration_audit" };
  }
  return dispatchLiveShipActions(action, args, deps);
}

export function dispatchPhase7FrontierActionExt2(
  action: string,
  args: Record<string, any> | undefined,
  deps: Phase7DomainHandlerDeps,
): unknown | undefined {
  if (action === "jarvis_dna_assimilate") {
    const profile = EosJarvisSdlcOrchestratorCore.assimilateCompanyDna({
      preset: (args?.preset as CompanyPresetId | undefined) ?? "spotify",
      companyName: typeof args?.companyName === "string" ? args.companyName : undefined,
      squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
      tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
      repoPath: typeof args?.repoPath === "string" ? args.repoPath : undefined,
      projectRoot: deps.projectRoot,
    });
    return { ...profile, action: "jarvis_dna_assimilate" };
  }
  if (action === "jarvis_sdlc_start") {
    return { ...resolveMissionState(args), action: "jarvis_sdlc_start" };
  }
  if (action === "jarvis_sdlc_verify") {
    const result = EosJarvisSdlcOrchestratorCore.verifyAndHealMission(
      resolveMissionState(args),
      buildDefaultValidation(isPlainRecord(args?.validation) ? args.validation : args),
    );
    return { ...result, action: "jarvis_sdlc_verify" };
  }
  if (action === "jarvis_sync_rules") {
    const pkg = EosJarvisSdlcOrchestratorCore.compileAutopilotRulesPackage({
      projectRoot: deps.projectRoot,
      outputRelPath: typeof args?.outputRelPath === "string" ? args.outputRelPath : undefined,
      companyPreset: (args?.companyPreset as CompanyPresetId | undefined) ?? "spotify",
      squadOwner: typeof args?.squadOwner === "string" ? args.squadOwner : undefined,
      tribe: typeof args?.tribe === "string" ? args.tribe : undefined,
      writeToDisk: args?.writeToDisk === true,
    });
    return { ...pkg, action: "jarvis_sync_rules" };
  }
  if (action === "canary_rollback_plan") {
    const plan = EosIssueToPrCanaryBridgeCore.compileCanaryAndRollbackPlan({
      ticketId: strOr(args?.ticketId, "PAY-881"),
      featureFlagKey: strOr(args?.featureFlagKey, "ff_pay_881"),
      workflowId: strOr(args?.workflowId, "flow-canary-01"),
      approvalDiffSha256: strOr(args?.approvalDiffSha256, "a".repeat(64)),
      companyPreset: args?.companyPreset as CompanyPresetId | undefined,
    });
    return { ...plan, action: "canary_rollback_plan" };
  }
  if (action === "staff_adversarial_judge") {
    const verdict = EosStaffEngineerAdversarialJudgeCore.evaluateProposalOrPr({
      targetId: strOr(args?.targetId, "PR-237"),
      title: typeof args?.title === "string" ? args.title : undefined,
      pillarScores: isPlainRecord(args?.pillarScores) ? (args.pillarScores as Partial<StaffPillarScores>) : undefined,
      plainSecretsDetected: args?.plainSecretsDetected === true,
      unsafeMigrationDetected: args?.unsafeMigrationDetected === true,
      missingTestsForProdChanges: args?.missingTestsForProdChanges === true,
      singlePointOfFailureDetected: args?.singlePointOfFailureDetected === true,
    });
    return { ...verdict, action: "staff_adversarial_judge" };
  }
  return dispatchPolyglotOrBridge(action, args, deps);
}
