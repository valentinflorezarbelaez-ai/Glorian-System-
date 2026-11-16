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
import * as fs from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
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
  const receiptPath = path.resolve(process.cwd(), "docs", "evidence", "K8S_NATIVE_RECEIPT.json");
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
