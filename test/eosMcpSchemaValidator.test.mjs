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
    method: "tools/list",
  });

  const tools = listRes?.result?.tools || [];
  assert.ok(tools.length > 50, `Expected at least 50 tools, got ${tools.length}`);

  const validator = new EosMcpSchemaValidator(projectRoot);
  const report = validator.validateCatalog(tools);

  assert.equal(report.status, "CONFORMING");
  assert.equal(report.issuesCount, 0, `Detected schema issues: ${JSON.stringify(report.issues, null, 2)}`);
  assert.ok(report.catalogSha256.length === 64);
  assert.ok(report.coreTier0Count === 46);

  // Export contract
  const contractPath = validator.exportCatalogContract(tools);
  assert.ok(fs.existsSync(contractPath));

  const contractContent = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  assert.equal(contractContent.totalTools, tools.length);
  assert.equal(contractContent.version, "66.0.0");
});

test("BDD-206: EosMcpSchemaValidator validates edge cases, violations, and contract guard rails", () => {
  const validator = new EosMcpSchemaValidator();

  // 1. Precondition: empty tools array
  assert.throws(() => {
    validator.validateCatalog([]);
  }, /Tool definitions array must not be empty/);

  // 2. Schema violations detection
  const malformedTools = [
    // Bad name
    {
      name: "bad_prefix_tool",
      description: "A tool that lacks proper eos_ prefix but is descriptive enough",
      inputSchema: { type: "object" },
    },
    // Name missing
    {
      name: "",
      description: "A tool with completely empty name string",
      inputSchema: { type: "object" },
    },
    // Bad description (too short)
    {
      name: "eos_short_desc",
      description: "Too short",
      inputSchema: { type: "object" },
    },
    // Bad inputSchema (not object)
    {
      name: "eos_bad_schema",
      description: "A tool with an invalid input schema type definition",
      inputSchema: { type: "string" },
    },
    // Bad property definition (primitive instead of object)
    {
      name: "eos_bad_prop_obj",
      description: "A tool whose property definition is not an object",
      inputSchema: {
        type: "object",
        properties: {
          badProp: "invalid",
        },
      },
    },
    // Bad property type
    {
      name: "eos_bad_prop_type",
      description: "A tool whose property has an invalid JSON schema type",
      inputSchema: {
        type: "object",
        properties: {
          weirdProp: { type: "unsupported-custom-type" },
        },
      },
    },
  ];

  const report = validator.validateCatalog(malformedTools);
  assert.equal(report.status, "VIOLATIONS_DETECTED");
  assert.ok(report.issuesCount >= 6);

  // 3. Export rejection on invalid catalog
  assert.throws(() => {
    validator.exportCatalogContract(malformedTools);
  }, /Cannot export invalid MCP tool catalog/);
});
