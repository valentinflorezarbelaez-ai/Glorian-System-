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
import os from "node:os";
import path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
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

    const receiptPath = resolveEvidencePath("HERMETIC_BUILD_RECEIPT.json", root);
    assert.ok(fs.existsSync(receiptPath));
    const saved = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  it("Edge cases: binary buffers, executable suffixes, normalizePermissions=false, missing/mode/epoch drift, and catch", () => {
    // 1. Default options, binary Buffer/Uint8Array content, Windows backslash paths, and .sh/.mjs/.exe suffixes
    const normalizedDefaults = EosHermeticReproducibleBuildGovernor.normalizeArtifacts([
      { path: "scripts\\deploy.sh", content: Buffer.from("#!/bin/sh\necho ok\n") },
      { path: "tools/runner.mjs", content: new Uint8Array([101, 120, 112, 111, 114, 116]) },
      { path: "dist/app.exe", content: "MZ" },
      { path: "README.md", content: "docs" },
    ]);
    assert.equal(normalizedDefaults.find((a) => a.path === "scripts/deploy.sh")?.mode, 0o755);
    assert.equal(normalizedDefaults.find((a) => a.path === "tools/runner.mjs")?.mode, 0o755);
    assert.equal(normalizedDefaults.find((a) => a.path === "dist/app.exe")?.mode, 0o755);
    assert.equal(normalizedDefaults.find((a) => a.path === "README.md")?.mode, 0o644);

    // 2. normalizePermissions: false preserves explicit mode and falls back to 0o644 when omitted
    const preservedPerms = EosHermeticReproducibleBuildGovernor.normalizeArtifacts(
      [
        { path: "scripts/custom.sh", content: "echo", mode: 0o600 },
        { path: "bin/no-mode.sh", content: "echo" },
      ],
      { normalizePermissions: false, sourceDateEpoch: 1700000123 },
    );
    assert.equal(preservedPerms[0].mode, 0o644);
    assert.equal(preservedPerms[1].mode, 0o600);
    assert.equal(preservedPerms[0].mtime, 1700000123);

    // 3. Precondition checks
    assert.throws(() => EosHermeticReproducibleBuildGovernor.normalizeArtifacts(null));
    assert.throws(() => EosHermeticReproducibleBuildGovernor.computeReproducibleRootDigest(null));
    assert.throws(() => EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("", []));
    assert.throws(() => EosHermeticReproducibleBuildGovernor.buildReproducibleBundle(123, []));
    const sampleBundle = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle("b-valid", []);
    assert.throws(() => EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(null, sampleBundle));
    assert.throws(() => EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(sampleBundle, null));

    // 4. verifyHermeticBuild with missing artifacts on both sides and mode mismatch
    const bundleLeft = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle(
      "left",
      [
        { path: "only-left.txt", content: "left" },
        { path: "shared.txt", content: "same", mode: 0o644 },
      ],
      { normalizePermissions: false },
    );
    const bundleRight = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle(
      "right",
      [
        { path: "only-right.txt", content: "right" },
        { path: "shared.txt", content: "same", mode: 0o755 },
      ],
      { normalizePermissions: false },
    );
    const driftReport = EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(bundleLeft, bundleRight);
    assert.equal(driftReport.reproducible, false);
    assert.equal(driftReport.verdict, "NON_DETERMINISTIC_DRIFT");
    assert.equal(driftReport.divergentArtifacts.find((d) => d.path === "only-left.txt")?.digestB, "MISSING");
    assert.equal(driftReport.divergentArtifacts.find((d) => d.path === "only-right.txt")?.digestA, "MISSING");
    assert.ok(driftReport.divergentArtifacts.some((d) => d.path === "shared.txt"));

    // 5. Same artifact hashes & modes but differing rootDigestSha256 (different sourceDateEpoch)
    const epochA = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle(
      "epoch-a",
      [{ path: "a.txt", content: "same" }],
      { sourceDateEpoch: 1700000000 },
    );
    const epochB = EosHermeticReproducibleBuildGovernor.buildReproducibleBundle(
      "epoch-b",
      [{ path: "a.txt", content: "same" }],
      { sourceDateEpoch: 1700000001 },
    );
    const epochVerify = EosHermeticReproducibleBuildGovernor.verifyHermeticBuild(epochA, epochB);
    assert.equal(epochVerify.divergentArtifacts.length, 0);
    assert.equal(epochVerify.reproducible, false);
    assert.equal(epochVerify.verdict, "NON_DETERMINISTIC_DRIFT");

    // 6. auditHermeticBuildPipeline default arg + best-effort catch when evidence path is unwritable
    const defaultReceipt = EosHermeticReproducibleBuildGovernor.auditHermeticBuildPipeline();
    assert.equal(defaultReceipt.specRef, "SPEC-302");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-hermetic-catch-"));
    const blockerFile = path.join(tmpDir, "blocker-file");
    fs.writeFileSync(blockerFile, "not-a-dir", "utf8");
    const prevEvidenceDir = process.env.EOS_EVIDENCE_DIR;
    try {
      process.env.EOS_EVIDENCE_DIR = path.join(blockerFile, "nested");
      const caughtReceipt = EosHermeticReproducibleBuildGovernor.auditHermeticBuildPipeline({ projectRoot: tmpDir });
      assert.equal(caughtReceipt.specRef, "SPEC-302");
      assert.equal(caughtReceipt.bitForBitIdentical, true);
    } finally {
      if (prevEvidenceDir !== undefined) {
        process.env.EOS_EVIDENCE_DIR = prevEvidenceDir;
      } else {
        delete process.env.EOS_EVIDENCE_DIR;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
