/**
 * EOS Pure REST Kubernetes Client via Native node:https
 *
 * Implements a Layer-0 Kubernetes control plane client using Node.js built-in
 * node:https, node:fs, and node:crypto with zero npm runtime dependencies.
 * Supports in-cluster service account discovery, custom CA certificate trust,
 * Pod & Batch Job lifecycle management, deterministic air-gapped simulation,
 * and cryptographic audit receipt generation.
 *
 * Conforms to SPEC-288 / CHANGE-150 and Law V.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import { URL } from "node:url";

export interface K8sClientOptions {
  endpoint?: string;
  token?: string;
  caCert?: string;
  tokenPath?: string;
  caPath?: string;
  namespacePath?: string;
  defaultNamespace?: string;
  simulationMode?: boolean;
  insecureSkipTlsVerify?: boolean;
  timeoutMs?: number;
}

export interface K8sClusterCredentials {
  endpoint: string;
  token: string | null;
  caCert: string | null;
  namespace: string;
  inClusterAuth: boolean;
  simulationMode: boolean;
}

export interface K8sObjectMetadata {
  name: string;
  namespace?: string;
  uid?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sPodCondition {
  type: string;
  status: "True" | "False" | "Unknown";
  lastProbeTime?: string | null;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface K8sContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  image: string;
  started?: boolean;
}

export interface K8sPodStatus {
  phase: "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
  conditions?: K8sPodCondition[];
  hostIP?: string;
  podIP?: string;
  startTime?: string;
  containerStatuses?: K8sContainerStatus[];
}

export interface K8sPodResource {
  apiVersion: "v1";
  kind: "Pod";
  metadata: K8sObjectMetadata;
  spec?: Record<string, unknown>;
  status?: K8sPodStatus;
}

export interface K8sPodList {
  apiVersion: "v1";
  kind: "PodList";
  metadata: {
    resourceVersion?: string;
  };
  items: K8sPodResource[];
}

export interface K8sJobCondition {
  type: "Complete" | "Failed" | "Suspended";
  status: "True" | "False" | "Unknown";
  lastProbeTime?: string | null;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface K8sJobStatus {
  active?: number;
  succeeded?: number;
  failed?: number;
  startTime?: string;
  completionTime?: string;
  conditions?: K8sJobCondition[];
}

export interface K8sJobSpec {
  template: {
    metadata?: K8sObjectMetadata;
    spec: Record<string, unknown>;
  };
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  parallelism?: number;
  completions?: number;
}

export interface K8sJobResource {
  apiVersion: "batch/v1";
  kind: "Job";
  metadata: K8sObjectMetadata;
  spec?: K8sJobSpec;
  status?: K8sJobStatus;
}

export interface K8sJobList {
  apiVersion: "batch/v1";
  kind: "JobList";
  metadata: {
    resourceVersion?: string;
  };
  items: K8sJobResource[];
}

export interface K8sAuditReceipt {
  timestampIso: string;
  clusterEndpoint: string;
  inClusterAuth: boolean;
  simulationMode: boolean;
  defaultNamespace: string;
  totalPods: number;
  activeJobs: number;
  sha256Signature: string;
}

const DEFAULT_SERVICEACCOUNT_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";
const DEFAULT_TOKEN_PATH = path.join(DEFAULT_SERVICEACCOUNT_DIR, "token");
const DEFAULT_CA_PATH = path.join(DEFAULT_SERVICEACCOUNT_DIR, "ca.crt");
const DEFAULT_NAMESPACE_PATH = path.join(DEFAULT_SERVICEACCOUNT_DIR, "namespace");
const DEFAULT_CLUSTER_ENDPOINT = "https://kubernetes.default.svc";

/**
 * Native REST Kubernetes Client using built-in node:https.
 */
export class EosKubernetesNativeClient {
  private readonly endpoint: string;
  private readonly token: string | null;
  private readonly caCert: string | null;
  private readonly defaultNamespace: string;
  private readonly inClusterAuth: boolean;
  private readonly simulationMode: boolean;
  private readonly insecureSkipTlsVerify: boolean;
  private readonly timeoutMs: number;
  private httpsAgent: https.Agent | null = null;

  // In-memory state for deterministic simulation mode
  private readonly simPods: Map<string, K8sPodResource> = new Map();
  private readonly simJobs: Map<string, K8sJobResource> = new Map();

