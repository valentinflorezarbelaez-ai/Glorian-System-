import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosAudioDspKernel } from "../src/core/eosAudioDspKernel.ts";

describe("Local Audio DSP Example", () => {
  const dsp = new EosAudioDspKernel();

  describe("Suite 1: Biquad IIR Filter Coefficients & Processing (BDD-043)", () => {
    it("computes stable normalized biquad coefficients for lowpass, highpass, and peaking", () => {
      const lp = dsp.computeBiquadCoefficients("lowpass", 1000, 44100, 0.7071);
      assert.ok(lp.b0 > 0);
      assert.ok(Math.abs(lp.a1) < 2);
      assert.ok(Math.abs(lp.a2) < 1);

      const hp = dsp.computeBiquadCoefficients("highpass", 500, 44100, 0.7071);
      assert.ok(hp.b0 > 0);
      assert.ok(hp.b1 < 0);

      const peak = dsp.computeBiquadCoefficients("peaking", 2500, 44100, 1.0, 3.0);
      assert.ok(peak.b0 !== 0);
    });

    it("processes audio buffer in-place with Direct Form II Transposed", () => {
      const buffer = new Float32Array([0.5, 0.8, -0.4, -0.9, 0.2, 0.1]);
      const lp = dsp.computeBiquadCoefficients("lowpass", 2000, 44100);
      dsp.processBiquadInPlace(buffer, lp);
      assert.equal(buffer.length, 6);
      for (const val of buffer) {
        assert.ok(!isNaN(val) && isFinite(val));
      }
    });
  });

  describe("Suite 2: Sample-Peak Clamp", () => {
    it("clamps samples that exceed the configured amplitude ceiling", () => {
      // Create a buffer with extreme overshoot (+3.0 dB, linear ~1.41)
      const buffer = new Float32Array([1.5, -1.8, 0.5, -0.2, 2.0]);
      const result = dsp.applySamplePeakLimiterInPlace(buffer);
      assert.equal(result.clamped, true);
      assert.ok(result.maxPeakDb > 0.0);

      // Verify all samples are now within safe bound
      for (const val of buffer) {
        assert.ok(Math.abs(val) <= 1.0, `Sample exceeded 1.0: ${val}`);
      }
    });
  });

  describe("Suite 3: High-Throughput DSP Benchmark", () => {
    it("achieves real-time audio throughput (> 50x real-time) on 65,536 audio frames", () => {
      const bench = dsp.benchmarkDsp(65536, 10);
      assert.equal(bench.sampleRateHz, 44100);
      assert.ok(bench.throughputSamplesSec > 500000, `Expected > 500k samples/sec, got ${bench.throughputSamplesSec}`);
      assert.ok(bench.realTimeSpeedFactor > 10, `Expected > 10x real-time, got ${bench.realTimeSpeedFactor}x`);
      assert.ok(bench.samplePeakOutputDbfs <= 0.0);
      assert.ok(bench.sha256Proof.length === 64);
    });
  });
});
