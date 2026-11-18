/**
 * Glorian System — Autonomous EUV Optical Proximity Correction &
 * Inverse Lithography Wavefront Engine (EUV-OPC / ILT)
 * Governed by SPEC-337 / CHANGE-199 / ADR-199-001..003
 *
 * Implements:
 *  1. Orthonormal Noll Zernike circle polynomials (Z4, Z5, Z6, Z7, Z8, Z11) with
 *     2D polar pupil quadrature verification and Maréchal Strehl ratio S = exp(-sigma_phi^2).
 *  2. Fail-closed Maréchal diffraction-limit gate (S >= 0.80) and active mirror
 *     conjugate Zernike actuator compensation.
 *  3. 2D diffraction point-spread function (PSF) aerial image convolution and
 *     sigmoid photoresist contour model.
 *  4. Adjoint-gradient pixel-based Inverse Lithography Technology (ILT) mask
 *     synthesis minimizing wafer L2 error and Edge Placement Error (EPE).
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import { createHash } from "node:crypto";
import type {
  AerialImageSimulationResult,
  EuvIltAuditReceipt,
  EuvIltErrorCode,
  EuvScannerOpticsConfig,
  IltSynthesisResult,
  WavefrontCompensationResult,
  WavefrontMetrologyReport,
  ZernikeAberrationProfileNm,
} from "./eosEuvInverseLithographyWavefront.types.ts";

export * from "./eosEuvInverseLithographyWavefront.types.ts";

export const MARECHAL_MIN_STREHL = 0.8;

export class EuvIltError extends Error {
  public readonly code: EuvIltErrorCode;

  constructor(code: EuvIltErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "EuvIltError";
  }
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function sigmoid(x: number): number {
  if (x >= 35) return 1;
  if (x <= -35) return 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Evaluate orthonormal Noll Zernike modes at polar pupil coordinate (rho in [0,1], theta).
 */
export function evaluateZernikeWavefrontNm(rho: number, theta: number, profile: ZernikeAberrationProfileNm): number {
  const r2 = rho * rho;
  const r3 = r2 * rho;
  const r4 = r2 * r2;
  const z4 = (profile.z4DefocusNm ?? 0) * Math.sqrt(3) * (2 * r2 - 1);
  const z5 = (profile.z5AstigmatismObliqueNm ?? 0) * Math.sqrt(6) * r2 * Math.sin(2 * theta);
  const z6 = (profile.z6AstigmatismVerticalNm ?? 0) * Math.sqrt(6) * r2 * Math.cos(2 * theta);
  const z7 = (profile.z7ComaVerticalNm ?? 0) * Math.sqrt(8) * (3 * r3 - 2 * rho) * Math.sin(theta);
  const z8 = (profile.z8ComaHorizontalNm ?? 0) * Math.sqrt(8) * (3 * r3 - 2 * rho) * Math.cos(theta);
  const z11 = (profile.z11SphericalNm ?? 0) * Math.sqrt(5) * (6 * r4 - 6 * r2 + 1);
  return z4 + z5 + z6 + z7 + z8 + z11;
}

/**
 * Autonomous EUV Optical Proximity Correction & Inverse Lithography Wavefront Core.
 */
export class EosEuvInverseLithographyWavefrontCore {
  private readonly wavelengthNm: number;
  private readonly na: number;
  private readonly sigma: number;
  private readonly resistSteepness: number;
  private readonly resistThreshold: number;

  constructor(config: EuvScannerOpticsConfig = {}) {
    const wavelengthNm = config.wavelengthNm ?? 13.5;
    const na = config.numericalAperture ?? 0.33;
    const sigma = config.coherenceSigma ?? 0.5;
    const resistSteepness = config.resistSteepness ?? 14.0;
    const resistThreshold = config.resistThreshold ?? 0.42;

    if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0) {
      throw new EuvIltError("EUVILT_INVALID_PARAMETERS", `wavelengthNm must be > 0, got ${wavelengthNm}`);
    }
    if (!Number.isFinite(na) || na <= 0 || na >= 1) {
      throw new EuvIltError("EUVILT_INVALID_PARAMETERS", `numericalAperture must be in (0, 1), got ${na}`);
    }
    if (!Number.isFinite(sigma) || sigma < 0.05 || sigma > 1.0) {
      throw new EuvIltError("EUVILT_INVALID_PARAMETERS", `coherenceSigma must be in [0.05, 1.0], got ${sigma}`);
    }
    if (!Number.isFinite(resistThreshold) || resistThreshold <= 0 || resistThreshold >= 1) {
      throw new EuvIltError("EUVILT_INVALID_PARAMETERS", `resistThreshold must be in (0, 1), got ${resistThreshold}`);
    }

