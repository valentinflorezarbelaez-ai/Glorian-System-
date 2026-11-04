/**
 * test/eosAutonomousCodeSynthesizer.test.mjs
 * Verification suite for SPEC-157: Autonomous Multi-Tier Code Synthesizer
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { EosAutonomousCodeSynthesizer } from "../src/core/eosAutonomousCodeSynthesizer.ts";

test("BDD-483: Nominal fintech synthesis produces complete 4-tier hexagonal package", () => {
  const synthesizer = new EosAutonomousCodeSynthesizer();
  const bundle = synthesizer.synthesizeBundle(
    "idempotent payment processor with ledger",
    "fintech"
  );

  assert.equal(typeof bundle, "object");
  assert.ok(bundle.id.startsWith("SYNTH-"));
  assert.equal(bundle.domain, "fintech");
  assert.equal(bundle.files.length, 4);

  const domainFile = bundle.files.find((f) => f.layer === "domain");
  const appFile = bundle.files.find((f) => f.layer === "application");
  const infraFile = bundle.files.find((f) => f.layer === "infrastructure");
  const testFile = bundle.files.find((f) => f.layer === "test");

  assert.ok(domainFile, "Domain layer file must exist");
  assert.ok(appFile, "Application layer file must exist");
  assert.ok(infraFile, "Infrastructure layer file must exist");
  assert.ok(testFile, "Test layer file must exist");

  assert.ok(domainFile.content.includes("balanceCents"));
  assert.ok(domainFile.content.includes("FINTECH_INVARIANT_VIOLATION"));
  assert.ok(appFile.content.includes("idempotencyKey"));
  assert.ok(infraFile.content.includes("InMemory"));

  assert.equal(bundle.sha256Receipt.length, 64);
  assert.ok(Object.isFrozen(bundle), "Bundle must be deeply frozen");
});

test("BDD-484: Domain specialization applies archetype rules (audio and platform)", () => {
  const synthesizer = new EosAutonomousCodeSynthesizer();

  // 1. Audio Domain
  const audioBundle = synthesizer.synthesizeBundle("biquad filter audio normalizer", "audio");
  assert.equal(audioBundle.domain, "audio");
  const audioDomain = audioBundle.files.find((f) => f.layer === "domain");
  assert.ok(audioDomain.content.includes("integratedLufs"));
  assert.ok(audioDomain.content.includes("sampleRateHz"));
  assert.ok(audioDomain.content.includes("maxPeakDb"));

  // 2. Platform Domain
  const platformBundle = synthesizer.synthesizeBundle("cell bulkhead gateway rate limiter", "platform");
  assert.equal(platformBundle.domain, "platform");
  const platformDomain = platformBundle.files.find((f) => f.layer === "domain");
  assert.ok(platformDomain.content.includes("circuitState"));
  assert.ok(platformDomain.content.includes("maxConcurrency"));
});

test("BDD-485: JPL Power of 10 conformance", () => {
  const synthesizer = new EosAutonomousCodeSynthesizer();
  const bundle = synthesizer.synthesizeBundle("planetary satellite mission telemetery", "govtech");

  assert.equal(bundle.jplConformance.rule1SimpleControlFlow, true);
  assert.equal(bundle.jplConformance.rule2FixedLoopBounds, true);
  assert.equal(bundle.jplConformance.rule3NoHeapAfterInit, true);
  assert.equal(bundle.jplConformance.rule5PreconditionAssertions, true);

  const domainFile = bundle.files.find((f) => f.layer === "domain");
  assert.ok(domainFile.content.includes("PRECONDITION_FAILED"));
  assert.ok(domainFile.content.includes("Object.freeze"));
});

test("BDD-486: Hermetic materialization with atomic safety into temporary directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-synth-test-"));
  try {
    const synthesizer = new EosAutonomousCodeSynthesizer();
    const bundle = synthesizer.synthesizeBundle("realtime telemetry pipeline", "platform");

    const result = synthesizer.materializeBundle(bundle, tempDir, true);
    assert.equal(result.bundleId, bundle.id);
    assert.ok(result.writtenFiles.length >= 4);

    // Verify files exist on physical disk
    assert.ok(fs.existsSync(path.join(tempDir, "bundle-manifest.json")));
    const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, "bundle-manifest.json"), "utf8"));
    assert.equal(manifest.bundleId, bundle.id);
    assert.equal(manifest.sha256Receipt, bundle.sha256Receipt);

    // Rejection on existing file when overwrite=false
    assert.throws(() => {
      synthesizer.materializeBundle(bundle, tempDir, false);
    }, /MATERIALIZATION_ABORT/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Precondition assertions fail-closed on invalid inputs", () => {
  const synthesizer = new EosAutonomousCodeSynthesizer();
  assert.throws(() => {
    synthesizer.synthesizeBundle("");
  }, /PRECONDITION_FAILED/);

  assert.throws(() => {
    synthesizer.synthesizeBundle("   ");
  }, /PRECONDITION_FAILED/);
});
