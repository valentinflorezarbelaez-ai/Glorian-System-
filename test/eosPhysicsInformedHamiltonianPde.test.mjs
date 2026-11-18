/**
 * @file eosPhysicsInformedHamiltonianPde.test.mjs
 * @description BDD test suite for SPEC-336 / CHANGE-198: Autonomous Physics-Informed
 * Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator (BDD-1791..1796).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EosPhysicsInformedHamiltonianPdeCore,
  PinnError,
  createAnharmonicHamiltonianSystem,
} from "../src/core/eosPhysicsInformedHamiltonianPde.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/PINN_HAMILTONIAN_PDE_RECEIPT.json");

test("SPEC-336 / CHANGE-198: Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator", async (t) => {
  await t.test("BDD-1791: Symplectic Störmer-Verlet & 4th-Order Yoshida vs Explicit Euler Energy Conservation", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const system = createAnharmonicHamiltonianSystem(1.0, 0.25, 0.15);
    const q0 = [1.0, -0.5];
    const p0 = [0.2, 0.4];
    const dt = 0.05;
    const steps = 400;

    const euler = core.integrateHamiltonian(system, q0, p0, dt, steps, "EULER_EXPLICIT");
    const verlet = core.integrateHamiltonian(system, q0, p0, dt, steps, "STORMER_VERLET");
    const yoshida = core.integrateHamiltonian(system, q0, p0, dt, steps, "YOSHIDA_4");

    // Explicit Euler suffers severe secular energy growth; Verlet and Yoshida stay bounded
    assert.ok(euler.maxEnergyDrift > 0.1);
    assert.ok(verlet.maxEnergyDrift < 2e-3);
    assert.ok(yoshida.maxEnergyDrift < 1e-5);
    assert.ok(yoshida.maxEnergyDrift < verlet.maxEnergyDrift * 0.01);
  });

  await t.test("BDD-1792: Fail-Closed Courant-Friedrichs-Lewy (CFL) & Fourier Diffusion Stability Guard", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const initialProfile = Array.from({ length: 21 }, (_, i) => Math.sin((Math.PI * i) / 20));

    // Stable step: c = 1.0, nu = 0.01, dx = 0.05, dt = 0.01 -> C_adv = 0.2, C_diff = 0.04, combined = 0.28 <= 1
    const stableRun = core.marchAdvectionDiffusion1D({
      initialProfile,
      advectionVelocity: 1.0,
      diffusionViscosity: 0.01,
      dx: 0.05,
      dt: 0.01,
      steps: 10,
    });
    assert.strictEqual(stableRun.assessment.stable, true);
    assert.ok(stableRun.assessment.combinedStabilityNumber <= 1.0);
    assert.ok(stableRun.profile.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.0001));

    // Unstable step: dt = 0.2 -> combined > 1 -> rejected with PINN_CFL_INSTABILITY
    assert.throws(
      () =>
        core.marchAdvectionDiffusion1D({
          initialProfile,
          advectionVelocity: 1.0,
          diffusionViscosity: 0.05,
          dx: 0.05,
          dt: 0.2,
          steps: 5,
        }),
      (err) => err instanceof PinnError && err.code === "PINN_CFL_INSTABILITY",
    );
  });

  await t.test("BDD-1793: Collocation Differential Residual & Boundary Condition Loss Evaluation", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const nu = 0.05;
    const exactHeat = (x, t) => Math.exp(-nu * Math.PI * Math.PI * t) * Math.sin(Math.PI * x);
    const problem = {
      advectionVelocity: 0,
      diffusionViscosity: nu,
      domainLength: 1.0,
      timeHorizon: 0.25,
      initialCondition: (x) => Math.sin(Math.PI * x),
    };
    const collocation = [
      { x: 0.2, t: 0.05 },
      { x: 0.5, t: 0.1 },
      { x: 0.8, t: 0.2 },
    ];

    const exactReport = core.evaluateCollocationResiduals(exactHeat, problem, collocation);
    assert.ok(exactReport.pdeMse < 1e-9);
    assert.ok(exactReport.boundaryMse < 1e-24);
    assert.ok(exactReport.initialMse < 1e-24);

    // Perturbed field violating homogeneous Dirichlet boundary conditions
    const perturbed = (x, t) => exactHeat(x, t) + 0.5;
    const perturbedReport = core.evaluateCollocationResiduals(perturbed, problem, collocation);
    assert.ok(perturbedReport.boundaryMse > 0.2);
    assert.ok(perturbedReport.compositeLoss > 1.0);
  });

  await t.test("BDD-1794: Physics-Informed Collocation Solver Convergence & L2 Accuracy", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const solution = core.solvePinnCollocation({
      diffusionViscosity: 0.05,
      reactionRate: 0.1,
      spatialModes: 3,
      temporalOrder: 5,
    });

    assert.ok(solution.lossReductionRatio > 0.999);
    assert.ok(solution.trainedLoss.compositeLoss < 1e-6);
    assert.ok(solution.l2ErrorVsExact < 1e-4);
    assert.ok(Math.abs(solution.evaluate(0, 0.1)) < 1e-12);
    assert.ok(Math.abs(solution.evaluate(1.0, 0.1)) < 1e-12);
  });

  await t.test("BDD-1795: Liouville Phase-Space Volume Preservation (det J = 1)", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const system = createAnharmonicHamiltonianSystem(1.2, 0.3, 0.2);

    const detVerlet = core.computePhaseSpaceJacobianDet(system, [0.8, -0.4], [0.3, -0.2], 0.04, "STORMER_VERLET");
    const detYoshida = core.computePhaseSpaceJacobianDet(system, [0.8, -0.4], [0.3, -0.2], 0.04, "YOSHIDA_4");

    assert.ok(Math.abs(detVerlet - 1.0) < 1e-9);
    assert.ok(Math.abs(detYoshida - 1.0) < 1e-9);
  });

  await t.test("BDD-1796: Deterministic Audit Receipt & Parameter Validation", () => {
    const core = new EosPhysicsInformedHamiltonianPdeCore();
    const receiptA = core.audit();
    const receiptB = core.audit();

    assert.strictEqual(receiptA.specRef, "SPEC-336");
    assert.strictEqual(receiptA.symplecticEnergyBounded, true);
    assert.strictEqual(receiptA.yoshidaBeatsVerlet, true);
    assert.strictEqual(receiptA.liouvilleVolumePreserved, true);
    assert.strictEqual(receiptA.cflGuardEnforced, true);
    assert.strictEqual(receiptA.pinnLossConverged, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    // Invalid parameter guard
    assert.throws(
      () => core.assessCflStability({ advectionVelocity: 1, diffusionViscosity: -1, dx: 0.1, dt: 0.01 }),
      (err) => err instanceof PinnError && err.code === "PINN_INVALID_PARAMETERS",
    );

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receiptA, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
