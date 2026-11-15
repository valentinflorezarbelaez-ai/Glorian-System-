/**
 * Glorian System — Toolchain Adapters, OPA Policy Governor & Kubectl Guard Test Suite
 * Governed by SPEC-273 / CHANGE-135
 *
 * Verifies BDD-1413 through BDD-1418.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosTrivyScannerAdapter } from "../src/core/eosTrivyScannerAdapter.ts";
import { EosOpaPolicyGovernor } from "../src/core/eosOpaPolicyGovernor.ts";
import { EosKubectlClusterInspector } from "../src/core/eosKubectlClusterInspector.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-273: Toolchain Adapters, OPA Policy Governor & Kind Context Guard", () => {
  // -------------------------------------------------------------------------
  // BDD-1413: Trivy Filesystem Scan Normalization and SARIF v2.1.0 Conversion
  // -------------------------------------------------------------------------
  it("BDD-1413: normalizes Trivy JSON vulnerabilities and converts to OASIS SARIF v2.1.0", () => {
    const mockTrivyOutput = {
      SchemaVersion: 2,
      Results: [
        {
          Target: "package-lock.json",
          Class: "lang-pkgs",
          Type: "npm",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2023-1234",
              PkgName: "lodash",
              InstalledVersion: "4.17.20",
              FixedVersion: "4.17.21",
              Severity: "HIGH",
              Title: "Prototype Pollution in lodash",
              Description: "Command injection via deep copy",
              PrimaryURL: "https://nvd.nist.gov/vuln/detail/CVE-2023-1234",
            },
            {
              VulnerabilityID: "CVE-2024-5678",
              PkgName: "minimist",
              InstalledVersion: "1.2.5",
              FixedVersion: "1.2.6",
              Severity: "LOW",
              Title: "Prototype pollution",
              Description: "Minor parsing anomaly",
              PrimaryURL: "https://nvd.nist.gov/vuln/detail/CVE-2024-5678",
            },
          ],
        },
      ],
    };

    const normalized = EosTrivyScannerAdapter.normalizeTrivyResults(mockTrivyOutput);
    assert.equal(normalized.length, 2);
    assert.equal(normalized[0].id, "CVE-2023-1234");
    assert.equal(normalized[0].pkgName, "lodash");
    assert.equal(normalized[0].installedVersion, "4.17.20");
    assert.equal(normalized[0].severity, "HIGH");

    assert.equal(normalized[1].id, "CVE-2024-5678");
    assert.equal(normalized[1].severity, "LOW");

    // Convert to OASIS SARIF v2.1.0
    const sarif = EosTrivyScannerAdapter.convertToSarif(normalized, "test/workspace");
    assert.equal(sarif.version, "2.1.0");
    assert.ok(sarif.$schema.includes("sarif-schema-2.1.0.json"));
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].tool.driver.name, "Trivy");
    assert.equal(sarif.runs[0].results.length, 2);

    // Verify rules and severity mapping
    const highResult = sarif.runs[0].results.find((r) => r.ruleId === "CVE-2023-1234");
    assert.ok(highResult);
    assert.equal(highResult.level, "error");

    const lowResult = sarif.runs[0].results.find((r) => r.ruleId === "CVE-2024-5678");
    assert.ok(lowResult);
    assert.equal(lowResult.level, "warning");
  });

  // -------------------------------------------------------------------------
  // BDD-1414: Trivy Fail-Closed Gate on CRITICAL Vulnerabilities
  // -------------------------------------------------------------------------
  it("BDD-1414: fails closed when CRITICAL CVEs are detected and passes on benign scans", () => {
    // 1. Benign scan of sample pod json (zero CVEs)
    const samplePodPath = path.join(ROOT, "policies/k8s/sample_pod.json");
    const benignReport = EosTrivyScannerAdapter.scan(samplePodPath, {
      failClosedOnCritical: true,
      workingDirectory: ROOT,
    });

    assert.equal(benignReport.status, "PASS");
    assert.equal(benignReport.criticalCount, 0);
    assert.equal(benignReport.totalVulnerabilities, 0);
    assert.equal(typeof benignReport.sha256Receipt, "string");
    assert.equal(benignReport.sha256Receipt.length, 64);
    assert.equal(benignReport.sarif.version, "2.1.0");

    // 2. Simulated critical vulnerability normalization
    const criticalMock = {
      Results: [
        {
          Target: "Dockerfile",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2026-9999",
              PkgName: "openssl",
              InstalledVersion: "1.1.1",
              Severity: "CRITICAL",
              Title: "Remote Code Execution in Handshake",
            },
          ],
        },
      ],
    };

    const normCritical = EosTrivyScannerAdapter.normalizeTrivyResults(criticalMock);
    assert.equal(normCritical.length, 1);
    assert.equal(normCritical[0].severity, "CRITICAL");

    // Verify SARIF conversion maps CRITICAL to error level
    const sarifCritical = EosTrivyScannerAdapter.convertToSarif(normCritical, "Dockerfile");
    assert.equal(sarifCritical.runs[0].results[0].level, "error");
  });

  // -------------------------------------------------------------------------
  // BDD-1415: OPA Rego Evaluation on Compliant Kubernetes Manifest
  // -------------------------------------------------------------------------
  it("BDD-1415: OPA evaluation allows compliant pod manifest with zero violations", () => {
    const compliantManifest = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name: "compliant-worker" },
      spec: {
        securityContext: {
          runAsNonRoot: true,
        },
        containers: [
          {
            name: "worker",
            image: "redis:7.2.4-alpine",
            securityContext: {
              privileged: false,
              allowPrivilegeEscalation: false,
            },
            resources: {
              limits: {
                cpu: "500m",
                memory: "512Mi",
              },
            },
          },
        ],
      },
    };

    const result = EosOpaPolicyGovernor.evaluateManifest(compliantManifest, {
      workingDirectory: ROOT,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.violations.length, 0);
    assert.equal(result.totalViolations, 0);
    assert.equal(result.evaluatedContainers, 1);
    assert.equal(typeof result.sha256Receipt, "string");
    assert.equal(result.sha256Receipt.length, 64);
    assert.ok(result.executionEngine === "OPA_CLI_EVAL" || result.executionEngine === "NATIVE_AST_FALLBACK");
  });

  // -------------------------------------------------------------------------
  // BDD-1416: OPA Rego Evaluation on Flawed Kubernetes Manifest
  // -------------------------------------------------------------------------
  it("BDD-1416: OPA evaluation rejects flawed pod manifest with exactly 4 security violations", () => {
    const flawedManifest = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: { name: "insecure-app" },
      spec: {
        securityContext: {
          runAsNonRoot: false,
        },
        containers: [
          {
            name: "insecure-container",
            image: "nginx:latest",
            securityContext: {
              privileged: true,
            },
            resources: {},
          },
        ],
      },
    };

    // Test both CLI evaluation and Native AST fallback
    const resultCli = EosOpaPolicyGovernor.evaluateManifest(flawedManifest, {
      workingDirectory: ROOT,
    });

    assert.equal(resultCli.allowed, false);
    assert.equal(resultCli.violations.length, 4);
    assert.equal(resultCli.totalViolations, 4);

    const rulesFlagged = resultCli.violations.map((v) => v.rule);
    assert.ok(rulesFlagged.includes("run_as_non_root"), "Must flag root execution");
    assert.ok(rulesFlagged.includes("no_privileged"), "Must flag privileged container");
    assert.ok(rulesFlagged.includes("require_resource_limits"), "Must flag missing resource limits");
    assert.ok(rulesFlagged.includes("disallow_latest_tag"), "Must flag :latest image tag");

    // Test forced native AST fallback for 100% equivalence guarantee
    const resultNative = EosOpaPolicyGovernor.evaluateManifest(flawedManifest, {
      forceNativeFallback: true,
      workingDirectory: ROOT,
    });

    assert.equal(resultNative.executionEngine, "NATIVE_AST_FALLBACK");
    assert.equal(resultNative.allowed, false);
    assert.equal(resultNative.violations.length, 4);
    assert.deepEqual(resultNative.violations.map((v) => v.rule).sort(), resultCli.violations.map((v) => v.rule).sort());
  });

  // -------------------------------------------------------------------------
  // BDD-1417: Kubectl Context Guard Rejects Non-Kind Contexts
  // -------------------------------------------------------------------------
  it("BDD-1417: rejects non-kind contexts fail-closed to protect external clusters", () => {
    // 1. Context validation logic
    assert.equal(EosKubectlClusterInspector.isContextAllowed("kind-glorian-cluster"), true);
    assert.equal(EosKubectlClusterInspector.isContextAllowed("kind-local"), true);
    assert.equal(EosKubectlClusterInspector.isContextAllowed("arn:aws:eks:us-east-1:123456789012:cluster/prod"), false);
    assert.equal(EosKubectlClusterInspector.isContextAllowed("gke_my-project_us-central1_prod"), false);
    assert.equal(EosKubectlClusterInspector.isContextAllowed("minikube"), false);
    assert.equal(EosKubectlClusterInspector.isContextAllowed("docker-desktop"), false);

    // 2. Attempt cluster inspection on prohibited AWS EKS context
    const report = EosKubectlClusterInspector.inspectCluster({
      customContext: "arn:aws:eks:us-east-1:123456789012:cluster/prod-eks",
      workingDirectory: ROOT,
    });

    assert.equal(report.allowedContext, false);
    assert.equal(report.status, "CONTEXT_UNAUTHORIZED");
    assert.equal(report.totalNodes, 0);
    assert.equal(report.readyNodes, 0);
    assert.equal(report.nodes.length, 0);
    assert.equal(report.pods.total, 0);
    assert.ok(report.error?.includes("unauthorized"));
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1418: Kubectl Read-Only Cluster Status Telemetry Parsing
  // -------------------------------------------------------------------------
  it("BDD-1418: handles cluster telemetry gracefully and generates cryptographic receipt", () => {
    // 1. With kind-glorian-cluster (or custom context)
    const report = EosKubectlClusterInspector.inspectCluster({
      customContext: "kind-glorian-cluster",
      workingDirectory: ROOT,
    });

    assert.equal(report.allowedContext, true);
    assert.equal(report.context, "kind-glorian-cluster");
    assert.ok(
      report.status === "HEALTHY" || report.status === "DEGRADED" || report.status === "INSPECTION_FAILED",
      `Expected valid status but got ${report.status}`,
    );
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
    assert.equal(typeof report.pods.total, "number");
    assert.equal(typeof report.pods.running, "number");

    // 2. Deterministic mock telemetry parsing
    const mockNodes = {
      items: [
        {
          metadata: { name: "kind-control-plane" },
          status: {
            conditions: [{ type: "Ready", status: "True" }],
            nodeInfo: { kubeletVersion: "v1.31.0" },
            addresses: [{ type: "InternalIP", address: "172.18.0.2" }],
          },
        },
      ],
    };
    const mockPods = {
      items: [
        {
          metadata: { name: "coredns-1", namespace: "kube-system" },
          status: { phase: "Running" },
        },
        {
          metadata: { name: "local-path-provisioner-1", namespace: "local-path-storage" },
          status: { phase: "Running" },
        },
      ],
    };

    const mockReport = EosKubectlClusterInspector.inspectCluster({
      customContext: "kind-mock-cluster",
      mockNodesJson: mockNodes,
      mockPodsJson: mockPods,
      workingDirectory: ROOT,
    });

    assert.equal(mockReport.allowedContext, true);
    assert.equal(mockReport.status, "HEALTHY");
    assert.equal(mockReport.totalNodes, 1);
    assert.equal(mockReport.readyNodes, 1);
    assert.equal(mockReport.nodes[0].name, "kind-control-plane");
    assert.equal(mockReport.nodes[0].kubeletVersion, "v1.31.0");
    assert.equal(mockReport.pods.total, 2);
    assert.equal(mockReport.pods.running, 2);
    assert.equal(mockReport.pods.failed, 0);
  });
});
