/**
 * SPEC-252 / CHANGE-126 — Layer-0 Six-Sigma SPC (Shewhart, Cp/Cpk, CUSUM, EWMA) & Semiconductor Yield Control.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  SpcYieldAuditOptions,
  SpcYieldAuditReport,
  SpcYieldVerdict,
} from "./eosStatisticalProcessYieldControlCore.types.ts";

const DEFAULT_SPC_SAMPLES: readonly number[] = [
  99.8, 100.2, 99.6, 100.4, 99.9, 100.1, 99.7, 100.3, 100.0, 99.8, 100.2, 99.9, 100.1, 99.7, 100.3, 100.0,
];

function validateSpcInputs(
  samples: readonly number[],
  lsl: number,
  usl: number,
  ewmaLambda: number,
  criticalAreaCm2: number,
  defectDensityPerCm2: number,
): void {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new Error("SPC yield audit requires at least 2 finite numeric observations.");
  }
  if (samples.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("All SPC sample observations must be finite numbers.");
  }
  if (!(usl > lsl)) {
    throw new Error(`Specification upper limit (${usl}) must strictly exceed lower limit (${lsl}).`);
  }
  if (!(ewmaLambda > 0 && ewmaLambda <= 1)) {
    throw new Error("EWMA smoothing factor lambda must lie within (0, 1].");
  }
  if (!(criticalAreaCm2 > 0) || defectDensityPerCm2 < 0) {
    throw new Error("criticalAreaCm2 must be > 0 and defectDensityPerCm2 must be >= 0.");
  }
}

function computeBasicStats(samples: readonly number[]): { readonly mean: number; readonly stdDev: number } {
  const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (samples.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

function computeCusumAndEwma(
  samples: readonly number[],
  target: number,
  effectiveSigma: number,
  cusumSlackSigma: number,
  cusumLimitSigma: number,
  ewmaLambda: number,
  lcl: number,
  ucl: number,
  lsl: number,
  usl: number,
): {
  readonly maxCusumHigh: number;
  readonly maxCusumLow: number;
  readonly cusumThreshold: number;
  readonly cusumDriftDetected: boolean;
  readonly ewmaFinal: number;
  readonly excursionIndices: readonly number[];
} {
  const k = cusumSlackSigma * effectiveSigma;
  const cusumThreshold = cusumLimitSigma * effectiveSigma;
  let cPlus = 0;
  let cMinus = 0;
  let maxCusumHigh = 0;
  let maxCusumLow = 0;
  let ewma = target;
  const excursionIndices: number[] = [];

  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    cPlus = Math.max(0, cPlus + (x - target - k));
    cMinus = Math.max(0, cMinus + (target - k - x));
    if (cPlus > maxCusumHigh) maxCusumHigh = cPlus;
    if (cMinus > maxCusumLow) maxCusumLow = cMinus;
    ewma = ewmaLambda * x + (1 - ewmaLambda) * ewma;
    if (x < lcl || x > ucl || x < lsl || x > usl) {
      excursionIndices.push(i);
    }
  }

  return {
    maxCusumHigh,
    maxCusumLow,
    cusumThreshold,
    cusumDriftDetected: maxCusumHigh > cusumThreshold || maxCusumLow > cusumThreshold,
    ewmaFinal: ewma,
    excursionIndices,
  };
}

function resolveVerdict(cpk: number, outOfControlCount: number, cusumDriftDetected: boolean): SpcYieldVerdict {
  if (outOfControlCount > 0 || cpk < 1.0) return "PROCESS_EXCURSION_HALT";
  if (cpk >= 1.33 && !cusumDriftDetected) return "SIX_SIGMA_LOCKED";
  return "SPC_DRIFT_WARNING";
}

export class EosStatisticalProcessYieldControlCore {
  static auditProcessCapabilityAndYield(options: SpcYieldAuditOptions = {}): SpcYieldAuditReport {
    const processId = options.processId?.trim() || "SUBNM-LITHO-SPC-01";
    const samples = options.samples ?? DEFAULT_SPC_SAMPLES;
    const lsl = options.lsl ?? 94.0;
    const usl = options.usl ?? 106.0;
    const target = options.target ?? (lsl + usl) / 2;
    const cusumSlackSigma = options.cusumSlackSigma ?? 0.5;
    const cusumLimitSigma = options.cusumLimitSigma ?? 4.0;
    const ewmaLambda = options.ewmaLambda ?? 0.2;
    const criticalAreaCm2 = options.criticalAreaCm2 ?? 1.5;
    const defectDensityPerCm2 = options.defectDensityPerCm2 ?? 0.02;

    validateSpcInputs(samples, lsl, usl, ewmaLambda, criticalAreaCm2, defectDensityPerCm2);

    const { mean, stdDev } = computeBasicStats(samples);
    const effectiveSigma = stdDev > 1e-9 ? stdDev : 1e-6;
    const ucl = mean + 3 * effectiveSigma;
    const lcl = mean - 3 * effectiveSigma;
    const cp = (usl - lsl) / (6 * effectiveSigma);
    const cpk = Math.min((usl - mean) / (3 * effectiveSigma), (mean - lsl) / (3 * effectiveSigma));

    const control = computeCusumAndEwma(
      samples,
      target,
      effectiveSigma,
      cusumSlackSigma,
      cusumLimitSigma,
      ewmaLambda,
      lcl,
      ucl,
      lsl,
      usl,
    );

    const lambdaYield = criticalAreaCm2 * defectDensityPerCm2;
    const poissonYieldPercent = lambdaYield === 0 ? 100 : 100 * Math.exp(-lambdaYield);
    const murphyYieldPercent = lambdaYield === 0 ? 100 : 100 * ((1 - Math.exp(-lambdaYield)) / lambdaYield) ** 2;

    const verdict = resolveVerdict(cpk, control.excursionIndices.length, control.cusumDriftDetected);
    const digestPayload = {
      processId,
      sampleCount: samples.length,
      cpk: Number(cpk.toFixed(4)),
      outOfControlPointsCount: control.excursionIndices.length,
      cusumDriftDetected: control.cusumDriftDetected,
      verdict,
    };

    return deepFreeze({
      processId,
      sampleCount: samples.length,
      lsl,
      usl,
      target: Number(target.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      ucl: Number(ucl.toFixed(4)),
      lcl: Number(lcl.toFixed(4)),
      cp: Number(cp.toFixed(4)),
      cpk: Number(cpk.toFixed(4)),
      maxCusumHigh: Number(control.maxCusumHigh.toFixed(4)),
      maxCusumLow: Number(control.maxCusumLow.toFixed(4)),
      cusumThreshold: Number(control.cusumThreshold.toFixed(4)),
      cusumDriftDetected: control.cusumDriftDetected,
      ewmaFinal: Number(control.ewmaFinal.toFixed(4)),
      outOfControlPointsCount: control.excursionIndices.length,
      excursionIndices: control.excursionIndices,
      criticalAreaCm2,
      defectDensityPerCm2,
      poissonYieldPercent: Number(poissonYieldPercent.toFixed(4)),
      murphyYieldPercent: Number(murphyYieldPercent.toFixed(4)),
      verdict,
      spcDigestSha256: pureSha256(JSON.stringify(digestPayload)),
    });
  }
}
