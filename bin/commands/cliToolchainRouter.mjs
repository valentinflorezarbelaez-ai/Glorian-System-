/**
 * CLI Toolchain Router
 *
 * Consolidates lazy-loaded subdispatchers for toolchain:* commands.
 * Keeps individual CLI modules strictly under 800 lines with >= 12 headroom (SPEC-250).
 */

const TOOLCHAIN_DISPATCHERS = [
  { prefix: "toolchain:helm:", file: "./cliHelm.mjs", fn: "handleHelmCommands" },
  { prefix: "toolchain:tf:", file: "./cliTerraform.mjs", fn: "handleTerraformCommands" },
  { prefix: "toolchain:db:", file: "./cliDatabase.mjs", fn: "handleDatabaseCommands" },
  { prefix: "toolchain:otel:", file: "./cliOtelGateway.mjs", fn: "handleOtelCommands" },
  { prefix: "toolchain:chaos:", file: "./cliChaos.mjs", fn: "handleChaosCommands" },
  { prefix: "toolchain:canary:", file: "./cliCanaryEval.mjs", fn: "handleCanaryCommands" },
  { prefix: "toolchain:events:", file: "./cliEventStore.mjs", fn: "handleEventStoreCommands" },
  { prefix: "toolchain:merkle:", file: "./cliMerkleSnapshot.mjs", fn: "handleMerkleCommands" },
  { prefix: "toolchain:vector:", file: "./cliVectorIndex.mjs", fn: "handleVectorCommands" },
  { prefix: "toolchain:lock:", file: "./cliDistributedLock.mjs", fn: "handleLockCommands" },
  { prefix: "toolchain:deadlock:", file: "./cliDeadlock.mjs", fn: "handleDeadlockCommands" },
  { prefix: "toolchain:ratelimit:", file: "./cliRateLimit.mjs", fn: "handleRateLimitCommands" },
  { prefix: "toolchain:sqlite:", file: "./cliSqliteStore.mjs", fn: "handleSqliteCommands" },
  { prefix: "toolchain:k8s:", file: "./cliK8sNative.mjs", fn: "handleK8sNativeCommands" },
  { prefix: "toolchain:dst:", file: "./cliDstEngine.mjs", fn: "handleDstCommands" },
  { prefix: "toolchain:ast:", file: "./cliAstEngine.mjs", fn: "handleAstCommands" },
  { prefix: "toolchain:sapfix:", file: "./cliSapFix.mjs", fn: "handleSapFixCommands" },
  { prefix: "toolchain:z3:", file: "./cliZ3Prover.mjs", fn: "handleZ3Commands" },
  { prefix: "toolchain:slsa:", file: "./cliSlsaGovernor.mjs", fn: "handleSlsaCommands" },
  { prefix: "toolchain:durable:", file: "./cliDurableEngine.mjs", fn: "handleDurableCommands" },
  { prefix: "toolchain:microvm:", file: "./cliMicroVmEngine.mjs", fn: "handleMicroVmCommands" },
  { prefix: "toolchain:ebpf:", file: "./cliEbpfOtlpGovernor.mjs", fn: "handleEbpfCommands" },
  { prefix: "toolchain:edge:", file: "./cliDurableBridge.mjs", fn: "handleEdgeCommands" },
  { prefix: "toolchain:gateway:", file: "./cliAiGateway.mjs", fn: "handleAiGatewayCommands" },
  { prefix: "toolchain:soundcheck:", file: "./cliSoundcheckScorecard.mjs", fn: "handleSoundcheckCommands" },
  { prefix: "toolchain:crdt:", file: "./cliAutomergeCrdt.mjs", fn: "handleCrdtCommands" },
  { prefix: "toolchain:enclave:", file: "./cliConfidentialEnclave.mjs", fn: "handleEnclaveCommands" },
  { prefix: "toolchain:nix:", file: "./cliHermeticBuild.mjs", fn: "handleHermeticBuildCommands" },
  { prefix: "toolchain:bazel:", file: "./cliHermeticBuild.mjs", fn: "handleHermeticBuildCommands" },
  { prefix: "toolchain:build:", file: "./cliHermeticBuild.mjs", fn: "handleHermeticBuildCommands" },
  { prefix: "toolchain:shm:", file: "./cliSharedMemory.mjs", fn: "handleSharedMemoryCommands" },
  { prefix: "toolchain:sea:", file: "./cliSeaDistribution.mjs", fn: "handleSeaCommands" },
  { prefix: "toolchain:fdir:", file: "./cliFdirOntology.mjs", fn: "handleFdirCommands" },
  { prefix: "toolchain:wasm:", file: "./cliWasmSynthesizer.mjs", fn: "handleWasmCommands" },
  { prefix: "toolchain:reconcile:", file: "./cliReconciliationLoop.mjs", fn: "handleReconcileCommands" },
  { prefix: "toolchain:replicator:", file: "./cliCrdtStateReplicator.mjs", fn: "handleCrdtCommand" },
  { prefix: "toolchain:rustzig:", file: "./cliPolyglotRustZigWasm.mjs", fn: "handleRustZigWasmCommand" },
  { prefix: "toolchain:simd:", file: "./cliWasmSimd128Arena.mjs", fn: "handleWasmSimd128Command" },
  { prefix: "toolchain:workers:", file: "./cliSharedMemoryWorkerPool.mjs", fn: "handleSharedMemoryWorkerPoolCommand" },
  { prefix: "toolchain:ringbuffer:", file: "./cliZeroCopyRingBuffer.mjs", fn: "handleRingBufferCommand" },
  { prefix: "toolchain:jepsen:", file: "./cliJepsenDistributedChaos.mjs", fn: "handleJepsenChaosCommand" },
  { prefix: "toolchain:quant:", file: "./cliSimdQuantizedHnsw.mjs", fn: "handleSimdQuantizedHnswCommand" },
  { prefix: "toolchain:mesh:", file: "./cliDistributedVectorMesh.mjs", fn: "handleDistributedVectorMeshCommand" },
  { prefix: "toolchain:lsm:", file: "./cliVectorLsmStorage.mjs", fn: "handleVectorLsmCommand" },
  {
    prefix: "toolchain:speculative:",
    file: "./cliSpeculativePagedKvCache.mjs",
    fn: "handleSpeculativePagedKvCacheCommand",
  },
  {
    prefix: "toolchain:flash:",
    file: "./cliFlashAttentionOnlineSoftmax.mjs",
    fn: "handleFlashAttentionCommand",
  },
  {
    prefix: "toolchain:continuous:",
    file: "./cliContinuousDynamicBatching.mjs",
    fn: "handleContinuousBatchingCommand",
  },
  {
    prefix: "toolchain:allreduce:",
    file: "./cliRingAllReduce.mjs",
    fn: "handleRingAllReduceCommand",
  },
  {
    prefix: "toolchain:megatron:",
    file: "./cliMegatronTensorParallelism.mjs",
    fn: "handleMegatronCommand",
  },
  {
    prefix: "toolchain:pipeline:",
    file: "./cliPipelineParallelism1F1B.mjs",
    fn: "handlePipelineCommand",
  },
  {
    prefix: "toolchain:tp:",
    file: "./cliTensorParallelAttention.mjs",
    fn: "handleTpAttentionCommand",
  },
  {
    prefix: "toolchain:zero:",
    file: "./cliZeroFsdpEngine.mjs",
    fn: "handleZeroFsdpCommand",
  },
  {
    prefix: "toolchain:moe:",
    file: "./cliExpertParallelMoERouter.mjs",
    fn: "handleMoeRouterCommand",
  },
  {
    prefix: "toolchain:checkpoint:",
    file: "./cliActivationCheckpointingEngine.mjs",
    fn: "handleActivationCheckpointingCommand",
  },
  {
    prefix: "toolchain:rea:",
    file: "./cliReverseEngineeringEngine.mjs",
    fn: "handleReverseEngineeringCommand",
  },
  {
    prefix: "toolchain:quanttrain:",
    file: "./cliQuantizedDistributedTrainingEngine.mjs",
    fn: "handleQuantizedDistributedTrainingCommand",
  },
  {
    prefix: "toolchain:kvcache:",
    file: "./cliDistributedKvReplication.mjs",
    fn: "handleDistributedKvReplicationCommand",
  },
  {
    prefix: "toolchain:specdec:",
    file: "./cliTreeSpeculativeDecoding.mjs",
    fn: "handleTreeSpeculativeDecodingCommand",
  },
  {
    prefix: "toolchain:streamllm:",
    file: "./cliStreamingLlmAttentionSinks.mjs",
    fn: "handleStreamingLlmCommand",
  },
  {
    prefix: "toolchain:distpd:",
    file: "./cliDisaggregatedPrefillDecode.mjs",
    fn: "handleDisaggregatedPrefillDecodeCommand",
  },
  {
    prefix: "toolchain:hypergraph:",
    file: "./cliOntologicalHypergraph.mjs",
    fn: "handleOntologicalHypergraphCommand",
  },
  {
    prefix: "toolchain:desh:",
    file: "./cliDiscreteEventSimulationHypervisor.mjs",
    fn: "handleDiscreteEventSimulationHypervisorCommand",
  },
  {
    prefix: "toolchain:pqmpc:",
    file: "./cliPostQuantumThresholdMpc.mjs",
    fn: "handlePostQuantumThresholdMpcCommand",
  },
  {
    prefix: "toolchain:pinn:",
    file: "./cliPhysicsInformedHamiltonianPde.mjs",
    fn: "handlePhysicsInformedHamiltonianPdeCommand",
  },
  {
    prefix: "toolchain:euvilt:",
    file: "./cliEuvInverseLithographyWavefront.mjs",
    fn: "handleEuvInverseLithographyWavefrontCommand",
  },
  {
    prefix: "toolchain:scm:",
    file: "./cliCausalStructuralModel.mjs",
    fn: "handleCausalStructuralModelCommand",
  },
  {
    prefix: "toolchain:harness:",
    file: "./cliAgenticHarnessYield.mjs",
    fn: "handleAgenticHarnessYieldCommand",
  },
  {
    prefix: "toolchain:autopilot:",
    file: "./cliClosedLoopRepoAutopilot.mjs",
    fn: "handleClosedLoopRepoAutopilotCommand",
  },
  {
    prefix: "toolchain:blindspot:",
    file: "./cliMetamorphicDifferentialBlindSpot.mjs",
    fn: "handleMetamorphicDifferentialBlindSpotCommand",
  },
  {
    prefix: "toolchain:web:",
    file: "./cliWebCompiler.mjs",
    fn: "handleWebCompilerCommand",
  },
  {
    prefix: "toolchain:agentic:",
    file: "./cliAgenticContextEngine.mjs",
    fn: "handleAgenticContextCommand",
  },
  {
    prefix: "toolchain:graph:",
    file: "./cliKnowledgeGraphReflex.mjs",
    fn: "handleKnowledgeGraphCommand",
  },
  {
    prefix: "toolchain:swarm:",
    file: "./cliAgenticSwarmBft.mjs",
    fn: "handleAgenticSwarmCommand",
  },
  {
    prefix: "toolchain:wasmjit:",
    file: "./cliAutonomousWasmJit.mjs",
    fn: "handleAutonomousWasmJitCommand",
  },
  {
    prefix: "toolchain:crdtmem:",
    file: "./cliDistributedCrdtMemory.mjs",
    fn: "handleDistributedCrdtMemoryCommand",
  },
  {
    prefix: "toolchain:prover:",
    file: "./cliNeuralSymbolicProver.mjs",
    fn: "handleNeuralSymbolicProverCommand",
  },
  {
    prefix: "toolchain:zkcirc:",
    file: "./cliZkCircuitSynthesizer.mjs",
    fn: "handleZkCircuitSynthesizerCommand",
  },
  {
    prefix: "toolchain:txfabric:",
    file: "./cliShardedTransactionFabric.mjs",
    fn: "handleShardedTransactionFabricCommand",
  },
  {
    prefix: "toolchain:neuro:",
    file: "./cliNeuromorphicPlanner.mjs",
    fn: "handleNeuromorphicPlannerCommand",
  },
  {
    prefix: "toolchain:causal:",
    file: "./cliCausalMetaLearning.mjs",
    fn: "handleCausalMetaLearningCommand",
  },
  {
    prefix: "toolchain:gpu:",
    file: "./cliWebGpuTensorAcceleration.mjs",
    fn: "handleWebGpuTensorAccelerationCommand",
  },
  {
    prefix: "toolchain:ipc:",
    file: "./cliZeroCopyIpcRingBuffer.mjs",
    fn: "handleZeroCopyIpcCommand",
  },
  {
    prefix: "toolchain:sched:",
    file: "./cliWorkStealingScheduler.mjs",
    fn: "handleWorkStealingSchedulerCommand",
  },
  {
    prefix: "toolchain:ledger:",
    file: "./cliBitemporalEventLedger.mjs",
    fn: "handleBitemporalEventLedgerCommand",
  },
  {
    prefix: "toolchain:canvas:",
    file: "./cliArchitecturalCanvas.mjs",
    fn: "handleArchitecturalCanvasCommand",
  },
  {
    prefix: "toolchain:kernel:",
    file: "./cliAgentSwarmMicroKernel.mjs",
    fn: "handleAgentSwarmMicroKernelCommand",
  },
  {
    prefix: "toolchain:proof:",
    file: "./cliInductiveProofEngine.mjs",
    fn: "handleInductiveProofEngineCommand",
  },
  {
    prefix: "toolchain:studio:",
    file: "./cliGlorianLiveStudio.mjs",
    fn: "handleGlorianLiveStudioCommand",
  },
  {
    prefix: "toolchain:sentinel:",
    file: "./cliAutonomousSentinelDaemon.mjs",
    fn: "handleAutonomousSentinelDaemonCommand",
  },
  {
    prefix: "toolchain:voice:",
    file: "./cliVoiceNeuralInterface.mjs",
    fn: "handleVoiceNeuralInterfaceCommand",
  },
  {
    prefix: "toolchain:chaos:",
    file: "./cliFleetChaosMonkey.mjs",
    fn: "handleFleetChaosMonkeyCommand",
  },
  {
    prefix: "toolchain:mesh:",
    file: "./cliMultiNodeSwarmMesh.mjs",
    fn: "handleMultiNodeSwarmMeshCommand",
  },
  {
    prefix: "toolchain:eval:",
    file: "./cliSweBenchEvalFlywheel.mjs",
    fn: "handleSweBenchEvalFlywheelCommand",
  },
  {
    prefix: "toolchain:jit:",
    file: "./cliDynamicToolSynthesis.mjs",
    fn: "handleDynamicToolSynthesisCommand",
  },
  {
    prefix: "toolchain:crucible:",
    file: "./cliAdversarialRedTeamCrucible.mjs",
    fn: "handleAdversarialRedTeamCrucibleCommand",
  },
  {
    prefix: "toolchain:memory:",
    file: "./cliEpisodicMemoryGraph.mjs",
    fn: "handleEpisodicMemoryGraphCommand",
  },
  {
    prefix: "toolchain:replay:",
    file: "./cliDeterministicReplayDebugger.mjs",
    fn: "handleDeterministicReplayDebuggerCommand",
  },
  {
    prefix: "toolchain:trading:",
    file: "./cliInstitutionalTradingEngine.mjs",
    fn: "handleInstitutionalTradingCommand",
  },
  {
    prefix: "toolchain:aladdin:",
    file: "./cliAladdinRiskEngine.mjs",
    fn: "handleAladdinCommand",
  },
];

export async function handleToolchainCommands(commandContext) {
  for (const entry of TOOLCHAIN_DISPATCHERS) {
    if (commandContext.command.startsWith(entry.prefix)) {
      const mod = await import(entry.file);
      const result = await mod[entry.fn](commandContext);
      return result !== false;
    }
  }
  return false;
}
