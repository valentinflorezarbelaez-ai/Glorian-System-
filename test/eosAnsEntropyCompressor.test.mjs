/**
 * EOS SYSTEM — LAYER-0 ASYMMETRIC NUMERAL SYSTEMS (ANS/rANS) TEST SUITE
 * Governed by SPEC-207, CHANGE-092, ADR-092, BDD-1054..BDD-1058 (v77.0.0)
 *
 * Validates:
 * - BDD-1054: Frequency table normalization to M = 4096 and cumulative mapping.
 * - BDD-1055: Bounded rANS state maintenance and stream container serialization.
 * - BDD-1056: 100% exact lossless round-trip decompression across diverse payloads.
 * - BDD-1057: Empirical Shannon entropy calculation and compression metrics.
 * - BDD-1058: End-to-end CLI execution, base64 transport, and SHA-256 receipts.
 *
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  EosAnsEntropyCompressor,
  normalizeFrequencies,
  calculateShannonEntropy,
  RANS_M,
} from "../src/core/eosAnsEntropyCompressor.ts";

describe("EosAnsEntropyCompressor (SPEC-207 / BDD-1054..BDD-1058)", () => {
  it("BDD-1054: Frequency table normalization and cumulative mapping", () => {
    const counts = new Uint32Array(256);
    // Skewed frequency distribution
    counts[65] = 100; // 'A'
    counts[66] = 50; // 'B'
    counts[67] = 10; // 'C'
    counts[68] = 1; // 'D'

    const norm = normalizeFrequencies(counts, 161);
    assert.equal(norm.presentSymbols.length, 4);
    assert.deepEqual(norm.presentSymbols, [65, 66, 67, 68]);

    // Frequencies sum to exactly M = 4096
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += norm.freqs[i];
      if (counts[i] > 0) {
        assert.ok(norm.freqs[i] >= 1, `Observed symbol ${i} must have frequency >= 1`);
      } else {
        assert.equal(norm.freqs[i], 0);
      }
    }
    assert.equal(sum, RANS_M);

    // Cumulative bounds
    assert.equal(norm.cum[0], 0);
    assert.equal(norm.cum[256], RANS_M);
    for (let i = 0; i < 256; i++) {
      assert.ok(norm.cum[i + 1] >= norm.cum[i]);
    }

    // Slot table maps every slot to a valid present symbol
    for (let slot = 0; slot < RANS_M; slot++) {
      const sym = norm.slotToSymbol[slot];
      assert.ok(norm.presentSymbols.includes(sym));
    }
  });

  it("BDD-1055: rANS byte-level stream encoding and bounded state maintenance", () => {
    const text = "GLORIAN_SOVEREIGN_SYSTEM_ENTERPRISE_CONTROL_PLANE_2026";
    const result = EosAnsEntropyCompressor.compress(text);

    assert.ok(result.compressed.length > 0);
    // Check MAGIC "EOSA"
    assert.equal(result.compressed[0], 0x45);
    assert.equal(result.compressed[1], 0x4f);
    assert.equal(result.compressed[2], 0x53);
    assert.equal(result.compressed[3], 0x41);
    assert.equal(result.compressed[4], 1); // Version 1

    assert.equal(result.metadata.uncompressedSize, Buffer.byteLength(text));
    assert.ok(result.metadata.compressedSize === result.compressed.length);
    assert.ok(result.metadata.uniqueSymbols > 0);
    assert.equal(result.sha256Receipt.length, 64);
  });

  it("BDD-1056: Lossless decompression and round-trip verification", () => {
    const testCases = [
      { name: "empty", data: new Uint8Array(0) },
      { name: "single-byte", data: Buffer.from("X") },
      { name: "repetitive", data: Buffer.from("A".repeat(500)) },
      {
        name: "json-payload",
        data: Buffer.from(
          JSON.stringify({
            spec: "SPEC-207",
            standard: "rANS",
            author: "Valentín Flórez Arbeláez",
            epoch: 2026,
            verified: true,
            features: ["entropy", "streaming", "lossless", "sovereign"],
          }),
        ),
      },
      {
        name: "full-spectrum",
        data: new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
      },
    ];

    for (const tc of testCases) {
      const comp = EosAnsEntropyCompressor.compress(tc.data);
      const decomp = EosAnsEntropyCompressor.decompress(comp.compressed);

      assert.equal(decomp.verified, true, `Verification failed for case: ${tc.name}`);
      assert.equal(decomp.decompressed.length, tc.data.length);
      assert.equal(
        Buffer.compare(Buffer.from(decomp.decompressed), Buffer.from(tc.data)),
        0,
        `Byte mismatch for case: ${tc.name}`,
      );
      assert.equal(decomp.originalSha256, comp.metadata.originalSha256);
      assert.equal(decomp.sha256Receipt.length, 64);
    }
  });

  it("BDD-1057: Shannon entropy calculation and compression ratio telemetry", () => {
    // Monotonous stream: H(X) = 0
    const mono = Buffer.from("A".repeat(100));
    assert.equal(calculateShannonEntropy(mono), 0);

    // Uniform binary flips: H(X) = 1.0
    const flips = Buffer.from("01".repeat(50));
    assert.equal(calculateShannonEntropy(flips), 1);

    // Repetitive text: high compressibility
    const rep = Buffer.from("GLORIAN_".repeat(100));
    const comp = EosAnsEntropyCompressor.compress(rep);

    assert.ok(comp.metadata.shannonEntropyBitsPerSymbol < 4.0);
    assert.ok(comp.metadata.compressionRatio > 1.2);
    assert.ok(comp.metadata.spaceSavingsPercent > 15);
    assert.ok(comp.metadata.theoreticalEntropyBytes < comp.metadata.uncompressedSize);
  });

  it("BDD-1058: End-to-end CLI execution, base64 transport, and SHA-256 receipts", () => {
    const rawText = "AUTONOMOUS_ENTROPY_COMPRESSION_RECEIPT_VERIFICATION_2026";

    // 1. CLI compress --json
    const compStdout = execFileSync(process.execPath, ["bin/eos.mjs", "compress:ans", rawText, "--json"], {
      encoding: "utf8",
    });

    const compJson = JSON.parse(compStdout);
    assert.equal(compJson.verifiedRoundTrip, true);
    assert.ok(compJson.compressedBase64.length > 0);
    assert.equal(compJson.sha256Receipt.length, 64);

    // 2. CLI decompress --json
    const decompStdout = execFileSync(
      process.execPath,
      ["bin/eos.mjs", "decompress:ans", compJson.compressedBase64, "--json"],
      { encoding: "utf8" },
    );

    const decompJson = JSON.parse(decompStdout);
    assert.equal(decompJson.verified, true);
    assert.equal(decompJson.decompressedLength, Buffer.byteLength(rawText));
    assert.equal(decompJson.originalSha256, compJson.metadata.originalSha256);
    assert.equal(decompJson.sha256Receipt.length, 64);
  });
});
