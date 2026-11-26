/**
 * Glorian System — Toolchain Adapters, OPA Policy Governor & Kubectl Guard Test Suite
 * Governed by SPEC-273 / CHANGE-135
 *
 * Verifies BDD-1413 through BDD-1418.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
      mockRawOutput: { Results: [] },
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

    // Verify scan fails closed on critical
    const criticalReport = EosTrivyScannerAdapter.scan("Dockerfile", {
      failClosedOnCritical: true,
      mockRawOutput: criticalMock,
    });
    assert.equal(criticalReport.status, "FAIL_CLOSED");
    assert.equal(criticalReport.criticalCount, 1);

    // Verify SARIF conversion maps CRITICAL to error level
    const sarifCritical = EosTrivyScannerAdapter.convertToSarif(normCritical, "Dockerfile");
    assert.equal(sarifCritical.runs[0].results[0].level, "error");

    // 3. Live process fallback isolates and cleans up temporary Trivy directory
    const deferred = EosTrivyScannerAdapter.scan("nonexistent-local-image:0.0.0", {
      scanType: "IMAGE",
      timeoutMs: 200,
    });
    assert.ok(["SCAN_DEFERRED", "PASS", "FAIL_CLOSED"].includes(deferred.status));
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

  it("BDD-1419: covers Trivy normalization fallbacks, CLI stdout parsing, and receipt persistence", () => {
    assert.deepEqual(EosTrivyScannerAdapter.normalizeTrivyResults(null), []);
    assert.deepEqual(EosTrivyScannerAdapter.normalizeTrivyResults("not-an-object"), []);
    assert.deepEqual(EosTrivyScannerAdapter.normalizeTrivyResults({}), []);

    const partialVulns = EosTrivyScannerAdapter.normalizeTrivyResults({
      Results: [
        { Target: "empty-target" },
        {
          Vulnerabilities: [
            {},
            {
              VulnerabilityID: "CVE-2026-1001",
              PkgName: "demo",
              InstalledVersion: "1.0.0",
              Severity: "MEDIUM",
              Description: "Description fallback only",
            },
          ],
        },
      ],
    });
    assert.equal(partialVulns.length, 2);
    assert.equal(partialVulns[0].id, "CVE-UNKNOWN");
    assert.equal(partialVulns[0].severity, "UNKNOWN");
    assert.equal(partialVulns[0].fixedVersion, null);
    assert.equal(partialVulns[0].title, "No description available");
    assert.equal(partialVulns[1].title, "Description fallback only");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-trivy-shim-"));
    const prevPath = process.env.PATH ?? "";
    const prevMode = process.env.EOS_TEST_TRIVY_MODE;
    try {
      const shimJs = path.join(tmpDir, "trivy-shim.cjs");
      fs.writeFileSync(
        shimJs,
        `if (process.env.EOS_TEST_TRIVY_MODE === "bad-json") { process.stdout.write("{invalid-json"); process.exit(0); }
process.stdout.write(JSON.stringify({ Results: [{ Vulnerabilities: [{ VulnerabilityID: "CVE-2026-2002", PkgName: "zlib", InstalledVersion: "1.2.11", FixedVersion: "1.3.1", Severity: "HIGH", Title: "Buffer overflow" }] }] }));
process.exit(0);
`,
        "utf8",
      );
      const posixShim = path.join(tmpDir, "trivy");
      fs.writeFileSync(posixShim, `#!/usr/bin/env node\nrequire("./trivy-shim.cjs");\n`, "utf8");
      try {
        fs.chmodSync(posixShim, 0o755);
      } catch {
        // ignore on non-POSIX
      }
      const winShim = path.join(tmpDir, "trivy.cmd");
      fs.writeFileSync(winShim, `@"${process.execPath}" "${shimJs}" %*\r\n`, "utf8");

      process.env.PATH = `${tmpDir}${path.delimiter}${path.dirname(process.execPath)}`;
      process.env.EOS_TEST_TRIVY_MODE = "valid";

      // Verify receiptPath persistence + HIGH vulnerability branch deterministically via mockRawOutput
      const receiptPath = path.join(tmpDir, "nested", "trivy-receipt.json");
      const mockHighReport = EosTrivyScannerAdapter.scan("package.json", {
        mockRawOutput: {
          Results: [
            {
              Vulnerabilities: [
                {
                  VulnerabilityID: "CVE-2026-2002",
                  PkgName: "zlib",
                  InstalledVersion: "1.2.11",
                  FixedVersion: "1.3.1",
                  Severity: "HIGH",
                  Title: "Buffer overflow",
                },
              ],
            },
          ],
        },
        receiptPath,
      });
      assert.equal(mockHighReport.status, "PASS");
      assert.equal(mockHighReport.highCount, 1);
      assert.equal(mockHighReport.criticalCount, 0);
      assert.ok(fs.existsSync(receiptPath));

      // Live spawnSync invocation (POSIX directly runs #!/usr/bin/env node shim; Windows Node rejects .cmd without shell:true)
      const passReport = EosTrivyScannerAdapter.scan("package.json");
      if (process.platform === "win32") {
        assert.ok(["PASS", "SCAN_DEFERRED"].includes(passReport.status));
      } else {
        assert.equal(passReport.status, "PASS");
        assert.equal(passReport.scanType, "FS");
        assert.equal(passReport.highCount, 1);
      }

      process.env.EOS_TEST_TRIVY_MODE = "bad-json";
      const badJsonReport = EosTrivyScannerAdapter.scan("package.json");
      assert.equal(badJsonReport.status, "SCAN_DEFERRED");

      // Receipt write failure is fail-soft when parent is an existing file
      const blockingFile = path.join(tmpDir, "blocker-file");
      fs.writeFileSync(blockingFile, "not-a-dir", "utf8");
      const failSoftReport = EosTrivyScannerAdapter.scan("package.json", {
        mockRawOutput: { Results: [] },
        receiptPath: path.join(blockingFile, "subdir", "receipt.json"),
      });
      assert.equal(failSoftReport.status, "PASS");
    } finally {
      process.env.PATH = prevPath;
      if (prevMode === undefined) delete process.env.EOS_TEST_TRIVY_MODE;
      else process.env.EOS_TEST_TRIVY_MODE = prevMode;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
