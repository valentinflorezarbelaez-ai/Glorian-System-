/**
 * @file cliEuvInverseLithographyWavefront.mjs
 * @description CLI handler for SPEC-337 / CHANGE-199: Autonomous EUV Optical Proximity
 * Correction & Inverse Lithography Wavefront Engine (EUV-OPC / ILT).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosEuvInverseLithographyWavefrontCore } from "../../src/core/eosEuvInverseLithographyWavefront.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("EUV_INVERSE_LITHOGRAPHY_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_euvilt_wavefront(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const na = Number(parseFlagValue(args, "--na=", "0.33"));
  const z4 = Number(parseFlagValue(args, "--z4=", "0.4"));
  const z7 = Number(parseFlagValue(args, "--z7=", "0.3"));
  const z11 = Number(parseFlagValue(args, "--z11=", "0.2"));

  const core = new EosEuvInverseLithographyWavefrontCore({ numericalAperture: na });
  const report = core.evaluateWavefront({
    z4DefocusNm: z4,
    z7ComaVerticalNm: z7,
    z11SphericalNm: z11,
  });

  const payload = {
    command: "toolchain:euvilt:wavefront",
    ...report,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== EUV-ILT: Zernike Pupil Wavefront Metrology ===");
    console.log(`Wavelength / NA    : ${report.wavelengthNm} nm / ${report.numericalAperture}`);
    console.log(`Rayleigh Half-Pitch: ${report.rayleighHalfPitchNm.toFixed(3)} nm`);
    console.log(`RMS Error (Analyt) : ${report.rmsErrorNm.toFixed(4)} nm`);
    console.log(`RMS Error (Quad)   : ${report.quadratureRmsNm.toFixed(4)} nm`);
    console.log(`Strehl Ratio       : ${report.strehlRatio.toFixed(4)}`);
    console.log(`Diffraction Limited: ${report.diffractionLimited}`);
  }
}

async function cmd_euvilt_compensate(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const efficiency = Number(parseFlagValue(args, "--efficiency=", "0.94"));

  const core = new EosEuvInverseLithographyWavefrontCore();
  const res = core.compensateWavefront({ z4DefocusNm: 1.2, z7ComaVerticalNm: 0.9, z11SphericalNm: 0.8 }, efficiency);

  const payload = {
    command: "toolchain:euvilt:compensate",
    beforeStrehl: res.before.strehlRatio,
    afterStrehl: res.after.strehlRatio,
    beforeRmsNm: res.before.rmsErrorNm,
    afterRmsNm: res.after.rmsErrorNm,
    residualSuppressionRatio: res.residualSuppressionRatio,
    admittedAfterCompensation: res.after.diffractionLimited,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== EUV-ILT: Active Mirror Wavefront Compensation ===");
    console.log(`Before Strehl / RMS: ${res.before.strehlRatio.toFixed(4)} / ${res.before.rmsErrorNm.toFixed(3)} nm`);
    console.log(`After Strehl / RMS : ${res.after.strehlRatio.toFixed(4)} / ${res.after.rmsErrorNm.toFixed(3)} nm`);
    console.log(`Suppression Ratio  : ${(res.residualSuppressionRatio * 100).toFixed(2)}%`);
    console.log(`Admitted           : ${res.after.diffractionLimited}`);
  }
}

async function cmd_euvilt_aerial(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const grid = Number(parseFlagValue(args, "--grid=", "11"));

  const core = new EosEuvInverseLithographyWavefrontCore();
  const target = EosEuvInverseLithographyWavefrontCore.createCrossTargetPattern(grid);
  const sim = core.simulateAerialImage(target);

  const payload = {
    command: "toolchain:euvilt:aerial",
    gridSize: sim.gridSize,
    minIntensity: sim.minIntensity,
    maxIntensity: sim.maxIntensity,
    centerIntensity: sim.aerialIntensity[Math.floor(sim.gridSize / 2)][Math.floor(sim.gridSize / 2)],
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== EUV-ILT: 2D Diffraction Aerial Image Simulation ===");
    console.log(`Grid Size          : ${sim.gridSize}x${sim.gridSize}`);
    console.log(`Min / Max Intensity: ${sim.minIntensity.toFixed(4)} / ${sim.maxIntensity.toFixed(4)}`);
    console.log(`Center Intensity   : ${payload.centerIntensity.toFixed(4)}`);
  }
}

async function cmd_euvilt_synthesize(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const iterations = Number(parseFlagValue(args, "--iterations=", "35"));

  const core = new EosEuvInverseLithographyWavefrontCore();
  const target = EosEuvInverseLithographyWavefrontCore.createCrossTargetPattern(11);
  const ilt = core.synthesizeInverseMask(target, { iterations });

  const payload = {
    command: "toolchain:euvilt:synthesize",
    gridSize: ilt.gridSize,
    iterations: ilt.iterations,
    initialL2Loss: ilt.initialL2Loss,
    finalL2Loss: ilt.finalL2Loss,
    lossReductionRatio: ilt.lossReductionRatio,
    initialEpePixels: ilt.initialEpePixels,
    finalEpePixels: ilt.finalEpePixels,
    epeImprovementRatio: ilt.epeImprovementRatio,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== EUV-ILT: Adjoint Inverse Lithography Mask Synthesis ===");
    console.log(`Grid / Iterations  : ${ilt.gridSize}x${ilt.gridSize} / ${ilt.iterations}`);
    console.log(`Initial -> Final L2: ${ilt.initialL2Loss.toFixed(5)} -> ${ilt.finalL2Loss.toFixed(5)}`);
    console.log(`Initial -> Final EPE: ${ilt.initialEpePixels} -> ${ilt.finalEpePixels} px`);
    console.log(`Loss Reduction     : ${(ilt.lossReductionRatio * 100).toFixed(2)}%`);
  }
}

async function cmd_euvilt_audit(commandContext) {
  const args = commandContext.args || [];
  const root = commandContext.root || ROOT;
  const isJson = args.includes("--json");

  const core = new EosEuvInverseLithographyWavefrontCore();
  const receipt = core.audit();
  const receiptPath = getReceiptPath(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== EUV-ILT: Audit Receipt ===");
    console.log(`0.33 NA Half-Pitch : ${receipt.standardEuvHalfPitchNm} nm`);
    console.log(`0.55 NA Half-Pitch : ${receipt.highNaEuvHalfPitchNm} nm`);
    console.log(`Zernike Orthonormal: ${receipt.zernikeOrthonormal}`);
    console.log(`Maréchal Guard     : ${receipt.marechalGuardEnforced}`);
    console.log(`Wavefront Comp.    : ${receipt.wavefrontCompensated}`);
    console.log(`ILT Loss Reduced   : ${receipt.iltLossReduced}`);
    console.log(
      `EPE Improved       : ${receipt.epeImproved} (${receipt.initialEpePixels} -> ${receipt.finalEpePixels} px)`,
    );
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256Digest}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:euvilt:wavefront"] = cmd_euvilt_wavefront;
HANDLERS["toolchain:euvilt:compensate"] = cmd_euvilt_compensate;
HANDLERS["toolchain:euvilt:aerial"] = cmd_euvilt_aerial;
HANDLERS["toolchain:euvilt:synthesize"] = cmd_euvilt_synthesize;
HANDLERS["toolchain:euvilt:audit"] = cmd_euvilt_audit;

export async function handleEuvInverseLithographyWavefrontCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:euvilt command: ${command}`);
  }
  await handler(commandContext);
  return true;
}
