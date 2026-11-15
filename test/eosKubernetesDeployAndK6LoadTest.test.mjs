/**
 * Glorian System — Kubernetes Gated Deployment & k6 SLO Load Testing Test Suite
 * Governed by SPEC-274 / CHANGE-136
 *
 * Verifies BDD-1419 through BDD-1424.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosKubernetesDeployGovernor } from "../src/core/eosKubernetesDeployGovernor.ts";
import { EosK6LoadTestAdapter } from "../src/core/eosK6LoadTestAdapter.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-274: Kubernetes Gated Deployment Pipeline & k6 SLO Engine", () => {
  // -------------------------------------------------------------------------
  // BDD-1419: Context Guard Blocks Deployment to External Clusters
  // -------------------------------------------------------------------------
  it("BDD-1419: rejects deployment to unauthorized external contexts fail-closed", () => {
    const samplePodPath = path.join(ROOT, "policies/k8s/sample_pod.json");
    const report = EosKubernetesDeployGovernor.deployWorkload(samplePodPath, {
      customContext: "arn:aws:eks:us-east-1:123456789012:cluster/prod-workloads",
      workingDirectory: ROOT,
    });

    assert.equal(report.status, "CONTEXT_UNAUTHORIZED");
    assert.equal(report.stages.length, 1);
    assert.equal(report.stages[0].stage, "CONTEXT_GUARD");
    assert.equal(report.stages[0].passed, false);
    assert.ok(report.error?.includes("rejected by safety guard allowlist"));
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1420: OPA Policy Violation Halts Deployment Pipeline
  // -------------------------------------------------------------------------
  it("BDD-1420: halts deployment pipeline when manifest violates OPA security rules", () => {
    const flawedManifest = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name: "insecure-workload" },
      spec: {
        securityContext: { runAsNonRoot: false },
        containers: [
          {
            name: "insecure-app",
            image: "nginx:latest",
            securityContext: { privileged: true },
            resources: {},
          },
        ],
      },
    };

    const report = EosKubernetesDeployGovernor.deployWorkload(flawedManifest, {
      customContext: "kind-glorian-cluster",
      workingDirectory: ROOT,
    });

    assert.equal(report.status, "POLICY_VIOLATION");
    assert.equal(report.stages.length, 2);
    assert.equal(report.stages[0].stage, "CONTEXT_GUARD");
    assert.equal(report.stages[0].passed, true);
    assert.equal(report.stages[1].stage, "OPA_POLICY");
    assert.equal(report.stages[1].passed, false);
    assert.ok(report.stages[1].details.length >= 4);
    assert.ok(report.error?.includes("violates Kubernetes security baseline"));
  });

  // -------------------------------------------------------------------------
  // BDD-1421: Server Dry-Run Validation on Compliant Manifest
  // -------------------------------------------------------------------------
  it("BDD-1421: validates admission and passes dry-run on compliant manifest", () => {
    const samplePodPath = path.join(ROOT, "policies/k8s/sample_pod.json");
    const report = EosKubernetesDeployGovernor.deployWorkload(samplePodPath, {
      customContext: "kind-glorian-cluster",
      dryRun: true,
      mockDryRunSuccess: true,
      workingDirectory: ROOT,
    });

    assert.equal(report.status, "DRY_RUN_PASSED");
    assert.equal(report.dryRun, true);
    assert.ok(report.stages.every((s) => s.passed));
    assert.equal(report.stages[0].stage, "CONTEXT_GUARD");
    assert.equal(report.stages[1].stage, "OPA_POLICY");
    assert.equal(report.stages[2].stage, "TRIVY_SECURITY");
    assert.equal(report.stages[3].stage, "SERVER_DRY_RUN");
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1422: Successful Gated Workload Deployment on Kind Cluster
  // -------------------------------------------------------------------------
  it("BDD-1422: completes full 5-stage apply when explicit authorization is provided", () => {
    const samplePodPath = path.join(ROOT, "policies/k8s/sample_pod.json");
    const report = EosKubernetesDeployGovernor.deployWorkload(samplePodPath, {
      customContext: "kind-glorian-cluster",
      dryRun: false,
      mockDryRunSuccess: true,
      mockApplySuccess: true,
      workingDirectory: ROOT,
    });

    assert.equal(report.status, "APPLIED");
    assert.equal(report.dryRun, false);
    assert.equal(report.stages.length, 5);
    assert.ok(report.stages.every((s) => s.passed));
    assert.equal(report.stages[4].stage, "APPLY");
    assert.equal(report.stages[4].passed, true);
  });

  // -------------------------------------------------------------------------
  // BDD-1423: k6 Load Test Execution and Telemetry Normalization
  // -------------------------------------------------------------------------
  it("BDD-1423: executes k6 load test, normalizes telemetry, and generates verified receipt", () => {
    const report = EosK6LoadTestAdapter.runLoadTest("https://glorian-system.vercel.app/api/health", {
      vus: 10,
      duration: "10s",
      forceMock: true,
      workingDirectory: ROOT,
    });

    assert.equal(report.verdict, "PASS");
    assert.equal(report.sloPassed, true);
    assert.equal(report.vus, 10);
    assert.equal(report.duration, "10s");
    assert.ok(report.metrics.totalRequests > 0);
    assert.ok(report.metrics.requestsPerSecond > 0);
    assert.ok(report.metrics.p95DurationMs > 0);
    assert.ok(report.metrics.p99DurationMs > 0);
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1424: k6 SLO Threshold Breach Gating
  // -------------------------------------------------------------------------
  it("BDD-1424: fails closed with SLO_BREACHED when observed latency exceeds threshold", () => {
    const report = EosK6LoadTestAdapter.runLoadTest("https://glorian-system.vercel.app/api/health", {
      vus: 5,
      duration: "5s",
      thresholds: {
        targetP95Ms: 30, // Strict 30ms threshold
        targetP99Ms: 50,
        maxErrorRate: 0.01,
      },
      mockMetrics: {
        p95DurationMs: 95.4, // Exceeds 30ms
        p99DurationMs: 140.2, // Exceeds 50ms
        errorRate: 0.0,
      },
      workingDirectory: ROOT,
    });

    assert.equal(report.verdict, "SLO_BREACHED");
    assert.equal(report.sloPassed, false);
    assert.ok(report.metrics.p95DurationMs > report.thresholds.targetP95Ms);
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });
});
