/**
 * EOS SYSTEM — K6 LOAD TESTING ADAPTER & SLO GATEWAY (Layer 0)
 * Governed by SPEC-274, CHANGE-136
 *
 * Implements automated, bounded k6 performance benchmarking:
 * 1. Hermetic Ephemeral Script Generation (zero clutter on working tree).
 * 2. Automated k6 Execution with Structured Summary JSON Export.
 * 3. Multi-Window SLO Threshold Gating (p95, p99, error rate).
 * 4. Cryptographic Load Test Receipts for Pipeline Integration.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type K6TestVerdict = "PASS" | "SLO_BREACHED" | "EXECUTION_FAILED" | "TEST_DEFERRED";

export interface K6SloThresholds {
  readonly targetP95Ms: number;
  readonly targetP99Ms: number;
  readonly maxErrorRate: number; // e.g. 0.01 for 1%
}

export interface K6LoadMetrics {
  readonly totalRequests: number;
  readonly requestsPerSecond: number;
  readonly p95DurationMs: number;
  readonly p99DurationMs: number;
  readonly medianDurationMs: number;
  readonly errorRate: number;
}

export interface K6LoadTestReport {
  readonly timestampIso: string;
  readonly targetUrl: string;
  readonly vus: number;
  readonly duration: string;
  readonly verdict: K6TestVerdict;
  readonly sloPassed: boolean;
  readonly metrics: K6LoadMetrics;
  readonly thresholds: K6SloThresholds;
  readonly sha256Receipt: string;
  readonly error?: string;
}

export interface K6LoadTestOptions {
  readonly vus?: number;
  readonly duration?: string;
  readonly thresholds?: Partial<K6SloThresholds>;
  readonly receiptPath?: string;
  readonly workingDirectory?: string;
  readonly timeoutMs?: number;
  readonly mockMetrics?: Partial<K6LoadMetrics>;
  readonly forceMock?: boolean;
}

const DEFAULT_THRESHOLDS: K6SloThresholds = {
  targetP95Ms: 250,
  targetP99Ms: 500,
  maxErrorRate: 0.01,
};

export class EosK6LoadTestAdapter {
  /**
   * Generates ephemeral k6 test script content.
   */
  public static generateScript(targetUrl: string, vus: number, duration: string, thresholds: K6SloThresholds): string {
    return `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${vus},
  duration: '${duration}',
  thresholds: {
    http_req_duration: ['p(95)<${thresholds.targetP95Ms}', 'p(99)<${thresholds.targetP99Ms}'],
    http_req_failed: ['rate<${thresholds.maxErrorRate}'],
  },
};

export default function () {
  const res = http.get('${targetUrl}');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.05);
}
`;
  }

  /**
   * Executes load testing against a target URL and enforces SLO thresholds.
   */
  public static runLoadTest(targetUrl: string, options: K6LoadTestOptions = {}): K6LoadTestReport {
    assertPrecondition(
      typeof targetUrl === "string" && targetUrl.trim().length > 0,
      "targetUrl must be a valid non-empty string",
    );

    const vus = options.vus || 5;
    const duration = options.duration || "5s";
    const thresholds: K6SloThresholds = {
      targetP95Ms: options.thresholds?.targetP95Ms ?? DEFAULT_THRESHOLDS.targetP95Ms,
      targetP99Ms: options.thresholds?.targetP99Ms ?? DEFAULT_THRESHOLDS.targetP99Ms,
      maxErrorRate: options.thresholds?.maxErrorRate ?? DEFAULT_THRESHOLDS.maxErrorRate,
    };

    // 1. Check for mock execution mode
    if (options.forceMock || options.mockMetrics) {
      const mockMetrics: K6LoadMetrics = {
        totalRequests: options.mockMetrics?.totalRequests ?? 250,
        requestsPerSecond: options.mockMetrics?.requestsPerSecond ?? 50,
        p95DurationMs: options.mockMetrics?.p95DurationMs ?? 42.5,
        p99DurationMs: options.mockMetrics?.p99DurationMs ?? 85.0,
        medianDurationMs: options.mockMetrics?.medianDurationMs ?? 25.0,
        errorRate: options.mockMetrics?.errorRate ?? 0.0,
      };

      const sloPassed =
        mockMetrics.p95DurationMs <= thresholds.targetP95Ms &&
        mockMetrics.p99DurationMs <= thresholds.targetP99Ms &&
        mockMetrics.errorRate <= thresholds.maxErrorRate;

      return EosK6LoadTestAdapter.buildReport(
        targetUrl,
        vus,
        duration,
        sloPassed ? "PASS" : "SLO_BREACHED",
        sloPassed,
        mockMetrics,
        thresholds,
        undefined,
        options.receiptPath,
      );
    }

    // 2. Synthesize Ephemeral Script
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-k6-"));
    const scriptPath = path.join(tempDir, "test.js");
    const summaryPath = path.join(tempDir, "summary.json");
    const scriptContent = EosK6LoadTestAdapter.generateScript(targetUrl, vus, duration, thresholds);

    let k6Output: any = null;
    let executionErr: string | undefined;

    try {
      fs.writeFileSync(scriptPath, scriptContent, "utf8");

      const k6Res = spawnSync("k6", ["run", "--summary-export", summaryPath, scriptPath], {
        encoding: "utf8",
        timeout: options.timeoutMs || 30000,
        windowsHide: true,
      });

      if (fs.existsSync(summaryPath)) {
        const rawSummary = fs.readFileSync(summaryPath, "utf8");
        k6Output = JSON.parse(rawSummary);
      } else if (k6Res.status !== 0) {
        executionErr = k6Res.stderr || k6Res.stdout || "k6 process terminated with non-zero exit code";
      }
    } catch (err: any) {
      executionErr = err.message;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // fail-soft on temp cleanup
      }
    }

    // 3. Fallback when k6 binary is absent or failed
    if (!k6Output) {
      const emptyMetrics: K6LoadMetrics = {
        totalRequests: 0,
        requestsPerSecond: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        medianDurationMs: 0,
        errorRate: 1.0,
      };
      return EosK6LoadTestAdapter.buildReport(
        targetUrl,
        vus,
        duration,
        "EXECUTION_FAILED",
        false,
        emptyMetrics,
        thresholds,
        executionErr || "k6 execution failed or binary not found in PATH",
        options.receiptPath,
      );
    }

    // 4. Parse k6 Metrics
    const reqDuration = k6Output.metrics?.http_req_duration?.values || {};
    const reqFailed = k6Output.metrics?.http_req_failed?.values || {};
    const reqs = k6Output.metrics?.http_reqs?.values || {};

    const p95DurationMs = reqDuration["p(95)"] || 0;
    const p99DurationMs = reqDuration["p(99)"] || 0;
    const medianDurationMs = reqDuration.med || 0;
    const totalRequests = reqs.count || 0;
    const requestsPerSecond = reqs.rate || 0;
    const errorRate = reqFailed.rate || 0;

    const metrics: K6LoadMetrics = {
      totalRequests,
      requestsPerSecond,
      p95DurationMs,
      p99DurationMs,
      medianDurationMs,
      errorRate,
    };

    const sloPassed =
      p95DurationMs <= thresholds.targetP95Ms &&
      p99DurationMs <= thresholds.targetP99Ms &&
      errorRate <= thresholds.maxErrorRate;

    const verdict: K6TestVerdict = sloPassed ? "PASS" : "SLO_BREACHED";

    return EosK6LoadTestAdapter.buildReport(
      targetUrl,
      vus,
      duration,
      verdict,
      sloPassed,
      metrics,
      thresholds,
      undefined,
      options.receiptPath,
    );
  }

  private static buildReport(
    targetUrl: string,
    vus: number,
    duration: string,
    verdict: K6TestVerdict,
    sloPassed: boolean,
    metrics: K6LoadMetrics,
    thresholds: K6SloThresholds,
    error?: string,
    receiptPath?: string,
  ): K6LoadTestReport {
    const timestampIso = new Date().toISOString();
    const payload = JSON.stringify({
      timestampIso,
      targetUrl,
      vus,
      duration,
      verdict,
      sloPassed,
      metrics,
      thresholds,
      error,
    });

    const sha256Receipt = pureSha256(payload);

    const report: K6LoadTestReport = {
      timestampIso,
      targetUrl,
      vus,
      duration,
      verdict,
      sloPassed,
      metrics,
      thresholds,
      sha256Receipt,
      error,
    };

    if (receiptPath) {
      try {
        fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
        fs.writeFileSync(receiptPath, JSON.stringify(report, null, 2), "utf8");
      } catch {
        // fail-soft on receipt persistence
      }
    }

    return deepFreeze(report);
  }
}
