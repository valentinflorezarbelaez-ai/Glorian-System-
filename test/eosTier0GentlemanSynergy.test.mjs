import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { EosDurableSqliteLedger, sanitizeFts5Query } from "../src/core/eosDurableSqliteLedger.ts";
import { EosTypeScriptAstAnalyzer } from "../src/core/eosTypeScriptAstAnalyzer.ts";
import { EosGentlemanStackBridge } from "../src/core/eosGentlemanStackBridge.ts";
import { CORE_TIER0_TOOL_NAMES } from "../src/mcp/eosMcpToolCatalog.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-128: MCP Path Confinement resolves relative to projectRoot when CWD is os.tmpdir() and blocks traversal", () => {
  const requests =
    [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "eos_refactor_audit", arguments: { targetDir: "src/core" } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "eos_refactor_execute", arguments: { projectRoot: "." } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "eos_ast_analyze", arguments: { targetDir: "src/core" } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "eos_refactor_audit", arguments: { targetDir: "../../outside-workspace" } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "eos_sqlite_ledger", arguments: { action: "verify", databasePath: "../../outside.sqlite" } },
      }),
    ].join("\n") + "\n";

  const proc = spawnSync(process.execPath, [path.join(projectRoot, "src", "mcp", "eosMcpServer.ts")], {
    cwd: os.tmpdir(),
    env: { ...process.env, EOS_PROJECT_ROOT: projectRoot },
    input: requests,
    encoding: "utf8",
    timeout: 60_000, // generous: validates path confinement correctness, not subprocess speed
  });

  assert.equal(proc.status, 0, `MCP subprocess exited non-zero: ${proc.stderr}`);
  const responses = proc.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(responses.length, 6);

  // id 2: eos_refactor_audit succeeded from os.tmpdir()
  assert.ok(!responses[1].error, `Unexpected error on eos_refactor_audit: ${JSON.stringify(responses[1])}`);
  const refactorAudit = JSON.parse(responses[1].result.content[0].text);
  assert.ok(refactorAudit.scannedFilesCount >= 90);
  assert.equal(refactorAudit.sha256AuditReceipt.length, 64);

  // id 3: eos_refactor_execute succeeded from os.tmpdir()
  assert.ok(!responses[2].error, `Unexpected error on eos_refactor_execute: ${JSON.stringify(responses[2])}`);
  const refactorExec = JSON.parse(responses[2].result.content[0].text);
  assert.ok(refactorExec.auditReport.scannedFilesCount >= 90);
  assert.ok(typeof refactorExec.epistemicState === "string");

  // id 4: eos_ast_analyze succeeded from os.tmpdir()
  assert.ok(!responses[3].error);
  const astReport = JSON.parse(responses[3].result.content[0].text);
  assert.equal(astReport.layer0Pure, true);
  assert.equal(astReport.stripOnlyCompatible, true);

  // id 5 & id 6: Path traversal outside projectRoot rejected fail-closed
  assert.equal(responses[4].error?.code, -32603);
  assert.match(responses[4].error?.message || "", /outside the configured project root/i);

  assert.equal(responses[5].error?.code, -32603);
  assert.match(responses[5].error?.message || "", /outside the configured project root/i);
});

test("BDD-129: Modular MCP 2025-03-26 ToolAnnotations enrich 100% of tools and support 'core' vs 'full' profiles", () => {
  const fullServer = new EosMcpServer(projectRoot, "full");
  const fullRes = fullServer.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const fullTools = fullRes?.result?.tools || [];
  assert.ok(fullTools.length >= 115, `Expected >= 115 tools in full profile, got ${fullTools.length}`);

  for (const tool of fullTools) {
    assert.ok(tool.annotations, `Tool ${tool.name} is missing MCP 2025-03-26 annotations`);
    assert.equal(typeof tool.annotations.title, "string");
    assert.ok(tool.annotations.title.length > 0);
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    assert.equal(typeof tool.annotations.idempotentHint, "boolean");
    assert.equal(typeof tool.annotations.openWorldHint, "boolean");
  }

  const searchTool = fullTools.find((t) => t.name === "eos_semantic_search");
  assert.equal(searchTool.annotations.readOnlyHint, true);
  assert.equal(searchTool.annotations.destructiveHint, false);

  const ledgerTool = fullTools.find((t) => t.name === "eos_sqlite_ledger");
  assert.equal(ledgerTool.annotations.readOnlyHint, false);

  const worktreeTool = fullTools.find((t) => t.name === "eos_manage_worktree");
  assert.equal(worktreeTool.annotations.destructiveHint, true);

  const coreServer = new EosMcpServer(projectRoot, "core");
  const coreRes = coreServer.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const coreTools = coreRes?.result?.tools || [];
  assert.equal(coreTools.length, CORE_TIER0_TOOL_NAMES.size);
  assert.ok(coreTools.length <= 50, `Expected <= 50 curated core tools, got ${coreTools.length}`);
  const coreNames = new Set(coreTools.map((t) => t.name));
  assert.ok(coreNames.has("eos_antigravity_direct"));
  assert.ok(coreNames.has("eos_gentleman_audit"));
  assert.ok(coreNames.has("eos_sqlite_ledger"));
  assert.ok(coreNames.has("eos_ast_analyze"));
});

