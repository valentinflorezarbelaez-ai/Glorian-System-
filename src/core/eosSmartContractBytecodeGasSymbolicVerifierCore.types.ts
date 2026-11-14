/**
 * src/core/eosSmartContractBytecodeGasSymbolicVerifierCore.types.ts
 * SPEC-268 / CHANGE-130: Smart-Contract Bytecode Gas & Symbolic CEI Verifier Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type BytecodeSymbolicGasRegime =
  "SYMBOLIC_GAS_AND_CEI_PROVED" | "GAS_STIPEND_PRESSURE_WARNING" | "REENTRANCY_OR_UNBOUNDED_GAS_CRITICAL";

export interface BytecodeSymbolicGasOptions {
  readonly contractId?: string;
  readonly cfgNodeCount?: number;
  readonly cfgEdgeCount?: number;
  readonly maxLoopBound?: number;
  readonly loopBodyGasCost?: number;
  readonly coldSstoreCount?: number;
  readonly externalCallCount?: number;
  readonly stateWritesAfterExternalCall?: number;
  readonly reentrancyMutexLocked?: boolean;
  readonly blockGasLimitCeiling?: number;
}

export interface BytecodeSymbolicGasAssessment {
  readonly specId: "SPEC-268";
  readonly contractId: string;
  readonly cfgNodeCount: number;
  readonly cfgEdgeCount: number;
  readonly maxLoopBound: number;
  readonly loopBodyGasCost: number;
  readonly coldSstoreCount: number;
  readonly externalCallCount: number;
  readonly stateWritesAfterExternalCall: number;
  readonly reentrancyMutexLocked: boolean;
  readonly blockGasLimitCeiling: number;
  readonly cyclomaticPaths: number;
  readonly worstCaseGasUsed: number;
  readonly gasUtilizationRatio: number;
  readonly ceiInvariantSatisfied: boolean;
  readonly regime: BytecodeSymbolicGasRegime;
  readonly bytecodeGasDigestSha256: string;
}
