/**
 * EOS LSP DIAGNOSTIC PROVIDER (Layer 0)
 * SPEC-055: Language Server Protocol 3.17 diagnostics from semantic graph data.
 *
 * Exposes blast radius, spec drift, and architecture violations as LSP diagnostics
 * that VS Code, Cursor, Neovim LSP, and any LSP-compatible editor consumes natively.
 *
 * Two modes:
 *   1. Stdio LSP server — responds to textDocument/diagnostic requests
 *   2. File watcher — writes diagnostics.json that editors pick up
 *
 * The server speaks a minimal subset of LSP 3.17 over stdio (JSON-RPC 2.0).
 * It does NOT require any npm packages — pure Node.js.
 *
 * VS Code configuration (.vscode/settings.json):
 * ```json
 * {
 *   "eos.diagnostics.enable": true,
 *   "eos.diagnostics.blastRadiusThreshold": 5
 * }
 * ```
 *
 * Usage (standalone):
 *   node src/core/eosLspDiagnostics.ts --stdio
 *   node src/core/eosLspDiagnostics.ts --write-diagnostics
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { EosSemanticGraph } from "./eosSemanticGraph.ts";
import { EosSpecDriftDetector } from "./eosSpecDriftDetector.ts";
import { scanArchitecture } from "./eosArchitectureGuard.ts";
import { createLogger } from "./eosLogger.ts";

const _log = createLogger("eosLspDiagnostics");

// ============================================================================
// 1. LSP DATA TYPES (LSP 3.17 subset)
// ============================================================================

export type DiagnosticSeverity = 1 | 2 | 3 | 4; // Error=1, Warning=2, Info=3, Hint=4

export interface Position {
  readonly line: number;
  readonly character: number;
}
export interface Range {
  readonly start: Position;
  readonly end: Position;
}
export interface Location {
  readonly uri: string;
  readonly range: Range;
}

export interface Diagnostic {
  readonly range: Range;
  readonly severity: DiagnosticSeverity;
  readonly code?: string | number;
  readonly source: string;
  readonly message: string;
  readonly relatedInformation?: Array<{ location: Location; message: string }>;
  readonly tags?: number[]; // 1=Unnecessary, 2=Deprecated
}

export interface PublishDiagnosticsParams {
  readonly uri: string;
  readonly diagnostics: Diagnostic[];
  readonly version?: number;
}

// ============================================================================
// 2. DIAGNOSTIC GENERATORS
// ============================================================================

const ZERO_RANGE: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function pathToUri(absolutePath: string): string {
  return `file://${absolutePath.replace(/\\/g, "/")}`;
}

/**
 * Computes LSP diagnostics for a file from blast radius analysis.
 * High blast radius = Warning, Critical blast radius = Error.
 */
function blastRadiusDiagnostics(graph: EosSemanticGraph, fileAbsPath: string, projectRoot: string): Diagnostic[] {
  const relPath = path.relative(projectRoot, fileAbsPath).replace(/\\/g, "/");
  const report = graph.calculateBlastRadius(relPath);

  if (report.totalImpactedFiles === 0) return [];

  const diagnostics: Diagnostic[] = [];
  const severity: DiagnosticSeverity =
    report.riskLevel === "CRITICAL" ? 1 : report.riskLevel === "HIGH" ? 2 : report.riskLevel === "MEDIUM" ? 3 : 4;

  diagnostics.push({
    range: ZERO_RANGE,
    severity,
    code: `EOS_BLAST_${report.riskLevel}`,
    source: "eos-semantic-graph",
    message: `Blast radius: ${report.totalImpactedFiles} files affected (${report.impactPercentage}% of codebase). Risk: ${report.riskLevel}. Modifying this file triggers tests: ${report.predictiveTestSuites.slice(0, 3).join(", ")}${report.predictiveTestSuites.length > 3 ? "..." : ""}.`,
    tags: severity === 4 ? [1] : undefined, // Hint = Unnecessary tag
  });

  return diagnostics;
}

/**
 * Computes LSP diagnostics from spec drift violations.
 */
