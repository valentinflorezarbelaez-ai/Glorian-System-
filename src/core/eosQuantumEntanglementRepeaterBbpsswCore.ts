/**
 * src/core/eosQuantumEntanglementRepeaterBbpsswCore.ts
 * SPEC-267 / CHANGE-130: Quantum Entanglement Repeater & BBPSSW Purification Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFinitePositive,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  QuantumRepeaterBbpsswAssessment,
  QuantumRepeaterBbpsswOptions,
  QuantumRepeaterRegime,
} from "./eosQuantumEntanglementRepeaterBbpsswCore.types.ts";

export const DEFAULT_QUANTUM_REPEATER_BBPSSW_OPTIONS: Readonly<Required<QuantumRepeaterBbpsswOptions>> = deepFreeze({
  linkTopologyId: "QNET-BBPSSW-REPEATER-CHAIN-01",
  repeaterSwapLevels: 2,
  purificationRounds: 2,
  rawBellPairFidelity: 0.95,
  entanglementAttemptRateHz: 250000,
  memoryCoherenceTimeMs: 120.0,
  heraldingRoundTripMs: 1.2,
  minEndToEndFidelity: 0.82,
});

function assertIntClosedRange(value: number, min: number, max: number, name: string): number {
  assertIntMin(value, min, name);
  assertPrecondition(value <= max, `${name} must be <= ${max} (got ${value})`);
  return value;
}

function assertLeftOpenRightClosed(value: number, min: number, max: number, name: string): number {
  assertPrecondition(
    typeof value === "number" && Number.isFinite(value) && value > min && value <= max,
    `${name} must satisfy ${min} < ${name} <= ${max} (got ${value})`,
  );
  return value;
}

function resolveValidatedRepeaterParams(options: QuantumRepeaterBbpsswOptions) {
  const d = DEFAULT_QUANTUM_REPEATER_BBPSSW_OPTIONS;
  return {
    linkTopologyId: pickNonEmptyString(options.linkTopologyId, d.linkTopologyId),
    repeaterSwapLevels: assertIntClosedRange(
      pickDefined(options.repeaterSwapLevels, d.repeaterSwapLevels),
      1,
      6,
      "repeaterSwapLevels",
    ),
    purificationRounds: assertIntClosedRange(
      pickDefined(options.purificationRounds, d.purificationRounds),
      0,
      5,
      "purificationRounds",
    ),
    rawBellPairFidelity: assertLeftOpenRightClosed(
      pickDefined(options.rawBellPairFidelity, d.rawBellPairFidelity),
      0.25,
      1.0,
      "rawBellPairFidelity",
    ),
    entanglementAttemptRateHz: assertFinitePositive(
      pickDefined(options.entanglementAttemptRateHz, d.entanglementAttemptRateHz),
      "entanglementAttemptRateHz",
    ),
    memoryCoherenceTimeMs: assertFinitePositive(
      pickDefined(options.memoryCoherenceTimeMs, d.memoryCoherenceTimeMs),
      "memoryCoherenceTimeMs",
    ),
    heraldingRoundTripMs: assertFinitePositive(
      pickDefined(options.heraldingRoundTripMs, d.heraldingRoundTripMs),
      "heraldingRoundTripMs",
    ),
    minEndToEndFidelity: assertLeftOpenRightClosed(
      pickDefined(options.minEndToEndFidelity, d.minEndToEndFidelity),
      0.5,
      1.0,
      "minEndToEndFidelity",
    ),
  };
}

function classifyRepeaterRegime(
  rawBellPairFidelity: number,
  endToEndFidelity: number,
  minEndToEndFidelity: number,
  memoryDecoherenceFactor: number,
): QuantumRepeaterRegime {
  if (rawBellPairFidelity <= 0.5 || endToEndFidelity < minEndToEndFidelity) return "BELOW_PURIFICATION_THRESHOLD";
  if (memoryDecoherenceFactor < 0.88) return "DECOHERENCE_RATE_DEGRADED";
  return "BELL_PAIR_DISTILLATION_LOCKED";
}

export class EosQuantumEntanglementRepeaterBbpsswCore {
  static evaluateQuantumEntanglementRepeaterBbpssw(
    options: QuantumRepeaterBbpsswOptions = {},
  ): QuantumRepeaterBbpsswAssessment {
    const p = resolveValidatedRepeaterParams(options);
    let f = p.rawBellPairFidelity;
    let cumSuccessProb = 1.0;

    for (let m = 0; m < p.purificationRounds; m++) {
      const oneMinusF = 1 - f;
      const pSucc = f * f + (2 / 3) * f * oneMinusF + (5 / 9) * oneMinusF * oneMinusF;
      f = (f * f + (1 / 9) * oneMinusF * oneMinusF) / pSucc;
      cumSuccessProb *= pSucc;
    }

    const purifiedLinkFidelity = round6(f);
    const purificationSuccessProb = round6(cumSuccessProb);
    const segmentCount = Math.pow(2, p.repeaterSwapLevels);
    const wPurified = (4 * f - 1) / 3;
    const memoryDecoherenceFactor = round6(Math.exp(-p.heraldingRoundTripMs / p.memoryCoherenceTimeMs));
    const wE2e = Math.pow(Math.max(0, wPurified), segmentCount) * memoryDecoherenceFactor;
    const endToEndFidelity = round6((1 + 3 * wE2e) / 4);
    const distilledEbitRatePerSec = round6(
      (p.entanglementAttemptRateHz * cumSuccessProb * memoryDecoherenceFactor) / segmentCount,
    );
    const regime = classifyRepeaterRegime(
      p.rawBellPairFidelity,
      endToEndFidelity,
      p.minEndToEndFidelity,
      memoryDecoherenceFactor,
    );

    const payload = {
      specId: "SPEC-267" as const,
      ...p,
      purifiedLinkFidelity,
      purificationSuccessProb,
      segmentCount,
      memoryDecoherenceFactor,
      endToEndFidelity,
      distilledEbitRatePerSec,
      regime,
    };
    return deepFreeze({
      ...payload,
      quantumRepeaterDigestSha256: pureSha256(JSON.stringify(payload)),
    });
  }
}

export function evaluateQuantumEntanglementRepeaterBbpssw(
  options: QuantumRepeaterBbpsswOptions = {},
): QuantumRepeaterBbpsswAssessment {
  return EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw(options);
}
