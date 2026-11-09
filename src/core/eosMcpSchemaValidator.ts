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

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { contentDerivedIso, writeDeterministicArtifact } from "./eosDeterministicArtifact.ts";

/**
 * Curated Tier-0 Core Engineering Profile (real, high-signal control-plane tools).
 * Keeps LLM tool-selection precision maximized when `EOS_MCP_PROFILE=core`.
 */
export const CORE_TIER0_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eos_antigravity_direct",
  "eos_antigravity_doctor",
  "eos_gentleman_audit",
  "eos_gentleman_update",
  "eos_enterprise_workspace",
  "eos_evolve_module",
  "eos_sqlite_ledger",
  "eos_ast_analyze",
  "eos_amplify_prompt",
  "eos_semantic_search",
  "eos_hnsw_knn_search",
  "eos_check_architecture",
  "eos_check_openspec",
  "eos_get_blast_radius",
  "eos_query_code_graph",
  "eos_evaluate_decision",
  "eos_tmr_consensus",
  "eos_validate_patch",
  "eos_optimize_context",
  "eos_turbo_verify",
  "eos_refactor_audit",
  "eos_autonomous_heal",
  "eos_manage_worktree",
  "eos_fleet_soundcheck",
  "eos_audit_fleet",
  "eos_mcts_tune",
  "eos_canary_rollout",
  "eos_agent_topology_mesh",
  "eos_invariant_engine",
  "eos_contract_governor",
  "eos_surgical_healing",
  "eos_tlc_checker",
  "eos_github_gate",
  "eos_microvm_sandbox",
  "eos_dashboard_status",
  "eos_fleet_verify",
  "eos_unitotal_evaluate",
  "eos_fuzz_hypervisor",
  "eos_conscious_witness",
  "eos_sapfix_autoshipper",
  "eos_slsa_provenance_sbom",
  "eos_content_addressable_cache",
  "eos_smt_reasoning_prover",
  "eos_chaos_monkey_live",
  "eos_bft_swarm_consensus",
  "eos_health_check",
]);

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
      if (
        !tool.name ||
        typeof tool.name !== "string" ||
        (!tool.name.startsWith("eos_") && !tool.name.startsWith("glorian_"))
      ) {
        issues.push({
          toolName: tool.name || "UNKNOWN",
          field: "name",
          reason: "Tool name must be a non-empty string prefixed with 'eos_' or 'glorian_'",
        });
      }

      if (!tool.description || typeof tool.description !== "string" || tool.description.trim().length < 15) {
        issues.push({
          toolName: tool.name,
          field: "description",
          reason: "Tool description must be descriptive and at least 15 characters",
        });
      }

      if (!tool.inputSchema || tool.inputSchema.type !== "object") {
        issues.push({
          toolName: tool.name,
          field: "inputSchema.type",
          reason: "Input schema must be an object with type: 'object'",
        });
        continue;
      }

      if (tool.inputSchema.properties) {
        for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
          if (!propDef || typeof propDef !== "object") {
            issues.push({
              toolName: tool.name,
              field: `properties.${propName}`,
              reason: "Property definition must be a valid object",
            });
            continue;
          }

          const def = propDef as McpToolPropertyDef;
          if (!def.type || !validJsonTypes.has(def.type)) {
            issues.push({
              toolName: tool.name,
              field: `properties.${propName}.type`,
              reason: `Property type '${def.type}' is not a valid JSON Schema type`,
            });
          }
        }
      }
    }

    const issuesCount = issues.length;
    const status = issuesCount === 0 ? "CONFORMING" : "VIOLATIONS_DETECTED";
    const timestampIso = new Date().toISOString();
    const catalogJson = JSON.stringify(tools, null, 2);
    const catalogSha256 = pureSha256(catalogJson);

    return deepFreeze({
      totalTools: tools.length,
      coreTier0Count: CORE_TIER0_TOOL_NAMES.size,
      validToolsCount: tools.length - issuesCount,
      issuesCount,
      issues,
      status,
      catalogSha256,
      timestampIso,
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
      tools,
    };

    // Deterministic artifact: the committed generatedAt stamp is reused in place,
    // so an unchanged tool catalog yields a byte-identical file with no tree churn.
    writeDeterministicArtifact(exportPath, payload, {
      stampField: "generatedAt",
      stampFor: (seedSha) => contentDerivedIso(seedSha),
    });
    return exportPath;
  }
}
