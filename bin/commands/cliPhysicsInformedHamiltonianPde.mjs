/**
 * @file cliPhysicsInformedHamiltonianPde.mjs
 * @description CLI handler for SPEC-336 / CHANGE-198: Autonomous Physics-Informed
 * Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosPhysicsInformedHamiltonianPdeCore,
  createAnharmonicHamiltonianSystem,
} from "../../src/core/eosPhysicsInformedHamiltonianPde.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("PINN_HAMILTONIAN_PDE_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_pinn_symplectic(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const steps = Number(parseFlagValue(args, "--steps=", "300"));
  const dt = Number(parseFlagValue(args, "--dt=", "0.05"));
  const scheme = parseFlagValue(args, "--scheme=", "YOSHIDA_4");

  const core = new EosPhysicsInformedHamiltonianPdeCore();
  const sys = createAnharmonicHamiltonianSystem();
  const res = core.integrateHamiltonian(sys, [1.0, -0.5], [0.2, 0.4], dt, steps, scheme);

  const payload = {
    command: "toolchain:pinn:symplectic",
    scheme: res.scheme,
    steps: res.steps,
    dt: res.dt,
    initialEnergy: res.initialEnergy,
    finalEnergy: res.finalEnergy,
    maxEnergyDrift: res.maxEnergyDrift,
    liouvilleJacobianDet: res.liouvilleJacobianDet,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== PINN-PDE: Symplectic Hamiltonian Integration ===");
    console.log(`Scheme             : ${res.scheme}`);
    console.log(`Steps / dt         : ${res.steps} / ${res.dt}`);
    console.log(`Initial Energy     : ${res.initialEnergy.toFixed(8)}`);
    console.log(`Final Energy       : ${res.finalEnergy.toFixed(8)}`);
    console.log(`Max Energy Drift   : ${res.maxEnergyDrift.toExponential(4)}`);
    console.log(`Liouville det(J)   : ${res.liouvilleJacobianDet.toFixed(12)}`);
  }
}

async function cmd_pinn_cfl(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const c = Number(parseFlagValue(args, "--velocity=", "1.0"));
  const nu = Number(parseFlagValue(args, "--viscosity=", "0.02"));
  const dx = Number(parseFlagValue(args, "--dx=", "0.05"));
  const dt = Number(parseFlagValue(args, "--dt=", "0.01"));

  const core = new EosPhysicsInformedHamiltonianPdeCore();
  const assessment = core.assessCflStability({
    advectionVelocity: c,
    diffusionViscosity: nu,
    dx,
    dt,
  });

  const payload = {
    command: "toolchain:pinn:cfl",
    ...assessment,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== PINN-PDE: CFL & Fourier Diffusion Stability ===");
    console.log(`Advection Courant  : ${assessment.advectionCourant.toFixed(4)}`);
    console.log(`Diffusion Fourier  : ${assessment.diffusionFourier.toFixed(4)}`);
    console.log(`Combined Number    : ${assessment.combinedStabilityNumber.toFixed(4)}`);
    console.log(`Max Admissible dt  : ${assessment.maxStableDt.toExponential(4)}`);
    console.log(`Stable             : ${assessment.stable}`);
  }
}

async function cmd_pinn_residual(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nu = Number(parseFlagValue(args, "--viscosity=", "0.05"));

  const core = new EosPhysicsInformedHamiltonianPdeCore();
  const exactHeat = (x, t) => Math.exp(-nu * Math.PI * Math.PI * t) * Math.sin(Math.PI * x);
  const points = [
    { x: 0.25, t: 0.05 },
    { x: 0.5, t: 0.1 },
    { x: 0.75, t: 0.15 },
  ];
  const report = core.evaluateCollocationResiduals(
    exactHeat,
    {
      advectionVelocity: 0,
      diffusionViscosity: nu,
      initialCondition: (x) => Math.sin(Math.PI * x),
    },
    points,
  );

  const payload = {
    command: "toolchain:pinn:residual",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== PINN-PDE: Collocation Differential Residual ===");
    console.log(`Collocation Points : ${report.collocationCount}`);
    console.log(`PDE MSE            : ${report.pdeMse.toExponential(4)}`);
    console.log(`Boundary MSE       : ${report.boundaryMse.toExponential(4)}`);
    console.log(`Initial MSE        : ${report.initialMse.toExponential(4)}`);
    console.log(`Composite Loss     : ${report.compositeLoss.toExponential(4)}`);
  }
}

async function cmd_pinn_solve(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const modes = Number(parseFlagValue(args, "--modes=", "3"));

  const core = new EosPhysicsInformedHamiltonianPdeCore();
  const sol = core.solvePinnCollocation({ spatialModes: modes });

  const payload = {
    command: "toolchain:pinn:solve",
    modes: sol.modes,
    initialCompositeLoss: sol.initialLoss.compositeLoss,
    trainedCompositeLoss: sol.trainedLoss.compositeLoss,
    lossReductionRatio: sol.lossReductionRatio,
    l2ErrorVsExact: sol.l2ErrorVsExact,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== PINN-PDE: Collocation Solver Convergence ===");
    console.log(`Basis Modes        : ${sol.modes}`);
    console.log(`Initial Loss       : ${sol.initialLoss.compositeLoss.toExponential(4)}`);
    console.log(`Trained Loss       : ${sol.trainedLoss.compositeLoss.toExponential(4)}`);
    console.log(`Loss Reduction     : ${(sol.lossReductionRatio * 100).toFixed(4)}%`);
    console.log(`L2 Error vs Exact  : ${sol.l2ErrorVsExact.toExponential(4)}`);
  }
}

async function cmd_pinn_audit(commandContext) {
  const args = commandContext.args || [];
  const root = commandContext.root || ROOT;
  const isJson = args.includes("--json");

  const core = new EosPhysicsInformedHamiltonianPdeCore();
  const receipt = core.audit();
  const receiptPath = getReceiptPath(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== PINN-PDE: Audit Receipt ===");
    console.log(`Symplectic Bounded : ${receipt.symplecticEnergyBounded}`);
    console.log(`Yoshida < Verlet   : ${receipt.yoshidaBeatsVerlet}`);
    console.log(`Liouville det(J)=1 : ${receipt.liouvilleVolumePreserved}`);
    console.log(`CFL Guard Enforced : ${receipt.cflGuardEnforced}`);
    console.log(`PINN Converged     : ${receipt.pinnLossConverged}`);
    console.log(`PINN L2 Error      : ${receipt.pinnL2Error}`);
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256Digest}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:pinn:symplectic"] = cmd_pinn_symplectic;
HANDLERS["toolchain:pinn:cfl"] = cmd_pinn_cfl;
HANDLERS["toolchain:pinn:residual"] = cmd_pinn_residual;
HANDLERS["toolchain:pinn:solve"] = cmd_pinn_solve;
HANDLERS["toolchain:pinn:audit"] = cmd_pinn_audit;

export async function handlePhysicsInformedHamiltonianPdeCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:pinn command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
