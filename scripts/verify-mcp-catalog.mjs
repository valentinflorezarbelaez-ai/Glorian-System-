#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { EOS_MCP_TOOL_DEFINITIONS } from "../src/mcp/eosMcpToolDefinitions.ts";
import { EosMcpSchemaValidator } from "../src/core/eosMcpSchemaValidator.ts";
import { pureSha256 } from "../src/core/eosKernelPrimitives.ts";

const root = process.cwd();
const catalogPath = path.join(root, "docs", "contracts", "mcp-tool-catalog.json");

if (!fs.existsSync(catalogPath)) {
  console.error(
    "[FAIL] MCP catalog contract missing at docs/contracts/mcp-tool-catalog.json. Run: npm run mcp:catalog:sync"
  );
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
} catch (error) {
  console.error(`[FAIL] MCP catalog contract is not valid JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];

if (!Array.isArray(catalog.tools) || catalog.tools.length === 0) {
  console.error("[FAIL] MCP catalog contract must contain a non-empty 'tools' array.");
  process.exit(1);
}

const committedSeal = pureSha256(JSON.stringify(catalog.tools, null, 2));
if (committedSeal !== catalog.catalogSha256) {
  errors.push(
    "Committed catalog is internally inconsistent: catalogSha256 does not match its own tools array (tampered file?)."
  );
}

const report = new EosMcpSchemaValidator(root).validateCatalog(EOS_MCP_TOOL_DEFINITIONS);
if (report.status !== "CONFORMING") {
  for (const issue of report.issues) {
    errors.push(`Current definition ${issue.toolName}.${issue.field}: ${issue.reason}`);
  }
}

if (report.catalogSha256 !== catalog.catalogSha256) {
  const committedNames = new Set(catalog.tools.map((tool) => tool.name));
  const currentNames = new Set(EOS_MCP_TOOL_DEFINITIONS.map((tool) => tool.name));
  const added = [...currentNames].filter((name) => !committedNames.has(name)).sort();
  const removed = [...committedNames].filter((name) => !currentNames.has(name)).sort();
  const detail = [
    added.length > 0 ? `added: ${added.join(", ")}` : "",
    removed.length > 0 ? `removed: ${removed.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("; ");

  errors.push(
    `Tool contract drift against source definitions (${detail || "schemas changed for existing tools"}). Run: npm run mcp:catalog:sync`
  );
}

if (catalog.totalTools !== report.totalTools) {
  errors.push(`totalTools drift: catalog=${String(catalog.totalTools)} source=${report.totalTools}.`);
}

if (catalog.coreTier0Count !== report.coreTier0Count) {
  errors.push(
    `coreTier0Count drift: catalog=${String(catalog.coreTier0Count)} source=${report.coreTier0Count}.`
  );
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (catalog.version !== String(pkg.version ?? "0.0.0")) {
  errors.push(
    `Catalog version drift: catalog=${String(catalog.version)} package.json=${String(pkg.version)}. Run: npm run mcp:catalog:sync`
  );
}

if (errors.length > 0) {
  console.error("[FAIL] MCP tool catalog contract verification failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("[PASS] MCP tool catalog contract matches the source definitions.");
console.log(`  Tools     : ${report.totalTools} (core Tier-0: ${report.coreTier0Count})`);
console.log(`  Catalog   : sha256:${report.catalogSha256}`);
console.log(`  Version   : ${catalog.version}`);
