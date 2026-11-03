import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-205: EosMcpSchemaValidator validates 100% of MCP tool definitions and exports formal catalog contract", () => {
  const server = new EosMcpServer(projectRoot, "full");
  const listRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list"
  });

  const tools = listRes?.result?.tools || [];
  assert.ok(tools.length > 50, `Expected at least 50 tools, got ${tools.length}`);

  const validator = new EosMcpSchemaValidator(projectRoot);
  const report = validator.validateCatalog(tools);

  assert.equal(report.status, "CONFORMING");
  assert.equal(report.issuesCount, 0, `Detected schema issues: ${JSON.stringify(report.issues, null, 2)}`);
  assert.ok(report.catalogSha256.length === 64);
  assert.ok(report.coreTier0Count >= 46);

  // Export contract
  const contractPath = validator.exportCatalogContract(tools);
  assert.ok(fs.existsSync(contractPath));

  const contractContent = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  assert.equal(contractContent.totalTools, tools.length);
  assert.equal(contractContent.version, "66.0.0");
});
