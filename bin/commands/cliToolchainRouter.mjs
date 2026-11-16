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
