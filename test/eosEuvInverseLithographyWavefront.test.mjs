/**
 * @file eosEuvInverseLithographyWavefront.test.mjs
 * @description BDD test suite for SPEC-337 / CHANGE-199: Autonomous EUV Optical Proximity
 * Correction & Inverse Lithography Wavefront Engine (BDD-1797..1802).
 *
 * Invariant: Pure Layer-0 testing, zero external npm runtime dependencies.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EosEuvInverseLithographyWavefrontCore, EuvIltError } from "../src/core/eosEuvInverseLithographyWavefront.ts";

const RECEIPT_PATH = path.join(os.tmpdir(), `eos-test-EUV_INVERSE_LITHOGRAPHY_RECEIPT-${process.pid}.json`);

test("SPEC-337 / CHANGE-199: Autonomous EUV Optical Proximity Correction & Inverse Lithography Wavefront Engine (EUV-OPC)", async (t) => {
  await t.test("BDD-1797: Zernike Pupil Wavefront Metrology, Quadrature Orthonormality & Maréchal Strehl Ratio", () => {
    const core = new EosEuvInverseLithographyWavefrontCore({
      wavelengthNm: 13.5,
      numericalAperture: 0.33,
    });

    // Unaberrated pupil -> Strehl = 1.0, RMS = 0
    const ideal = core.evaluateWavefront({});
    assert.strictEqual(ideal.rmsErrorNm, 0);
    assert.strictEqual(ideal.strehlRatio, 1.0);
    assert.strictEqual(ideal.diffractionLimited, true);

    // Aberrated pupil within Maréchal limit (lambda / 14 = 0.964 nm)
    const moderate = core.evaluateWavefront({
      z4DefocusNm: 0.4,
      z5AstigmatismObliqueNm: 0.2,
      z7ComaVerticalNm: 0.3,
      z11SphericalNm: 0.2,
    });
    assert.ok(Math.abs(moderate.rmsErrorNm - moderate.quadratureRmsNm) < 2e-2);
    assert.ok(moderate.rmsErrorNm < moderate.marechalLimitNm);
    assert.ok(moderate.strehlRatio >= 0.8);
    assert.strictEqual(moderate.diffractionLimited, true);
  });

  await t.test(
    "BDD-1798: Fail-Closed Maréchal Diffraction-Limit Breach Guard & Active Mirror Phase Compensation",
    () => {
      const core = new EosEuvInverseLithographyWavefrontCore();
      const severeAberration = {
        z4DefocusNm: 1.3,
        z7ComaVerticalNm: 0.9,
        z11SphericalNm: 0.8,
      };

      // Uncompensated severe aberration must fail closed with EUVILT_MARECHAL_BREACH
      assert.throws(
        () => core.assertDiffractionLimitedAdmission(severeAberration),
        (err) => err instanceof EuvIltError && err.code === "EUVILT_MARECHAL_BREACH",
      );

      // Active mirror Zernike phase conjugation restores Strehl >= 0.98
      const compensated = core.compensateWavefront(severeAberration, 0.94);
      assert.strictEqual(compensated.before.diffractionLimited, false);
      assert.strictEqual(compensated.after.diffractionLimited, true);
      assert.ok(compensated.after.strehlRatio > 0.98);
      assert.ok(compensated.residualSuppressionRatio >= 0.939);
    },
  );

  await t.test("BDD-1799: 2D Diffraction Aerial Image Simulation & Photoresist Contour Symmetry", () => {
    const core = new EosEuvInverseLithographyWavefrontCore();
    const target = EosEuvInverseLithographyWavefrontCore.createCrossTargetPattern(11);
    const sim = core.simulateAerialImage(target);

    assert.strictEqual(sim.gridSize, 11);
    assert.ok(sim.minIntensity >= 0 && sim.maxIntensity <= 1.0001);
    assert.ok(sim.aerialIntensity[5][5] > 0.7);

    // Symmetry of cross pattern preserved under symmetric PSF
    assert.ok(Math.abs(sim.aerialIntensity[2][5] - sim.aerialIntensity[8][5]) < 1e-12);
    assert.ok(Math.abs(sim.aerialIntensity[5][2] - sim.aerialIntensity[5][8]) < 1e-12);
  });

  await t.test(
    "BDD-1800: Adjoint-Gradient Pixel-Based Inverse Lithography (ILT) Mask Synthesis & EPE Reduction",
    () => {
      const core = new EosEuvInverseLithographyWavefrontCore();
      const target = EosEuvInverseLithographyWavefrontCore.createCrossTargetPattern(11);
      const ilt = core.synthesizeInverseMask(target, { iterations: 35, stepSize: 1.8 });

      assert.ok(ilt.finalL2Loss < ilt.initialL2Loss);
      assert.ok(ilt.lossReductionRatio > 0.65);
      assert.ok(ilt.finalEpePixels < ilt.initialEpePixels);
      assert.ok(ilt.epeImprovementRatio >= 0.5);

      // Synthesized continuous mask transmissions stay strictly in [0, 1]
      for (const row of ilt.synthesizedMask) {
        for (const v of row) {
          assert.ok(v >= 0 && v <= 1);
        }
      }
    },
  );

  await t.test("BDD-1801: Rayleigh Resolution Scaling Between Standard EUV (0.33 NA) and High-NA EUV (0.55 NA)", () => {
    const core = new EosEuvInverseLithographyWavefrontCore();
    const stdEuv = core.evaluateWavefront({}, { wavelengthNm: 13.5, numericalAperture: 0.33 });
    const highNaEuv = core.evaluateWavefront({}, { wavelengthNm: 13.5, numericalAperture: 0.55 });

    const ratio = highNaEuv.rayleighHalfPitchNm / stdEuv.rayleighHalfPitchNm;
    assert.ok(Math.abs(ratio - 0.33 / 0.55) < 1e-12);
    assert.ok(highNaEuv.pupilCutoffFreqPerNm > stdEuv.pupilCutoffFreqPerNm);
  });

  await t.test("BDD-1802: Deterministic Audit Receipt & Parameter Validation", () => {
    const core = new EosEuvInverseLithographyWavefrontCore();
    const receiptA = core.audit();
    const receiptB = core.audit();

    assert.strictEqual(receiptA.specRef, "SPEC-337");
    assert.strictEqual(receiptA.zernikeOrthonormal, true);
    assert.strictEqual(receiptA.marechalGuardEnforced, true);
    assert.strictEqual(receiptA.wavefrontCompensated, true);
    assert.strictEqual(receiptA.iltLossReduced, true);
    assert.strictEqual(receiptA.epeImproved, true);
    assert.strictEqual(receiptA.allPassed, true);
    assert.strictEqual(receiptA.sha256Digest.length, 64);
    assert.strictEqual(receiptA.sha256Digest, receiptB.sha256Digest);

    assert.throws(
      () => new EosEuvInverseLithographyWavefrontCore({ numericalAperture: 1.2 }),
      (err) => err instanceof EuvIltError && err.code === "EUVILT_INVALID_PARAMETERS",
    );

    fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receiptA, null, 2), "utf8");
    assert.ok(fs.existsSync(RECEIPT_PATH));
  });
});
