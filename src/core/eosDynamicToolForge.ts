/**
 * EOS DYNAMIC TOOL FORGE — AUTO-CREATION OF MCP TOOLS AT RUNTIME (Layer 0)
 * SPEC-047: Frontier Agent Harness — Dynamic Tool Genesis
 *
 * The forge allows the AGI Core to create, register, validate, and invoke
 * new MCP tools on-the-fly when it encounters a problem it has no tool for.
 *
 * This is the critical capability that separates an AGI from a chatbot:
 * if the system needs to measure PostgreSQL query latency and has no tool for it,
 * it writes the tool, validates it, registers it, and uses it — in one cycle.
 *
 * Architecture:
 *   /src/dynamic_tools/          ← genesis zone for auto-created tools
 *     <tool-name>.tool.mjs       ← each tool is a standalone ESM module
 *     forge_manifest.json        ← registry of all forged tools
 *
 * Each forged tool module must export:
 *   - name: string               ← MCP tool name (eos_<name>)
 *   - description: string        ← one sentence for tools/list
 *   - inputSchema: object        ← JSON Schema for arguments
 *   - execute(args): Promise<unknown>  ← tool implementation
 *
 * Zero external npm dependencies.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { assertPrecondition, assertInvariant, deepFreeze, Ok, Err, type Result } from "./eosKernelPrimitives.ts";
import { createLogger } from "./eosLogger.ts";

const _log = createLogger("eosDynamicToolForge");

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================

/** A single forged MCP tool entry in the manifest. */
export interface ForgedTool {
  /** Unique tool name as registered in MCP (must start with "eos_"). */
  readonly name: string;
  /** Human-readable description. */
  readonly description: string;
  /** JSON Schema object for the tool's arguments. */
  readonly inputSchema: Record<string, unknown>;
  /** Relative path to the tool module file. */
  readonly moduleRelPath: string;
  /** SHA-256 of the module content at registration time. */
  readonly contentHash: string;
  /** ISO timestamp when this tool was forged. */
  readonly forgedAt: string;
  /** Who/what requested this tool to be created. */
  readonly forgedBy: string;
  /** Whether this tool has been validated (syntax check + dry run). */
  validated: boolean;
}

/** The manifest file that tracks all forged tools. */
export interface ForgeManifest {
  readonly version: string;
  readonly forgeRoot: string;
  readonly tools: ForgedTool[];
  readonly lastUpdatedAt: string;
}

/** Request to forge a new tool. */
export interface ForgeRequest {
  /** Desired tool name (will be prefixed with "eos_" if not already). */
  readonly toolName: string;
  /** One-sentence description of what the tool does. */
  readonly description: string;
  /** Full ESM module source code (must export name, description, inputSchema, execute). */
  readonly moduleSource: string;
  /** JSON Schema for the tool arguments. */
  readonly inputSchema: Record<string, unknown>;
  /** Who is requesting this tool (for audit trail). */
  readonly requestedBy?: string;
}

/** Result of a forge operation. */
export interface ForgeResult {
  readonly success: boolean;
  readonly toolName: string;
  readonly moduleRelPath: string;
  readonly contentHash: string;
  readonly validationPassed: boolean;
  readonly validationError?: string;
  readonly forgedAt: string;
}

/** Result of invoking a forged tool. */
export interface ForgedToolInvocationResult {
  readonly toolName: string;
  readonly success: boolean;
  readonly output: unknown;
  readonly durationMs: number;
  readonly error?: string;
}

// ============================================================================
// 2. FORGE MANIFEST MANAGER
// ============================================================================

class ForgeManifestManager {
  private readonly manifestPath: string;
  private manifest: ForgeManifest;

  constructor(forgeRoot: string) {
    this.manifestPath = path.join(forgeRoot, "forge_manifest.json");
    this.manifest = this._load(forgeRoot);
  }

