/**
 * Glorian System — Autonomous Physics-Informed Neural Network (PINN) &
 * Symplectic Hamiltonian PDE Integrator
 * Governed by SPEC-336 / CHANGE-198 / ADR-198-001..003
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type HamiltonianIntegratorScheme = "EULER_EXPLICIT" | "STORMER_VERLET" | "YOSHIDA_4";

export type PinnErrorCode = "PINN_INVALID_PARAMETERS" | "PINN_CFL_INSTABILITY" | "PINN_SINGULAR_SYSTEM";

export interface SeparableHamiltonianSystem {
  /** System identifier. */
  name: string;
  /** Mass matrix diagonal (positive entries, one per degree of freedom). */
  masses: number[];
  /** Potential energy V(q). */
  potential: (q: ReadonlyArray<number>) => number;
  /** Gradient of potential dV/dq. */
  gradPotential: (q: ReadonlyArray<number>) => number[];
}

export interface PhaseSpaceState {
  q: number[];
  p: number[];
  t: number;
  energy: number;
}

export interface SymplecticTrajectoryResult {
  scheme: HamiltonianIntegratorScheme;
  steps: number;
  dt: number;
  initialEnergy: number;
  finalEnergy: number;
  maxEnergyDrift: number;
  rmsEnergyDrift: number;
  liouvilleJacobianDet: number;
  finalState: PhaseSpaceState;
  samples: PhaseSpaceState[];
}

export interface CflStabilityAssessment {
  advectionVelocity: number;
  diffusionViscosity: number;
  dx: number;
  dt: number;
  advectionCourant: number;
  diffusionFourier: number;
  combinedStabilityNumber: number;
  maxStableDt: number;
  stable: boolean;
}

export interface PdeProblemConfig {
  /** Advection velocity c. */
  advectionVelocity: number;
  /** Diffusion viscosity nu >= 0. */
  diffusionViscosity: number;
  /** Reaction decay rate lambda >= 0 in u_t + c u_x - nu u_xx + lambda u = f(x,t). */
  reactionRate?: number;
  /** Spatial domain [0, domainLength]. Default 1.0. */
  domainLength?: number;
  /** Temporal horizon [0, timeHorizon]. Default 0.25. */
  timeHorizon?: number;
  /** Optional source term f(x, t). Default 0. */
  sourceTerm?: (x: number, t: number) => number;
  /** Dirichlet boundary at x = 0: u(0, t). Default 0. */
  boundaryLeft?: (t: number) => number;
  /** Dirichlet boundary at x = L: u(L, t). Default 0. */
  boundaryRight?: (t: number) => number;
  /** Initial condition u(x, 0). */
  initialCondition?: (x: number) => number;
}

export interface CollocationPoint {
  x: number;
  t: number;
}

export interface PinnLossWeights {
  pdeWeight?: number;
  bcWeight?: number;
  icWeight?: number;
}

export interface PinnResidualReport {
  pdeMse: number;
  boundaryMse: number;
  initialMse: number;
  compositeLoss: number;
  maxAbsPdeResidual: number;
  collocationCount: number;
}

export interface PinnSolutionResult {
  modes: number;
  weights: number[];
  initialLoss: PinnResidualReport;
  trainedLoss: PinnResidualReport;
  lossReductionRatio: number;
  l2ErrorVsExact: number;
  evaluate: (x: number, t: number) => number;
}

export interface PinnAuditReceipt {
  specRef: "SPEC-336";
  verletMaxEnergyDrift: number;
  yoshidaMaxEnergyDrift: number;
  eulerMaxEnergyDrift: number;
  symplecticEnergyBounded: boolean;
  yoshidaBeatsVerlet: boolean;
  liouvilleVolumePreserved: boolean;
  cflGuardEnforced: boolean;
  pinnLossConverged: boolean;
  pinnL2Error: number;
  allPassed: boolean;
  sha256Digest: string;
}
