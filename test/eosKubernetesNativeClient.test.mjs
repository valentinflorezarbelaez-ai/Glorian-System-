/**
 * BDD-1503..BDD-1508: Pure REST Kubernetes Client via Native node:https Test Suite
 *
 * Validates in-cluster credential discovery, custom CA certificate trust,
 * Pod query and namespace isolation, ephemeral batch Job orchestration,
 * deterministic air-gapped simulation mode, resource deletion, and
 * cryptographic audit receipts.
 *
 * Conforms to SPEC-288 / CHANGE-150 and Law V.
 */

import * as assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
import { EosKubernetesNativeClient } from "../src/core/eosKubernetesNativeClient.ts";

test("BDD-1503: In-Cluster Credential Resolution and CA Certificate Loading", () => {
  const customToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3QifQ.sim-token";
  const customCa = "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAP...==\n-----END CERTIFICATE-----";
  const customEndpoint = "https://k8s-cluster.internal:6443";

  const client = new EosKubernetesNativeClient({
    endpoint: customEndpoint,
    token: customToken,
    caCert: customCa,
    defaultNamespace: "custom-system",
    simulationMode: true,
  });

  const creds = client.getCredentials();
  assert.equal(creds.endpoint, customEndpoint);
  assert.equal(creds.token, customToken);
  assert.equal(creds.caCert, customCa);
  assert.equal(creds.namespace, "custom-system");
  assert.equal(creds.simulationMode, true);
});

test("BDD-1504: Pod List Query with Namespace Isolation", async () => {
  const client = new EosKubernetesNativeClient({ simulationMode: true });

  const defaultPods = await client.listPods("default");
  assert.ok(defaultPods.items.length >= 1);
  assert.ok(defaultPods.items.every((p) => p.metadata.namespace === "default"));
  const defaultAgentPod = defaultPods.items.find((p) => p.metadata.name === "glorian-agent-worker-1");
  assert.ok(defaultAgentPod);
  assert.equal(defaultAgentPod.status?.phase, "Running");

  const kubeSystemPods = await client.listPods("kube-system");
  assert.ok(kubeSystemPods.items.length >= 1);
  assert.ok(kubeSystemPods.items.every((p) => p.metadata.namespace === "kube-system"));
  const dnsPod = kubeSystemPods.items.find((p) => p.metadata.name.startsWith("coredns-"));
  assert.ok(dnsPod);
  assert.equal(dnsPod.status?.phase, "Running");
});

test("BDD-1505: Ephemeral Batch Job Creation and Status Polling", async () => {
  const client = new EosKubernetesNativeClient({ simulationMode: true });

  const jobManifest = {
    metadata: {
      name: "agent-eval-verification-job",
      labels: {
        "glorian.io/workload": "eval",
      },
    },
    spec: {
      template: {
        spec: {
          containers: [
            {
              name: "evaluator",
              image: "node:22-alpine",
              command: ["node", "-e", "process.exit(0)"],
            },
          ],
        },
      },
      backoffLimit: 2,
    },
  };

  const created = await client.createJob("default", jobManifest);
  assert.equal(created.metadata.name, "agent-eval-verification-job");
  assert.equal(created.metadata.namespace, "default");
  assert.equal(created.status?.active, 1);

  // Poll status: should transition to Succeeded in simulation mode
  const polled = await client.getJobStatus("agent-eval-verification-job", "default");
  assert.ok(polled);
  assert.equal(polled.status?.active, 0);
  assert.equal(polled.status?.succeeded, 1);
  assert.ok(polled.status?.completionTime);
});

test("BDD-1506: Deterministic Simulation Mode in Offline / Air-Gapped Environments", async () => {
  const client = new EosKubernetesNativeClient({ simulationMode: true });

  // No network calls should be executed; all in-memory operations succeed
  const pods = await client.listPods("default");
  assert.equal(pods.apiVersion, "v1");
  assert.equal(pods.kind, "PodList");

  const singlePod = await client.getPod("glorian-agent-worker-1", "default");
  assert.ok(singlePod);
  assert.equal(singlePod.kind, "Pod");
  assert.equal(singlePod.status?.phase, "Running");

  const nonExistent = await client.getPod("non-existent-pod-xyz", "default");
  assert.equal(nonExistent, null);
});

