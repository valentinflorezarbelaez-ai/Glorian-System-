/**
 * Glorian System — Autonomous EUV Optical Proximity Correction &
 * Inverse Lithography Wavefront Engine (EUV-OPC / ILT)
 * Governed by SPEC-337 / CHANGE-199 / ADR-199-001..003
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type EuvIltErrorCode = "EUVILT_INVALID_PARAMETERS" | "EUVILT_MARECHAL_BREACH" | "EUVILT_SHAPE_MISMATCH";

/**
 * Orthonormal Noll-indexed Zernike RMS aberration coefficients in nanometers.
 */
export interface ZernikeAberrationProfileNm {
  /** Z4: Defocus (sqrt(3)*(2*rho^2 - 1)). */
  z4DefocusNm?: number;
  /** Z5: Oblique astigmatism (sqrt(6)*rho^2*sin(2*theta)). */
  z5AstigmatismObliqueNm?: number;
  /** Z6: Vertical astigmatism (sqrt(6)*rho^2*cos(2*theta)). */
  z6AstigmatismVerticalNm?: number;
  /** Z7: Vertical coma (sqrt(8)*(3*rho^3 - 2*rho)*sin(theta)). */
  z7ComaVerticalNm?: number;
  /** Z8: Horizontal coma (sqrt(8)*(3*rho^3 - 2*rho)*cos(theta)). */
  z8ComaHorizontalNm?: number;
  /** Z11: Primary spherical (sqrt(5)*(6*rho^4 - 6*rho^2 + 1)). */
  z11SphericalNm?: number;
}

export interface EuvScannerOpticsConfig {
  /** EUV wavelength in nm. Default 13.5 nm. */
  wavelengthNm?: number;
  /** Numerical aperture (0.33 standard EUV, 0.55 High-NA EUV). Default 0.33. */
  numericalAperture?: number;
  /** Partial coherence factor sigma in [0.1, 1.0]. Default 0.5. */
  coherenceSigma?: number;
  /** Resist sigmoid steepness gamma. Default 14.0. */
  resistSteepness?: number;
  /** Resist exposure threshold I_th in (0, 1). Default 0.35. */
  resistThreshold?: number;
}

export interface WavefrontMetrologyReport {
  wavelengthNm: number;
  numericalAperture: number;
  rayleighHalfPitchNm: number;
  pupilCutoffFreqPerNm: number;
  rmsErrorNm: number;
  rmsErrorWaves: number;
  rmsPhaseRad: number;
  quadratureRmsNm: number;
  strehlRatio: number;
  marechalLimitNm: number;
  diffractionLimited: boolean;
}

export interface WavefrontCompensationResult {
  before: WavefrontMetrologyReport;
  after: WavefrontMetrologyReport;
  actuatorStrokeNm: Required<ZernikeAberrationProfileNm>;
  residualSuppressionRatio: number;
}

export interface AerialImageSimulationResult {
  gridSize: number;
  aerialIntensity: number[][];
  resistContour: number[][];
  binaryWaferImage: number[][];
  minIntensity: number;
  maxIntensity: number;
}

export interface IltSynthesisResult {
  gridSize: number;
  iterations: number;
  initialMask: number[][];
  synthesizedMask: number[][];
  binarySynthesizedMask: number[][];
  initialL2Loss: number;
  finalL2Loss: number;
  initialEpePixels: number;
  finalEpePixels: number;
  lossReductionRatio: number;
  epeImprovementRatio: number;
  lossHistory: number[];
}

export interface EuvIltAuditReceipt {
  specRef: "SPEC-337";
  standardEuvHalfPitchNm: number;
  highNaEuvHalfPitchNm: number;
  zernikeOrthonormal: boolean;
  marechalGuardEnforced: boolean;
  wavefrontCompensated: boolean;
  iltLossReduced: boolean;
  epeImproved: boolean;
  initialEpePixels: number;
  finalEpePixels: number;
  allPassed: boolean;
  sha256Digest: string;
}