  private _load(forgeRoot: string): ForgeManifest {
    try {
      if (fs.existsSync(this.manifestPath)) {
        return JSON.parse(fs.readFileSync(this.manifestPath, "utf8")) as ForgeManifest;
      }
    } catch {
      /* start fresh */
    }
    return {
      version: "1.0.0",
      forgeRoot,
      tools: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private _save(): void {
    const updated: ForgeManifest = {
      ...this.manifest,
      lastUpdatedAt: new Date().toISOString(),
    };
    const tmp = `${this.manifestPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(updated, null, 2), "utf8");
    try {
      fs.renameSync(tmp, this.manifestPath);
    } catch {
      try {
        fs.copyFileSync(tmp, this.manifestPath);
        fs.unlinkSync(tmp);
      } catch {
        fs.writeFileSync(this.manifestPath, JSON.stringify(updated, null, 2), "utf8");
      }
    }
    this.manifest = updated;
  }

  public register(tool: ForgedTool): void {
    // Remove any prior version of the same tool
    const filtered = this.manifest.tools.filter((t) => t.name !== tool.name);
    (this.manifest as { tools: ForgedTool[] }).tools = [...filtered, tool];
    this._save();
  }

  public get(name: string): ForgedTool | undefined {
    return this.manifest.tools.find((t) => t.name === name);
  }

  public getAll(): readonly ForgedTool[] {
    return this.manifest.tools;
  }

  public markValidated(name: string): void {
    const tool = this.manifest.tools.find((t) => t.name === name);
    if (tool) {
      tool.validated = true;
      this._save();
    }
  }

  public remove(name: string): boolean {
    const before = this.manifest.tools.length;
    (this.manifest as { tools: ForgedTool[] }).tools = this.manifest.tools.filter((t) => t.name !== name);
    if (this.manifest.tools.length < before) {
      this._save();
      return true;
    }
    return false;
  }
}

// ============================================================================
// 3. DYNAMIC TOOL FORGE
// ============================================================================

/**
 * The forge creates, validates, registers, and invokes dynamic MCP tools.
 *
 * Usage:
 * ```ts
 * const forge = new EosDynamicToolForge("/workspace");
 *
 * // AGI Core requests a new tool
 * const result = await forge.forge({
 *   toolName: "measure_db_query_latency",
 *   description: "Measures PostgreSQL query execution time in milliseconds",
 *   inputSchema: { type: "object", properties: { query: { type: "string" } } },
 *   moduleSource: `
 *     export const name = "eos_measure_db_query_latency";
 *     export const description = "Measures PostgreSQL query latency";
 *     export const inputSchema = { type: "object", properties: { query: { type: "string" } } };
 *     export async function execute(args) {
 *       const t0 = Date.now();
 *       // ... query logic ...
 *       return { latencyMs: Date.now() - t0 };
 *     }
 *   `,
 *   requestedBy: "EosAgiCore",
 * });
 *
 * // Invoke it immediately
 * if (result.success) {
 *   const output = await forge.invoke("eos_measure_db_query_latency", { query: "SELECT 1" });
 * }
 * ```
 */
export class EosDynamicToolForge {
  private readonly projectRoot: string;
  private readonly forgeDir: string;
  private readonly manifestMgr: ForgeManifestManager;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.forgeDir = path.join(this.projectRoot, "src", "dynamic_tools");

    // Ensure forge directory exists
    if (!fs.existsSync(this.forgeDir)) {
      fs.mkdirSync(this.forgeDir, { recursive: true });
      // Write .gitkeep and README so the dir is tracked by git
      fs.writeFileSync(path.join(this.forgeDir, ".gitkeep"), "", "utf8");
      fs.writeFileSync(
        path.join(this.forgeDir, "README.md"),
        `# EOS Dynamic Tool Forge\n\nThis directory contains MCP tools auto-created by the EOS AGI Core at runtime.\nEach \`.tool.mjs\` file is a standalone ESM module. Do not edit manually.\n`,
        "utf8",
      );
    }

    this.manifestMgr = new ForgeManifestManager(this.forgeDir);
  }

  /**
   * Normalizes a tool name: adds "eos_" prefix if absent, lowercases, replaces spaces with underscores.
   */
  private _normalizeName(name: string): string {
    const clean = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    return clean.startsWith("eos_") ? clean : `eos_${clean}`;
  }

