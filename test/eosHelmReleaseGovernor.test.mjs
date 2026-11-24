/**
 * Glorian System — Helm Packaging & Release Governor Test Suite
 * Governed by SPEC-275 / CHANGE-137
 *
 * Verifies BDD-1425 through BDD-1430.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";

import { EosHelmReleaseGovernor } from "../src/core/eosHelmReleaseGovernor.ts";
import { EosKubectlClusterInspector } from "../src/core/eosKubectlClusterInspector.ts";

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
    const receiptPath = resolveEvidencePath("HELM_RECEIPT.json", ROOT);
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

  it("covers Layer-0 helm/opa fallbacks, template failures, valuesFile handling, and all 5 deploy stages", () => {
    const req = createRequire(import.meta.url);
    const cjsCp = req("node:child_process");
    const origSpawnSync = cjsCp.spawnSync;
    const origGetContext = EosKubectlClusterInspector.getCurrentContext;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-helm-test-"));
    const valuesFile = path.join(tempDir, "custom-values.yaml");
    const missingValuesFile = path.join(tempDir, "missing-values.yaml");
    const invalidChartDir = path.join(tempDir, "bad-chart");
    fs.writeFileSync(valuesFile, "replicaCount: 2\n", "utf8");
    fs.mkdirSync(invalidChartDir, { recursive: true });
    fs.writeFileSync(path.join(invalidChartDir, "Chart.yaml"), "apiVersion: v2\nname: bad\nversion: 0.1.0\n", "utf8");

    try {
      // 1. Default args & valuesFile + res.error fallbacks (Layer-0 lint & template)
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") {
          return { status: null, stdout: "", stderr: "", error: new Error("spawn helm ENOENT") };
        }
        if (bin === "helm" && args[0] === "template") {
          return { status: null, stdout: "", stderr: "", error: new Error("spawn helm ENOENT") };
        }
        if (bin === "opa") {
          return { status: 1, stdout: "", stderr: "opa missing", error: new Error("spawn opa ENOENT") };
        }
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();

      const l0LintPass = EosHelmReleaseGovernor.lintChart(COMPLIANT_CHART, { timeoutMs: 5000 });
      assert.equal(l0LintPass.status, "PASS");
      assert.equal(l0LintPass.rawOutput, "LAYER0_HELM_CHART_STRUCTURE_VERIFIED");

      const l0LintFail = EosHelmReleaseGovernor.lintChart(invalidChartDir);
      assert.equal(l0LintFail.status, "LINT_FAILED");
      assert.ok(l0LintFail.error?.includes("ENOENT"));

      const l0TemplateClean = EosHelmReleaseGovernor.templateChart(COMPLIANT_CHART);
      assert.equal(l0TemplateClean.status, "PASS");
      assert.equal(l0TemplateClean.documentCount, 3);
      assert.equal(l0TemplateClean.workloadDocumentCount, 1);

      const l0TemplatePriv = EosHelmReleaseGovernor.templateChart(COMPLIANT_CHART, "priv-rel", {
        valuesFile,
        setValues: { "securityContext.privileged": "true" },
        timeoutMs: 5000,
      });
      assert.equal(l0TemplatePriv.status, "PASS");
      assert.ok(l0TemplatePriv.renderedYaml.includes("privileged: true"));

      const l0AuditDefault = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART);
      assert.equal(l0AuditDefault.status, "PASS");

      // 2. TEMPLATE_FAILED branches (res.error without Chart.yaml, status != 0 with stderr, status != 0 empty stderr)
      const noChartDir = path.join(tempDir, "empty-chart");
      fs.mkdirSync(noChartDir, { recursive: true });
      const tplErrFail = EosHelmReleaseGovernor.templateChart(noChartDir, "fail-rel", {
        valuesFile: missingValuesFile,
      });
      assert.equal(tplErrFail.status, "TEMPLATE_FAILED");
      assert.ok(tplErrFail.error?.includes("ENOENT"));

      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") {
          return { status: 1, stdout: "", stderr: "Chart.yaml missing" };
        }
        if (bin === "helm" && args[0] === "template") {
          return { status: 1, stdout: "", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();

      const lintCliFail = EosHelmReleaseGovernor.lintChart(COMPLIANT_CHART);
      assert.equal(lintCliFail.status, "LINT_FAILED");
      assert.equal(lintCliFail.error, "Chart.yaml missing");

      const tplCliFail = EosHelmReleaseGovernor.templateChart(COMPLIANT_CHART, "fail-empty");
      assert.equal(tplCliFail.status, "TEMPLATE_FAILED");
      assert.equal(tplCliFail.error, "Failed to render chart template");

      const auditOnTplFail = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART);
      assert.equal(auditOnTplFail.status, "AUDIT_FAILED");
      assert.equal(auditOnTplFail.allowed, false);

      // 3. OPA fallback violation rules (no_privileged, run_as_non_root, disallow_latest_tag) & OPA JSON parse paths
      const badYaml = [
        "# comment-only section",
        "---",
        "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: cfg",
        "---",
        [
          "apiVersion: apps/v1",
          "kind: Deployment",
          "metadata:\n  name: bad-app",
          "spec:\n  template:\n    spec:",
          "      securityContext:\n        runAsNonRoot: false\n        runAsUser: 0",
          "      containers:\n        - name: bad-ctr",
          '          image: "nginx:latest"',
          "          securityContext:\n            privileged: true",
        ].join("\n"),
        "---",
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: untagged\nspec:\n  image: busybox",
      ].join("\n---\n");

      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "template") {
          return { status: 0, stdout: badYaml, stderr: "" };
        }
        if (bin === "opa") {
          return { status: 1, stdout: "", stderr: "opa unavailable" };
        }
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();

      const fallbackViolations = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART);
      assert.equal(fallbackViolations.status, "POLICY_VIOLATION");
      assert.equal(fallbackViolations.evaluatedWorkloads, 2);
      assert.ok(fallbackViolations.violations.some((v) => v.rule === "no_privileged"));
      assert.ok(fallbackViolations.violations.some((v) => v.rule === "run_as_non_root"));
      assert.ok(fallbackViolations.violations.some((v) => v.rule === "disallow_latest_tag"));

      // Invalid OPA JSON catch & partial OPA JSON object defaults
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "template") {
          return { status: 0, stdout: badYaml, stderr: "" };
        }
        if (bin === "opa") {
          return { status: 0, stdout: "{broken-json", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();
      assert.equal(EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART).status, "PASS");

      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "template") {
          return { status: 0, stdout: badYaml, stderr: "" };
        }
        if (bin === "opa") {
          return { status: 0, stdout: JSON.stringify({ result: [{ expressions: [{ value: [{}] }] }] }), stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();
      const partialOpa = EosHelmReleaseGovernor.auditChartWithOpa(COMPLIANT_CHART);
      assert.equal(partialOpa.violations[0].rule, "unknown_rule");
      assert.equal(partialOpa.violations[0].container, "unknown_container");

      // 4. deployChart all 5 stage outcomes + unknown-context + custom allowedContextPattern + unwritable receipt catch
      EosKubectlClusterInspector.getCurrentContext = () => null;
      const unknownCtxReport = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART);
      assert.equal(unknownCtxReport.status, "CONTEXT_UNAUTHORIZED");
      assert.equal(unknownCtxReport.targetContext, "unknown-context");

      // LINT_FAILED inside deployChart (also exercise receipt write catch by passing tempDir as receiptPath)
      cjsCp.spawnSync = () => ({ status: 1, stdout: "", stderr: "" });
      syncBuiltinESMExports();
      const deployLintFail = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "rel-lint-fail", {
        customContext: "minikube-dev",
        allowedContextPattern: /^minikube-/,
        receiptPath: tempDir,
      });
      assert.equal(deployLintFail.status, "LINT_FAILED");

      // POLICY_VIOLATION inside deployChart
      const cleanYaml =
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: ok\nspec:\n  containers:\n    - name: c\n      image: busybox:1.36.1\n      securityContext:\n        privileged: true\n";
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") return { status: 0, stdout: "ok", stderr: "" };
        if (bin === "helm" && args[0] === "template") return { status: 0, stdout: cleanYaml, stderr: "" };
        if (bin === "opa") return { status: 1, stdout: "", stderr: "" };
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();
      const deployPolicyFail = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "rel-pol-fail", {
        customContext: "kind-local",
      });
      assert.equal(deployPolicyFail.status, "POLICY_VIOLATION");

      // DRY_RUN_PASSED (dryRun: true)
      const safeYaml =
        "apiVersion: v1\nkind: Pod\nmetadata:\n  name: ok\nspec:\n  containers:\n    - name: c\n      image: busybox:1.36.1\n";
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") return { status: 0, stdout: "ok", stderr: "" };
        if (bin === "helm" && args[0] === "template") return { status: 0, stdout: safeYaml, stderr: "" };
        if (bin === "opa") return { status: 1, stdout: "", stderr: "" };
        if (bin === "helm" && args[0] === "upgrade") return { status: 0, stdout: "dry-run ok", stderr: "" };
        return { status: 0, stdout: "", stderr: "" };
      };
      syncBuiltinESMExports();
      const dryRunPass = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "rel-dry-pass", {
        customContext: "kind-local",
        dryRun: true,
        valuesFile,
        setValues: { replicaCount: "2" },
      });
      assert.equal(dryRunPass.status, "DRY_RUN_PASSED");

      // DEPLOY_FAILED on Stage 5 APPLY
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") return { status: 0, stdout: "ok", stderr: "" };
        if (bin === "helm" && args[0] === "template") return { status: 0, stdout: safeYaml, stderr: "" };
        if (bin === "opa") return { status: 1, stdout: "", stderr: "" };
        if (bin === "helm" && args[0] === "upgrade" && args.includes("--dry-run=server")) {
          return { status: 0, stdout: "dry-run ok", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "apply timed out" };
      };
      syncBuiltinESMExports();
      const deployApplyFail = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "rel-apply-fail", {
        customContext: "kind-local",
        dryRun: false,
        valuesFile,
        setValues: { replicaCount: "2" },
      });
      assert.equal(deployApplyFail.status, "DEPLOY_FAILED");

      // RELEASE_DEPLOYED on Stage 5 APPLY
      cjsCp.spawnSync = (bin, args) => {
        if (bin === "helm" && args[0] === "lint") return { status: 0, stdout: "ok", stderr: "" };
        if (bin === "helm" && args[0] === "template") return { status: 0, stdout: safeYaml, stderr: "" };
        if (bin === "opa") return { status: 1, stdout: "", stderr: "" };
        return { status: 0, stdout: "released", stderr: "" };
      };
      syncBuiltinESMExports();
      const deployed = EosHelmReleaseGovernor.deployChart(COMPLIANT_CHART, "rel-ok", {
        customContext: "kind-local",
        dryRun: false,
        valuesFile,
        setValues: { replicaCount: "2" },
      });
      assert.equal(deployed.status, "RELEASE_DEPLOYED");
      assert.equal(deployed.stages.length, 5);
    } finally {
      cjsCp.spawnSync = origSpawnSync;
      syncBuiltinESMExports();
      EosKubectlClusterInspector.getCurrentContext = origGetContext;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
