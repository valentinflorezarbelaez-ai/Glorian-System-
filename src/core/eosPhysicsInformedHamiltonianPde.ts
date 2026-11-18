/**
 * Glorian System — Autonomous Physics-Informed Neural Network (PINN) &
 * Symplectic Hamiltonian PDE Integrator
 * Governed by SPEC-336 / CHANGE-198 / ADR-198-001..003
 *
 * Implements:
 *  1. Symplectic geometric integrators (2nd-order Störmer-Verlet & 4th-order Yoshida)
 *     with Liouville phase-space Jacobian determinant verification (det J = 1).
 *  2. Fail-closed Courant-Friedrichs-Lewy (CFL) & Fourier diffusion stability guard
 *     for advection-diffusion-reaction PDEs.
 *  3. Physics-Informed Collocation residual evaluator and regularized Fourier-feature
 *     collocation solver minimizing L_PINN = w_pde L_pde + w_bc L_bc + w_ic L_ic.
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import { createHash } from "node:crypto";
import type {
  CflStabilityAssessment,
  CollocationPoint,
  HamiltonianIntegratorScheme,
  PdeProblemConfig,
  PhaseSpaceState,
  PinnAuditReceipt,
  PinnErrorCode,
  PinnLossWeights,
  PinnResidualReport,
  PinnSolutionResult,
  SeparableHamiltonianSystem,
  SymplecticTrajectoryResult,
} from "./eosPhysicsInformedHamiltonianPde.types.ts";

export * from "./eosPhysicsInformedHamiltonianPde.types.ts";

/** Yoshida 4th-order symmetric composition weights (Yoshida 1990, Phys. Lett. A). */
const CBRT_2 = Math.cbrt(2);
const YOSHIDA_W1 = 1 / (2 - CBRT_2);
const YOSHIDA_W0 = -CBRT_2 / (2 - CBRT_2);
const YOSHIDA_SUBSTEPS: readonly number[] = [YOSHIDA_W1, YOSHIDA_W0, YOSHIDA_W1];

export class PinnError extends Error {
  public readonly code: PinnErrorCode;

  constructor(code: PinnErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "PinnError";
  }
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Default nonlinear anharmonic (quartic Duffing-Kepler) Hamiltonian system:
 * H(q, p) = sum_i p_i^2 / (2 m_i) + 1/2 k q_i^2 + 1/4 alpha q_i^4 + coupling.
 */
export function createAnharmonicHamiltonianSystem(
  stiffness = 1.0,
  anharmonicity = 0.25,
  coupling = 0.1,
): SeparableHamiltonianSystem {
  return {
    name: "coupled-anharmonic-oscillator",
    masses: [1.0, 1.0],
    potential(q: ReadonlyArray<number>): number {
      let v = 0;
      for (let i = 0; i < q.length; i++) {
        const qi = q[i];
        v += 0.5 * stiffness * qi * qi + 0.25 * anharmonicity * qi * qi * qi * qi;
      }
      if (q.length >= 2) {
        const diff = q[0] - q[1];
        v += 0.5 * coupling * diff * diff;
      }
      return v;
    },
    gradPotential(q: ReadonlyArray<number>): number[] {
      const grad = q.map((qi) => stiffness * qi + anharmonicity * qi * qi * qi);
      if (q.length >= 2) {
        const diff = q[0] - q[1];
        grad[0] += coupling * diff;
        grad[1] -= coupling * diff;
      }
      return grad;
    },
  };
}

/**
 * Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Core.
 */
export class EosPhysicsInformedHamiltonianPdeCore {
  /** Compute total Hamiltonian energy H(q, p) = T(p) + V(q). */
  public computeHamiltonianEnergy(
    system: SeparableHamiltonianSystem,
    q: ReadonlyArray<number>,
    p: ReadonlyArray<number>,
  ): number {
    this.assertSystemAndState(system, q, p);
    let kinetic = 0;
    for (let i = 0; i < p.length; i++) {
      kinetic += (p[i] * p[i]) / (2 * system.masses[i]);
    }
    return kinetic + system.potential(q);
  }