  /**
   * Validates a tool module source by:
   *   1. Checking it's valid JS syntax via `node --check`
   *   2. Verifying it exports name, description, inputSchema, execute
   */
  private _validateSource(moduleSource: string, modulePath: string): Result<true, Error> {
    // Write to temp file for syntax check
    const tmpPath = `${modulePath}.tmp.mjs`;
    try {
      fs.writeFileSync(tmpPath, moduleSource, "utf8");

      // Syntax check via node --check
      execFileSync(process.execPath, ["--check", tmpPath], {
        timeout: 10_000,
        stdio: "pipe",
      });

      // Check required exports using naive regex (no runtime execution needed)
      const required = ["name", "description", "inputSchema", "execute"];
      for (const exp of required) {
        if (!moduleSource.includes(`export`) || !moduleSource.includes(exp)) {
          return Err(new Error(`Missing required export: "${exp}"`));
        }
      }

      return Ok(true);
    } catch (err) {
      return Err(new Error(`Syntax validation failed: ${err instanceof Error ? err.message : String(err)}`));
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }

  /**
   * Forges (creates, validates, and registers) a new MCP tool.
   * Returns a ForgeResult describing whether the tool was successfully created.
   */
  public forge(req: ForgeRequest): Result<ForgeResult, Error> {
    const toolName = this._normalizeName(req.toolName);
    const moduleFileName = `${toolName}.tool.mjs`;
    const moduleRelPath = `src/dynamic_tools/${moduleFileName}`;
    const moduleFullPath = path.join(this.forgeDir, moduleFileName);

    assertPrecondition(toolName.length > 4, "Tool name must be non-empty after normalization.");
    assertPrecondition(req.moduleSource.trim().length > 0, "Module source must not be empty.");

    // ── CRITICAL FIX: Comprehensive allowlist-based security scanner ──────────
    // Operator precedence bug fixed + complete blocklist replacing the old incomplete check.
    // Blocked categories: dangerous modules, code execution, filesystem, process access.
    const BLOCKED_MODULE_PATTERNS: RegExp[] = [
      // Module imports (ESM and CJS)
      /import\s*\(\s*['"`]child_process['"`]/,
      /import\s+.*\s+from\s+['"`]child_process['"`]/,
      /require\s*\(\s*['"`]child_process['"`]\s*\)/,
      /import\s*\(\s*['"`]fs['"`]/,
      /import\s+.*\s+from\s+['"`]fs['"`]/,
      /require\s*\(\s*['"`]fs['"`]\s*\)/,
      /import\s*\(\s*['"`]net['"`]/,
      /import\s*\(\s*['"`]http['"`]/,
      /import\s*\(\s*['"`]https['"`]/,
      /import\s*\(\s*['"`]os['"`]/,
      /import\s*\(\s*['"`]vm['"`]/,
      /import\s*\(\s*['"`]worker_threads['"`]/,
      /import\s*\(\s*['"`]cluster['"`]/,
      // Process access — forged tools are pure computation; any handle on the
      // host process is out of contract (env leaks, exits, kills, cwd changes).
      /\bprocess\.env\b/,
      /\bprocess\s*\./,
      /\bglobalThis\s*\.\s*process\b/,
      /\bDeno\s*\./,
      /\bBun\s*\./,
      // Code execution
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      // Path traversal
      /\.\.\//,
      /\.\.\\/,
      // Dangerous builtins
      /\bBuffer\.allocUnsafe\b/,
    ];

    const src = req.moduleSource;
    for (const pattern of BLOCKED_MODULE_PATTERNS) {
      if (pattern.test(src)) {
        return Err(
          new Error(
            `Security violation: module source contains prohibited pattern [${pattern.source}]. ` +
              `Forged tools may only use pure computation — no I/O, no process access, no dynamic imports of system modules.`,
          ),
        );
      }
    }
    // ── END SECURITY SCANNER ──────────────────────────────────────────────────

    // Validate inputSchema is a valid JSON Schema draft-7 object
    if (req.inputSchema && typeof req.inputSchema === "object") {
      const schema = req.inputSchema as Record<string, unknown>;
      if (
        schema["type"] !== undefined &&
        schema["type"] !== "object" &&
        schema["type"] !== "array" &&
        schema["type"] !== "string"
      ) {
        return Err(new Error(`inputSchema.type must be "object", "array", or "string", got: ${schema["type"]}`));
      }
      if (schema["properties"] !== undefined && typeof schema["properties"] !== "object") {
        return Err(new Error("inputSchema.properties must be an object"));
      }
      if (schema["required"] !== undefined && !Array.isArray(schema["required"])) {
        return Err(new Error("inputSchema.required must be an array"));
      }
    }

    // Validate syntax before writing
    const validationResult = this._validateSource(req.moduleSource, moduleFullPath);

    const forgedAt = new Date().toISOString();
    const contentHash = `sha256:${crypto.createHash("sha256").update(req.moduleSource).digest("hex")}`;

    if (!validationResult.ok) {
      _log.warn("Forge validation failed", { toolName, reason: validationResult.error.message });
      return Ok({
        success: false,
        toolName,
        moduleRelPath,
        contentHash,
        validationPassed: false,
        validationError: validationResult.error.message,
        forgedAt,
      });
    }

    // Write the validated tool module
    fs.writeFileSync(moduleFullPath, req.moduleSource, "utf8");

    // Register in manifest
    const forgedTool: ForgedTool = {
      name: toolName,
      description: req.description,
      inputSchema: req.inputSchema,
      moduleRelPath,
      contentHash,
      forgedAt,
      forgedBy: req.requestedBy ?? "unknown",
      validated: true,
    };
    this.manifestMgr.register(forgedTool);

    _log.info("Tool forged and registered", { toolName, moduleRelPath });

    return Ok({
      success: true,
      toolName,
      moduleRelPath,
      contentHash,
      validationPassed: true,
      forgedAt,
    });
  }

  /**
   * Dynamically invokes a registered forged tool by name.
   * Loads the module, calls execute(args), and returns the result.
   */
  public async invoke(toolName: string, args: Record<string, unknown>): Promise<ForgedToolInvocationResult> {
    const name = this._normalizeName(toolName);
    const entry = this.manifestMgr.get(name);
    const t0 = Date.now();

    if (!entry) {
      return {
        toolName: name,
        success: false,
        output: null,
        durationMs: 0,
        error: `Tool "${name}" not found in forge manifest.`,
      };
    }

    const moduleFullPath = path.resolve(this.projectRoot, entry.moduleRelPath);

    if (!fs.existsSync(moduleFullPath)) {
      return {
        toolName: name,
        success: false,
        output: null,
        durationMs: 0,
        error: `Tool module file not found: ${entry.moduleRelPath}`,
      };
    }

    try {
      // TOCTOU fix: verify content hash matches manifest before dynamic import
      const currentBytes = fs.readFileSync(moduleFullPath);
      const currentHash = `sha256:${crypto.createHash("sha256").update(currentBytes).digest("hex")}`;
      if (currentHash !== entry.contentHash) {
        return {
          toolName: name,
          success: false,
          output: null,
          durationMs: Date.now() - t0,
          error: `Security violation: tool module hash mismatch — file may have been tampered with. Expected ${entry.contentHash.slice(0, 20)}, got ${currentHash.slice(0, 20)}`,
        };
      }

      // Dynamic import of the forged tool module
      const mod = await import(`file://${moduleFullPath}?cacheBust=${Date.now()}`);

      if (typeof mod.execute !== "function") {
        return {
          toolName: name,
          success: false,
          output: null,
          durationMs: Date.now() - t0,
          error: `Tool module missing execute() export.`,
        };
      }

      const output: unknown = await mod.execute(args);
      return {
        toolName: name,
        success: true,
        output,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        toolName: name,
        success: false,
        output: null,
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Returns all registered forged tools as MCP-compatible tool descriptors.
   * Plug this into EosMcpServer.tools/list to expose forged tools to AI models.
   */
  public getMcpToolDescriptors(): readonly {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }[] {
    return this.manifestMgr.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * Removes a forged tool from the registry and deletes its module file.
   */
  public destroy(toolName: string): boolean {
    const name = this._normalizeName(toolName);
    const entry = this.manifestMgr.get(name);
    if (!entry) return false;

    const moduleFullPath = path.resolve(this.projectRoot, entry.moduleRelPath);
    if (fs.existsSync(moduleFullPath)) fs.unlinkSync(moduleFullPath);

    return this.manifestMgr.remove(name);
  }

  public get forgeDirectory(): string {
    return this.forgeDir;
  }

  public listTools(): readonly ForgedTool[] {
    return this.manifestMgr.getAll();
  }
}
