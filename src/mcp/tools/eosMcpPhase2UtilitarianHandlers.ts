/**
 * EOS SYSTEM — PHASE-2 CORE UTILITARIAN MCP HANDLERS (SPEC-155 / TASKS-090 T6)
 * Next extraction wave from eosMcpServer.ts god-file with semantic parity.
 */

import fs from "node:fs";
import path from "node:path";

import { evaluateDirectiveWithTMR, interpretJarvisDirective } from "../../core/eosJarvisMonad.ts";
import { validatePatch } from "../../core/eosPatchValidator.ts";
import { compressSourceContext } from "../../core/eosContextOptimizer.ts";
import { EosSemanticGraph } from "../../core/eosSemanticGraph.ts";
import { EosOpenSpecSync } from "../../core/eosOpenSpecSync.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";

const MAX_MCP_STRING_BYTES = 256 * 1024;

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveValidatePatchTarget(projectRoot: string, filePath: string): string {
  if (typeof filePath !== "string" || !filePath || Buffer.byteLength(filePath, "utf8") > 4096) {
    throw new TypeError("A project-relative target file path no longer than 4096 bytes is required.");
  }
  if (path.isAbsolute(filePath)) throw new Error("Patch validation accepts project-relative paths only.");
  const root = fs.realpathSync(projectRoot);
  const candidate = path.resolve(root, filePath);
  if (candidate === root || !isPathWithin(root, candidate)) {
    throw new Error("Patch target must stay inside the configured project root.");
  }
  let ancestor = path.dirname(candidate);
  const missingSegments: string[] = [];
  while (true) {
    try {
      fs.lstatSync(ancestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new Error("Unable to resolve the patch target's parent directory.");
      missingSegments.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
  const ancestorStat = fs.statSync(ancestor);
  if (!ancestorStat.isDirectory()) throw new Error("Patch target parent must be a directory.");
  const realAncestor = fs.realpathSync(ancestor);
  if (!isPathWithin(root, realAncestor)) {
    throw new Error("Patch target parent resolves outside the configured project root.");
  }
  const realParent = path.join(realAncestor, ...missingSegments);
  const safeTarget = path.join(realParent, path.basename(candidate));
  if (!isPathWithin(root, safeTarget)) {
    throw new Error("Patch target must stay inside the configured project root.");
  }
  try {
    const stat = fs.lstatSync(safeTarget);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("Patch target must be a regular non-symlink file.");
    }
    const realTarget = fs.realpathSync(safeTarget);
    if (!isPathWithin(root, realTarget)) {
      throw new Error("Patch target resolves outside the configured project root.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return path.relative(root, safeTarget);
}

export const PHASE2_CORE_UTILITARIAN_HANDLERS: Readonly<Record<string, McpToolHandler>> = {
  eos_tmr_consensus: (args) => {
    const directive = String(args.directive || "");
    const tmr = evaluateDirectiveWithTMR(directive);
    const thought = interpretJarvisDirective(directive);
    return {
      directive,
      consensusAchieved: tmr.consensusAchieved,
      agreementRatio: tmr.agreementRatio,
      selectedAction: tmr.selectedAction,
      consensusHash: tmr.consensusHash,
      sandboxes: tmr.sandboxes,
      voiceScript: thought.voiceTranscript
    };
  },

  eos_audit_fleet: (_args, ctx) => {
    const registryCandidate = path.join(ctx.projectRoot, "docs/projects/registry.json");
    let registry: { projects?: unknown } = { projects: [] };
    if (fs.existsSync(registryCandidate)) {
      registry = JSON.parse(fs.readFileSync(registryCandidate, "utf8"));
    }
    const registeredProjects = Array.isArray(registry.projects) ? registry.projects : [];
    return {
      scope: "LOCAL_REGISTRY_ONLY",
      externalProbesRun: false,
      fleetStatus: "NOT_PROBED",
      totalRegisteredProjects: registeredProjects.length,
      projects: registeredProjects.filter(isPlainRecord).map((project) => ({
        id: typeof project.id === "string" ? project.id : null,
        name: typeof project.name === "string" ? project.name : null,
        remoteUrl: typeof project.remoteUrl === "string" ? project.remoteUrl : null,
        health: "NOT_PROBED",
        ci: "NOT_PROBED",
        hooks: "NOT_PROBED"
      }))
    };
  },

  eos_validate_patch: (args, ctx) => {
    if (typeof args.content !== "string" || Buffer.byteLength(args.content, "utf8") > MAX_MCP_STRING_BYTES) {
      throw new RangeError("Patch content must be a string no larger than 256 KiB.");
    }
    const relativeTarget = resolveValidatePatchTarget(ctx.projectRoot, String(args.filePath || ""));
    return validatePatch(relativeTarget, args.content, ctx.projectRoot);
  },

  eos_optimize_context: (args, ctx) => {
    const filePath = typeof args.filePath === "string" ? args.filePath : "";
    let content = typeof args.content === "string" ? args.content : "";
    if (Buffer.byteLength(content, "utf8") > MAX_MCP_STRING_BYTES) {
      throw new RangeError("Context input exceeds the 256 KiB limit.");
    }
    if (!content && filePath) {
      const full = ctx.resolveProjectPath(filePath, "file");
      content = fs.readFileSync(full, "utf8");
    }
    return compressSourceContext(content, filePath);
  },

  eos_get_blast_radius: (args, ctx) => {
    const filePath = String(args.filePath || "");
    const graph = new EosSemanticGraph(ctx.projectRoot);
    return graph.calculateBlastRadius(filePath);
  },

  eos_query_code_graph: (_args, ctx) => {
    const graph = new EosSemanticGraph(ctx.projectRoot);
    return graph.getSummary();
  },

  eos_check_openspec: (args, ctx) => {
    const synchronizer = new EosOpenSpecSync(ctx.projectRoot);
    const action = String(args.action || "audit");
    if (action === "list_specs") return synchronizer.listSpecs();
    if (action === "list_changes") return synchronizer.listChanges();
    return synchronizer.audit();
  }
};

export const PHASE2_MIGRATED_TOOL_NAMES: readonly string[] = Object.freeze(
  Object.keys(PHASE2_CORE_UTILITARIAN_HANDLERS).sort()
);