  /** Advance one step of duration dt using the chosen integrator scheme. */
  public stepHamiltonian(
    system: SeparableHamiltonianSystem,
    q: ReadonlyArray<number>,
    p: ReadonlyArray<number>,
    dt: number,
    scheme: HamiltonianIntegratorScheme = "YOSHIDA_4",
  ): { q: number[]; p: number[] } {
    this.assertSystemAndState(system, q, p);
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new PinnError("PINN_INVALID_PARAMETERS", `dt must be > 0, got ${dt}`);
    }
    if (scheme === "EULER_EXPLICIT") {
      return this.stepEulerExplicit(system, q, p, dt);
    }
    if (scheme === "STORMER_VERLET") {
      return this.stepStormerVerlet(system, q, p, dt);
    }
    let curQ = [...q];
    let curP = [...p];
    for (const weight of YOSHIDA_SUBSTEPS) {
      const next = this.stepStormerVerlet(system, curQ, curP, weight * dt);
      curQ = next.q;
      curP = next.p;
    }
    return { q: curQ, p: curP };
  }

  /** Integrate a Hamiltonian trajectory over `steps` steps of size `dt`. */
  public integrateHamiltonian(
    system: SeparableHamiltonianSystem,
    q0: ReadonlyArray<number>,
    p0: ReadonlyArray<number>,
    dt: number,
    steps: number,
    scheme: HamiltonianIntegratorScheme = "YOSHIDA_4",
    sampleStride = 10,
  ): SymplecticTrajectoryResult {
    this.assertSystemAndState(system, q0, p0);
    if (!Number.isInteger(steps) || steps < 1 || steps > 100000) {
      throw new PinnError("PINN_INVALID_PARAMETERS", `steps must be an integer in [1, 100000], got ${steps}`);
    }
    const initialEnergy = this.computeHamiltonianEnergy(system, q0, p0);
    let q = [...q0];
    let p = [...p0];
    let maxDrift = 0;
    let sumSqDrift = 0;
    const samples: PhaseSpaceState[] = [{ q: [...q], p: [...p], t: 0, energy: initialEnergy }];

    for (let s = 1; s <= steps; s++) {
      const next = this.stepHamiltonian(system, q, p, dt, scheme);
      q = next.q;
      p = next.p;
      const e = this.computeHamiltonianEnergy(system, q, p);
      const drift = Math.abs(e - initialEnergy);
      if (drift > maxDrift) maxDrift = drift;
      sumSqDrift += drift * drift;
      if (s % Math.max(1, sampleStride) === 0 || s === steps) {
        samples.push({ q: [...q], p: [...p], t: s * dt, energy: e });
      }
    }

    const finalEnergy = this.computeHamiltonianEnergy(system, q, p);
    const liouvilleJacobianDet = this.computePhaseSpaceJacobianDet(system, q0, p0, dt, scheme);

    return {
      scheme,
      steps,
      dt,
      initialEnergy,
      finalEnergy,
      maxEnergyDrift: maxDrift,
      rmsEnergyDrift: Math.sqrt(sumSqDrift / steps),
      liouvilleJacobianDet,
      finalState: { q, p, t: steps * dt, energy: finalEnergy },
      samples,
    };
  }

