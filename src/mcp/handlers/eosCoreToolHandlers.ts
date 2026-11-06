/**
 * EOS SYSTEM — CORE MCP TOOL HANDLERS (Layer 0)
 * Governed by ADR-015, FR-022
 *
 * Contains the first 8 tool handlers extracted from the `dispatchTool`
 * switch/case in `eosMcpServer.ts`. Each handler is a plain `const`
 * implementing the `ToolHandler` interface from `eosToolRegistry.ts`.
 *
 * Handlers in this file:
 *  1. eos_semantic_search
 *  2. eos_tmr_consensus
 *  3. eos_audit_fleet
 *  4. eos_health_check
 *  5. eos_validate_patch
 *  6. eos_optimize_context
 *  7. eos_amplify_prompt
 *  8. eos_check_architecture
 *
 * Zero external runtime dependencies. All imports come from Node built-ins
 * or project-internal core modules.
 */

import fs from "node:fs";
import path from "node:path";

import {
  evaluateDirectiveWithTMR,
  interpretJarvisDirective,
} from "../../core/eosJarvisMonad.ts";

import { validatePatch } from "../../core/eosPatchValidator.ts";

import { compressSourceContext } from "../../core/eosContextOptimizer.ts";

import { amplifyPrompt } from "../../core/eosPromptAmplifier.ts";
import type { ModelFamily, StrictnessLevel } from "../../core/eosPromptAmplifier.ts";

import { scanArchitecture } from "../../core/eosArchitectureGuard.ts";

import type { ToolHandler } from "../eosToolRegistry.ts";

// ---------------------------------------------------------------------------
// 1. eos_semantic_search
// ---------------------------------------------------------------------------

/**
 * High-dimensional vector space query over the EOS sovereign knowledge base.
 * Supports hybrid RRF fusion (default) or pure cosine-vector mode.
 */
