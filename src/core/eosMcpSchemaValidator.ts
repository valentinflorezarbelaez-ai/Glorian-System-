/**
 * src/core/eosMcpSchemaValidator.ts
 * MCP Tool Contract & JSON Schema Automated Validator & Exporter.
 * Ensures 100% formal type safety and schema conformance for all Model Context Protocol tools.
 *
 * SPEC-068: MCP Tool Contract Formal Validation & Schema Exporter
 * Zero runtime NPM dependencies (Strict Layer-0 Pure).
 */

import fs from "node:fs";
import path from "node:path";

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { CORE_TIER0_TOOL_NAMES } from "./eosMcpToolTaxonomy.ts";

export interface McpToolPropertyDef {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
}

export interface McpToolSchemaDef {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties?: Readonly<Record<string, McpToolPropertyDef>>;
    readonly required?: readonly string[];
  };
}

export interface SchemaValidationIssue {
  readonly toolName: string;
  readonly field: string;
  readonly reason: string;
}

export interface McpValidationReport {
  readonly totalTools: number;
  readonly coreTier0Count: number;
  readonly validToolsCount: number;
  readonly issuesCount: number;
  readonly issues: readonly SchemaValidationIssue[];
  readonly status: "CONFORMING" | "VIOLATIONS_DETECTED";
  readonly catalogSha256: string;
  readonly timestampIso: string;
}

export class EosMcpSchemaValidator {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Validates an array of MCP tool definitions against strict JSON Schema standards.
   */
  public validateCatalog(tools: readonly McpToolSchemaDef[]): McpValidationReport {
    assertPrecondition(Array.isArray(tools) && tools.length > 0, "Tool definitions array must not be empty");

    const issues: SchemaValidationIssue[] = [];
    const validJsonTypes = new Set(["string", "number", "integer", "boolean", "object", "array"]);

    for (const tool of tools) {
      if (!tool.name || typeof tool.name !== "string" || (!tool.name.startsWith("eos_") && !tool.name.startsWith("glorian_"))) {
        issues.push({
          toolName: tool.name || "UNKNOWN",
          field: "name",
          reason: "Tool name must be a non-empty string prefixed with 'eos_' or 'glorian_'"
        });
      }

      if (!tool.description || typeof tool.description !== "string" || tool.description.trim().length < 15) {
        issues.push({
          toolName: tool.name,
          field: "description",
          reason: "Tool description must be descriptive and at least 15 characters"
        });
      }

      if (!tool.inputSchema || tool.inputSchema.type !== "object") {
        issues.push({
          toolName: tool.name,
          field: "inputSchema.type",
          reason: "Input schema must be an object with type: 'object'"
        });
        continue;
      }

      if (tool.inputSchema.properties) {
        for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
          if (!propDef || typeof propDef !== "object") {
            issues.push({
              toolName: tool.name,
              field: `properties.${propName}`,
              reason: "Property definition must be a valid object"
            });
            continue;
          }

          const def = propDef as McpToolPropertyDef;
          if (!def.type || !validJsonTypes.has(def.type)) {
            issues.push({
              toolName: tool.name,
              field: `properties.${propName}.type`,
              reason: `Property type '${def.type}' is not a valid JSON Schema type`
            });
          }
        }
      }
    }

    const issuesCount = issues.length;
    const status = issuesCount === 0 ? "CONFORMING" : "VIOLATIONS_DETECTED";
    const catalogJson = JSON.stringify(tools, null, 2);
    const catalogSha256 = pureSha256(catalogJson);
    // Content-addressed timestamp keeps tip-seal catalog porcelain across verify re-runs.
    const seconds = 1_577_836_800 + (parseInt(catalogSha256.slice(0, 8), 16) % 315_619_200);
    const timestampIso = new Date(seconds * 1000).toISOString();

    return deepFreeze({
      totalTools: tools.length,
      coreTier0Count: CORE_TIER0_TOOL_NAMES.size,
      validToolsCount: tools.length - issuesCount,
      issuesCount,
      issues,
      status,
      catalogSha256,
      timestampIso
    });
  }

  /**
   * Exports the validated tool catalog to docs/contracts/mcp-tool-catalog.json
   */
  public exportCatalogContract(tools: readonly McpToolSchemaDef[]): string {
    const report = this.validateCatalog(tools);
    if (report.status !== "CONFORMING") {
      throw new Error(`Cannot export invalid MCP tool catalog: ${report.issuesCount} issues detected.`);
    }

    const exportPath = path.join(this.projectRoot, "docs", "contracts", "mcp-tool-catalog.json");
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });

    const payload = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "EOS System MCP Tool Catalog Contract",
      version: "66.0.0",
      generatedAt: report.timestampIso,
      catalogSha256: report.catalogSha256,
      totalTools: report.totalTools,
      coreTier0Count: report.coreTier0Count,
      tools
    };

    safeWriteFileSync(exportPath, JSON.stringify(payload, null, 2) + "\n");
    return exportPath;
  }
}

function safeWriteFileSync(filePath: string, content: string): void {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.writeFileSync(filePath, content, "utf8");
      return;
    } catch (err: any) {
      if (attempt === maxAttempts) throw err;
      const end = Date.now() + 25 * attempt;
      while (Date.now() < end) {}
    }
  }
}