test("BDD-130: EosDurableSqliteLedger persists WAL + FTS5 across restarts and detects cryptographic hash tampering", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-sqlite-wal-test-"));
  const dbPath = path.join(tmpDir, "sovereign_test.sqlite");

  try {
    const ledger1 = new EosDurableSqliteLedger(dbPath);
    const r1 = ledger1.appendEntry({
      category: "MISSION_DIRECTION",
      projectId: "eos-system",
      title: "Initialize Tier-0 SQLite WAL Architecture",
      payload: { spec: "SPEC-044", version: "50.0.0" },
      engramTopicKey: "architecture/sqlite-wal-ledger",
    });
    const r2 = ledger1.appendEntry({
      category: "ARCHITECTURE_DECISION",
      projectId: "eos-system",
      title: "Gentleman-Programming Synergy Mesh Co-Governance",
      payload: { stack: ["gentle-ai", "engram", "gga", "context7", "agent-teams-lite"] },
    });
    const r3 = ledger1.appendEntry({
      category: "VERIFICATION_RECEIPT",
      projectId: "crud-slack",
      title: "Fleet Soundcheck Quorum Certified 92/100",
      payload: { quorum: true },
    });

    assert.equal(r1.seq, 1);
    assert.equal(r2.prevHash, r1.entryHash);
    assert.equal(r3.prevHash, r2.entryHash);
    ledger1.close();

    // Reopen fresh instance from disk to verify durable persistence
    const ledger2 = new EosDurableSqliteLedger(dbPath);
    const integrity = ledger2.verifyChainIntegrity();
    assert.equal(integrity.journalMode, "wal");
    assert.equal(integrity.totalEntries, 3);
    assert.equal(integrity.intact, true);
    assert.deepEqual(integrity.corruptedSequences, []);
    assert.equal(integrity.headHash, r3.entryHash);

    // FTS5 query with punctuation characters must sanitize cleanly without syntax error
    assert.equal(sanitizeFts5Query('Gentleman-Programming: "Synergy"*'), '"Gentleman-Programming" "Synergy"');
    const searchHits = ledger2.searchEntries('Gentleman-Programming: "Synergy"*', 5);
    assert.equal(searchHits.length, 1);
    assert.equal(searchHits[0].entryId, r2.entryId);

    const projectFiltered = ledger2.listRecent(10, "crud-slack");
    assert.equal(projectFiltered.length, 1);
    assert.equal(projectFiltered[0].entryId, r3.entryId);
    ledger2.close();

    // Tamper directly with row #2 in SQLite to prove monotonic SHA-256 chain detection
    const rawDb = new DatabaseSync(dbPath);
    rawDb.prepare("UPDATE eos_ledger_entries SET title = 'TAMPERED_RECORD' WHERE seq = 2").run();
    rawDb.close();

    const ledger3 = new EosDurableSqliteLedger(dbPath);
    const tamperedReport = ledger3.verifyChainIntegrity();
    assert.equal(tamperedReport.intact, false);
    assert.ok(tamperedReport.corruptedSequences.includes(2));
    ledger3.close();
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Ignore cleanup error on Windows CI
    }
  }
});

