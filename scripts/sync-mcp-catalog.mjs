#!/usr/bin/env node
import { EOS_MCP_TOOL_DEFINITIONS } from "../src/mcp/eosMcpToolDefinitions.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";

const root = process.cwd();
const validator = new EosMcpSchemaValidator(root);
const report = validator.validateCatalog(EOS_MCP_TOOL_DEFINITIONS);

if (report.status !== "CONFORMING") {
  console.error(`[FAIL] Refusing to export an invalid MCP tool catalog (${report.issuesCount} issues):`);
  for (const issue of report.issues) {
    console.error(`  - ${issue.toolName}.${issue.field}: ${issue.reason}`);
  }
  process.exit(1);
}

const exportPath = validator.exportCatalogContract(EOS_MCP_TOOL_DEFINITIONS);

console.log("[PASS] MCP tool catalog synchronized.");
console.log(`  File      : ${exportPath.replace(/\\/g, "/")}`);
console.log(`  Tools     : ${report.totalTools} (core Tier-0: ${report.coreTier0Count})`);
console.log(`  Catalog   : sha256:${report.catalogSha256}`);