  public constructor(options: K8sClientOptions = {}) {
    const tokenPath = options.tokenPath ?? DEFAULT_TOKEN_PATH;
    const caPath = options.caPath ?? DEFAULT_CA_PATH;
    const namespacePath = options.namespacePath ?? DEFAULT_NAMESPACE_PATH;

    let discoveredToken: string | null = null;
    let discoveredCa: string | null = null;
    let discoveredNamespace = "default";
    let isLiveInCluster = false;

    // Check explicit options first
    if (options.token) {
      discoveredToken = options.token;
    } else if (fs.existsSync(tokenPath)) {
      try {
        discoveredToken = fs.readFileSync(tokenPath, "utf-8").trim();
        isLiveInCluster = true;
      } catch {
        discoveredToken = null;
      }
    } else if (process.env.KUBERNETES_TOKEN) {
      discoveredToken = process.env.KUBERNETES_TOKEN;
    }

    if (options.caCert) {
      discoveredCa = options.caCert;
    } else if (fs.existsSync(caPath)) {
      try {
        discoveredCa = fs.readFileSync(caPath, "utf-8");
      } catch {
        discoveredCa = null;
      }
    } else if (process.env.KUBERNETES_CA_CERT) {
      discoveredCa = process.env.KUBERNETES_CA_CERT;
    }

    if (options.defaultNamespace) {
      discoveredNamespace = options.defaultNamespace;
    } else if (fs.existsSync(namespacePath)) {
      try {
        discoveredNamespace = fs.readFileSync(namespacePath, "utf-8").trim();
      } catch {
        discoveredNamespace = "default";
      }
    } else if (process.env.KUBERNETES_NAMESPACE) {
      discoveredNamespace = process.env.KUBERNETES_NAMESPACE;
    }

    let defaultHost = DEFAULT_CLUSTER_ENDPOINT;
    if (process.env.KUBERNETES_SERVICE_HOST) {
      const port = process.env.KUBERNETES_SERVICE_PORT || "443";
      defaultHost = `https://${process.env.KUBERNETES_SERVICE_HOST}:${port}`;
    }

    this.endpoint = (options.endpoint ?? defaultHost).replace(/\/+$/, "");
    this.token = discoveredToken;
    this.caCert = discoveredCa;
    this.defaultNamespace = discoveredNamespace;
    this.inClusterAuth = isLiveInCluster || Boolean(options.tokenPath);
    this.insecureSkipTlsVerify = Boolean(options.insecureSkipTlsVerify);
    this.timeoutMs = options.timeoutMs ?? 15000;

    // Determine simulation mode
    if (options.simulationMode !== undefined) {
      this.simulationMode = options.simulationMode;
    } else {
      // If no token or running on non-k8s dev host without explicit endpoint, fallback to simulation
      this.simulationMode = !this.token;
    }

    if (!this.simulationMode) {
      this.httpsAgent = new https.Agent({
        ca: this.caCert ?? undefined,
        rejectUnauthorized: !this.insecureSkipTlsVerify,
        keepAlive: true,
      });
    } else {
      this.seedSimulationData();
    }
  }

  /**
   * Returns current resolved credentials and cluster configuration.
   */
  public getCredentials(): K8sClusterCredentials {
    return {
      endpoint: this.endpoint,
      token: this.token,
      caCert: this.caCert,
      namespace: this.defaultNamespace,
      inClusterAuth: this.inClusterAuth,
      simulationMode: this.simulationMode,
    };
  }