test("BDD-131: EosTypeScriptAstAnalyzer verifies Layer-0 purity, ignores comments/strings/regexes, and flags strip-only violations", () => {
  const coreAudit = EosTypeScriptAstAnalyzer.analyzeDirectory(path.join(projectRoot, "src", "core"), projectRoot);
  assert.ok(coreAudit.filesAnalyzed >= 95);
  assert.equal(coreAudit.layer0Pure, true);
  assert.equal(coreAudit.stripOnlyCompatible, true);
  assert.deepEqual(coreAudit.violations, []);
  assert.equal(coreAudit.sha256Receipt.length, 64);

  // Comments, string literals, template literals, regex literals, and readonly type annotations must produce 0 false positives
  const cleanComplexSource = `
    // enum CommentEnum { A }
    /* namespace CommentNamespace { export const x = 1; }
       import axios from "axios"; */
    import fs from "node:fs";
    import { pureSha256 } from "./eosKernelPrimitives.ts";

    const fakeCodeInString = "enum Fake { X } import lodash from 'lodash';";
    const fakeTemplate = \`namespace NotReal { \${pureSha256("ok")} }\`;
    const fakeRegex = /\\benum\\s+NotAnEnum\\b/gi;

    export interface SampleContract {
      readonly items?: readonly string[];
    }

    export class PureService {
      private readonly items: readonly string[];
      constructor(items: readonly string[]) {
        this.items = items;
      }
      public check(): boolean {
        return fs.existsSync(".") && this.items.length >= 0;
      }
    }
  `;

  const cleanMetrics = EosTypeScriptAstAnalyzer.analyzeSource(cleanComplexSource, "src/core/pureSample.ts", true);
  assert.deepEqual(cleanMetrics.violations, []);
  assert.deepEqual(cleanMetrics.imports, ["node:fs", "./eosKernelPrimitives.ts"]);
  assert.deepEqual(cleanMetrics.exportedSymbols, ["SampleContract", "PureService"]);

  // Real violations must all be caught with exact codes and line numbers
  const violatingSource = [
    'import axios from "axios";',
    "export enum BadStatus { READY = 1 }",
    "namespace LegacyModule { export const flag = true; }",
    "export class BrokenStripOnly {",
    "  constructor(public readonly secretToken: string) {}",
    "}",
  ].join("\n");

  const badMetrics = EosTypeScriptAstAnalyzer.analyzeSource(violatingSource, "src/core/badSample.ts", true);
  const codes = badMetrics.violations.map((v) => v.code);
  assert.ok(codes.includes("EXTERNAL_IMPORT_IN_LAYER0"));
  assert.ok(codes.includes("TS_ENUM_PROHIBITED"));
  assert.ok(codes.includes("TS_NAMESPACE_PROHIBITED"));
  assert.ok(codes.includes("TS_PARAMETER_PROPERTY_PROHIBITED"));
  assert.equal(badMetrics.violations.find((v) => v.code === "TS_ENUM_PROHIBITED")?.line, 2);
});

test("BDD-132: EosGentlemanStackBridge certifies 100/100 SOVEREIGN_GENTLEMAN_APEX co-governance in hermetic environment", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gentleman-test-"));
  const mockHome = path.join(tmpRoot, "home");
  const mockGemini = path.join(mockHome, ".gemini", "config");

  try {
    fs.mkdirSync(path.join(mockHome, "go", "bin"), { recursive: true });
    fs.mkdirSync(path.join(mockHome, "bin"), { recursive: true });
    fs.mkdirSync(mockGemini, { recursive: true });

    const writeStubBinary = (dir, baseName, versionText) => {
      if (process.platform === "win32") {
        const batPath = path.join(dir, `${baseName}.bat`);
        fs.writeFileSync(batPath, `@echo off\r\necho ${versionText}\r\n`, "utf8");
        // Create companion .exe placeholder path or rely on probeBinary candidate/dir resolution
        if (baseName !== "gga") {
          fs.writeFileSync(path.join(dir, `${baseName}.cmd`), `@echo off\r\necho ${versionText}\r\n`, "utf8");
        }
      } else {
        const shPath = path.join(dir, baseName);
        fs.writeFileSync(shPath, `#!/usr/bin/env sh\necho "${versionText}"\n`, { mode: 0o755 });
      }
    };

    writeStubBinary(path.join(mockHome, "go", "bin"), "gentle-ai", "gentle-ai 4.3.1");
    writeStubBinary(path.join(mockHome, "go", "bin"), "engram", "engram 3.2.1");
    writeStubBinary(path.join(mockHome, "bin"), "gga", "gga v2.10.1");

    fs.writeFileSync(
      path.join(mockGemini, "AGENTS.md"),
      "# THE EOS AGENT BIBLE & CONSTITUTION\n## 1. THE SEVEN INVIOLABLE COMMANDMENTS\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(mockGemini, "mcp_config.json"),
      JSON.stringify({
        mcpServers: {
          "eos-system": { command: "node", args: ["src/mcp/eosMcpServer.ts"] },
          engram: { command: "engram", args: ["mcp"] },
          context7: { serverUrl: "https://mcp.context7.com/mcp" },
        },
      }),
      "utf8",
    );

    const report = EosGentlemanStackBridge.auditStack(projectRoot, mockGemini, mockHome);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(report.constitutionPreserved, true);
    assert.equal(report.activeSddSkills.length, 11);
    assert.equal(report.readinessScore, 100, `Pillars: ${JSON.stringify(report.pillars)}`);
    assert.equal(report.status, "SOVEREIGN_GENTLEMAN_APEX");
    assert.equal(report.sha256Receipt.length, 64);

    // MCP dispatch verification against hermetic geminiConfigDir
    const server = new EosMcpServer(projectRoot);
    const mcpRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: { name: "eos_gentleman_audit", arguments: { geminiConfigDir: mockGemini } },
    });
    const parsedMcp = JSON.parse(mcpRes?.result?.content?.[0]?.text || "{}");
    assert.equal(parsedMcp.constitutionPreserved, true);
    assert.equal(parsedMcp.activeSddSkills.length, 11);
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Ignore cleanup error on Windows CI
    }
  }
});