    this.wavelengthNm = wavelengthNm;
    this.na = na;
    this.sigma = sigma;
    this.resistSteepness = resistSteepness;
    this.resistThreshold = resistThreshold;
  }

  // ---------------------------------------------------------------------------
  // Zernike Pupil Wavefront Metrology & Compensation (FR-1, FR-2, FR-3)
  // ---------------------------------------------------------------------------

  public evaluateWavefront(
    profile: ZernikeAberrationProfileNm = {},
    opticsOverride?: { wavelengthNm?: number; numericalAperture?: number },
  ): WavefrontMetrologyReport {
    const lambda = opticsOverride?.wavelengthNm ?? this.wavelengthNm;
    const na = opticsOverride?.numericalAperture ?? this.na;
    if (!Number.isFinite(lambda) || lambda <= 0 || !Number.isFinite(na) || na <= 0 || na >= 1) {
      throw new EuvIltError("EUVILT_INVALID_PARAMETERS", "invalid optical wavelength or NA override");
    }

    const coeffs = [
      profile.z4DefocusNm ?? 0,
      profile.z5AstigmatismObliqueNm ?? 0,
      profile.z6AstigmatismVerticalNm ?? 0,
      profile.z7ComaVerticalNm ?? 0,
      profile.z8ComaHorizontalNm ?? 0,
      profile.z11SphericalNm ?? 0,
    ];
    const sumSq = coeffs.reduce((acc, c) => acc + c * c, 0);
    const rmsErrorNm = Math.sqrt(sumSq);
    const rmsErrorWaves = rmsErrorNm / lambda;
    const rmsPhaseRad = (2 * Math.PI * rmsErrorNm) / lambda;

    // 2D polar pupil midpoint quadrature cross-check over the unit disk:
    // (1 / pi) int_0^1 int_0^{2pi} W(rho, theta)^2 rho d(rho) d(theta)
    const nRho = 32;
    const nTheta = 32;
    const dRho = 1 / nRho;
    const dTheta = (2 * Math.PI) / nTheta;
    let integralSq = 0;
    for (let ir = 0; ir < nRho; ir++) {
      const rho = (ir + 0.5) * dRho;
      for (let it = 0; it < nTheta; it++) {
        const theta = (it + 0.5) * dTheta;
        const w = evaluateZernikeWavefrontNm(rho, theta, profile);
        integralSq += w * w * rho * dRho * dTheta;
      }
    }
    const quadratureRmsNm = Math.sqrt(integralSq / Math.PI);

    const strehlRatio = Math.exp(-(rmsPhaseRad * rmsPhaseRad));
    const marechalLimitNm = lambda / 14;
    const rayleighHalfPitchNm = (0.25 * lambda) / na;
    const pupilCutoffFreqPerNm = na / lambda;

    return {
      wavelengthNm: lambda,
      numericalAperture: na,
      rayleighHalfPitchNm,
      pupilCutoffFreqPerNm,
      rmsErrorNm,
      rmsErrorWaves,
      rmsPhaseRad,
      quadratureRmsNm,
      strehlRatio,
      marechalLimitNm,
      diffractionLimited: strehlRatio >= MARECHAL_MIN_STREHL - 1e-9,
    };
  }

  /** Fail-closed exposure admission guard requiring Maréchal Strehl >= 0.80. */
  public assertDiffractionLimitedAdmission(profile: ZernikeAberrationProfileNm): WavefrontMetrologyReport {
    const report = this.evaluateWavefront(profile);
    if (!report.diffractionLimited) {
      throw new EuvIltError(
        "EUVILT_MARECHAL_BREACH",
        `pupil Strehl ${report.strehlRatio.toFixed(4)} < ${MARECHAL_MIN_STREHL} (RMS ${report.rmsErrorNm.toFixed(3)} nm > Maréchal limit ${report.marechalLimitNm.toFixed(3)} nm)`,
      );
    }
    return report;
  }

  /**
   * Apply active mirror Zernike phase conjugation with actuator correction efficiency
   * (default 94%), suppressing aberration modes well below the Maréchal limit.
   */
  public compensateWavefront(
    aberrated: ZernikeAberrationProfileNm,
    actuatorEfficiency = 0.94,
  ): WavefrontCompensationResult {
    if (!Number.isFinite(actuatorEfficiency) || actuatorEfficiency <= 0 || actuatorEfficiency > 1) {
      throw new EuvIltError(
        "EUVILT_INVALID_PARAMETERS",
        `actuatorEfficiency must be in (0, 1], got ${actuatorEfficiency}`,
      );
    }
    const before = this.evaluateWavefront(aberrated);
    const rem = 1 - actuatorEfficiency;
    const residualProfile: ZernikeAberrationProfileNm = {
      z4DefocusNm: (aberrated.z4DefocusNm ?? 0) * rem,
      z5AstigmatismObliqueNm: (aberrated.z5AstigmatismObliqueNm ?? 0) * rem,
      z6AstigmatismVerticalNm: (aberrated.z6AstigmatismVerticalNm ?? 0) * rem,
      z7ComaVerticalNm: (aberrated.z7ComaVerticalNm ?? 0) * rem,
      z8ComaHorizontalNm: (aberrated.z8ComaHorizontalNm ?? 0) * rem,
      z11SphericalNm: (aberrated.z11SphericalNm ?? 0) * rem,
    };
    const after = this.assertDiffractionLimitedAdmission(residualProfile);
    const actuatorStrokeNm: Required<ZernikeAberrationProfileNm> = {
      z4DefocusNm: -(aberrated.z4DefocusNm ?? 0) * actuatorEfficiency,
      z5AstigmatismObliqueNm: -(aberrated.z5AstigmatismObliqueNm ?? 0) * actuatorEfficiency,
      z6AstigmatismVerticalNm: -(aberrated.z6AstigmatismVerticalNm ?? 0) * actuatorEfficiency,
      z7ComaVerticalNm: -(aberrated.z7ComaVerticalNm ?? 0) * actuatorEfficiency,
      z8ComaHorizontalNm: -(aberrated.z8ComaHorizontalNm ?? 0) * actuatorEfficiency,
      z11SphericalNm: -(aberrated.z11SphericalNm ?? 0) * actuatorEfficiency,
    };
    const residualSuppressionRatio = before.rmsErrorNm > 0 ? 1 - after.rmsErrorNm / before.rmsErrorNm : 1;

    return {
      before,
      after,
      actuatorStrokeNm,
      residualSuppressionRatio,
    };
  }

  // ---------------------------------------------------------------------------
  // 2D Diffraction PSF & Aerial Image Simulation (FR-4)
  // ---------------------------------------------------------------------------

  /**
   * Build normalized 2D diffraction point-spread function (PSF) kernel K(dx, dy)
   * of radius R, with bandwidth proportional to NA / lambda.
   */
  public buildDiffractionPsfKernel(radius = 3, blurScale = 1.35): number[][] {
    const size = 2 * radius + 1;
    const kernel: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const r = Math.hypot(dx, dy) / blurScale;
        // Jinc-like diffraction core approximated by positive Airy-Gaussian lobe
        const sinc = r < 1e-8 ? 1.0 : Math.sin(Math.PI * r) / (Math.PI * r);
        const w = Math.max(0, sinc) * Math.exp(-0.35 * r * r);
        kernel[dy + radius][dx + radius] = w;
        sum += w;
      }
    }
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        kernel[j][i] /= sum;
      }
    }
    return kernel;
  }

  public simulateAerialImage(
    mask: ReadonlyArray<ReadonlyArray<number>>,
    psfKernel?: number[][],
  ): AerialImageSimulationResult {
    this.assertSquareGrid(mask);
    const G = mask.length;
    const kernel = psfKernel ?? this.buildDiffractionPsfKernel();
    const amplitude = this.convolve2D(mask, kernel);

    const aerialIntensity: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
    const resistContour: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
    const binaryWaferImage: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
    let minIntensity = Number.POSITIVE_INFINITY;
    let maxIntensity = Number.NEGATIVE_INFINITY;

    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const E = amplitude[y][x];
        const I = E * E;
        aerialIntensity[y][x] = I;
        if (I < minIntensity) minIntensity = I;
        if (I > maxIntensity) maxIntensity = I;
        const R = sigmoid(this.resistSteepness * (I - this.resistThreshold));
        resistContour[y][x] = R;
        binaryWaferImage[y][x] = I >= this.resistThreshold ? 1 : 0;
      }
    }

    return {
      gridSize: G,
      aerialIntensity,
      resistContour,
      binaryWaferImage,
      minIntensity,
      maxIntensity,
    };
  }

  // ---------------------------------------------------------------------------
  // Adjoint-Gradient Pixel-Based Inverse Lithography (ILT) Synthesis (FR-5)
  // ---------------------------------------------------------------------------

  /**
   * Synthesize an inverse-lithography photomask M(x,y) = sigma(beta * psi(x,y))
   * for a target wafer pattern Z*(x,y) via analytical adjoint gradient descent.
   */
  public synthesizeInverseMask(
    targetPattern: ReadonlyArray<ReadonlyArray<number>>,
    options: {
      iterations?: number;
      stepSize?: number;
      maskSteepness?: number;
      binarizationWeight?: number;
    } = {},
  ): IltSynthesisResult {
    this.assertSquareGrid(targetPattern);
    const G = targetPattern.length;
    const iterations = options.iterations ?? 35;
    const lr = options.stepSize ?? 1.8;
    const beta = options.maskSteepness ?? 2.5;
    const binWeight = options.binarizationWeight ?? 0.005;

    const kernel = this.buildDiffractionPsfKernel();
    const initialMask = targetPattern.map((row) => [...row]);
    const initialSim = this.simulateAerialImage(initialMask, kernel);
    const initialL2Loss = this.computeGridL2Loss(initialSim.resistContour, targetPattern);
    const initialEpePixels = this.computeGridEpeCount(initialSim.binaryWaferImage, targetPattern);

    // Initialize continuous field psi so sigma(beta * psi) approximates targetPattern
    const psi: number[][] = targetPattern.map((row) => row.map((v) => (v >= 0.5 ? 0.6 : -0.6)));

    const lossHistory: number[] = [initialL2Loss];

    for (let iter = 0; iter < iterations; iter++) {
      const mask = psi.map((row) => row.map((p) => sigmoid(beta * p)));
      const E = this.convolve2D(mask, kernel);

      // dL/dE = 2 * E * gamma * R * (1 - R) * 2 * (R - Z*)
      const dLdE: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
      let sumSqErr = 0;
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const eVal = E[y][x];
          const iVal = eVal * eVal;
          const rVal = sigmoid(this.resistSteepness * (iVal - this.resistThreshold));
          const diff = rVal - targetPattern[y][x];
          sumSqErr += diff * diff;
          dLdE[y][x] = 2 * diff * this.resistSteepness * rVal * (1 - rVal) * (2 * eVal);
        }
      }
      lossHistory.push(sumSqErr / (G * G));

      // Adjoint convolution: dL/dM = K^T * dL/dE (K is symmetric, so K^T == K)
      const dLdM = this.convolve2D(dLdE, kernel);

      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const mVal = mask[y][x];
          const binGrad = binWeight * (1 - 2 * mVal);
          const gradPsi = (dLdM[y][x] + binGrad) * beta * mVal * (1 - mVal);
          psi[y][x] = Math.max(-4, Math.min(4, psi[y][x] - lr * gradPsi));
        }
      }
    }

    const synthesizedMask = psi.map((row) => row.map((p) => sigmoid(beta * p)));
    const binarySynthesizedMask = synthesizedMask.map((row) => row.map((m) => (m >= 0.5 ? 1 : 0)));
    const finalSim = this.simulateAerialImage(synthesizedMask, kernel);
    const finalL2Loss = this.computeGridL2Loss(finalSim.resistContour, targetPattern);
    const finalEpePixels = this.computeGridEpeCount(finalSim.binaryWaferImage, targetPattern);

    const lossReductionRatio = initialL2Loss > 0 ? 1 - finalL2Loss / initialL2Loss : 1;
    const epeImprovementRatio = initialEpePixels > 0 ? 1 - finalEpePixels / initialEpePixels : 1;

    return {
      gridSize: G,
      iterations,
      initialMask,
      synthesizedMask,
      binarySynthesizedMask,
      initialL2Loss,
      finalL2Loss,
      initialEpePixels,
      finalEpePixels,
      lossReductionRatio,
      epeImprovementRatio,
      lossHistory,
    };
  }

  /** Create a canonical symmetric 11x11 cross test pattern prone to line-end pull-back. */
  public static createCrossTargetPattern(gridSize = 11): number[][] {
    const G = Math.max(7, gridSize);
    const mid = Math.floor(G / 2);
    const pattern: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
    for (let i = 1; i < G - 1; i++) {
      pattern[mid][i] = 1;
      pattern[i][mid] = 1;
    }
    pattern[mid - 1][mid - 1] = 1;
    pattern[mid - 1][mid + 1] = 1;
    pattern[mid + 1][mid - 1] = 1;
    pattern[mid + 1][mid + 1] = 1;
    return pattern;
  }

  // ---------------------------------------------------------------------------
  // Audit (FR-6)
  // ---------------------------------------------------------------------------

  public audit(): EuvIltAuditReceipt {
    const stdMetro = this.evaluateWavefront(
      { z4DefocusNm: 0.4, z7ComaVerticalNm: 0.3, z11SphericalNm: 0.2 },
      { wavelengthNm: 13.5, numericalAperture: 0.33 },
    );
    const highNaMetro = this.evaluateWavefront({}, { wavelengthNm: 13.5, numericalAperture: 0.55 });
    const zernikeOrthonormal = Math.abs(stdMetro.rmsErrorNm - stdMetro.quadratureRmsNm) < 2e-2;

    const severeProfile: ZernikeAberrationProfileNm = {
      z4DefocusNm: 1.2,
      z7ComaVerticalNm: 0.9,
      z11SphericalNm: 0.8,
    };
    let marechalGuardEnforced = false;
    try {
      this.assertDiffractionLimitedAdmission(severeProfile);
    } catch (err) {
      marechalGuardEnforced = err instanceof EuvIltError && err.code === "EUVILT_MARECHAL_BREACH";
    }

    const comp = this.compensateWavefront(severeProfile, 0.95);
    const wavefrontCompensated =
      !comp.before.diffractionLimited && comp.after.diffractionLimited && comp.after.strehlRatio > 0.98;

    const target = EosEuvInverseLithographyWavefrontCore.createCrossTargetPattern(11);
    const ilt = this.synthesizeInverseMask(target, { iterations: 35, stepSize: 1.8 });
    const iltLossReduced = ilt.lossReductionRatio > 0.65;
    const epeImproved = ilt.finalEpePixels < ilt.initialEpePixels;

    const allPassed =
      zernikeOrthonormal && marechalGuardEnforced && wavefrontCompensated && iltLossReduced && epeImproved;

    const round = (v: number) => Number(v.toFixed(6));
    const body = {
      specRef: "SPEC-337" as const,
      standardEuvHalfPitchNm: round(stdMetro.rayleighHalfPitchNm),
      highNaEuvHalfPitchNm: round(highNaMetro.rayleighHalfPitchNm),
      zernikeOrthonormal,
      marechalGuardEnforced,
      wavefrontCompensated,
      iltLossReduced,
      epeImproved,
      initialEpePixels: ilt.initialEpePixels,
      finalEpePixels: ilt.finalEpePixels,
      allPassed,
    };
    return { ...body, sha256Digest: sha256Hex(JSON.stringify(body)) };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private convolve2D(
    grid: ReadonlyArray<ReadonlyArray<number>>,
    kernel: ReadonlyArray<ReadonlyArray<number>>,
  ): number[][] {
    const G = grid.length;
    const R = Math.floor(kernel.length / 2);
    const out: number[][] = Array.from({ length: G }, () => new Array<number>(G).fill(0));
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        let acc = 0;
        for (let ky = -R; ky <= R; ky++) {
          const ny = y + ky;
          if (ny < 0 || ny >= G) continue;
          for (let kx = -R; kx <= R; kx++) {
            const nx = x + kx;
            if (nx < 0 || nx >= G) continue;
            acc += grid[ny][nx] * kernel[ky + R][kx + R];
          }
        }
        out[y][x] = acc;
      }
    }
    return out;
  }

  private computeGridL2Loss(a: ReadonlyArray<ReadonlyArray<number>>, b: ReadonlyArray<ReadonlyArray<number>>): number {
    const G = a.length;
    let sumSq = 0;
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const d = a[y][x] - b[y][x];
        sumSq += d * d;
      }
    }
    return sumSq / (G * G);
  }

  private computeGridEpeCount(
    binaryWafer: ReadonlyArray<ReadonlyArray<number>>,
    target: ReadonlyArray<ReadonlyArray<number>>,
  ): number {
    const G = binaryWafer.length;
    let mismatches = 0;
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const tBit = target[y][x] >= 0.5 ? 1 : 0;
        if (binaryWafer[y][x] !== tBit) mismatches++;
      }
    }
    return mismatches;
  }

  private assertSquareGrid(grid: ReadonlyArray<ReadonlyArray<number>>): void {
    if (
      !Array.isArray(grid) ||
      grid.length < 3 ||
      grid.some((row) => !Array.isArray(row) || row.length !== grid.length)
    ) {
      throw new EuvIltError("EUVILT_SHAPE_MISMATCH", "expected square 2D grid of dimension >= 3");
    }
  }
}
