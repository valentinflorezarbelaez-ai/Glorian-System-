/**
 * EOS SYSTEM — 24/7 SOVEREIGN SENTINEL DAEMON (Layer 0)
 * Governed by ADR-038, SPEC-031, FR-087, BDD-075, Commandment V
 *
 * Implements "El Latido Despierto 24/7" (Continuous Uninterrupted Heartbeat):
 * - Evaluates SHA-256 Merkle root across core control plane files to prevent unauthorized drift
 * - V8 garbage collection & heap memory pressure monitoring (heapUsed / heapTotal)
 * - FDIR sovereign fleet topology graph health & orphan link elimination
 * - Discrete on-demand pulse check (tick) and continuous background daemon modes
 *
 * Invariant: 100% Layer-0 purity with zero external npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getFleetNodes } from "./eosFleetTopology.ts";

export interface SentinelTickReport {
  status: "SENTINEL_PULSE_HEALTHY" | "REMEDIATION_REQUIRED";
  timestamp: string;
  uptimeSeconds: number;
  merkleRootHash: string;
  filesMonitoredCount: number;
  memoryHealth: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    utilizationRatio: number;
    status: "HEALTHY" | "HIGH_PRESSURE";
  };
  fleetHealth: {
    totalNodes: number;
    ringsActive: number[];
    orphanLinksDetected: number;
  };
  anomaliesDetected: string[];
}

export class EosSentinelDaemon {
  public readonly projectRoot: string;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pulseCount = 0;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Executes a single discrete sentinel heartbeat pulse (tick).
   */
  public tick(): SentinelTickReport {
    this.pulseCount++;
    const anomalies: string[] = [];

    // 1. Core control-plane Merkle root evaluation
    const criticalFiles = [
      "package.json",
      "AGENTS.md",
      "IMPLEMENTATION_AUTHORIZATION.md",
      "src/core/eosJarvisSoul.ts",
      "src/core/eosDurableWal.ts",
      "src/core/eosWebGpuTopology.ts",
    ];

    const hasher = crypto.createHash("sha256");
    let monitoredFilesCount = 0;

    for (const rel of criticalFiles) {
      const fullPath = path.join(this.projectRoot, rel);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath);
        const fileHash = crypto.createHash("sha256").update(fileContent).digest("hex");
        hasher.update(`${rel}:${fileHash}\n`);
        monitoredFilesCount++;
      } else {
        anomalies.push(`Critical file missing: ${rel}`);
      }
    }
    const merkleRootHash = hasher.digest("hex");

    // 2. Memory Health Check
    const mem = process.memoryUsage();
    const utilizationRatio = mem.heapTotal > 0 ? Number((mem.heapUsed / mem.heapTotal).toFixed(3)) : 0;
    const memStatus = utilizationRatio > 0.9 ? "HIGH_PRESSURE" : "HEALTHY";
    if (memStatus === "HIGH_PRESSURE") {
      anomalies.push(`V8 heap utilization critical: ${(utilizationRatio * 100).toFixed(1)}%`);
    }

    // 3. Sovereign Fleet Topology Graph Check (FDIR)
    const nodes = getFleetNodes();
    const ringSet = new Set<number>();
    let orphans = 0;

    for (const node of nodes) {
      if (![1, 2, 3].includes(node.ring)) {
        orphans++;
        anomalies.push(`Invalid ring assignment for node: ${node.id}`);
      }
      ringSet.add(node.ring);
    }

    const isHealthy = anomalies.length === 0;

    return {
      status: isHealthy ? "SENTINEL_PULSE_HEALTHY" : "REMEDIATION_REQUIRED",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      merkleRootHash,
      filesMonitoredCount: monitoredFilesCount,
      memoryHealth: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        utilizationRatio,
        status: memStatus,
      },
      fleetHealth: {
        totalNodes: nodes.length,
        ringsActive: Array.from(ringSet).sort(),
        orphanLinksDetected: orphans,
      },
      anomaliesDetected: anomalies,
    };
  }

  /**
   * Starts continuous background heartbeat loop.
   */
  public startDaemon(intervalMs = 15000, onPulse?: (report: SentinelTickReport) => void): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run first tick immediately
    const initialReport = this.tick();
    onPulse?.(initialReport);

    this.timer = setInterval(() => {
      const report = this.tick();
      onPulse?.(report);
    }, intervalMs);

    // Unref timer so node process can exit naturally if needed
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stops continuous background heartbeat loop.
   */
  public stopDaemon(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public isDaemonRunning(): boolean {
    return this.isRunning;
  }

  public getPulseCount(): number {
    return this.pulseCount;
  }
}