test("BDD-1507: Resource Deletion and Cleanup", async () => {
  const client = new EosKubernetesNativeClient({ simulationMode: true });

  // Create a transient job and verify deletion
  const transientJob = await client.createJob("default", {
    metadata: { name: "transient-worker-job" },
  });
  assert.ok(transientJob);

  const beforeDelete = await client.getJobStatus("transient-worker-job", "default");
  assert.ok(beforeDelete);

  const deleted = await client.deleteJob("transient-worker-job", "default");
  assert.equal(deleted, true);

  const afterDelete = await client.getJobStatus("transient-worker-job", "default");
  assert.equal(afterDelete, null);

  // Delete a pod
  const podDeleted = await client.deletePod("glorian-agent-worker-1", "default");
  assert.equal(podDeleted, true);
  const afterPodDelete = await client.getPod("glorian-agent-worker-1", "default");
  assert.equal(afterPodDelete, null);
});

test("BDD-1508: Cryptographic Audit Receipt Verification", async () => {
  const client = new EosKubernetesNativeClient({ simulationMode: true });

  const receipt = await client.auditCluster();
  assert.ok(receipt.timestampIso);
  assert.ok(receipt.clusterEndpoint);
  assert.equal(typeof receipt.inClusterAuth, "boolean");
  assert.equal(receipt.simulationMode, true);
  assert.ok(receipt.totalPods >= 1);
  assert.equal(typeof receipt.activeJobs, "number");
  assert.equal(receipt.sha256Signature.length, 64);

  // Validate on-disk receipt
  const receiptPath = resolveEvidencePath("K8S_NATIVE_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath));
  const diskReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8"));

  assert.equal(diskReceipt.sha256Signature, receipt.sha256Signature);

  // Validate SHA-256 calculation
  const payload = {
    timestampIso: diskReceipt.timestampIso,
    clusterEndpoint: diskReceipt.clusterEndpoint,
    inClusterAuth: diskReceipt.inClusterAuth,
    simulationMode: diskReceipt.simulationMode,
    defaultNamespace: diskReceipt.defaultNamespace,
    totalPods: diskReceipt.totalPods,
    activeJobs: diskReceipt.activeJobs,
  };
  const expectedHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  assert.equal(diskReceipt.sha256Signature, expectedHash);
});

test("covers file/env credential discovery, simulation edge defaults, and live node:https REST mode", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-k8s-test-"));
  const tokenFile = path.join(tempDir, "token");
  const caFile = path.join(tempDir, "ca.crt");
  const nsFile = path.join(tempDir, "namespace");
  fs.writeFileSync(tokenFile, "file-token-123\n", "utf8");
  fs.writeFileSync(caFile, "FILE-CA-CERT", "utf8");
  fs.writeFileSync(nsFile, "file-namespace\n", "utf8");

  const savedEnv = {
    KUBERNETES_TOKEN: process.env.KUBERNETES_TOKEN,
    KUBERNETES_CA_CERT: process.env.KUBERNETES_CA_CERT,
    KUBERNETES_NAMESPACE: process.env.KUBERNETES_NAMESPACE,
    KUBERNETES_SERVICE_HOST: process.env.KUBERNETES_SERVICE_HOST,
    KUBERNETES_SERVICE_PORT: process.env.KUBERNETES_SERVICE_PORT,
  };

  const req = createRequire(import.meta.url);
  const cjsHttps = req("node:https");
  const origHttpsRequest = cjsHttps.request;

  try {
    // 1. File-based credential discovery & default simulationMode=false when token is present
    const fileClient = new EosKubernetesNativeClient({
      tokenPath: tokenFile,
      caPath: caFile,
      namespacePath: nsFile,
      insecureSkipTlsVerify: true,
    });
    const fileCreds = fileClient.getCredentials();
    assert.equal(fileCreds.token, "file-token-123");
    assert.equal(fileCreds.caCert, "FILE-CA-CERT");
    assert.equal(fileCreds.namespace, "file-namespace");
    assert.equal(fileCreds.inClusterAuth, true);
    assert.equal(fileCreds.simulationMode, false);

    // 2. Unreadable file paths (directories cause readFileSync EISDIR catch) & default simulationMode=true
    const dirReadClient = new EosKubernetesNativeClient({
      tokenPath: tempDir,
      caPath: tempDir,
      namespacePath: tempDir,
    });
    const dirCreds = dirReadClient.getCredentials();
    assert.equal(dirCreds.token, null);
    assert.equal(dirCreds.caCert, null);
    assert.equal(dirCreds.namespace, "default");
    assert.equal(dirCreds.simulationMode, true);

    // 3. Env var credential discovery (with explicit port and default port 443)
    process.env.KUBERNETES_TOKEN = "env-token";
    process.env.KUBERNETES_CA_CERT = "ENV-CA";
    process.env.KUBERNETES_NAMESPACE = "env-ns";
    process.env.KUBERNETES_SERVICE_HOST = "10.96.0.1";
    process.env.KUBERNETES_SERVICE_PORT = "8443";
    const envClient = new EosKubernetesNativeClient({
      tokenPath: path.join(tempDir, "missing-token"),
      caPath: path.join(tempDir, "missing-ca"),
      namespacePath: path.join(tempDir, "missing-ns"),
      simulationMode: true,
    });
    assert.equal(envClient.getCredentials().endpoint, "https://10.96.0.1:8443");
    assert.equal(envClient.getCredentials().token, "env-token");
    assert.equal(envClient.getCredentials().caCert, "ENV-CA");
    assert.equal(envClient.getCredentials().namespace, "env-ns");

    delete process.env.KUBERNETES_SERVICE_PORT;
    const defaultPortClient = new EosKubernetesNativeClient({ simulationMode: true });
    assert.equal(defaultPortClient.getCredentials().endpoint, "https://10.96.0.1:443");

    delete process.env.KUBERNETES_TOKEN;
    delete process.env.KUBERNETES_CA_CERT;
    delete process.env.KUBERNETES_NAMESPACE;
    delete process.env.KUBERNETES_SERVICE_HOST;

    // 4. Simulation mode edge cases: omitted namespaces, nameless job, active vs completed job auditCluster
    const simClient = new EosKubernetesNativeClient({ simulationMode: true });
    const simList = await simClient.listPods();
    assert.ok(simList.items.length >= 1);
    assert.ok(await simClient.getPod("glorian-agent-worker-1"));
    const unnamedJob = await simClient.createJob("", {});
    assert.ok(unnamedJob.metadata.name.startsWith("glorian-job-"));
    assert.equal(unnamedJob.metadata.namespace, "default");
    const activeAudit = await simClient.auditCluster();
    assert.equal(activeAudit.activeJobs, 1);

    await simClient.getJobStatus(unnamedJob.metadata.name);
    await simClient.getJobStatus(unnamedJob.metadata.name); // already succeeded branch
    const completedAudit = await simClient.auditCluster();
    assert.equal(completedAudit.activeJobs, 0);
    assert.equal(await simClient.deleteJob(unnamedJob.metadata.name), true);
    assert.equal(await simClient.deletePod("glorian-agent-worker-1"), true);

    // 5. Live REST client branches via mocked https.request
    let nextResponder = () => ({ statusCode: 200, body: "{}" });
    cjsHttps.request = (_opts, onResponse) => {
      const reqEmitter = new EventEmitter();
      reqEmitter.write = () => {};
      reqEmitter.destroy = (err) => {
        queueMicrotask(() => reqEmitter.emit("error", err));
      };
      reqEmitter.end = () => {
        queueMicrotask(() => {
          const outcome = nextResponder(_opts);
          if (outcome.emitTimeout) {
            reqEmitter.emit("timeout");
            return;
          }
          if (outcome.emitError) {
            reqEmitter.emit("error", outcome.emitError);
            return;
          }
          const resEmitter = new EventEmitter();
          resEmitter.statusCode = outcome.statusCode;
          onResponse(resEmitter);
          if (outcome.body !== undefined) {
            resEmitter.emit("data", Buffer.from(outcome.body, "utf8"));
          }
          resEmitter.emit("end");
        });
      };
      return reqEmitter;
    };
    syncBuiltinESMExports();

    const liveClient = new EosKubernetesNativeClient({
      endpoint: "https://k8s-live.internal///",
      token: "live-bearer",
      simulationMode: false,
      timeoutMs: 250,
    });
    const liveNoToken = new EosKubernetesNativeClient({
      endpoint: "https://k8s-live.internal:6443",
      simulationMode: false,
    });

    // listPods success + HTTP 500 error
    nextResponder = () => ({
      statusCode: 200,
      body: JSON.stringify({ apiVersion: "v1", kind: "PodList", metadata: {}, items: [{ metadata: { name: "p1" } }] }),
    });
    const livePods = await liveClient.listPods();
    assert.equal(livePods.items.length, 1);

    nextResponder = () => ({ statusCode: 500, body: "server error" });
    await assert.rejects(() => liveClient.listPods("kube-system"), /HTTP 500/);

    // getPod: 200, 404, 500, error("404"), non-404 non-Error rejection
    nextResponder = () => ({ statusCode: 200, body: JSON.stringify({ kind: "Pod", metadata: { name: "p1" } }) });
    assert.equal((await liveNoToken.getPod("p1"))?.metadata.name, "p1");
    nextResponder = () => ({ statusCode: 404, body: "" });
    assert.equal(await liveClient.getPod("missing"), null);
    nextResponder = () => ({ statusCode: 503, body: "" });
    await assert.rejects(() => liveClient.getPod("err"), /HTTP 503/);
    nextResponder = () => ({ emitError: new Error("upstream 404 not found") });
    assert.equal(await liveClient.getPod("err404"), null);
    nextResponder = () => ({ emitError: "raw-socket-failure" });
    await assert.rejects(
      () => liveClient.getPod("rawerr"),
      (err) => err === "raw-socket-failure",
    );

    // deletePod: 200, 202, 404
    nextResponder = () => ({ statusCode: 202, body: "" });
    assert.equal(await liveClient.deletePod("p1"), true);
    nextResponder = () => ({ statusCode: 404, body: "" });
    assert.equal(await liveClient.deletePod("p1"), false);

    // createJob: 201 and 403
    nextResponder = () => ({ statusCode: 201, body: JSON.stringify({ kind: "Job", metadata: { name: "j1" } }) });
    const liveJob = await liveClient.createJob("batch-ns", { metadata: { name: "j1" } });
    assert.equal(liveJob.metadata.name, "j1");
    nextResponder = () => ({ statusCode: 403, body: "" });
    await assert.rejects(() => liveClient.createJob("batch-ns", { metadata: { name: "j1" } }), /HTTP 403/);

    // getJobStatus: 200, 404, 500, error("404"), timeout error
    nextResponder = () => ({ statusCode: 200, body: JSON.stringify({ kind: "Job", metadata: { name: "j1" } }) });
    assert.equal((await liveClient.getJobStatus("j1"))?.metadata.name, "j1");
    nextResponder = () => ({ statusCode: 404, body: "" });
    assert.equal(await liveClient.getJobStatus("j1"), null);
    nextResponder = () => ({ statusCode: undefined, body: "not-json" });
    await assert.rejects(() => liveClient.getJobStatus("j1"), /HTTP 500/);
    nextResponder = () => ({ emitError: new Error("404 gone") });
    assert.equal(await liveClient.getJobStatus("j1"), null);
    nextResponder = () => ({ emitTimeout: true });
    await assert.rejects(() => liveClient.getJobStatus("j1"), /timeout after 250ms/);

    // deleteJob: 200, 404
    nextResponder = () => ({ statusCode: 200, body: "{}" });
    assert.equal(await liveClient.deleteJob("j1"), true);
    nextResponder = () => ({ statusCode: 404, body: "{}" });
    assert.equal(await liveClient.deleteJob("j1"), false);

    // auditCluster in live mode: listPods succeeds and listPods fails
    nextResponder = () => ({
      statusCode: 200,
      body: JSON.stringify({ apiVersion: "v1", kind: "PodList", metadata: {}, items: [{}, {}] }),
    });
    const liveAuditOk = await liveClient.auditCluster();
    assert.equal(liveAuditOk.totalPods, 2);

    nextResponder = () => ({ emitError: new Error("cluster unreachable") });
    const liveAuditErr = await liveClient.auditCluster();
    assert.equal(liveAuditErr.totalPods, 0);
  } finally {
    cjsHttps.request = origHttpsRequest;
    syncBuiltinESMExports();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
