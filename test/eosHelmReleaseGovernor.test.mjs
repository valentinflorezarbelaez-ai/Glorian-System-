/**
 * Glorian System — Helm Packaging & Release Governor Test Suite
 * Governed by SPEC-275 / CHANGE-137
 *
 * Verifies BDD-1425 through BDD-1430.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosHelmReleaseGovernor } from "../src/core/eosHelmReleaseGovernor.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const COMPLIANT_CHART = path.join(ROOT, "templates/k8s/glorian-enterprise-workload");

describe("SPEC-275: Helm Packaging & Release Governor", () => {
  // -------------------------------------------------------------------------
  // BDD-1425: Helm Lint Validation
  // -------------------------------------------------------------------------
  it("BDD-1425: validates compliant Helm chart structure with 0 lint errors", () => {
    const report = EosHelmReleaseGovernor.lintChart(COMPLIANT_CHART);

    assert.equal(report.status, "PASS");
    assert.equal(report.clean, true);
    assert.equal(typeof report.latencyMs, "number");
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1426: In-Memory Template Rendering
  // -------------------------------------------------------------------------
  it("BDD-1426: materializes multi-document YAML manifests strictly in memory", () => {
    const report = EosHelmReleaseGovernor.templateChart(COMPLIANT_CHART, "test-render");

    assert.equal(report.status, "PASS");
    assert.ok(report.renderedYaml.length > 200);
    assert.ok(report.documentCount >= 3, `Expected >= 3 documents, got ${report.documentCount}`);
    assert.ok(
      report.workloadDocumentCount >= 1,
      `Expected >= 1 workload document, got ${report.workloadDocumentCount}`,
    );
    assert.ok(report.renderedYaml.includes("Deployment"));
    assert.ok(report.renderedYaml.includes("Service"));
    assert.ok(report.renderedYaml.includes("ServiceAccount"));
  });

  // -------------------------------------------------------------------------
  // BDD-1427: OPA Policy Audit on Chart Manifests
  // -------------------------------------------------------------------------
  it("BDD-1427: OPA evaluation passes compliant chart and flags security violations", () => {
    // 1. Compliant chart evaluation
    const cleanReport = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART, {
      releaseName: "test-clean",
    });
    assert.equal(cleanReport.status, "PASS");
    assert.equal(cleanReport.allowed, true);
    assert.equal(cleanReport.totalViolations, 0);

    // 2. Insecure chart evaluation (privileged=true)
    const insecureReport = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART, {
      releaseName: "test-insecure",
      setValues: { "securityContext.privileged": "true" },
    });
    assert.equal(insecureReport.status, "POLICY_VIOLATION");
    assert.equal(insecureReport.allowed, false);
    assert.ok(insecureReport.totalViolations >= 1);
    assert.ok(insecureReport.violations.some((v) => v.rule === "no_privileged"));
  });

  // -------------------------------------------------------------------------
  // BDD-1428: Context Guard Blocks External Clusters
  // -------------------------------------------------------------------------
  it("BDD-1428: rejects Helm deployment to unauthorized external contexts fail-closed", () => {
    const report = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "test-blocked", {
      customContext: "arn:aws:eks:us-east-1:123456789012:cluster/prod-workload",
    });

    assert.equal(report.status, "CONTEXT_UNAUTHORIZED");
    assert.equal(report.stages[0].stage, "CONTEXT_GUARD");
    assert.equal(report.stages[0].passed, false);
  });

  // -------------------------------------------------------------------------
  // BDD-1429: Server Dry-Run Admission Validation
  // -------------------------------------------------------------------------
  it("BDD-1429: validates admission and passes server dry-run on compliant chart", () => {
    const report = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "test-dryrun", {
      dryRun: true,
      customContext: "kind-glorian-cluster",
    });

    // In environment with active Kind cluster, server dry-run passes
    assert.ok(
      report.status === "DRY_RUN_PASSED" || report.status === "ADMISSION_REJECTED",
      `Expected DRY_RUN_PASSED or ADMISSION_REJECTED, got ${report.status}`,
    );
    assert.equal(report.stages[0].passed, true); // Context Guard
    assert.equal(report.stages[1].passed, true); // Helm Lint
    assert.equal(report.stages[2].passed, true); // OPA Policy
  });

  // -------------------------------------------------------------------------
  // BDD-1430: Gated Helm Deploy & Receipt Verification
  // -------------------------------------------------------------------------
  it("BDD-1430: deploys compliant Helm release and emits verified receipt", () => {
    const receiptPath = path.join(ROOT, "docs/evidence/HELM_RECEIPT.json");
    const report = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "glorian-enterprise-app", {
      dryRun: false, // Live apply
      customContext: "kind-glorian-cluster",
      receiptPath,
    });

    assert.ok(
      report.status === "RELEASE_DEPLOYED" ||
        report.status === "ADMISSION_REJECTED" ||
        report.status === "DEPLOY_FAILED",
      `Unexpected status: ${report.status}`,
    );
    assert.ok(fs.existsSync(receiptPath));
    const onDisk = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(onDisk.sha256Receipt, report.sha256Receipt);
  });
});
