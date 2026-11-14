/**
 * src/core/eosDifferentialPrivacyAbacGovernorCore.ts
 * SPEC-255 / CHANGE-128: Differential Privacy & Zero-Trust ABAC Policy Governor Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertClosedRange,
  assertFiniteNonNegative,
  assertFinitePositive,
  assertIntMin,
  assertOpenRange,
  pickDefined,
  pickNonEmptyString,
  round12,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  DifferentialPrivacyAbacOptions,
  DifferentialPrivacyAbacReport,
  DifferentialPrivacyAbacVerdict,
} from "./eosDifferentialPrivacyAbacGovernorCore.types.ts";

function normalizeTags(values: readonly string[] | undefined, fallback: readonly string[]): readonly string[] {
  return pickDefined(values, fallback).map((s) => s.trim().toUpperCase());
}

function resolveValidatedDpAbacParams(options: DifferentialPrivacyAbacOptions) {
  return {
    principalId: pickNonEmptyString(options.principalId, "principal:ml-research-01"),
    subjectClearance: assertFiniteNonNegative(pickDefined(options.subjectClearance, 4), "subjectClearance"),
    requiredClearance: assertFiniteNonNegative(pickDefined(options.requiredClearance, 3), "requiredClearance"),
    subjectCompartments: normalizeTags(options.subjectCompartments, ["AI_CORE", "QUANTUM", "FEDERATED_DP"]),
    requiredCompartments: normalizeTags(options.requiredCompartments, ["AI_CORE", "QUANTUM"]),
    mfaVerified: pickDefined(options.mfaVerified, true),
    deviceTrustScore: assertClosedRange(
      pickDefined(options.deviceTrustScore, 0.94),
      0,
      1,
      "deviceTrustScore must be in [0, 1].",
    ),
    minDeviceTrustScore: assertClosedRange(
      pickDefined(options.minDeviceTrustScore, 0.8),
      0,
      1,
      "minDeviceTrustScore must be in [0, 1].",
    ),
    epsilonTotalBudget: assertFinitePositive(pickDefined(options.epsilonTotalBudget, 2.0), "epsilonTotalBudget"),
    epsilonAlreadySpent: assertFiniteNonNegative(pickDefined(options.epsilonAlreadySpent, 0.6), "epsilonAlreadySpent"),
    queryEpsilon: assertFinitePositive(pickDefined(options.queryEpsilon, 0.4), "queryEpsilon"),
    deltaBudget: assertOpenRange(pickDefined(options.deltaBudget, 1e-6), 0, 1, "deltaBudget must be in (0, 1)."),
    l1Sensitivity: assertFinitePositive(pickDefined(options.l1Sensitivity, 1.0), "l1Sensitivity"),
    recordCount: assertIntMin(pickDefined(options.recordCount, 10000), 1, "recordCount"),
    kAnonymityThreshold: assertIntMin(pickDefined(options.kAnonymityThreshold, 5), 1, "kAnonymityThreshold"),
    minEquivalenceClassSize: assertIntMin(
      pickDefined(options.minEquivalenceClassSize, 12),
      1,
      "minEquivalenceClassSize",
    ),
  };
}

export class EosDifferentialPrivacyAbacGovernorCore {
  static evaluateDifferentialPrivacyAbac(options: DifferentialPrivacyAbacOptions = {}): DifferentialPrivacyAbacReport {
    const p = resolveValidatedDpAbacParams(options);
    const subjectSet = new Set(p.subjectCompartments);
    const clearanceSatisfied = p.subjectClearance >= p.requiredClearance;
    const compartmentsSatisfied = p.requiredCompartments.every((c) => subjectSet.has(c));
    const trustSatisfied = p.mfaVerified && p.deviceTrustScore >= p.minDeviceTrustScore;
    const kAnonymitySatisfied = p.minEquivalenceClassSize >= p.kAnonymityThreshold;
    const abacAuthorized = clearanceSatisfied && compartmentsSatisfied && trustSatisfied && kAnonymitySatisfied;

    const projectedEpsilonSpent = round12(p.epsilonAlreadySpent + p.queryEpsilon);
    const privacyBudgetAuthorized = projectedEpsilonSpent <= p.epsilonTotalBudget + 1e-12;
    const remainingEpsilonBudget = round12(Math.max(0, p.epsilonTotalBudget - projectedEpsilonSpent));
    const laplaceScale = round6(p.l1Sensitivity / p.queryEpsilon);
    const gaussianSigma = round6((p.l1Sensitivity * Math.sqrt(2 * Math.log(1.25 / p.deltaBudget))) / p.queryEpsilon);

    const verdict: DifferentialPrivacyAbacVerdict = !abacAuthorized
      ? "ABAC_ZERO_TRUST_DENIED"
      : !privacyBudgetAuthorized
        ? "PRIVACY_BUDGET_EXHAUSTED"
        : "PRIVACY_AND_ABAC_AUTHORIZED";

    const payload = {
      specId: "SPEC-255" as const,
      principalId: p.principalId,
      clearanceSatisfied,
      compartmentsSatisfied,
      trustSatisfied,
      kAnonymitySatisfied,
      abacAuthorized,
      privacyBudgetAuthorized,
      epsilonTotalBudget: p.epsilonTotalBudget,
      epsilonAlreadySpent: p.epsilonAlreadySpent,
      queryEpsilon: p.queryEpsilon,
      projectedEpsilonSpent,
      remainingEpsilonBudget,
      deltaBudget: p.deltaBudget,
      laplaceScale,
      gaussianSigma,
      recordCount: p.recordCount,
      verdict,
    };
    const privacyAbacDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, privacyAbacDigestSha256 });
  }
}

export const evaluateDifferentialPrivacyAbac = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac;