  /**
   * Compute the determinant of the full 2d x 2d phase-space Jacobian
   * d(q_next, p_next)/d(q_0, p_0) via central finite differences.
   * By Liouville's theorem, symplectic maps satisfy det(J) = 1 across the full phase space.
   */
  public computePhaseSpaceJacobianDet(
    system: SeparableHamiltonianSystem,
    q0: ReadonlyArray<number>,
    p0: ReadonlyArray<number>,
    dt: number,
    scheme: HamiltonianIntegratorScheme = "YOSHIDA_4",
  ): number {
    const dof = q0.length;
    const dim = 2 * dof;
    const eps = 1e-6;
    const J: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));

    for (let col = 0; col < dim; col++) {
      const qPlus = [...q0];
      const pPlus = [...p0];
      const qMinus = [...q0];
      const pMinus = [...p0];
      if (col < dof) {
        qPlus[col] += eps;
        qMinus[col] -= eps;
      } else {
        pPlus[col - dof] += eps;
        pMinus[col - dof] -= eps;
      }
      const nextPlus = this.stepHamiltonian(system, qPlus, pPlus, dt, scheme);
      const nextMinus = this.stepHamiltonian(system, qMinus, pMinus, dt, scheme);
      for (let row = 0; row < dof; row++) {
        J[row][col] = (nextPlus.q[row] - nextMinus.q[row]) / (2 * eps);
        J[row + dof][col] = (nextPlus.p[row] - nextMinus.p[row]) / (2 * eps);
      }
    }
    return this.matrixDeterminant(J);
  }

  // ---------------------------------------------------------------------------
  // CFL & Fourier Diffusion Stability Governance (FR-2)
  // ---------------------------------------------------------------------------

  public assessCflStability(params: {
    advectionVelocity: number;
    diffusionViscosity: number;
    dx: number;
    dt: number;
  }): CflStabilityAssessment {
    const { advectionVelocity, diffusionViscosity, dx, dt } = params;
    if (!Number.isFinite(dx) || dx <= 0 || !Number.isFinite(dt) || dt <= 0 || diffusionViscosity < 0) {
      throw new PinnError("PINN_INVALID_PARAMETERS", "dx > 0, dt > 0 and diffusionViscosity >= 0 are required");
    }
    const cAdv = (Math.abs(advectionVelocity) * dt) / dx;
    const cDiff = (diffusionViscosity * dt) / (dx * dx);
    const combined = cAdv + 2 * cDiff;
    const denom = Math.abs(advectionVelocity) / dx + (2 * diffusionViscosity) / (dx * dx);
    const maxStableDt = denom > 0 ? 1 / denom : Number.POSITIVE_INFINITY;

    return {
      advectionVelocity,
      diffusionViscosity,
      dx,
      dt,
      advectionCourant: cAdv,
      diffusionFourier: cDiff,
      combinedStabilityNumber: combined,
      maxStableDt,
      stable: combined <= 1.0 + 1e-12,
    };
  }

  /**
   * Advance a 1D advection-diffusion field u(x, t) using upwind + central differences,
   * failing closed with PINN_CFL_INSTABILITY if C_adv + 2 * C_diff > 1.
   */
  public marchAdvectionDiffusion1D(params: {
    initialProfile: ReadonlyArray<number>;
    advectionVelocity: number;
    diffusionViscosity: number;
    dx: number;
    dt: number;
    steps: number;
  }): { profile: number[]; assessment: CflStabilityAssessment } {
    const assessment = this.assessCflStability(params);
    if (!assessment.stable) {
      throw new PinnError(
        "PINN_CFL_INSTABILITY",
        `combined stability number ${assessment.combinedStabilityNumber.toFixed(4)} > 1.0 (max dt = ${assessment.maxStableDt.toExponential(4)})`,
      );
    }
    const n = params.initialProfile.length;
    if (n < 3) {
      throw new PinnError("PINN_INVALID_PARAMETERS", "initialProfile must contain at least 3 grid points");
    }
    let u = [...params.initialProfile];
    const c = params.advectionVelocity;
    const nu = params.diffusionViscosity;
    const { dx, dt, steps } = params;

    for (let s = 0; s < steps; s++) {
      const next = new Array<number>(n);
      next[0] = u[0];
      next[n - 1] = u[n - 1];
      for (let i = 1; i < n - 1; i++) {
        const ux = c >= 0 ? (u[i] - u[i - 1]) / dx : (u[i + 1] - u[i]) / dx;
        const uxx = (u[i + 1] - 2 * u[i] + u[i - 1]) / (dx * dx);
        next[i] = u[i] - dt * c * ux + dt * nu * uxx;
      }
      u = next;
    }
    return { profile: u, assessment };
  }

  // ---------------------------------------------------------------------------
  // Physics-Informed Collocation Residual & Solver (FR-3, FR-4)
  // ---------------------------------------------------------------------------

  /**
   * Evaluate PDE collocation residual R = u_t + c u_x - nu u_xx + lambda u - f(x,t)
   * along with Dirichlet boundary and initial condition losses via central differences.
   */
  public evaluateCollocationResiduals(
    candidate: (x: number, t: number) => number,
    problem: PdeProblemConfig,
    interiorPoints: ReadonlyArray<CollocationPoint>,
    weights: PinnLossWeights = {},
  ): PinnResidualReport {
    const L = problem.domainLength ?? 1.0;
    const T = problem.timeHorizon ?? 0.25;
    const c = problem.advectionVelocity;
    const nu = problem.diffusionViscosity;
    const lambda = problem.reactionRate ?? 0;
    const source = problem.sourceTerm ?? (() => 0);
    const bcLeft = problem.boundaryLeft ?? (() => 0);
    const bcRight = problem.boundaryRight ?? (() => 0);
    const ic = problem.initialCondition ?? ((x: number) => Math.sin(Math.PI * (x / L)));

    const hx = 1e-4 * L;
    const ht = 1e-5 * Math.max(T, 1e-2);

    let sumSqPde = 0;
    let maxAbsPde = 0;
    for (const pt of interiorPoints) {
      const u = candidate(pt.x, pt.t);
      const ut = (candidate(pt.x, pt.t + ht) - candidate(pt.x, Math.max(0, pt.t - ht))) / (pt.t >= ht ? 2 * ht : ht);
      const ux = (candidate(pt.x + hx, pt.t) - candidate(pt.x - hx, pt.t)) / (2 * hx);
      const uxx = (candidate(pt.x + hx, pt.t) - 2 * u + candidate(pt.x - hx, pt.t)) / (hx * hx);
      const r = ut + c * ux - nu * uxx + lambda * u - source(pt.x, pt.t);
      sumSqPde += r * r;
      if (Math.abs(r) > maxAbsPde) maxAbsPde = Math.abs(r);
    }
    const pdeMse = interiorPoints.length > 0 ? sumSqPde / interiorPoints.length : 0;

    const bcSamples = 16;
    let sumSqBc = 0;
    for (let j = 0; j <= bcSamples; j++) {
      const tj = (T * j) / bcSamples;
      const errL = candidate(0, tj) - bcLeft(tj);
      const errR = candidate(L, tj) - bcRight(tj);
      sumSqBc += errL * errL + errR * errR;
    }
    const boundaryMse = sumSqBc / (2 * (bcSamples + 1));

    const icSamples = 32;
    let sumSqIc = 0;
    for (let i = 0; i <= icSamples; i++) {
      const xi = (L * i) / icSamples;
      const err0 = candidate(xi, 0) - ic(xi);
      sumSqIc += err0 * err0;
    }
    const initialMse = sumSqIc / (icSamples + 1);

    const wPde = weights.pdeWeight ?? 1.0;
    const wBc = weights.bcWeight ?? 10.0;
    const wIc = weights.icWeight ?? 10.0;
    const compositeLoss = wPde * pdeMse + wBc * boundaryMse + wIc * initialMse;

    return {
      pdeMse,
      boundaryMse,
      initialMse,
      compositeLoss,
      maxAbsPdeResidual: maxAbsPde,
      collocationCount: interiorPoints.length,
    };
  }

  /**
   * Solve the 1D diffusion-reaction PDE u_t - nu u_xx + lambda u = f(x, t) on [0, L] x [0, T]
   * with homogeneous Dirichlet boundaries u(0,t) = u(L,t) = 0 using a physics-informed
   * Fourier-Chebyshev collocation ansatz u_theta(x, t) = sum_{m=1..M} sum_{p=0..P} theta_{m,p} sin(m pi x / L) t^p.
   */
  public solvePinnCollocation(
    params: {
      diffusionViscosity?: number;
      reactionRate?: number;
      domainLength?: number;
      timeHorizon?: number;
      spatialModes?: number;
      temporalOrder?: number;
      initialCondition?: (x: number) => number;
      exactSolution?: (x: number, t: number) => number;
    } = {},
  ): PinnSolutionResult {
    const nu = params.diffusionViscosity ?? 0.05;
    const lambda = params.reactionRate ?? 0.1;
    const L = params.domainLength ?? 1.0;
    const T = params.timeHorizon ?? 0.25;
    const M = params.spatialModes ?? 3;
    const P = params.temporalOrder ?? 5;
    const ic =
      params.initialCondition ?? ((x: number) => Math.sin((Math.PI * x) / L) + 0.5 * Math.sin((2 * Math.PI * x) / L));
    const exact =
      params.exactSolution ??
      ((x: number, t: number) => {
        const k1 = Math.PI / L;
        const k2 = (2 * Math.PI) / L;
        return (
          Math.exp(-(nu * k1 * k1 + lambda) * t) * Math.sin(k1 * x) +
          0.5 * Math.exp(-(nu * k2 * k2 + lambda) * t) * Math.sin(k2 * x)
        );
      });

    const totalBasis = M * (P + 1);
    const problem: PdeProblemConfig = {
      advectionVelocity: 0,
      diffusionViscosity: nu,
      reactionRate: lambda,
      domainLength: L,
      timeHorizon: T,
      initialCondition: ic,
    };

    const collocation: CollocationPoint[] = [];
    const nx = 12;
    const nt = 10;
    for (let i = 1; i <= nx; i++) {
      for (let j = 1; j <= nt; j++) {
        collocation.push({ x: (L * i) / (nx + 1), t: (T * j) / nt });
      }
    }

    const evaluateWithWeights =
      (w: ReadonlyArray<number>) =>
      (x: number, t: number): number => {
        let val = 0;
        for (let m = 1; m <= M; m++) {
          const s = Math.sin((m * Math.PI * x) / L);
          let tPow = 1;
          for (let p = 0; p <= P; p++) {
            val += w[(m - 1) * (P + 1) + p] * s * tPow;
            tPow *= t;
          }
        }
        return val;
      };

    const zeroWeights = new Array<number>(totalBasis).fill(0);
    const initialLoss = this.evaluateCollocationResiduals(evaluateWithWeights(zeroWeights), problem, collocation);

    // Build linear least-squares rows: PDE interior rows + weighted IC rows
    const rows: number[][] = [];
    const rhs: number[] = [];

    for (const pt of collocation) {
      const row = new Array<number>(totalBasis).fill(0);
      for (let m = 1; m <= M; m++) {
        const km = (m * Math.PI) / L;
        const s = Math.sin(km * pt.x);
        const diffCoeff = nu * km * km + lambda;
        for (let p = 0; p <= P; p++) {
          const tPow = Math.pow(pt.t, p);
          const dtTerm = p === 0 ? 0 : p * Math.pow(pt.t, p - 1);
          row[(m - 1) * (P + 1) + p] = (dtTerm + diffCoeff * tPow) * s;
        }
      }
      rows.push(row);
      rhs.push(0);
    }

    const icWeight = 20.0;
    const icPoints = 32;
    for (let i = 1; i < icPoints; i++) {
      const xi = (L * i) / icPoints;
      const row = new Array<number>(totalBasis).fill(0);
      for (let m = 1; m <= M; m++) {
        row[(m - 1) * (P + 1) + 0] = icWeight * Math.sin((m * Math.PI * xi) / L);
      }
      rows.push(row);
      rhs.push(icWeight * ic(xi));
    }

    const trainedWeights = this.solveRidgeLeastSquares(rows, rhs, 1e-10);
    const trainedFn = evaluateWithWeights(trainedWeights);
    const trainedLoss = this.evaluateCollocationResiduals(trainedFn, problem, collocation);

    let sumSqErr = 0;
    let count = 0;
    for (const pt of collocation) {
      const err = trainedFn(pt.x, pt.t) - exact(pt.x, pt.t);
      sumSqErr += err * err;
      count++;
    }
    const l2ErrorVsExact = Math.sqrt(sumSqErr / Math.max(1, count));
    const lossReductionRatio =
      initialLoss.compositeLoss > 0 ? 1 - trainedLoss.compositeLoss / initialLoss.compositeLoss : 1;

    return {
      modes: totalBasis,
      weights: trainedWeights,
      initialLoss,
      trainedLoss,
      lossReductionRatio,
      l2ErrorVsExact,
      evaluate: trainedFn,
    };
  }

  // ---------------------------------------------------------------------------
  // Audit (FR-6)
  // ---------------------------------------------------------------------------

  public audit(): PinnAuditReceipt {
    const system = createAnharmonicHamiltonianSystem(1.0, 0.25, 0.15);
    const q0 = [1.0, -0.5];
    const p0 = [0.2, 0.4];
    const dt = 0.05;
    const steps = 400;

    const euler = this.integrateHamiltonian(system, q0, p0, dt, steps, "EULER_EXPLICIT");
    const verlet = this.integrateHamiltonian(system, q0, p0, dt, steps, "STORMER_VERLET");
    const yoshida = this.integrateHamiltonian(system, q0, p0, dt, steps, "YOSHIDA_4");

    const symplecticEnergyBounded = verlet.maxEnergyDrift < 1e-2 && euler.maxEnergyDrift > 10 * verlet.maxEnergyDrift;
    const yoshidaBeatsVerlet = yoshida.maxEnergyDrift < verlet.maxEnergyDrift * 0.05;
    const liouvilleVolumePreserved = Math.abs(yoshida.liouvilleJacobianDet - 1.0) < 1e-9;

    let cflGuardEnforced = false;
    try {
      this.marchAdvectionDiffusion1D({
        initialProfile: [0, 0.5, 1.0, 0.5, 0],
        advectionVelocity: 2.0,
        diffusionViscosity: 0.5,
        dx: 0.1,
        dt: 0.2,
        steps: 5,
      });
    } catch (err) {
      cflGuardEnforced = err instanceof PinnError && err.code === "PINN_CFL_INSTABILITY";
    }

    const pinn = this.solvePinnCollocation();
    const pinnLossConverged = pinn.lossReductionRatio > 0.99 && pinn.l2ErrorVsExact < 1e-4;

    const allPassed =
      symplecticEnergyBounded &&
      yoshidaBeatsVerlet &&
      liouvilleVolumePreserved &&
      cflGuardEnforced &&
      pinnLossConverged;

    const round = (v: number) => Number(v.toExponential(8));
    const body = {
      specRef: "SPEC-336" as const,
      verletMaxEnergyDrift: round(verlet.maxEnergyDrift),
      yoshidaMaxEnergyDrift: round(yoshida.maxEnergyDrift),
      eulerMaxEnergyDrift: round(euler.maxEnergyDrift),
      symplecticEnergyBounded,
      yoshidaBeatsVerlet,
      liouvilleVolumePreserved,
      cflGuardEnforced,
      pinnLossConverged,
      pinnL2Error: round(pinn.l2ErrorVsExact),
      allPassed,
    };
    return { ...body, sha256Digest: sha256Hex(JSON.stringify(body)) };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private stepEulerExplicit(
    system: SeparableHamiltonianSystem,
    q: ReadonlyArray<number>,
    p: ReadonlyArray<number>,
    dt: number,
  ): { q: number[]; p: number[] } {
    const grad = system.gradPotential(q);
    const nextQ = q.map((qi, i) => qi + dt * (p[i] / system.masses[i]));
    const nextP = p.map((pi, i) => pi - dt * grad[i]);
    return { q: nextQ, p: nextP };
  }

  private stepStormerVerlet(
    system: SeparableHamiltonianSystem,
    q: ReadonlyArray<number>,
    p: ReadonlyArray<number>,
    dt: number,
  ): { q: number[]; p: number[] } {
    const grad0 = system.gradPotential(q);
    const pHalf = p.map((pi, i) => pi - 0.5 * dt * grad0[i]);
    const nextQ = q.map((qi, i) => qi + dt * (pHalf[i] / system.masses[i]));
    const grad1 = system.gradPotential(nextQ);
    const nextP = pHalf.map((phi, i) => phi - 0.5 * dt * grad1[i]);
    return { q: nextQ, p: nextP };
  }

  private solveRidgeLeastSquares(A: number[][], b: number[], ridge: number): number[] {
    const m = A.length;
    const n = A[0].length;
    const ata: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? ridge : 0)),
    );
    const atb = new Array<number>(n).fill(0);

    for (let r = 0; r < m; r++) {
      const row = A[r];
      const br = b[r];
      for (let i = 0; i < n; i++) {
        const ai = row[i];
        if (ai === 0) continue;
        atb[i] += ai * br;
        for (let j = i; j < n; j++) {
          ata[i][j] += ai * row[j];
        }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        ata[i][j] = ata[j][i];
      }
    }
    return this.gaussianEliminationWithPivoting(ata, atb);
  }

  private gaussianEliminationWithPivoting(M: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const aug = M.map((row, i) => [...row, rhs[i]]);

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxVal = Math.abs(aug[col][col]);
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(aug[r][col]) > maxVal) {
          maxVal = Math.abs(aug[r][col]);
          pivotRow = r;
        }
      }
      if (maxVal < 1e-15) {
        throw new PinnError("PINN_SINGULAR_SYSTEM", `singular collocation normal matrix at column ${col}`);
      }
      if (pivotRow !== col) {
        const tmp = aug[col];
        aug[col] = aug[pivotRow];
        aug[pivotRow] = tmp;
      }
      const pivot = aug[col][col];
      for (let r = col + 1; r < n; r++) {
        const factor = aug[r][col] / pivot;
        for (let c = col; c <= n; c++) {
          aug[r][c] -= factor * aug[col][c];
        }
      }
    }

    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        s -= aug[i][j] * x[j];
      }
      x[i] = s / aug[i][i];
    }
    return x;
  }

  private matrixDeterminant(M: number[][]): number {
    const n = M.length;
    const A = M.map((row) => [...row]);
    let det = 1.0;
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let maxVal = Math.abs(A[col][col]);
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(A[r][col]) > maxVal) {
          maxVal = Math.abs(A[r][col]);
          pivotRow = r;
        }
      }
      if (maxVal < 1e-15) return 0;
      if (pivotRow !== col) {
        const tmp = A[col];
        A[col] = A[pivotRow];
        A[pivotRow] = tmp;
        det = -det;
      }
      const pivot = A[col][col];
      det *= pivot;
      for (let r = col + 1; r < n; r++) {
        const factor = A[r][col] / pivot;
        for (let c = col + 1; c < n; c++) {
          A[r][c] -= factor * A[col][c];
        }
      }
    }
    return det;
  }

  private assertSystemAndState(
    system: SeparableHamiltonianSystem,
    q: ReadonlyArray<number>,
    p: ReadonlyArray<number>,
  ): void {
    if (
      !system ||
      !Array.isArray(system.masses) ||
      system.masses.length === 0 ||
      q.length !== system.masses.length ||
      p.length !== system.masses.length ||
      system.masses.some((m) => !Number.isFinite(m) || m <= 0)
    ) {
      throw new PinnError("PINN_INVALID_PARAMETERS", "invalid Hamiltonian system or phase-space dimension mismatch");
    }
  }
}
