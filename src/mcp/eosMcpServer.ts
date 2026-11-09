/**
 * EOS SYSTEM — MODEL CONTEXT PROTOCOL (MCP) NATIVE SERVER (Layer 0)
 * Governed by ADR-015, FR-022 & BDD-017
 *
 * Implements the open Model Context Protocol (MCP) JSON-RPC 2.0 specification over stdio.
 * Enables Cursor, Antigravity, Claude Code, and Gemini to invoke EOS sovereign tools:
 * - eos_semantic_search: High-dimensional vector space queries.
 * - eos_tmr_consensus: Triple-Modular Redundancy Byzantine evaluation of directives.
 * - eos_audit_fleet: Cross-repository health and git status checks.
 * - eos_simulate_bounded_models: bounded JavaScript simulations associated with TLA+ text files.
 * - eos_health_check: CNCF / Google SRE observability telemetry.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultEosKnowledgeStore } from "../core/eosNeuralVectorCore.ts";
import { EosHybridKnowledgeEngine, getDefaultHybridKnowledgeEngine } from "../core/eosHybridKnowledgeEngine.ts";
import { EosKnowledgeGraphEngine, getDefaultKnowledgeGraphEngine } from "../core/eosKnowledgeGraphEngine.ts";
import { EosWasmSandboxEngine, getDefaultWasmSandboxEngine } from "../core/eosWasmSandboxEngine.ts";
import {
  EosUniversalAgentSessionContract,
  getDefaultAgentSessionContract,
} from "../core/eosUniversalAgentSessionContract.ts";
import { EosOtelTraceEngine } from "../core/eosOtelDistributedTracing.ts";
import { EosHnswVectorEngine } from "../core/eosHnswVectorEngine.ts";
import { EosMonotonicHashChain } from "../core/eosMonotonicHashChain.ts";
import { EosAntigravityDirector } from "../core/eosAntigravityDirector.ts";
import { EosAgentTopologyMesh } from "../core/eosAgentTopologyMesh.ts";
import { EosLsmTreeStorageEngine } from "../core/eosLsmTreeStorageEngine.ts";
import { annotateAndFilterTools, normalizeToolProfile, type McpToolProfile } from "./eosMcpToolCatalog.ts";
import { EOS_MCP_TOOL_DEFINITIONS } from "./eosMcpToolDefinitions.ts";
import { dispatchLegacyTool } from "./dispatch/eosLegacyDispatch.ts";
import { EosMcpDispatchRegistry } from "./eosMcpDispatchRegistry.ts";
import { PHASE1_CORE_UTILITARIAN_HANDLERS } from "./tools/eosMcpCoreUtilitarianHandlers.ts";
import { PHASE2_CORE_UTILITARIAN_HANDLERS } from "./tools/eosMcpPhase2UtilitarianHandlers.ts";
import { createPhase3CoreHandlers } from "./tools/eosMcpPhase3CoreHandlers.ts";
import { createPhase4InstitutionalHandlers } from "./tools/eosMcpPhase4InstitutionalHandlers.ts";
import { createPhase5DomainHandlers } from "./tools/eosMcpPhase5DomainHandlers.ts";
import { createPhase6DomainHandlers } from "./tools/eosMcpPhase6DomainHandlers.ts";
import { createPhase7DomainHandlers } from "./tools/eosMcpPhase7DomainHandlers.ts";
import { createPhase8AgiHandlers } from "./tools/eosMcpPhase8AgiHandlers.ts";
import { resolveConfinedLedgerPath, resolveProjectPath } from "./eosMcpPathResolver.ts";
import { EosMcpSchemaValidator, type McpToolSchemaDef } from "../core/eosMcpSchemaValidator.ts";
import { appendIamAuditEntry } from "../core/eosIamAuditLedger.ts";
import type { BreakGlassGrant } from "../core/eosIamBreakGlass.ts";
import type { IamPolicyRule, IamPrincipal } from "../core/eosMultiTenantIamFoundation.ts";
import { EosMcpIamRuntime } from "./eosMcpIamRuntime.ts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

const MAX_MCP_REQUEST_BYTES = 1024 * 1024;
const MAX_MCP_STRING_BYTES = 256 * 1024;
const MAX_MCP_NESTING_DEPTH = 24;
const MAX_MCP_VALUE_COUNT = 20_000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateBoundedJson(value: unknown): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let visited = 0;

  while (pending.length > 0) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > MAX_MCP_VALUE_COUNT) throw new RangeError("MCP arguments exceed the item-count limit.");
    if (current.depth > MAX_MCP_NESTING_DEPTH) throw new RangeError("MCP arguments exceed the nesting-depth limit.");

    if (typeof current.value === "string") {
      if (Buffer.byteLength(current.value, "utf8") > MAX_MCP_STRING_BYTES) {
        throw new RangeError("An MCP string argument exceeds the 256 KiB limit.");
      }
      continue;
    }
    if (current.value === null || typeof current.value === "boolean") continue;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) throw new TypeError("MCP numeric arguments must be finite.");
      continue;
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_MCP_VALUE_COUNT)
        throw new RangeError("An MCP array exceeds the item-count limit.");
      for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (isPlainRecord(current.value)) {
      const entries = Object.entries(current.value);
      for (const [key, child] of entries) {
        if (Buffer.byteLength(key, "utf8") > 1024) throw new RangeError("An MCP object key exceeds the 1 KiB limit.");
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
          throw new TypeError("MCP arguments cannot contain prototype-control keys.");
        }
        pending.push({ value: child, depth: current.depth + 1 });
      }
      continue;
    }
    throw new TypeError("MCP arguments must contain JSON values only.");
  }
}

export class EosMcpServer {
  /** Shared HNSW index for MCP vector tools (Phase-3 handlers bind the same instance). */
  public static readonly globalHnsw = new EosHnswVectorEngine({ dimensions: 128, m: 16 });
  private static globalHashChain = new EosMonotonicHashChain();
  private static globalMeshRing = EosAgentTopologyMesh.createRingBufferMesh(256);
  private static globalLsmEngine = new EosLsmTreeStorageEngine(10);
  private readonly knowledgeStore = createDefaultEosKnowledgeStore();
  private readonly hybridKnowledge: EosHybridKnowledgeEngine;
  private readonly wasmSandbox: EosWasmSandboxEngine;
  private readonly knowledgeGraph: EosKnowledgeGraphEngine;
  private readonly agentSessionContract: EosUniversalAgentSessionContract;
  private readonly projectRoot: string;
  private readonly serverVersion: string;
  private toolProfile: McpToolProfile;
  private readonly dispatchRegistry = new EosMcpDispatchRegistry();
  private iam: EosMcpIamRuntime;

  constructor(projectRoot?: string, profile?: McpToolProfile) {
    this.toolProfile = normalizeToolProfile(profile ?? process.env.EOS_MCP_PROFILE);
    const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
    const repoCandidate = path.resolve(currentDir, "../../");

    if (projectRoot && fs.existsSync(path.join(projectRoot, "package.json"))) {
      this.projectRoot = fs.realpathSync(projectRoot);
    } else if (process.env.EOS_PROJECT_ROOT && fs.existsSync(path.join(process.env.EOS_PROJECT_ROOT, "package.json"))) {
      this.projectRoot = fs.realpathSync(process.env.EOS_PROJECT_ROOT);
    } else if (fs.existsSync(path.join(repoCandidate, "package.json"))) {
      this.projectRoot = fs.realpathSync(repoCandidate);
    } else if (fs.existsSync(path.join(process.cwd(), "package.json"))) {
      this.projectRoot = fs.realpathSync(process.cwd());
    } else {
      this.projectRoot = repoCandidate;
    }

    let version = "unknown";
    try {
      const packageInfo = JSON.parse(fs.readFileSync(path.join(this.projectRoot, "package.json"), "utf8"));
      if (typeof packageInfo.version === "string" && packageInfo.version.length <= 64) version = packageInfo.version;
    } catch {
      // The MCP server can still operate when package metadata is unavailable.
    }
    this.serverVersion = version;
    this.hybridKnowledge = getDefaultHybridKnowledgeEngine(this.projectRoot);
    this.wasmSandbox = getDefaultWasmSandboxEngine(this.projectRoot);
    try {
      this.hybridKnowledge.ensureCorpusIndexed();
    } catch {
      // Graceful degradation in read-only or confined file systems
    }
    let kg: EosKnowledgeGraphEngine;
    try {
      kg = getDefaultKnowledgeGraphEngine(this.projectRoot);
      const gStats = kg.getGraphStats();
      if (gStats.totalNodes === 0) {
        kg.syncGraph();
      }
    } catch {
      kg = new EosKnowledgeGraphEngine(this.projectRoot, ":memory:");
    }
    this.knowledgeGraph = kg;
    this.agentSessionContract = getDefaultAgentSessionContract(this.projectRoot);
    // SPEC-155 Phase-1..5: Tier-0 + institutional + Spotify domain via registry (god-file residual shrinks).
    this.dispatchRegistry.registerAll(PHASE1_CORE_UTILITARIAN_HANDLERS);
    this.dispatchRegistry.registerAll(PHASE2_CORE_UTILITARIAN_HANDLERS);
    this.dispatchRegistry.registerAll(
      createPhase3CoreHandlers({
        projectRoot: this.projectRoot,
        resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
        resolveConfinedLedgerPath: (value) => this.resolveConfinedLedgerPath(value),
        hybridKnowledge: this.hybridKnowledge,
        knowledgeStore: this.knowledgeStore,
        agentSessionContract: this.agentSessionContract,
        hnsw: EosMcpServer.globalHnsw,
      }),
    );
    this.dispatchRegistry.registerAll(createPhase4InstitutionalHandlers(this.projectRoot));
    this.dispatchRegistry.registerAll(
      createPhase5DomainHandlers({
        projectRoot: this.projectRoot,
        resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
      }),
    );
    this.dispatchRegistry.registerAll(
      createPhase6DomainHandlers({
        projectRoot: this.projectRoot,
        resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
      }),
    );
    this.dispatchRegistry.registerAll(
      createPhase7DomainHandlers({
        projectRoot: this.projectRoot,
        resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
        resolveConfinedLedgerPath: (value) => this.resolveConfinedLedgerPath(value),
        hybridKnowledge: this.hybridKnowledge,
        knowledgeStore: this.knowledgeStore,
        knowledgeGraph: this.knowledgeGraph,
        agentSessionContract: this.agentSessionContract,
        hnsw: EosMcpServer.globalHnsw,
        server: this,
      }),
    );
    this.dispatchRegistry.registerAll(
      createPhase8AgiHandlers({
        projectRoot: this.projectRoot,
      }),
    );
    this.iam = new EosMcpIamRuntime(this.projectRoot);
  }

  public setToolProfile(profile: McpToolProfile): void {
    this.toolProfile = normalizeToolProfile(profile);
  }

  /** Test/dogfood hook: replace in-memory IAM policies (SPEC-184 MCP gate). */
  public configureIamPolicies(policies: readonly IamPolicyRule[]): void {
    this.iam.configurePolicies(policies);
  }

  /** Test/dogfood hook: set a default principal when _meta.iam is absent. */
  public configureIamDefaultPrincipal(principal: IamPrincipal | null): void {
    this.iam.configureDefaultPrincipal(principal);
  }

  /** Test/dogfood hook: install or clear a break-glass grant for mutating tools/call. */
  public configureBreakGlassGrant(grant: BreakGlassGrant | null): void {
    this.iam.configureBreakGlassGrant(grant);
  }

  /** Tool names with a modular handler registered in the dispatch registry. */
  public listRegisteredTools(): readonly string[] {
    return this.dispatchRegistry.listRegistered();
  }

  private resolveConfinedLedgerPath(value: unknown): string {
    return resolveConfinedLedgerPath(this.projectRoot, value);
  }

  private resolveProjectPath(value: unknown, kind: "file" | "directory", defaultPath?: string): string {
    return resolveProjectPath(this.projectRoot, value, kind, defaultPath);
  }

  public handleRequest(
    req: JsonRpcRequest,
    onProgress?: (progress: number, total?: number, message?: string) => void,
  ): JsonRpcResponse | null {
    const fallbackId =
      isPlainRecord(req) &&
      ((typeof req.id === "string" && Buffer.byteLength(req.id, "utf8") <= 128) ||
        (typeof req.id === "number" && Number.isFinite(req.id)) ||
        req.id === null)
        ? (req.id as string | number | null)
        : null;
    if (!isPlainRecord(req)) {
      return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request." } };
    }
    let serializedRequest: string;
    try {
      const serialized = JSON.stringify(req);
      if (typeof serialized !== "string") throw new TypeError("Request did not serialize to JSON.");
      serializedRequest = serialized;
    } catch {
      return { jsonrpc: "2.0", id: fallbackId, error: { code: -32600, message: "Invalid JSON-RPC request." } };
    }
    if (Buffer.byteLength(serializedRequest, "utf8") > MAX_MCP_REQUEST_BYTES) {
      return {
        jsonrpc: "2.0",
        id: fallbackId,
        error: { code: -32600, message: "MCP request exceeds the 1 MiB limit." },
      };
    }
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string" || req.method.length > 128) {
      return { jsonrpc: "2.0", id: fallbackId, error: { code: -32600, message: "Invalid JSON-RPC request." } };
    }
    if (
      req.id !== undefined &&
      req.id !== null &&
      (typeof req.id !== "string" || Buffer.byteLength(req.id, "utf8") > 128) &&
      (typeof req.id !== "number" || !Number.isFinite(req.id))
    ) {
      return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC request ID." } };
    }
    if (req.params !== undefined && !isPlainRecord(req.params)) {
      return { jsonrpc: "2.0", id: fallbackId, error: { code: -32602, message: "MCP params must be a JSON object." } };
    }
    try {
      validateBoundedJson(req.params ?? {});
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: fallbackId,
        error: { code: -32602, message: error instanceof Error ? error.message : "MCP params are invalid." },
      };
    }

    const { id, method, params } = req;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        return null;
      }
    }

    try {
      switch (method) {
        case "initialize": {
          const negotiatedProtocol = params?.protocolVersion === "2025-03-26" ? "2025-03-26" : "2024-11-05";
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: negotiatedProtocol,
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
              serverInfo: {
                name: "eos-system-mcp",
                version: this.serverVersion,
                description:
                  "Sovereign Engineering Operating System Control Plane & Active Antigravity Mission Director.",
              },
              instructions: EosAntigravityDirector.DIRECTOR_INSTRUCTIONS_PLAYBOOK,
            },
          };
        }

        case "ping":
          return {
            jsonrpc: "2.0",
            id,
            result: {},
          };

        case "tools/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: annotateAndFilterTools(EOS_MCP_TOOL_DEFINITIONS, this.toolProfile),
            },
          };

        case "tools/call": {
          const toolName = params?.name;
          const args = params?.arguments === undefined ? {} : params.arguments;
          if (typeof toolName !== "string" || toolName.length < 1 || toolName.length > 128) {
            throw new TypeError("Tool name must contain 1 to 128 characters.");
          }
          if (!isPlainRecord(args)) throw new TypeError("Tool arguments must be a JSON object.");

          const catalog = annotateAndFilterTools(
            EOS_MCP_TOOL_DEFINITIONS,
            this.toolProfile,
          ) as unknown as McpToolSchemaDef[];
          const argGate = new EosMcpSchemaValidator(this.projectRoot).validateToolCallArguments(
            catalog,
            toolName,
            args,
          );
          if (!argGate.ok) {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: -32602,
                message: `Invalid params: ${argGate.reason}`,
                data: { code: argGate.code, field: argGate.field, toolName: argGate.toolName },
              },
            };
          }

          const authz = this.iam.authorizeToolsCall({
            toolName,
            args,
            meta: isPlainRecord(params?._meta) ? params._meta : null,
          });
          if (authz.gate.required && authz.gate.decision) {
            try {
              appendIamAuditEntry(this.projectRoot, {
                toolName,
                decision: authz.gate.decision,
                principal: authz.gate.principal,
                resourceId: authz.gate.resourceId,
                requestId: id,
              });
            } catch (auditErr: any) {
              return {
                jsonrpc: "2.0",
                id,
                error: {
                  code: -32030,
                  message: "IAM audit ledger append failed (fail-closed).",
                  data: {
                    code: "DENY_AUDIT_IO",
                    reason: String(auditErr?.message || auditErr),
                    toolName,
                  },
                },
              };
            }
          }
          if (!authz.ok) {
            return { jsonrpc: "2.0", id, error: authz.error };
          }

          const traceEngine = EosOtelTraceEngine.getInstance({ projectRoot: this.projectRoot });
          const traceparent = (params?._meta as any)?.traceparent || (params as any)?.traceparent;
          const span = traceEngine.startSpan(`mcp.tool.${toolName}`, {
            parentContext: traceparent,
            kind: "SERVER",
            attributes: {
              "mcp.tool_name": toolName,
              "mcp.request_id": String(id),
              "mcp.iam.required": authz.iamRequired,
              "mcp.iam.code": authz.iamCode,
            },
          });

          let rawResult: any;
          try {
            rawResult = this.dispatchTool(toolName, authz.dispatchArgs, onProgress);
          } catch (dispatchErr: any) {
            span.recordException(dispatchErr);
            span.end();
            throw dispatchErr;
          }

          if (rawResult instanceof Promise) {
            return rawResult.then(
              (result) => {
                span.setAttribute("mcp.success", true);
                span.end();
                const resultText = typeof result === "string" ? result : (JSON.stringify(result, null, 2) ?? "null");
                if (Buffer.byteLength(resultText, "utf8") > MAX_MCP_REQUEST_BYTES - 4096) {
                  throw new RangeError("MCP tool output exceeds the 1 MiB response limit.");
                }
                return {
                  jsonrpc: "2.0",
                  id,
                  result: {
                    content: [
                      {
                        type: "text",
                        text: resultText,
                      },
                    ],
                  },
                };
              },
              (promiseErr) => {
                span.recordException(promiseErr);
                span.end();
                throw promiseErr;
              },
            ) as any;
          }
          span.setAttribute("mcp.success", true);
          span.end();
          const result = rawResult;
          const resultText = typeof result === "string" ? result : (JSON.stringify(result, null, 2) ?? "null");
          if (Buffer.byteLength(resultText, "utf8") > MAX_MCP_REQUEST_BYTES - 4096) {
            throw new RangeError("MCP tool output exceeds the 1 MiB response limit.");
          }
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: resultText,
                },
              ],
            },
          };
        }

        case "resources/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              resources: [
                {
                  uri: "eos://specs/constitution",
                  name: "EOS Constitution & Inviolable Laws",
                  mimeType: "text/markdown",
                },
                {
                  uri: "eos://evidence/receipt",
                  name: "Local Repository Checks Receipt",
                  mimeType: "application/json",
                },
                {
                  uri: "eos://projects/registry",
                  name: "Sovereign Fleet Project Registry",
                  mimeType: "application/json",
                },
                {
                  uri: "eos://antigravity/director-playbook",
                  name: "EOS Sovereign Antigravity MCP Director Playbook",
                  mimeType: "text/markdown",
                },
              ],
            },
          };

        case "prompts/list":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              prompts: [
                {
                  name: "eos-direct-mission",
                  description:
                    "Classify and orchestrate an engineering mission in Antigravity under EOS Seven Inviolable Commandments.",
                  arguments: [
                    { name: "directive", description: "Mission goal or user prompt", required: true },
                    { name: "target", description: "Registered project ID or workspace path", required: false },
                  ],
                },
                {
                  name: "eos-sdd-gate",
                  description:
                    "Generate formal IEEE 830 EARS requirements, BDD acceptance criteria, and ADR plan prior to implementation.",
                  arguments: [{ name: "feature", description: "Feature or specification title", required: true }],
                },
                {
                  name: "eos-fleet-audit",
                  description:
                    "Run Spotify Soundcheck, MCTS parameter tuning, and canary readiness audit across the sovereign fleet.",
                  arguments: [],
                },
              ],
            },
          };

        case "prompts/get": {
          const promptName = params?.name;
          const promptArgs = isPlainRecord(params?.arguments) ? params!.arguments : {};
          if (typeof promptName !== "string" || promptName.length < 1 || promptName.length > 128) {
            throw new TypeError("Prompt name must be a non-empty string.");
          }
          if (promptName === "eos-direct-mission") {
            const directive = String(promptArgs.directive || "Audit and verify current workspace invariants");
            const target = String(promptArgs.target || "eos-system");
            const plan = EosAntigravityDirector.directMission(directive, target, this.projectRoot);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                description: `EOS Sovereign Mission Plan (${plan.profile})`,
                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: `Execute mission under EOS Control Plane:\n${JSON.stringify(plan, null, 2)}`,
                    },
                  },
                ],
              },
            };
          }
          if (promptName === "eos-sdd-gate") {
            const feature = String(promptArgs.feature || "New Feature");
            return {
              jsonrpc: "2.0",
              id,
              result: {
                description: `EOS Strict SDD Gate for ${feature}`,
                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: `Call eos_amplify_prompt for "${feature}", formalize INTAKE, SPEC (EARS + BDD), PLAN (ADRs), TASKS (DAG), and verify LEVEL 2+ authorization before writing implementation code.`,
                    },
                  },
                ],
              },
            };
          }
          if (promptName === "eos-fleet-audit") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                description: "EOS Sovereign Fleet Soundcheck & Canary Readiness",
                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: "Execute eos_fleet_soundcheck, eos_turbo_verify, and eos_antigravity_doctor, then report scores with SHA-256 receipts.",
                    },
                  },
                ],
              },
            };
          }
          throw new Error(`Unknown prompt: ${promptName}`);
        }

        case "resources/read": {
          const uri = params?.uri;
          if (typeof uri !== "string") throw new TypeError("Resource URI must be a string.");
          const content = this.readResource(uri);
          const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: uri?.endsWith(".json") ? "application/json" : "text/markdown",
                  text: content,
                },
              ],
            },
          };
          if (Buffer.byteLength(JSON.stringify(response), "utf8") > MAX_MCP_REQUEST_BYTES) {
            throw new RangeError("MCP resource output exceeds the 1 MiB response limit.");
          }
          return response;
        }

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message.slice(0, 512) : "MCP operation failed.",
          data: "Stack traces are not exposed by the MCP server.",
        },
      };
    }
  }

  private dispatchTool(
    toolName: string,
    args: Record<string, any>,
    onProgress?: (progress: number, total?: number, message?: string) => void,
  ): any {
    // SPEC-153: auto-record dispatched tools onto live session DAGs (Cursor/Antigravity preferred).
    try {
      if (toolName !== "eos_agent_session_contract") {
        this.agentSessionContract.recordToolAcrossLiveSessions(toolName);
      }
    } catch {
      // Never block tool dispatch on session ledger I/O
    }

    // SPEC-155: prefer modular utilitarian facades before the legacy god-file switch.
    // SPEC-155 T7/T8: Phase-1..4 tools dispatch via registry (migrated switch arms purged).
    const modular = this.dispatchRegistry.tryDispatch(toolName, args, {
      projectRoot: this.projectRoot,
      resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
      onProgress,
    });
    if (modular.handled) {
      return modular.result;
    }

    return dispatchLegacyTool(
      {
        projectRoot: this.projectRoot,
        knowledgeGraph: this.knowledgeGraph,
        hnsw: EosMcpServer.globalHnsw,
        resolveProjectPath: (value, kind, fallback) => this.resolveProjectPath(value, kind, fallback),
      },
      toolName,
      args,
      onProgress,
    );
  }

  private readResource(uri: string): string {
    if (typeof uri !== "string" || Buffer.byteLength(uri, "utf8") > 256) {
      throw new TypeError("Resource URI must be a string no longer than 256 UTF-8 bytes.");
    }
    switch (uri) {
      case "eos://antigravity/director-playbook":
        return EosAntigravityDirector.DIRECTOR_INSTRUCTIONS_PLAYBOOK;
      case "eos://specs/constitution": {
        const specCandidate = path.join(this.projectRoot, "docs/specs/spec.md");
        const specPath = fs.existsSync(specCandidate) ? this.resolveProjectPath("docs/specs/spec.md", "file") : null;
        if (specPath) return fs.readFileSync(specPath, "utf8");
        return "# EOS Constitution\nZero Vibe Coding & 7 Inviolable Laws active.";
      }
      case "eos://evidence/receipt": {
        const receiptCandidate = path.join(this.projectRoot, "docs/evidence/LOCAL-CHECKS-RECEIPT.json");
        const receiptPath = fs.existsSync(receiptCandidate)
          ? this.resolveProjectPath("docs/evidence/LOCAL-CHECKS-RECEIPT.json", "file")
          : null;
        if (receiptPath) return fs.readFileSync(receiptPath, "utf8");
        return JSON.stringify({ status: "NO_RECEIPT" });
      }
      case "eos://projects/registry": {
        const regCandidate = path.join(this.projectRoot, "docs/projects/registry.json");
        const regPath = fs.existsSync(regCandidate)
          ? this.resolveProjectPath("docs/projects/registry.json", "file")
          : null;
        if (regPath) return fs.readFileSync(regPath, "utf8");
        return JSON.stringify({ projects: [] });
      }
      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }
  }

  public startStdioLoop(): void {
    const processLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const req: JsonRpcRequest = JSON.parse(trimmed);
        const res = this.handleRequest(req, (progress, total, msg) => {
          if (req.id !== undefined && req.id !== null) {
            const notif = {
              jsonrpc: "2.0",
              method: "notifications/progress",
              params: { progressToken: req.id, progress, total, message: msg },
            };
            process.stdout.write(JSON.stringify(notif) + "\n");
          }
        });
        if (res) {
          process.stdout.write(JSON.stringify(res) + "\n");
        }
      } catch {
        const errorRes: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error: Invalid JSON",
          },
        };
        process.stdout.write(JSON.stringify(errorRes) + "\n");
      }
    };

    let pending = "";
    let discardingOversizedLine = false;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      let start = 0;
      while (start <= chunk.length) {
        const newline = chunk.indexOf("\n", start);
        const end = newline < 0 ? chunk.length : newline;
        if (!discardingOversizedLine) {
          pending += chunk.slice(start, end);
          if (Buffer.byteLength(pending, "utf8") > MAX_MCP_REQUEST_BYTES) {
            process.stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: "MCP request exceeds the 1 MiB limit." },
              }) + "\n",
            );
            pending = "";
            discardingOversizedLine = true;
          }
        }
        if (newline < 0) break;
        if (!discardingOversizedLine) processLine(pending);
        pending = "";
        discardingOversizedLine = false;
        start = newline + 1;
      }
    });
    process.stdin.on("end", () => {
      if (!discardingOversizedLine && pending) processLine(pending);
    });
  }
}

// Auto-start stdio loop if executed directly from CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("eosMcpServer.ts")) {
  const server = new EosMcpServer();
  server.startStdioLoop();
}
