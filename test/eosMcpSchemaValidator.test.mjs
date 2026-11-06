import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-205: EosMcpSchemaValidator validates 100% of MCP tool definitions and exports formal catalog contract", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mcp-catalog-export-"));

  try {
    fs.writeFileSync(
      path.join(fixtureRoot, "package.json"),
      `${JSON.stringify({ name: "mcp-catalog-export-fixture", version: "1.2.3" }, null, 2)}\n`
    );

    const server = new EosMcpServer(projectRoot, "full");
    const listRes = server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    });

    const tools = listRes?.result?.tools || [];
    assert.ok(tools.length > 50, `Expected at least 50 tools, got ${tools.length}`);

    const validator = new EosMcpSchemaValidator(fixtureRoot);
    const report = validator.validateCatalog(tools);

    assert.equal(report.status, "CONFORMING");
    assert.equal(report.issuesCount, 0, `Detected schema issues: ${JSON.stringify(report.issues, null, 2)}`);
    assert.ok(report.catalogSha256.length === 64);
    assert.ok(report.coreTier0Count <= 30);
    assert.ok(report.coreTier0Count >= 20);

    const contractPath = validator.exportCatalogContract(tools);
    assert.equal(path.dirname(path.dirname(path.dirname(contractPath))), fixtureRoot);
    assert.ok(fs.existsSync(contractPath));

    const contractContent = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    assert.equal(contractContent.totalTools, tools.length);
    assert.equal(contractContent.version, "1.2.3");
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
