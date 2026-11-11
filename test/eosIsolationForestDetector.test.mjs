/**
 * EOS SYSTEM — LAYER-0 STREAMING ISOLATION FOREST TEST SUITE
 * Governed by SPEC-209, CHANGE-094, ADR-094, BDD-1064..BDD-1068 (v79.0.0)
 *
 * Validates:
 * - BDD-1064: Isolation Tree recursive partitioning and depth bounding.
 * - BDD-1065: Path length evaluation and BST normalization c(n).
 * - BDD-1066: Outlier separation and anomaly threshold classification.
 * - BDD-1067: Streaming sliding window buffer and online drift handling.
 * - BDD-1068: End-to-end CLI execution and cryptographic anomaly receipts.
 *
 * Strictly ZERO external dependencies. Pure JavaScript for Node 24 native runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  EosIsolationForest,
  EosStreamingIsolationForest,
  computeAverageBstPathLength,
  buildIsolationTree,
  evaluatePathLength,
  createPrng,
} from "../src/core/eosIsolationForestDetector.ts";

describe("EosIsolationForestDetector (SPEC-209 / BDD-1064..BDD-1068)", () => {
  it("BDD-1064: Isolation Tree recursive partitioning and depth bounding", () => {
    // Check BST formula values
    assert.equal(computeAverageBstPathLength(0), 0);
    assert.equal(computeAverageBstPathLength(1), 0);
    assert.equal(computeAverageBstPathLength(2), 1);
    const c256 = computeAverageBstPathLength(256);
    assert.ok(c256 > 10.0 && c256 < 10.5);

    // Build a single tree
    const data = [
      [10, 20],
      [12, 22],
      [11, 21],
      [9, 19],
      [100, 200], // outlier
    ];
    const rng = createPrng(42);
    const maxDepth = Math.ceil(Math.log2(data.length));
    const tree = buildIsolationTree(data, 0, maxDepth, rng);

    assert.equal(tree.isLeaf, false);
    assert.equal(tree.size, 5);
    assert.ok(tree.splitFeature !== undefined);
    assert.ok(tree.splitValue !== undefined);
    assert.ok(tree.left);
    assert.ok(tree.right);

    const pathLen = evaluatePathLength(tree, data[0]);
    assert.ok(pathLen >= 1);
  });

  it("BDD-1065: Path length evaluation and BST normalization", () => {
    const normalData = [];
    for (let i = 0; i < 50; i++) {
      normalData.push([10.0 + (i % 5) * 0.5, 20.0 + (i % 7) * 0.5]);
    }
    const outlier = [500.0, 999.0];
    const dataset = [...normalData, outlier];

    const forest = new EosIsolationForest({ nTrees: 50, subsampleSize: 64, seed: 1065 });
    forest.fit(dataset);

    const normalScore = forest.score([10.5, 20.5]);
    const outlierScore = forest.score(outlier);

    // Outlier must have significantly shorter path length than normal point
    assert.ok(outlierScore.meanPathLength < normalScore.meanPathLength);
    // Outlier anomaly score must be higher
    assert.ok(outlierScore.anomalyScore > normalScore.anomalyScore);
    // Scores are normalized in [0, 1]
    assert.ok(normalScore.anomalyScore >= 0 && normalScore.anomalyScore <= 1);
    assert.ok(outlierScore.anomalyScore >= 0 && outlierScore.anomalyScore <= 1);
  });

  it("BDD-1066: Outlier separation and anomaly threshold classification", () => {
    // Dense cluster of 100 points around (50, 50)
    const inliers = [];
    for (let i = 0; i < 100; i++) {
      inliers.push([50.0 + Math.sin(i) * 5.0, 50.0 + Math.cos(i) * 5.0]);
    }

    // Two extreme outliers
    const outlier1 = [300.0, 400.0];
    const outlier2 = [-150.0, -200.0];

    const allData = [...inliers, outlier1, outlier2];

    const forest = new EosIsolationForest({ nTrees: 80, threshold: 0.6, seed: 1066 });
    forest.fit(allData);
    const report = forest.predict(allData);

    assert.equal(report.totalEvaluated, 102);
    assert.equal(report.anomalyCount, 2);
    assert.equal(report.outliers.length, 2);
    assert.ok(report.sha256Receipt.length === 64);

    // Verify both outliers scored >= 0.6
    for (const out of report.outliers) {
      assert.ok(out.anomalyScore >= 0.6);
      assert.equal(out.isAnomaly, true);
    }

    // Verify inliers scored < 0.55
    const inlierResults = report.results.slice(0, 100);
    for (const inl of inlierResults) {
      assert.ok(inl.anomalyScore < 0.55);
      assert.equal(inl.isAnomaly, false);
    }
  });

  it("BDD-1067: Streaming sliding window updates and drift detection", () => {
    const streaming = new EosStreamingIsolationForest({
      windowCapacity: 60,
      retrainInterval: 15,
      threshold: 0.6,
      seed: 1067,
    });

    // Ingest initial points
    for (let i = 0; i < 40; i++) {
      streaming.ingest([10.0 + (i % 3), 20.0 + (i % 4)]);
    }

    assert.equal(streaming.isReady, true);
    assert.equal(streaming.windowSize, 40);

    // Ingest anomalous vector
    const res = streaming.ingest([500.0, 800.0]);
    assert.ok(res);
    assert.equal(res.isAnomaly, true);
    assert.ok(res.anomalyScore >= 0.6);

    // Ingest more points to exceed window capacity
    for (let i = 0; i < 50; i++) {
      streaming.ingest([10.0 + (i % 3), 20.0 + (i % 4)]);
    }
    // Window capacity must remain capped at 60
    assert.equal(streaming.windowSize, 60);
    assert.equal(streaming.ingestedCount, 91);
  });

  it("BDD-1068: End-to-end CLI execution and cryptographic anomaly receipt", () => {
    const stdout = execFileSync(process.execPath, ["bin/eos.mjs", "anomaly:detect", "--json"], { encoding: "utf8" });

    const report = JSON.parse(stdout);
    assert.equal(report.totalEvaluated, 103);
    assert.equal(report.anomalyCount, 3);
    assert.equal(report.outliers.length, 3);
    assert.equal(report.sha256Receipt.length, 64);
    assert.ok(report.forestTrees >= 50);

    for (const out of report.outliers) {
      assert.ok(out.anomalyScore >= 0.6);
      assert.equal(out.isAnomaly, true);
    }
  });
});