export const eosSemanticSearch: ToolHandler = {
  name: "eos_semantic_search",
  description:
    "Search EOS sovereign architecture and knowledge base using deterministic Layer-0 hybrid vector and BM25 RRF fusion.",

  handle(args, ctx) {
    const query  = String(args.query  ?? "");
    const topK   = Number(args.topK)  || 3;
    const mode   = args.mode === "vector" ? "vector" : "hybrid";

    const matches =
      mode === "vector"
        ? ctx.knowledgeStore.search(query, topK)
        : ctx.knowledgeStore.searchHybrid(query, topK);

    return {
      query,
      mode,
      matchCount: matches.length,
      matches: matches.map((m: {
        id: string;
        score: number;
        text: string;
        metadata?: Record<string, unknown>;
      }) => ({
        id:     m.id,
        score:  Number(m.score.toFixed(4)),
        text:   m.text,
        domain: (m.metadata as { domain?: string } | undefined)?.domain ?? "General",
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// 2. eos_tmr_consensus
// ---------------------------------------------------------------------------

/**
 * Runs a Triple-Modular Redundancy Byzantine 3-sandbox evaluation for the
 * given directive. Executes `evaluateDirectiveWithTMR` and
 * `interpretJarvisDirective` from `eosJarvisMonad`.
 */
export const eosTmrConsensus: ToolHandler = {
  name: "eos_tmr_consensus",
  description:
    "Execute Triple-Modular Redundancy (TMR) Byzantine 3-sandbox evaluation for a directive before committing mutations.",

  handle(args, _ctx) {
    const directive = String(args.directive ?? "");
    const tmr       = evaluateDirectiveWithTMR(directive);
    const thought   = interpretJarvisDirective(directive);

    return {
      directive,
      consensusAchieved: tmr.consensusAchieved,
      agreementRatio:    tmr.agreementRatio,
      selectedAction:    tmr.selectedAction,
      consensusHash:     tmr.consensusHash,
      sandboxes:         tmr.sandboxes,
      voiceScript:       thought.voiceTranscript,
    };
  },
};

// ---------------------------------------------------------------------------
// 3. eos_audit_fleet
// ---------------------------------------------------------------------------

/**
 * Audits the health, git status, and endpoints of all repositories in the
 * sovereign fleet by reading `docs/projects/registry.json`.
 *
 * Note: the `deep` parameter declared in the MCP schema is accepted but not
 * yet implemented at the registry level — this mirrors the current behaviour
 * in `eosMcpServer.ts` and is tracked for a future enhancement.
 */
export const eosAuditFleet: ToolHandler = {
  name: "eos_audit_fleet",
  description:
    "Audits the health, git status, and endpoints of all repositories in the sovereign fleet.",

  handle(args, ctx) {
    const registryPath = path.join(ctx.projectRoot, "docs/projects/registry.json");
    let registry: { projects: unknown[] } = { projects: [] };

    if (fs.existsSync(registryPath)) {
      registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
        projects: unknown[];
      };
    }

    return {
      fleetStatus:              "ONLINE",
      totalRegisteredProjects:  registry.projects.length,
      projects:                 registry.projects,
      enforcedStandards: [
        "SLSA Level 4",
        "Pre-Commit Secret Scanner",
        "Pre-Push CI/CD Gate",
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 4. eos_health_check
// ---------------------------------------------------------------------------

/**
 * Returns CNCF / Google SRE observability telemetry: process uptime,
 * RSS memory, heap usage, and a hard-coded subsystem inventory list.
 * Purely in-process — no external I/O.
 */
export const eosHealthCheck: ToolHandler = {
  name: "eos_health_check",
  description:
    "Retrieves CNCF / Google SRE observability telemetry, process memory RSS, and subsystem health.",

  handle(_args, _ctx) {
    const mem = process.memoryUsage();

    return {
      status:          "UP",
      tier:            "BIG_TECH_TIER_1",
      uptimeSeconds:   Math.floor(process.uptime()),
      memoryRssMb:     (mem.rss        / (1024 * 1024)).toFixed(2),
      heapUsedMb:      (mem.heapUsed   / (1024 * 1024)).toFixed(2),
      subsystems: [
        "JarvisSovereignMonad",
        "NeuralVectorCore",
        "LinuxKernelCore",
        "NanosecondEngine",
        "AkashicMemory",
        "SecDevOpsSevenGates",
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// 5. eos_validate_patch
// ---------------------------------------------------------------------------

/**
 * Pre-validates proposed code modifications in an in-memory AST sandbox to
 * detect syntax errors, plaintext secrets, and destructive commands before
 * any file is touched on disk. Delegates entirely to `validatePatch` from
 * `eosPatchValidator`.
 */
export const eosValidatePatch: ToolHandler = {
  name: "eos_validate_patch",
  description:
    "Pre-validates proposed code modifications in an in-memory AST sandbox to detect syntax errors, plaintext secrets, and destructive commands before touching disk.",

  handle(args, ctx) {
    const filePath = String(args.filePath ?? "");
    const content  = String(args.content  ?? "");

    return validatePatch(filePath, content, ctx.projectRoot);
  },
};

// ---------------------------------------------------------------------------
// 6. eos_optimize_context
// ---------------------------------------------------------------------------

/**
 * Compresses source code into a high-density structural outline (interfaces,
 * types, function signatures), saving 70-85% of tokens while retaining full
 * architectural contracts. If `content` is omitted, the file is read from
 * disk at `path.resolve(projectRoot, filePath)`.
 */
export const eosOptimizeContext: ToolHandler = {
  name: "eos_optimize_context",
  description:
    "Compresses source code into a high-density structural outline (extracting interfaces, types, and function signatures), saving 70-85% of tokens while retaining full architectural contracts.",

  handle(args, ctx) {
    const filePath = String(args.filePath ?? "");
    let content    = typeof args.content === "string" ? args.content : "";

    if (!content && filePath) {
      const full = path.resolve(ctx.projectRoot, filePath);
      if (fs.existsSync(full)) {
        content = fs.readFileSync(full, "utf8");
      }
    }

    return compressSourceContext(content, filePath);
  },
};

// ---------------------------------------------------------------------------
// 7. eos_amplify_prompt
// ---------------------------------------------------------------------------

/**
 * Amplifies an informal natural-language prompt into an ISO 29148 EARS
 * specification, BDD acceptance scenarios, boundary invariants, and
 * model-specific cognitive scaffolding. Delegates to `amplifyPrompt` from
 * `eosPromptAmplifier`.
 */
export const eosAmplifyPrompt: ToolHandler = {
  name: "eos_amplify_prompt",
  description:
    "Amplifies an informal prompt into a zero-vibe ISO 29148 EARS specification, BDD acceptance scenarios, boundary invariants, and model-specific cognitive scaffolding.",

  handle(args, _ctx) {
    const rawPrompt   = String(args.rawPrompt   ?? "");
    const targetModel = (args.targetModel ?? "universal") as ModelFamily;
    const strictLevel = (args.strictLevel ?? "hardened") as StrictnessLevel;

    return amplifyPrompt({ rawPrompt, targetModel, strictLevel });
  },
};

// ---------------------------------------------------------------------------
// 8. eos_check_architecture
// ---------------------------------------------------------------------------

/**
 * Statically analyses Clean/Hexagonal architecture boundaries, domain purity
 * (0 framework/UI imports in core), and detects circular import dependency
 * cycles. Delegates to `scanArchitecture` from `eosArchitectureGuard`.
 */
export const eosCheckArchitecture: ToolHandler = {
  name: "eos_check_architecture",
  description:
    "Statically analyzes Clean/Hexagonal boundaries, domain purity (0 framework/UI imports in core), and detects circular import dependency cycles.",

  handle(args, ctx) {
    const targetDir = args.targetDir
      ? path.resolve(ctx.projectRoot, String(args.targetDir))
      : path.resolve(ctx.projectRoot, "src");

    return scanArchitecture(targetDir, ctx.projectRoot);
  },
};

// ---------------------------------------------------------------------------
// Convenience barrel export
// ---------------------------------------------------------------------------

/**
 * All 8 core tool handlers as an ordered array, ready to be bulk-registered
 * on an `EosToolRegistry` instance:
 *
 * ```ts
 * import { CORE_TOOL_HANDLERS } from "./handlers/eosCoreToolHandlers.ts";
 * for (const h of CORE_TOOL_HANDLERS) registry.register(h);
 * ```
 */
export const CORE_TOOL_HANDLERS: readonly ToolHandler[] = Object.freeze([
  eosSemanticSearch,
  eosTmrConsensus,
  eosAuditFleet,
  eosHealthCheck,
  eosValidatePatch,
  eosOptimizeContext,
  eosAmplifyPrompt,
  eosCheckArchitecture,
]);
