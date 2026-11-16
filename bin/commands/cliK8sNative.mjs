/**
 * CLI Pure REST Kubernetes Client Command Handlers
 *
 * Implements toolchain:k8s:* subcommands for cluster auditing,
 * pod inspection, and ephemeral batch Job orchestration.
 *
 * Conforms to SPEC-288 / CHANGE-150.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { EosKubernetesNativeClient } from "../../src/core/eosKubernetesNativeClient.ts";

const HANDLERS = {};

async function cmd_k8s_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const client = new EosKubernetesNativeClient();
  const receipt = await client.auditCluster();

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" ☸️   EOS PURE REST KUBERNETES CLIENT AUDIT (SPEC-288)          ");
  console.log("===============================================================");
  console.log(`  Cluster Endpoint    : ${receipt.clusterEndpoint}`);
  console.log(`  In-Cluster Auth     : ${receipt.inClusterAuth ? "ENABLED (ServiceAccount)" : "DISABLED"}`);
  console.log(`  Simulation Mode     : ${receipt.simulationMode ? "ACTIVE (Air-Gapped)" : "LIVE CLUSTER"}`);
  console.log(`  Default Namespace   : ${receipt.defaultNamespace}`);
  console.log(`  Total Pods Count    : ${receipt.totalPods}`);
  console.log(`  Active Jobs Count   : ${receipt.activeJobs}`);
  console.log(`  SHA-256 Receipt     : ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

async function cmd_k8s_pods(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const nsArg = args.find((a) => a.startsWith("--namespace=")) || args.find((a) => a.startsWith("--ns="));
  const namespace = nsArg ? nsArg.split("=")[1] : undefined;

  const client = new EosKubernetesNativeClient();
  const podList = await client.listPods(namespace);

  if (isJson) {
    console.log(JSON.stringify(podList, null, 2));
    return;
  }

  const targetNs = namespace || client.getCredentials().namespace;
  console.log("\n===============================================================");
  console.log(` ☸️   KUBERNETES PODS LIST [Namespace: ${targetNs}]             `);
  console.log("===============================================================");
  console.log(`  Total Pods Found    : ${podList.items.length}`);
  console.log("---------------------------------------------------------------");
  for (const pod of podList.items) {
    const name = pod.metadata.name;
    const phase = pod.status?.phase || "Unknown";
    const ip = pod.status?.podIP || "N/A";
    console.log(`  ● ${name.padEnd(35)} [${phase.padEnd(9)}] IP: ${ip}`);
  }
  console.log("===============================================================\n");
}

async function cmd_k8s_job(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const fileArg = args.find((a) => a.startsWith("--file=")) || args.find((a) => a.startsWith("--spec="));
  const nsArg = args.find((a) => a.startsWith("--namespace=")) || args.find((a) => a.startsWith("--ns="));
  const targetNs = nsArg ? nsArg.split("=")[1] : "default";

  let jobSpec;
  if (fileArg) {
    const filePath = path.resolve(process.cwd(), fileArg.split("=")[1]);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: Job specification file not found: ${filePath}`);
      process.exit(1);
    }
    jobSpec = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } else {
    const defaultTemplatePath = path.resolve(process.cwd(), "templates", "k8s", "sample-job-spec.json");
    if (fs.existsSync(defaultTemplatePath)) {
      jobSpec = JSON.parse(fs.readFileSync(defaultTemplatePath, "utf-8"));
    } else {
      jobSpec = {
        metadata: { name: `glorian-agent-job-${Date.now()}` },
        spec: { template: { spec: { containers: [{ name: "worker", image: "node:22-alpine" }] } } },
      };
    }
  }

  const client = new EosKubernetesNativeClient();
  const createdJob = await client.createJob(targetNs, jobSpec);
  const status = await client.getJobStatus(createdJob.metadata.name, targetNs);

  if (isJson) {
    console.log(JSON.stringify(status || createdJob, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🚀  EOS KUBERNETES EPHEMERAL BATCH JOB DISPATCH (SPEC-288)   ");
  console.log("===============================================================");
  console.log(`  Job Name            : ${createdJob.metadata.name}`);
  console.log(`  Namespace           : ${createdJob.metadata.namespace}`);
  console.log(`  Active Status       : ${status?.status?.active ?? 1}`);
  console.log(`  Succeeded Status    : ${status?.status?.succeeded ?? 0}`);
  console.log(`  Creation Timestamp  : ${createdJob.metadata.creationTimestamp}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:k8s:audit"] = cmd_k8s_audit;
HANDLERS["toolchain:k8s:pods"] = cmd_k8s_pods;
HANDLERS["toolchain:k8s:job"] = cmd_k8s_job;

export async function handleK8sNativeCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