function driftDiagnostics(projectRoot: string, fileAbsPath: string): Diagnostic[] {
  const detector = new EosSpecDriftDetector(projectRoot);
  const report = detector.detect({ driftThresholdDays: 7, checkOrphanSpecs: false });

  const relPath = path.relative(projectRoot, fileAbsPath).replace(/\\/g, "/");
  const myViolations = report.violations.filter((v) => v.modulePath.replace(/\\/g, "/").endsWith(relPath));

  return myViolations.map((v) => ({
    range: ZERO_RANGE,
    severity: (v.severity === "CRITICAL" ? 1 : v.severity === "HIGH" ? 2 : 3) as DiagnosticSeverity,
    code: `EOS_DRIFT_${v.type}`,
    source: "eos-spec-drift",
    message: v.message,
    relatedInformation: v.specPath
      ? [
          {
            location: {
              uri: pathToUri(path.resolve(projectRoot, v.specPath)),
              range: ZERO_RANGE,
            },
            message: v.remediation,
          },
        ]
      : undefined,
  }));
}

/**
 * Computes LSP diagnostics from architecture violations.
 */
function architectureDiagnostics(projectRoot: string, fileAbsPath: string): Diagnostic[] {
  try {
    const srcDir = path.join(projectRoot, "src");
    const report = scanArchitecture(srcDir, projectRoot);
    const relPath = path.relative(projectRoot, fileAbsPath).replace(/\\/g, "/");
    const myViolations = report.violations.filter((v) => v.file.replace(/\\/g, "/") === relPath);

    return myViolations.map((v) => ({
      range: ZERO_RANGE,
      severity: 1 as DiagnosticSeverity, // Architecture violations = Error
      code: "EOS_ARCH_VIOLATION",
      source: "eos-architecture-guard",
      message: `${v.rule}: ${v.details}`,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// 3. DIAGNOSTIC AGGREGATOR
// ============================================================================

export interface EosDiagnosticsResult {
  readonly fileUri: string;
  readonly diagnostics: Diagnostic[];
  readonly computedAt: string;
  readonly sha256: string;
}

/**
 * Computes all diagnostics for a given file (blast radius + drift + architecture).
 */
export async function computeDiagnosticsForFile(
  fileAbsPath: string,
  projectRoot: string,
  graph?: EosSemanticGraph,
): Promise<EosDiagnosticsResult> {
  const g = graph ?? new EosSemanticGraph(projectRoot);
  const allDiagnostics: Diagnostic[] = [
    ...blastRadiusDiagnostics(g, fileAbsPath, projectRoot),
    ...driftDiagnostics(projectRoot, fileAbsPath),
    ...architectureDiagnostics(projectRoot, fileAbsPath),
  ];

  const uri = pathToUri(fileAbsPath);
  const sha256 = crypto.createHash("sha256").update(`${uri}:${allDiagnostics.length}:${Date.now()}`).digest("hex");

  return {
    fileUri: uri,
    diagnostics: allDiagnostics,
    computedAt: new Date().toISOString(),
    sha256: `sha256:${sha256}`,
  };
}

/**
 * Writes diagnostics for all files in src/core to a JSON file.
 * Compatible with any editor that watches for diagnostics.json changes.
 */
export async function writeDiagnosticsFile(projectRoot: string, outputPath?: string): Promise<string> {
  const outPath = outputPath ?? path.join(projectRoot, ".eos-diagnostics.json");
  const graph = new EosSemanticGraph(projectRoot);
  const coreDir = path.join(projectRoot, "src", "core");

  if (!fs.existsSync(coreDir)) return outPath;

  const results: EosDiagnosticsResult[] = [];
  const files = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    const absPath = path.join(coreDir, file);
    const result = await computeDiagnosticsForFile(absPath, projectRoot, graph);
    if (result.diagnostics.length > 0) {
      results.push(result);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  _log.info("Diagnostics written", { path: outPath, files: files.length, withDiagnostics: results.length });
  return outPath;
}

// ============================================================================
// 4. MINIMAL LSP STDIO SERVER
// ============================================================================

/**
 * Starts a minimal LSP 3.17 stdio server that responds to:
 *   - initialize / initialized
 *   - textDocument/didOpen, textDocument/didSave
 *   - textDocument/diagnostic (pull diagnostics — LSP 3.17)
 *   - shutdown / exit
 */
export function startLspServer(projectRoot: string): void {
  _log.info("LSP server starting", { projectRoot });

  const graph = new EosSemanticGraph(projectRoot);
  let initialized = false;

  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  let headerBuffer = "";
  let contentLength = 0;
  let readingHeaders = true;
  let pendingContent = "";

  process.stdin.on("data", (chunk: Buffer) => {
    const data = chunk.toString("utf8");
    if (readingHeaders) {
      headerBuffer += data;
      const headerEnd = headerBuffer.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        const headers = headerBuffer.slice(0, headerEnd);
        const clMatch = headers.match(/Content-Length:\s*(\d+)/i);
        contentLength = clMatch ? parseInt(clMatch[1], 10) : 0;
        pendingContent = headerBuffer.slice(headerEnd + 4);
        readingHeaders = false;
        headerBuffer = "";
      }
    } else {
      pendingContent += data;
    }

    if (!readingHeaders && pendingContent.length >= contentLength) {
      const body = pendingContent.slice(0, contentLength);
      pendingContent = pendingContent.slice(contentLength);
      contentLength = 0;
      readingHeaders = true;
      handleMessage(body);
    }
  });

  async function handleMessage(body: string): Promise<void> {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(body);
    } catch {
      return;
    }

    const method = msg.method as string;
    const id = msg.id;

    if (method === "initialize") {
      initialized = true;
      sendResponse(id, {
        capabilities: {
          textDocumentSync: { openClose: true, save: true },
          diagnosticProvider: { identifier: "eos", interFileDependencies: true, workspaceDiagnostics: false },
        },
        serverInfo: { name: "eos-lsp", version: "1.0.0" },
      });
    } else if (method === "textDocument/diagnostic") {
      const params = msg.params as { textDocument?: { uri?: string } };
      const uri = params?.textDocument?.uri ?? "";
      const absPath = uri.replace(/^file:\/\//, "").replace(/\//g, path.sep);

      try {
        const result = await computeDiagnosticsForFile(absPath, projectRoot, graph);
        sendResponse(id, { kind: "full", items: result.diagnostics });
      } catch {
        sendResponse(id, { kind: "full", items: [] });
      }
    } else if (method === "textDocument/didSave") {
      const params = msg.params as { textDocument?: { uri?: string } };
      const uri = params?.textDocument?.uri ?? "";
      const absPath = uri.replace(/^file:\/\//, "").replace(/\//g, path.sep);

      // Push diagnostics on save
      const result = await computeDiagnosticsForFile(absPath, projectRoot, graph);
      sendNotification("textDocument/publishDiagnostics", {
        uri: result.fileUri,
        diagnostics: result.diagnostics,
      });
    } else if (method === "shutdown") {
      sendResponse(id, null);
    } else if (method === "exit") {
      process.exit(0);
    } else if (id !== undefined) {
      sendResponse(id, null);
    }
  }

  function sendResponse(id: unknown, result: unknown): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
    process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
  }

  function sendNotification(method: string, params: unknown): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
    process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
  }

  _log.info("LSP server ready — waiting for client");
}

// ============================================================================
// 5. CLI ENTRY POINT
// ============================================================================

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("eosLspDiagnostics.ts")) {
  const projectRoot = process.env["EOS_PROJECT_ROOT"] ?? process.cwd();
  const mode = process.argv[2] ?? "--stdio";

  if (mode === "--stdio") {
    startLspServer(projectRoot);
  } else if (mode === "--write-diagnostics") {
    writeDiagnosticsFile(projectRoot).then((outPath) => {
      process.stdout.write(`[EOS LSP] Diagnostics written: ${outPath}\n`);
    });
  } else {
    console.error("Usage: node eosLspDiagnostics.ts [--stdio | --write-diagnostics]");
    process.exit(1);
  }
}
