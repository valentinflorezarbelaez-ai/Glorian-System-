import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EOS_MCP_TOOL_DEFINITIONS } from "../src/mcp/eosMcpToolDefinitions.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";
import { pureSha256 } from "../src/core/eosKernelPrimitives.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogRelativePath = "docs/contracts/mcp-tool-catalog.json";
const verifyScript = path.join(root, "scripts", "verify-mcp-catalog.mjs");
const committed = JSON.parse(fs.readFileSync(path.join(root, catalogRelativePath), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function createTempRoot(catalog, version = catalog.version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-catalog-test-"));
  fs.mkdirSync(path.join(tmp, "docs", "contracts"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, catalogRelativePath),
    `${JSON.stringify(catalog, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    `${JSON.stringify({ name: "mcp-catalog-fixture", version }, null, 2)}\n`
  );
  return tmp;
}

function runVerify(cwd) {
  try {
    return {
      status: 0,
      stdout: execFileSync(process.execPath, [verifyScript], { cwd, encoding: "utf8" }),
      stderr: ""
    };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? "")
    };
  }
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

test("MCP-CAT-01: the committed catalog matches the live tool definitions", () => {
  const report = new EosMcpSchemaValidator(root).validateCatalog(EOS_MCP_TOOL_DEFINITIONS);

  assert.equal(report.status, "CONFORMING");
  assert.equal(committed.totalTools, report.totalTools);
  assert.equal(committed.coreTier0Count, report.coreTier0Count);
  assert.equal(committed.catalogSha256, report.catalogSha256);
  assert.equal(committed.version, pkg.version);
  assert.equal(pureSha256(JSON.stringify(committed.tools, null, 2)), committed.catalogSha256);

  const result = runVerify(root);
  assert.equal(result.status, 0, result.stderr);
});

test("MCP-CAT-02: a tampered catalog seal is rejected", () => {
  const tampered = { ...committed, catalogSha256: "0".repeat(64) };
  const tmp = createTempRoot(tampered);

  try {
    const result = runVerify(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /internally inconsistent/);
  } finally {
    cleanup(tmp);
  }
});

test("MCP-CAT-03: a removed tool is reported as contract drift", () => {
  const tools = committed.tools.slice(1);
  const drifted = {
    ...committed,
    tools,
    totalTools: tools.length,
    catalogSha256: pureSha256(JSON.stringify(tools, null, 2))
  };
  const tmp = createTempRoot(drifted);

  try {
    const result = runVerify(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /drift/);
  } finally {
    cleanup(tmp);
  }
});

test("MCP-CAT-04: a stale catalog version is rejected", () => {
  const tmp = createTempRoot(committed, "0.0.1");

  try {
    const result = runVerify(tmp);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /version drift/i);
  } finally {
    cleanup(tmp);
  }
});
