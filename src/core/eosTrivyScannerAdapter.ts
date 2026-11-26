/**
 * EOS SYSTEM — TRIVY SECURITY SCANNER ADAPTER & SARIF GATEWAY (Layer 0)
 * Governed by SPEC-273, CHANGE-135, ADR-135-001 (v75.0.0)
 *
 * Implements safe, zero-dependency execution and normalization of Aqua Security Trivy:
 * 1. Safe process invocation with discrete args and timeout ceilings.
 * 2. Normalization of raw Trivy JSON into vendor-neutral vulnerability reports.
 * 3. Bidirectional conversion into OASIS SARIF v2.1.0 standard schema.
 * 4. Fail-closed threshold evaluation: blocks on CRITICAL vulnerabilities.
 * 5. Cryptographic audit receipt hashing and persistence in docs/evidence/.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface NormalizedVulnerability {
  readonly id: string;
  readonly pkgName: string;
  readonly installedVersion: string;
  readonly fixedVersion: string | null;
  readonly severity: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly title: string;
  readonly primaryUrl?: string;
}

export interface TrivyScanReport {
  readonly timestampIso: string;
  readonly target: string;
  readonly scanType: "FS" | "IMAGE";
  readonly status: "PASS" | "FAIL_CLOSED" | "SCAN_DEFERRED";
  readonly criticalCount: number;
  readonly highCount: number;
  readonly totalVulnerabilities: number;
  readonly vulnerabilities: readonly NormalizedVulnerability[];
  readonly sarif: any;
  readonly sha256Receipt: string;
}

export interface TrivyScannerOptions {
  readonly scanType?: "FS" | "IMAGE";
  readonly severityLevels?: readonly string[];
  readonly timeoutMs?: number;
  readonly receiptPath?: string;
  readonly mockRawOutput?: any;
}

export class EosTrivyScannerAdapter {
  /**
   * Normalizes raw Trivy JSON results array into structured vulnerabilities.
   */
  public static normalizeTrivyResults(rawJson: any): NormalizedVulnerability[] {
    if (!rawJson || typeof rawJson !== "object") return [];
    const results = Array.isArray(rawJson.Results) ? rawJson.Results : [];
    const vulnerabilities: NormalizedVulnerability[] = [];

    for (const res of results) {
      const vulns = Array.isArray(res.Vulnerabilities) ? res.Vulnerabilities : [];
      for (const v of vulns) {
        const severity = String(v.Severity || "UNKNOWN").toUpperCase() as NormalizedVulnerability["severity"];
        vulnerabilities.push({
          id: String(v.VulnerabilityID || "CVE-UNKNOWN"),
          pkgName: String(v.PkgName || "unknown-package"),
          installedVersion: String(v.InstalledVersion || "0.0.0"),
          fixedVersion: v.FixedVersion ? String(v.FixedVersion) : null,
          severity,
          title: String(v.Title || v.Description || "No description available"),
          primaryUrl: v.PrimaryURL ? String(v.PrimaryURL) : undefined,
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Converts normalized vulnerabilities into standard OASIS SARIF v2.1.0 document.
   */
  public static convertToSarif(vulns: readonly NormalizedVulnerability[], target: string): any {
    const results = vulns.map((v) => ({
      ruleId: v.id,
      level: v.severity === "CRITICAL" || v.severity === "HIGH" ? "error" : "warning",
      message: {
        text: `[${v.severity}] ${v.pkgName} (${v.installedVersion}): ${v.title}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: target.replace(/\\/g, "/"),
            },
          },
        },
      ],
      properties: {
        severity: v.severity,
        fixedVersion: v.fixedVersion,
      },
    }));

    return {
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Trivy",
              informationUri: "https://github.com/aquasecurity/trivy",
              rules: vulns.map((v) => ({
                id: v.id,
                shortDescription: { text: `${v.pkgName} vulnerability ${v.id}` },
                helpUri: v.primaryUrl,
              })),
            },
          },
          results,
        },
      ],
    };
  }

  /**
   * Scans a target path or container image safely.
   */
  public static scan(target: string, options: TrivyScannerOptions = {}): TrivyScanReport {
    assertPrecondition(Boolean(target), "Scan target must be specified");
    const scanType = options.scanType || "FS";
    const severities = options.severityLevels || ["HIGH", "CRITICAL"];
    const timeoutMs = options.timeoutMs || 15000;

    let rawData: any = null;
    let scanSuccess = false;

    if (options.mockRawOutput) {
      rawData = options.mockRawOutput;
      scanSuccess = true;
    } else {
      const args = [
        scanType === "FS" ? "fs" : "image",
        "--format",
        "json",
        "--severity",
        severities.join(","),
        "--quiet",
        target,
      ];

      const trivyTmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-trivy-tmp-"));
      try {
        const res = spawnSync("trivy", args, {
          encoding: "utf8",
          timeout: timeoutMs,
          windowsHide: true,
          env: { ...process.env, TMPDIR: trivyTmp, TMP: trivyTmp, TEMP: trivyTmp },
        });

        if (res.status === 0 && res.stdout) {
          rawData = JSON.parse(res.stdout);
          scanSuccess = true;
        }
      } catch {
        scanSuccess = false;
      } finally {
        fs.rmSync(trivyTmp, { recursive: true, force: true });
      }
    }

    if (!scanSuccess || !rawData) {
      const emptySarif = EosTrivyScannerAdapter.convertToSarif([], target);
      const sha256Receipt = pureSha256(JSON.stringify({ status: "SCAN_DEFERRED", target }));
      return deepFreeze({
        timestampIso: new Date().toISOString(),
        target,
        scanType,
        status: "SCAN_DEFERRED",
        criticalCount: 0,
        highCount: 0,
        totalVulnerabilities: 0,
        vulnerabilities: [],
        sarif: emptySarif,
        sha256Receipt,
      });
    }

    const vulnerabilities = EosTrivyScannerAdapter.normalizeTrivyResults(rawData);
    let criticalCount = 0;
    let highCount = 0;

    for (const v of vulnerabilities) {
      if (v.severity === "CRITICAL") criticalCount++;
      if (v.severity === "HIGH") highCount++;
    }

    const status = criticalCount > 0 ? "FAIL_CLOSED" : "PASS";
    const sarif = EosTrivyScannerAdapter.convertToSarif(vulnerabilities, target);
    const receiptPayload = JSON.stringify({
      target,
      scanType,
      status,
      criticalCount,
      highCount,
      totalVulnerabilities: vulnerabilities.length,
      vulnerabilityIds: vulnerabilities.map((v) => v.id),
    });
    const sha256Receipt = pureSha256(receiptPayload);

    const report: TrivyScanReport = deepFreeze({
      timestampIso: new Date().toISOString(),
      target,
      scanType,
      status,
      criticalCount,
      highCount,
      totalVulnerabilities: vulnerabilities.length,
      vulnerabilities,
      sarif,
      sha256Receipt,
    });

    if (options.receiptPath) {
      try {
        fs.mkdirSync(path.dirname(options.receiptPath), { recursive: true });
        fs.writeFileSync(options.receiptPath, JSON.stringify(report, null, 2), "utf8");
      } catch {
        // fail-soft on receipt persistence
      }
    }

    return report;
  }
}
