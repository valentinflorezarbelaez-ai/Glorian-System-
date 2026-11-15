/**
 * EOS SYSTEM — UNIVERSAL TOOLCHAIN DOCTOR & CLI HARNESS GOVERNOR (Layer 0)
 * Governed by SPEC-272, CHANGE-134, ADR-134-001 (v75.0.0)
 *
 * Implements safe, zero-dependency host inspection of foundational engineering tools:
 * 1. Audits 13 core CLIs: docker, kubectl, kind, helm, trivy, opa, terraform, k6, java, rustc, cargo, go, python.
 * 2. Enforces safe non-shell execution (`spawnSync` with discrete argument arrays & strict timeouts).
 * 3. Fail-soft resilience: handles missing, failing, or timing-out binaries without unhandled exceptions.
 * 4. Generates cryptographically verifiable receipts in `docs/evidence/TOOLCHAIN_RECEIPT.json`.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface ToolDefinition {
  readonly name: string;
  readonly command: string;
  readonly versionArgs: readonly string[];
  readonly category: "CONTAINER" | "ORCHESTRATION" | "SECURITY" | "PERFORMANCE" | "COMPILER" | "RUNTIME";
  readonly timeoutMs?: number;
}

export interface ToolchainItemReport {
  readonly name: string;
  readonly category: string;
  readonly available: boolean;
  readonly version: string | null;
  readonly path: string | null;
  readonly latencyMs: number;
  readonly error?: string;
}

export interface ToolchainDoctorReport {
  readonly timestampIso: string;
  readonly totalTools: number;
  readonly availableCount: number;
  readonly unavailableCount: number;
  readonly tools: readonly ToolchainItemReport[];
  readonly sha256Receipt: string;
}

export const SUPPORTED_TOOLS: readonly ToolDefinition[] = deepFreeze([
  { name: "docker", command: "docker", versionArgs: ["--version"], category: "CONTAINER", timeoutMs: 4000 },
  {
    name: "kubectl",
    command: "kubectl",
    versionArgs: ["version", "--client"],
    category: "ORCHESTRATION",
    timeoutMs: 4000,
  },
  { name: "kind", command: "kind", versionArgs: ["version"], category: "ORCHESTRATION", timeoutMs: 4000 },
  { name: "helm", command: "helm", versionArgs: ["version", "--short"], category: "ORCHESTRATION", timeoutMs: 4000 },
  { name: "trivy", command: "trivy", versionArgs: ["--version"], category: "SECURITY", timeoutMs: 4000 },
  { name: "opa", command: "opa", versionArgs: ["version"], category: "SECURITY", timeoutMs: 4000 },
  { name: "terraform", command: "terraform", versionArgs: ["--version"], category: "ORCHESTRATION", timeoutMs: 4000 },
  { name: "k6", command: "k6", versionArgs: ["version"], category: "PERFORMANCE", timeoutMs: 4000 },
  { name: "java", command: "java", versionArgs: ["-version"], category: "RUNTIME", timeoutMs: 4000 },
  { name: "rustc", command: "rustc", versionArgs: ["--version"], category: "COMPILER", timeoutMs: 4000 },
  { name: "cargo", command: "cargo", versionArgs: ["--version"], category: "COMPILER", timeoutMs: 4000 },
  { name: "go", command: "go", versionArgs: ["version"], category: "COMPILER", timeoutMs: 4000 },
  { name: "python", command: "python", versionArgs: ["--version"], category: "RUNTIME", timeoutMs: 4000 },
]);

function buildSanitizedEnv(): NodeJS.ProcessEnv {
  const machinePath = process.env.Path || process.env.PATH || "";
  const userHome = process.env.USERPROFILE || process.env.HOME || "";
  const cargoBin = path.join(userHome, ".cargo", "bin");
  const localBin = path.join(userHome, ".local", "bin");

  const extraPaths = [cargoBin, localBin];
  if (process.platform === "win32") {
    const adoptiumDir = "C:\\Program Files\\Eclipse Adoptium";
    if (fs.existsSync(adoptiumDir)) {
      try {
        const entries = fs.readdirSync(adoptiumDir);
        for (const entry of entries) {
          const binPath = path.join(adoptiumDir, entry, "bin");
          if (fs.existsSync(binPath)) extraPaths.push(binPath);
        }
      } catch {}
    }
  }

  const combinedPath = [machinePath, ...extraPaths].filter(Boolean).join(path.delimiter);

  return {
    PATH: combinedPath,
    Path: combinedPath,
    SYSTEMROOT: process.env.SYSTEMROOT || "",
    WINDIR: process.env.WINDIR || "",
    TEMP: process.env.TEMP || "",
    TMP: process.env.TMP || "",
    USERPROFILE: process.env.USERPROFILE || "",
    HOME: process.env.HOME || "",
  };
}

export class EosToolchainDoctor {
  /**
   * Evaluates a single tool definition safely with timeout and fail-soft semantics.
   */
  public static evaluateTool(def: ToolDefinition, customEnv?: NodeJS.ProcessEnv): ToolchainItemReport {
    assertPrecondition(Boolean(def && def.command), "Tool definition must provide command");
    const startTime = Date.now();
    const env = customEnv || buildSanitizedEnv();
    const timeout = def.timeoutMs || 4000;

    try {
      const res = spawnSync(def.command, [...def.versionArgs], {
        env,
        encoding: "utf8",
        timeout,
        windowsHide: true,
      });

      const latencyMs = Date.now() - startTime;

      if (res.error || res.status !== 0) {
        const errorMsg = res.error ? res.error.message : (res.stderr || "Non-zero exit code").trim().slice(0, 200);
        return deepFreeze({
          name: def.name,
          category: def.category,
          available: false,
          version: null,
          path: null,
          latencyMs,
          error: errorMsg,
        });
      }

      const rawOutput = (res.stdout || res.stderr || "").trim();
      const firstLine = rawOutput.split(/\r?\n/)[0]?.trim().slice(0, 120) || "Detected (unknown version)";

      return deepFreeze({
        name: def.name,
        category: def.category,
        available: true,
        version: firstLine,
        path: def.command,
        latencyMs,
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return deepFreeze({
        name: def.name,
        category: def.category,
        available: false,
        version: null,
        path: null,
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Audits all registered engineering tools, computes a SHA-256 receipt, and optionally writes to disk.
   */
  public static diagnose(
    options: {
      readonly tools?: readonly ToolDefinition[];
      readonly receiptPath?: string;
      readonly customEnv?: NodeJS.ProcessEnv;
    } = {},
  ): ToolchainDoctorReport {
    const toolList = options.tools || SUPPORTED_TOOLS;
    const reports: ToolchainItemReport[] = [];

    for (const toolDef of toolList) {
      reports.push(EosToolchainDoctor.evaluateTool(toolDef, options.customEnv));
    }

    const availableCount = reports.filter((t) => t.available).length;
    const unavailableCount = reports.length - availableCount;

    const receiptPayload = {
      timestampIso: new Date().toISOString(),
      totalTools: reports.length,
      availableCount,
      unavailableCount,
      tools: reports,
    };

    const serialized = JSON.stringify(receiptPayload, null, 2);
    const sha256Receipt = pureSha256(serialized);

    const fullReport: ToolchainDoctorReport = deepFreeze({
      ...receiptPayload,
      sha256Receipt,
    });

    if (options.receiptPath) {
      fs.mkdirSync(path.dirname(options.receiptPath), { recursive: true });
      fs.writeFileSync(options.receiptPath, JSON.stringify(fullReport, null, 2), "utf8");
    }

    return fullReport;
  }
}
