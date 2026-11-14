/**
 * src/core/eosSmartContractBytecodeGasSymbolicVerifierCore.ts
 * SPEC-268 / CHANGE-130: Smart-Contract Bytecode Gas & Symbolic CEI Verifier Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteNonNegative,
  assertFinitePositive,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  BytecodeSymbolicGasAssessment,
  BytecodeSymbolicGasOptions,
  BytecodeSymbolicGasRegime,
} from "./eosSmartContractBytecodeGasSymbolicVerifierCore.types.ts";

export const DEFAULT_BYTECODE_SYMBOLIC_GAS_OPTIONS: Readonly<Required<BytecodeSymbolicGasOptions>> = deepFreeze({
  contractId: "EVM-VAULT-SETTLEMENT-CORE-01",
  cfgNodeCount: 42,
  cfgEdgeCount: 51,
  maxLoopBound: 16,
  loopBodyGasCost: 1850,
  coldSstoreCount: 3,
  externalCallCount: 1,
  stateWritesAfterExternalCall: 0,
  reentrancyMutexLocked: true,
  blockGasLimitCeiling: 150000,
});

function resolveValidatedBytecodeParams(options: BytecodeSymbolicGasOptions) {
  const d = DEFAULT_BYTECODE_SYMBOLIC_GAS_OPTIONS;
  const cfgNodeCount = assertIntMin(pickDefined(options.cfgNodeCount, d.cfgNodeCount), 1, "cfgNodeCount");
  const cfgEdgeCount = assertIntMin(
    pickDefined(options.cfgEdgeCount, d.cfgEdgeCount),
    cfgNodeCount - 1,
    "cfgEdgeCount",
  );
  const reentrancyMutexLocked = pickDefined(options.reentrancyMutexLocked, d.reentrancyMutexLocked);
  assertPrecondition(
    typeof reentrancyMutexLocked === "boolean",
    `reentrancyMutexLocked must be boolean (got ${typeof reentrancyMutexLocked})`,
  );
  return {
    contractId: pickNonEmptyString(options.contractId, d.contractId),
    cfgNodeCount,
    cfgEdgeCount,
    maxLoopBound: assertIntMin(pickDefined(options.maxLoopBound, d.maxLoopBound), 0, "maxLoopBound"),
    loopBodyGasCost: assertFiniteNonNegative(
      pickDefined(options.loopBodyGasCost, d.loopBodyGasCost),
      "loopBodyGasCost",
    ),
    coldSstoreCount: assertIntMin(pickDefined(options.coldSstoreCount, d.coldSstoreCount), 0, "coldSstoreCount"),
    externalCallCount: assertIntMin(
      pickDefined(options.externalCallCount, d.externalCallCount),
      0,
      "externalCallCount",
    ),
    stateWritesAfterExternalCall: assertIntMin(
      pickDefined(options.stateWritesAfterExternalCall, d.stateWritesAfterExternalCall),
      0,
      "stateWritesAfterExternalCall",
    ),
    reentrancyMutexLocked,
    blockGasLimitCeiling: assertFinitePositive(
      pickDefined(options.blockGasLimitCeiling, d.blockGasLimitCeiling),
      "blockGasLimitCeiling",
    ),
  };
}

function classifyBytecodeRegime(
  ceiInvariantSatisfied: boolean,
  worstCaseGasUsed: number,
  blockGasLimitCeiling: number,
  maxLoopBound: number,
  gasUtilizationRatio: number,
  stateWritesAfterExternalCall: number,
): BytecodeSymbolicGasRegime {
  if (!ceiInvariantSatisfied || worstCaseGasUsed > blockGasLimitCeiling || maxLoopBound > 256) {
    return "REENTRANCY_OR_UNBOUNDED_GAS_CRITICAL";
  }
  if (gasUtilizationRatio > 0.85 || stateWritesAfterExternalCall > 0) return "GAS_STIPEND_PRESSURE_WARNING";
  return "SYMBOLIC_GAS_AND_CEI_PROVED";
}

export class EosSmartContractBytecodeGasSymbolicVerifierCore {
  static evaluateSmartContractBytecodeGasSymbolicVerifier(
    options: BytecodeSymbolicGasOptions = {},
  ): BytecodeSymbolicGasAssessment {
    const p = resolveValidatedBytecodeParams(options);
    const cyclomaticPaths = p.cfgEdgeCount - p.cfgNodeCount + 2;
    const worstCaseGasUsed = round6(
      21000 +
        p.maxLoopBound * p.loopBodyGasCost +
        p.coldSstoreCount * 20000 +
        p.externalCallCount * 2600 +
        cyclomaticPaths * 320,
    );
    const gasUtilizationRatio = round6(worstCaseGasUsed / p.blockGasLimitCeiling);
    const ceiInvariantSatisfied = p.stateWritesAfterExternalCall === 0 || p.reentrancyMutexLocked === true;
    const regime = classifyBytecodeRegime(
      ceiInvariantSatisfied,
      worstCaseGasUsed,
      p.blockGasLimitCeiling,
      p.maxLoopBound,
      gasUtilizationRatio,
      p.stateWritesAfterExternalCall,
    );

    const payload = {
      specId: "SPEC-268" as const,
      ...p,
      cyclomaticPaths,
      worstCaseGasUsed,
      gasUtilizationRatio,
      ceiInvariantSatisfied,
      regime,
    };
    return deepFreeze({
      ...payload,
      bytecodeGasDigestSha256: pureSha256(JSON.stringify(payload)),
    });
  }
}

export function evaluateSmartContractBytecodeGasSymbolicVerifier(
  options: BytecodeSymbolicGasOptions = {},
): BytecodeSymbolicGasAssessment {
  return EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier(options);
}