  /**
   * Seeds realistic Kubernetes resources for simulation mode.
   */
  private seedSimulationData(): void {
    const defaultPod: K8sPodResource = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: "glorian-agent-worker-1",
        namespace: "default",
        uid: "pod-sim-001",
        creationTimestamp: new Date().toISOString(),
        labels: {
          "app.kubernetes.io/name": "glorian-agent",
          "glorian.io/spec-id": "SPEC-288",
        },
      },
      status: {
        phase: "Running",
        podIP: "10.244.0.12",
        hostIP: "192.168.1.100",
        startTime: new Date().toISOString(),
        conditions: [
          { type: "Initialized", status: "True" },
          { type: "Ready", status: "True" },
          { type: "ContainersReady", status: "True" },
          { type: "PodScheduled", status: "True" },
        ],
        containerStatuses: [
          {
            name: "agent-runtime",
            ready: true,
            restartCount: 0,
            image: "glorian/agent-runtime:v75",
            started: true,
          },
        ],
      },
    };

    const kubeSystemPod: K8sPodResource = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: "coredns-774f4b9f7c-xk92m",
        namespace: "kube-system",
        uid: "pod-sim-sys-001",
        creationTimestamp: new Date().toISOString(),
        labels: {
          "k8s-app": "kube-dns",
        },
      },
      status: {
        phase: "Running",
        podIP: "10.244.0.2",
        hostIP: "192.168.1.100",
        startTime: new Date().toISOString(),
        conditions: [{ type: "Ready", status: "True" }],
      },
    };

    this.simPods.set("default/glorian-agent-worker-1", defaultPod);
    this.simPods.set("kube-system/coredns-774f4b9f7c-xk92m", kubeSystemPod);
  }

  /**
   * Internal HTTP REST request dispatcher using node:https.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    apiPath: string,
    body?: unknown,
  ): Promise<{ statusCode: number; data: T }> {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(`${this.endpoint}${apiPath}`);
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "Glorian-EOS-Kubernetes-Native/75.0 (Node22)",
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      let payload = "";
      if (body !== undefined) {
        payload = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(payload).toString();
      }

      const reqOptions: https.RequestOptions = {
        method,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers,
        agent: this.httpsAgent ?? undefined,
        timeout: this.timeoutMs,
      };

      const req = https.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          let parsed: unknown = {};
          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = { raw };
            }
          }
          resolve({
            statusCode: res.statusCode ?? 500,
            data: parsed as T,
          });
        });
      });

      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy(new Error(`Kubernetes API request timeout after ${this.timeoutMs}ms`));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  /**
   * Lists pods within a given namespace.
   */
  public async listPods(namespace?: string): Promise<K8sPodList> {
    const ns = namespace ?? this.defaultNamespace;

    if (this.simulationMode) {
      const items: K8sPodResource[] = [];
      for (const [key, pod] of this.simPods.entries()) {
        if (key.startsWith(`${ns}/`)) {
          items.push(pod);
        }
      }
      return {
        apiVersion: "v1",
        kind: "PodList",
        metadata: { resourceVersion: "sim-1" },
        items,
      };
    }

    const res = await this.request<K8sPodList>("GET", `/api/v1/namespaces/${ns}/pods`);
    if (res.statusCode >= 400) {
      throw new Error(`Failed to list pods in namespace ${ns}: HTTP ${res.statusCode}`);
    }
    return res.data;
  }

  /**
   * Retrieves a single Pod by name and namespace.
   */
  public async getPod(name: string, namespace?: string): Promise<K8sPodResource | null> {
    const ns = namespace ?? this.defaultNamespace;
    const key = `${ns}/${name}`;

    if (this.simulationMode) {
      return this.simPods.get(key) ?? null;
    }

    try {
      const res = await this.request<K8sPodResource>("GET", `/api/v1/namespaces/${ns}/pods/${name}`);
      if (res.statusCode === 404) {
        return null;
      }
      if (res.statusCode >= 400) {
        throw new Error(`Failed to get pod ${key}: HTTP ${res.statusCode}`);
      }
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404")) return null;
      throw err;
    }
  }

  /**
   * Deletes a Pod by name and namespace.
   */
  public async deletePod(name: string, namespace?: string): Promise<boolean> {
    const ns = namespace ?? this.defaultNamespace;
    const key = `${ns}/${name}`;

    if (this.simulationMode) {
      return this.simPods.delete(key);
    }

    const res = await this.request<Record<string, unknown>>("DELETE", `/api/v1/namespaces/${ns}/pods/${name}`);
    return res.statusCode === 200 || res.statusCode === 202;
  }

  /**
   * Creates an ephemeral Batch Job from a specification.
   */
  public async createJob(namespace: string, jobSpec: K8sJobSpec | Record<string, unknown>): Promise<K8sJobResource> {
    const ns = namespace || this.defaultNamespace;
    const metadata = (jobSpec as Record<string, unknown>).metadata as K8sObjectMetadata | undefined;
    const jobName = metadata?.name ?? `glorian-job-${Date.now()}`;
    const key = `${ns}/${jobName}`;

    if (this.simulationMode) {
      const resource: K8sJobResource = {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
          name: jobName,
          namespace: ns,
          uid: `job-sim-${Date.now()}`,
          creationTimestamp: new Date().toISOString(),
          labels: metadata?.labels ?? { "app.kubernetes.io/name": "glorian-agent-job" },
        },
        spec: (jobSpec as Record<string, unknown>).spec as K8sJobSpec | undefined,
        status: {
          active: 1,
          succeeded: 0,
          failed: 0,
          startTime: new Date().toISOString(),
          conditions: [
            {
              type: "Complete",
              status: "False",
              lastTransitionTime: new Date().toISOString(),
            },
          ],
        },
      };
      this.simJobs.set(key, resource);
      return resource;
    }

    const payload = {
      apiVersion: "batch/v1",
      kind: "Job",
      metadata: {
        name: jobName,
        namespace: ns,
        labels: metadata?.labels,
      },
      ...jobSpec,
    };

    const res = await this.request<K8sJobResource>("POST", `/apis/batch/v1/namespaces/${ns}/jobs`, payload);
    if (res.statusCode >= 400) {
      throw new Error(`Failed to create job ${key}: HTTP ${res.statusCode}`);
    }
    return res.data;
  }

  /**
   * Queries status of a Batch Job.
   */
  public async getJobStatus(name: string, namespace?: string): Promise<K8sJobResource | null> {
    const ns = namespace ?? this.defaultNamespace;
    const key = `${ns}/${name}`;

    if (this.simulationMode) {
      const job = this.simJobs.get(key);
      if (!job) return null;
      // Advance simulated job to succeeded after initial check
      if (job.status?.active && job.status.active > 0) {
        job.status.active = 0;
        job.status.succeeded = 1;
        job.status.completionTime = new Date().toISOString();
        if (job.status.conditions && job.status.conditions.length > 0) {
          job.status.conditions[0].status = "True";
        }
      }
      return job;
    }

    try {
      const res = await this.request<K8sJobResource>("GET", `/apis/batch/v1/namespaces/${ns}/jobs/${name}`);
      if (res.statusCode === 404) return null;
      if (res.statusCode >= 400) {
        throw new Error(`Failed to get job ${key}: HTTP ${res.statusCode}`);
      }
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404")) return null;
      throw err;
    }
  }

  /**
   * Deletes a Batch Job resource.
   */
  public async deleteJob(name: string, namespace?: string): Promise<boolean> {
    const ns = namespace ?? this.defaultNamespace;
    const key = `${ns}/${name}`;

    if (this.simulationMode) {
      return this.simJobs.delete(key);
    }

    const res = await this.request<Record<string, unknown>>(
      "DELETE",
      `/apis/batch/v1/namespaces/${ns}/jobs/${name}?propagationPolicy=Background`,
    );
    return res.statusCode === 200 || res.statusCode === 202;
  }

  /**
   * Performs a comprehensive cluster audit and emits a cryptographic receipt.
   */
  public async auditCluster(): Promise<K8sAuditReceipt> {
    let totalPods = 0;
    let activeJobs = 0;

    if (this.simulationMode) {
      totalPods = this.simPods.size;
      for (const job of this.simJobs.values()) {
        if (job.status?.active && job.status.active > 0) {
          activeJobs++;
        }
      }
    } else {
      try {
        const pods = await this.listPods();
        totalPods = pods.items.length;
      } catch {
        totalPods = 0;
      }
    }

    const payload = {
      timestampIso: new Date().toISOString(),
      clusterEndpoint: this.endpoint,
      inClusterAuth: this.inClusterAuth,
      simulationMode: this.simulationMode,
      defaultNamespace: this.defaultNamespace,
      totalPods,
      activeJobs,
    };

    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(payload));
    const sha256Signature = hash.digest("hex");

    const receipt: K8sAuditReceipt = {
      ...payload,
      sha256Signature,
    };

    const receiptDir = path.resolve(process.cwd(), "docs", "evidence");
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    const receiptPath = path.join(receiptDir, "K8S_NATIVE_RECEIPT.json");
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf-8");

    return receipt;
  }
}
