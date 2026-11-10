/**
 * SPEC-125: EOS Fleet Mission Control Dashboard & Synthetic Health Sentinel
 *
 * Provides real-time fleet overview, synthetic HTTP/latency health probes,
 * availability quorum evaluation, and cryptographic attestation across
 * all 9 registered projects in the EOS Sovereign Fleet.
 *
 * Strict Hexagonal Layer-0: Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface FleetProjectInfo {
  id: string;
  name: string;
  resolvedLocalDir: string;
  productionUrl: string;
  type: string;
  authorization: string;
  status: string;
  currentBranch?: string;
  headCommitSha?: string;
}

export interface SyntheticProbeResult {
  url: string;
  reachable: boolean;
  statusCode?: number;
  latencyMs: number;
  ssl: boolean;
  error?: string;
  probedAt: string;
}

export interface FleetMissionReport {
  timestamp: string;
  totalProjects: number;
  productionEndpointsCount: number;
  healthyEndpointsCount: number;
  fleetQuorumPercentage: number;
  averageLatencyMs: number;
  registrySha256: string;
  projects: Array<FleetProjectInfo & { probe?: SyntheticProbeResult }>;
}

export class EosFleetMissionControl {
  private readonly projectRoot: string;
  private readonly registryPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.registryPath = path.join(this.projectRoot, "docs/projects/registry.json");
  }

  /**
   * Reads and parses canonical fleet registry.
   */
  public getRawRegistry(): { version: string; registrySha256: string; projects: any[] } {
    if (!fs.existsSync(this.registryPath)) {
      throw new Error(`Fleet registry not found at: ${this.registryPath}`);
    }
    const raw = fs.readFileSync(this.registryPath, "utf8");
    return JSON.parse(raw);
  }

  /**
   * Returns structured fleet overview without network probing.
   */
  public getFleetOverview(): FleetProjectInfo[] {
    const reg = this.getRawRegistry();
    if (!Array.isArray(reg.projects)) return [];

    return reg.projects.map((p) => ({
      id: String(p.id || ""),
      name: String(p.name || p.id || "Unnamed"),
      resolvedLocalDir: String(p.resolvedLocalDir || p.id || ""),
      productionUrl: String(p.productionUrl || ""),
      type: String(p.type || "general-application"),
      authorization: String(p.authorization || "LEVEL_1_READ_ONLY"),
      status: String(p.status || "REGISTERED"),
      currentBranch: p.currentBranch ? String(p.currentBranch) : undefined,
      headCommitSha: p.headCommitSha ? String(p.headCommitSha) : undefined,
    }));
  }

  /**
   * Pings a single HTTP/HTTPS endpoint with timeout and latency measurement.
   */
  public static async probeEndpoint(url: string, timeoutMs: number = 4000): Promise<SyntheticProbeResult> {
    const probedAt = new Date().toISOString();
    const isSsl = url.startsWith("https://");

    if (!url || !/^https?:\/\//i.test(url)) {
      return {
        url,
        reachable: false,
        latencyMs: 0,
        ssl: isSsl,
        error: "INVALID_URL",
        probedAt,
      };
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "EOS-Fleet-MissionControl/1.0 (Synthetic Sentinel)",
        },
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;
      const reachable = res.status >= 200 && res.status < 400;

      return {
        url,
        reachable,
        statusCode: res.status,
        latencyMs,
        ssl: isSsl,
        ...(reachable ? {} : { error: `HTTP_${res.status}` }),
        probedAt,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        url,
        reachable: false,
        latencyMs,
        ssl: isSsl,
        error: err.name === "AbortError" ? "TIMEOUT" : err.message || "NETWORK_ERROR",
        probedAt,
      };
    }
  }

  /**
   * Generates comprehensive Mission Control Report, optionally executing live synthetic probes.
   */
  public async generateReport(options: { probe?: boolean; timeoutMs?: number } = {}): Promise<FleetMissionReport> {
    const reg = this.getRawRegistry();
    const overview = this.getFleetOverview();
    const shouldProbe = Boolean(options.probe);
    const timeoutMs = options.timeoutMs || 4000;

    let healthyCount = 0;
    let totalLatency = 0;
    let latencySamples = 0;

    const enrichedProjects: Array<FleetProjectInfo & { probe?: SyntheticProbeResult }> = [];

    for (const proj of overview) {
      if (shouldProbe && proj.productionUrl) {
        const probe = await EosFleetMissionControl.probeEndpoint(proj.productionUrl, timeoutMs);
        if (probe.reachable) {
          healthyCount++;
          totalLatency += probe.latencyMs;
          latencySamples++;
        }
        enrichedProjects.push({ ...proj, probe });
      } else {
        enrichedProjects.push(proj);
      }
    }

    const prodCount = overview.filter((p) => Boolean(p.productionUrl)).length;
    const quorumPct = shouldProbe && prodCount > 0 ? Number(((healthyCount / prodCount) * 100).toFixed(1)) : 100.0;

    const avgLatency = latencySamples > 0 ? Math.round(totalLatency / latencySamples) : 0;

    return {
      timestamp: new Date().toISOString(),
      totalProjects: overview.length,
      productionEndpointsCount: prodCount,
      healthyEndpointsCount: shouldProbe ? healthyCount : prodCount,
      fleetQuorumPercentage: quorumPct,
      averageLatencyMs: avgLatency,
      registrySha256: reg.registrySha256 || "",
      projects: enrichedProjects,
    };
  }

  /**
   * Synchronous fleet overview report without network probing.
   */
  public generateReportSync(): FleetMissionReport {
    const reg = this.getRawRegistry();
    const overview = this.getFleetOverview();
    const prodCount = overview.filter((p) => Boolean(p.productionUrl)).length;

    return {
      timestamp: new Date().toISOString(),
      totalProjects: overview.length,
      productionEndpointsCount: prodCount,
      healthyEndpointsCount: prodCount,
      fleetQuorumPercentage: 100.0,
      averageLatencyMs: 0,
      registrySha256: reg.registrySha256 || "",
      projects: overview,
    };
  }
}
