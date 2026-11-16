/**
 * GLORIAN SYSTEM — HERMETIC REPRODUCIBLE BUILD GOVERNOR TEST SUITE
 *
 * Verifies Bit-for-Bit Reproducible Builds, Nix Flake derivations,
 * Bazel hermetic sandboxing, SOURCE_DATE_EPOCH archive normalization, and drift detection.
 *
 * Governed by SPEC-302 (FR-302-01..FR-302-06, BDD-1587..BDD-1592).
 * Strict Law V: Zero third-party runtime dependencies. Uses node:test and node:assert/strict.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosHermeticReproducibleBuildGovernor } from "../src/core/eosHermeticReproducibleBuildGovernor.ts";

describe("SPEC-302: Bit-for-Bit Hermetic Reproducible Builds (Nix Flakes & Bazel Containers)", () => {
  it("BDD-1587: Declarative Nix Flake and Bazel Manifest Generation", () => {
    const root = process.cwd();
    const flakePath = path.join(root, "deploy", "nix", "flake.nix");
    const defaultNixPath = path.join(root, "deploy", "nix", "default.nix");
    const workspacePath = path.join(root, "deploy", "bazel", "WORKSPACE");
    const buildBazelPath = path.join(root, "deploy", "bazel", "BUILD.bazel");

    assert.ok(fs.existsSync(flakePath), "flake.nix must exist");
    assert.ok(fs.existsSync(defaultNixPath), "default.nix must exist");
    assert.ok(fs.existsSync(workspacePath), "WORKSPACE must exist");
    assert.ok(fs.existsSync(buildBazelPath), "BUILD.bazel must exist");

    const flakeContent = fs.readFileSync(flakePath, "utf8");
    assert.ok(flakeContent.includes("nodejs_22"));
    assert.ok(flakeContent.includes("SOURCE_DATE_EPOCH"));

    const bazelContent = fs.readFileSync(buildBazelPath, "utf8");
    assert.ok(bazelContent.includes("requires-network:no"));
    assert.ok(bazelContent.includes("SOURCE_DATE_EPOCH"));
  });

  it("BDD-1588: Canonical Archive Normalization (SOURCE_DATE_EPOCH & Permissions)", () => {
    const rawFiles = [
      { path: "src/file2.txt", content: "data2", mode: 0o777, mtime: 1729999999 },
      { path: "bin/tool.mjs", content: "console.log(1);", mode: 0o600, mtime: 1711111111 },
      { path: "src/file1.txt", content: "data1", mode: 0o664, mtime: 1733333333 },
    ];

    const normalized = EosHermeticReproducibleBuildGovernor.normalizeArtifacts(rawFiles, {
      sourceDateEpoch: 1700000000,
    });

    assert.equal(normalized.length, 3);
    // 1. Path sorting
    assert.equal(normalized[0].path, "bin/tool.mjs");
    assert.equal(normalized[1].path, "src/file1.txt");
    assert.equal(normalized[2].path, "src/file2.txt");

    // 2. Clamped timestamps
    assert.equal(normalized[0].mtime, 1700000000);
    assert.equal(normalized[1].mtime, 1700000000);
    assert.equal(normalized[2].mtime, 1700000000);

    // 3. Clamped permissions (bin/ gets 0755, src/ gets 0644)
    assert.equal(normalized[0].mode, 0o755);
    assert.equal(normalized[1].mode, 0o644);
    assert.equal(normalized[2].mode, 0o644);

    // 4. Zero ownership
    assert.equal(normalized[0].uid, 0);
    assert.equal(normalized[0].gid, 0);
  });

  it("BDD-1589: Bit-for-Bit Deterministic Artifact Digest Computation", () => {
    const filesA = [
      { path: "a.ts", content: "const a = 1;", mtime: 1710000000 },
      { path: "b.ts", content: "const b = 2;", mtime: 1720000000 },
    ];

    // Permuted order and different local timestamps
    const filesB = [
      { path: "b.ts", content: "const b = 2;", mtime: 1730000000 },
      { path: "a.ts", content: "const a = 1;", mtime: 1740000000 },
    ];

    const bundleA = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("build-A", filesA);
    const bundleB = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("build-B", filesB);

    assert.equal(bundleA.rootDigestSha256, bundleB.rootDigestSha256);
    assert.match(bundleA.rootDigestSha256, /^[0-9a-f]{64}$/);
  });

  it("BDD-1590: Multi-Build Dual Verification (REPRODUCIBLE_MATCH)", () => {
    const files = [
      { path: "dist/app.js", content: "console.log('glorian');" },
      { path: "dist/styles.css", content: "body { margin: 0; }" },
    ];

    const build1 = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("runner-linux", files);
    const build2 = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("runner-darwin", files);

    const verification = EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(build1, build2);
    assert.equal(verification.reproducible, true);
    assert.equal(verification.verdict, "REPRODUCIBLE_MATCH");
    assert.equal(verification.matchedCount, 2);
    assert.equal(verification.divergentArtifacts.length, 0);
  });

  it("BDD-1591: Non-Deterministic Drift Detection and Divergence Isolation", () => {
    const filesA = [
      { path: "dist/app.js", content: "console.log('build-1-content');" },
      { path: "dist/styles.css", content: "body { margin: 0; }" },
    ];

    // Host ambient drift injected
    const filesB = [
      { path: "dist/app.js", content: "console.log('build-2-drifted');" },
      { path: "dist/styles.css", content: "body { margin: 0; }" },
    ];

    const buildA = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("build-A", filesA);
    const buildB = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("build-B", filesB);

    const verification = EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(buildA, buildB);
    assert.equal(verification.reproducible, false);
    assert.equal(verification.verdict, "NON_DETERMINISTIC_DRIFT");
    assert.equal(verification.matchedCount, 1);
    assert.equal(verification.divergentArtifacts.length, 1);
    assert.equal(verification.divergentArtifacts[0].path, "dist/app.js");
  });

  it("BDD-1592: End-to-End Cryptographic Audit Receipt Generation", () => {
    const root = process.cwd();
    const receipt = EosHermeticReproducibleBuildGovernor.auditHermeticBuildPipeline({ projectRoot: root });

    assert.equal(receipt.specRef, "SPEC-302");
    assert.equal(receipt.totalArtifactsVerified, 4);
    assert.equal(receipt.bitForBitIdentical, true);
    assert.equal(receipt.reproducibilityRatio, 1.0);
    assert.match(receipt.rootDigestSha256, /^[0-9a-f]{64}$/);
    assert.match(receipt.sha256Signature, /^[0-9a-f]{64}$/);

    const receiptPath = path.join(root, "docs", "evidence", "HERMETIC_BUILD_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
