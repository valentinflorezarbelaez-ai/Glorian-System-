/**
 * EOS SYSTEM — PHASE-3 CORE MCP HANDLERS (SPEC-155 / T7b)
 * Completes Tier-0 core extraction: remaining 13 CORE_TIER0 tools leave the god-file switch.
 * Apex doctrine: single dispatch authority (SpaceX), modular purity (Apple), evidence-first (DeepMind/DARPA).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { EosAutonomousHealer } from "../../core/eosAutonomousHealer.ts";
import { EosWorktreeOrchestrator } from "../../core/eosWorktreeOrchestrator.ts";
import { EosHnswVectorEngine } from "../../core/eosHnswVectorEngine.ts";
import { EosContinuousRefactorEngine } from "../../core/eosContinuousRefactorEngine.ts";
import { EosMctsHyperTuner } from "../../core/eosMctsHyperTuner.ts";
import { EosAntigravityDirector } from "../../core/eosAntigravityDirector.ts";
import {
  EosDurableSqliteLedger,
  type LedgerCategory
} from "../../core/eosDurableSqliteLedger.ts";
import { EosGentlemanAutoUpdater } from "../../core/eosGentlemanAutoUpdater.ts";
import { EosGentlemanStackBridge } from "../../core/eosGentlemanStackBridge.ts";
import { GlorianFleetHealthWatchdog } from "../../core/glorianFleetHealthWatchdog.ts";
import { GlorianConstitutionalTribunal } from "../../core/glorianConstitutionalTribunal.ts";
import type { EosHybridKnowledgeEngine } from "../../core/eosHybridKnowledgeEngine.ts";
import type { EosUniversalAgentSessionContract } from "../../core/eosUniversalAgentSessionContract.ts";
import type { McpToolHandler } from "../eosMcpDispatchRegistry.ts";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export interface Phase3CoreHandlerDeps {
  readonly projectRoot: string;
  readonly resolveProjectPath: (
    value: unknown,
    kind: "file" | "directory",
    fallback?: string
  ) => string;
  readonly resolveConfinedLedgerPath: (value: unknown) => string;
  readonly hybridKnowledge: EosHybridKnowledgeEngine;
  readonly knowledgeStore: {
    search(query: string, topK: number): readonly { id: string; score: number; text: string; metadata?: unknown }[];
    searchHybrid(query: string, topK: number): readonly { id: string; score: number; text: string; metadata?: unknown }[];
  };
  readonly agentSessionContract: EosUniversalAgentSessionContract;
  readonly hnsw: EosHnswVectorEngine;
}

export function createPhase3CoreHandlers(
  deps: Phase3CoreHandlerDeps
): Readonly<Record<string, McpToolHandler>> {
  return {
    eos_semantic_search: (args) => {
      const query = String(args.query || "");
      const topK = Number(args.topK) || 5;
      const mode = args.mode === "vector" || args.mode === "lexical" ? args.mode : "hybrid";
      const category = args.category || "ALL";
      const hybridMatches = deps.hybridKnowledge.search(query, { topK, mode, category });
      if (hybridMatches.length > 0) {
        return {
          query,
          mode,
          category,
          matchCount: hybridMatches.length,
          matches: hybridMatches.map((m) => ({
            id: m.id,
            score: m.score,
            title: m.title,
            snippet: m.snippet,
            filePath: m.filePath,
            category: m.category,
            lexicalRank: m.lexicalRank,
            vectorRank: m.vectorRank
          }))
        };
      }
      const matches =
        mode === "vector"
          ? deps.knowledgeStore.search(query, topK)
          : deps.knowledgeStore.searchHybrid(query, topK);
      return {
        query,
        mode,
        category,
        matchCount: matches.length,
        matches: matches.map((m) => ({
          id: m.id,
          score: Number(m.score.toFixed(4)),
          title: m.id,
          snippet: m.text,
          filePath: "",
          category: (m.metadata as { domain?: string } | undefined)?.domain || "General"
        }))
      };
    },

    eos_autonomous_heal: (args) => {
      const healer = new EosAutonomousHealer(deps.projectRoot);
      return healer.executeHealing({
        targetFile: args.targetFile === undefined ? undefined : String(args.targetFile),
        dryRun: args.apply !== true,
        autoApply: args.apply === true
      });
    },

    eos_manage_worktree: (args, ctx) => {
      const orchestrator = new EosWorktreeOrchestrator(deps.projectRoot);
      const action = String(args.action || "list");
      if (action === "create") {
        const branch = typeof args.branch === "string" ? args.branch : `agent-${Date.now()}`;
        if (Buffer.byteLength(branch, "utf8") > 256) {
          throw new RangeError("Worktree branch names are limited to 256 UTF-8 bytes.");
        }
        if (
          !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) ||
          branch.includes("..") ||
          branch.includes("//") ||
          branch.endsWith("/") ||
          branch.endsWith(".") ||
          /(^|\/)\./.test(branch) ||
          /(^|\/)[^/]+\.lock(\/|$)/.test(branch)
        ) {
          throw new Error("Worktree branch must be a valid, project-relative Git branch name.");
        }
        if (args.apply !== true) return { status: "PLAN_ONLY", action, branch, writeRequired: true };
        const worktreeRoot = path.join(deps.projectRoot, ".worktrees");
        try {
          const worktreeStat = fs.lstatSync(worktreeRoot);
          if (
            worktreeStat.isSymbolicLink() ||
            !worktreeStat.isDirectory() ||
            !isPathWithin(deps.projectRoot, fs.realpathSync(worktreeRoot))
          ) {
            throw new Error(
              "The .worktrees directory must be a regular directory inside the configured project root."
            );
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return orchestrator.createWorktree(branch);
      }
      if (action === "remove") {
        const targetPath = ctx.resolveProjectPath(args.targetPath, "directory");
        if (args.apply !== true) {
          return { status: "PLAN_ONLY", action, targetPath, force: args.force === true, writeRequired: true };
        }
        return orchestrator.removeWorktree(targetPath, { force: args.force === true });
      }
      if (action !== "list") throw new Error("Unsupported worktree action.");
      return orchestrator.listWorktrees();
    },

    eos_hnsw_knn_search: (args, ctx) => {
      ctx.onProgress?.(20, 100, "Navigating HNSW small-world graph");
      const k = typeof args.k === "number" ? args.k : 5;
      const ef = typeof args.efSearch === "number" ? args.efSearch : 32;
      let results;
      if (args.query) {
        results = deps.hnsw.searchByText(String(args.query), k, ef);
      } else if (Array.isArray(args.vector)) {
        results = deps.hnsw.searchKnn(new Float32Array(args.vector), k, ef);
      } else {
        throw new Error("Must provide either 'query' string or 'vector' array.");
      }
      ctx.onProgress?.(100, 100, "k-NN search complete");
      return {
        query: args.query ?? "custom_vector",
        k,
        count: results.length,
        results
      };
    },

    eos_agent_session_contract: (args) => {
      const action = String(args.action || "").toLowerCase();
      switch (action) {
        case "open": {
          const opened = deps.agentSessionContract.openSession({
            ideFamily: String(args.ideFamily || ""),
            directive: String(args.directive || ""),
            target: args.target ? String(args.target) : "eos-system"
          });
          return { action: "open", preferred: ["cursor", "antigravity"], ...opened };
        }
        case "ensure": {
          const ensured = deps.agentSessionContract.ensurePreferredIdeSession({
            ideFamily: String(args.ideFamily || ""),
            directive: args.directive ? String(args.directive) : undefined,
            target: args.target ? String(args.target) : "eos-system"
          });
          return {
            action: "ensure",
            preferred: true,
            ...ensured,
            gentlemanAlignment: deps.agentSessionContract.getGentlemanAlignment(),
            coGovernanceMessage: deps.agentSessionContract.formatCoGovernanceSessionMessage(
              String(args.ideFamily || "cursor"),
              ensured
            )
          };
        }
        case "record_tool": {
          const sessionId = String(args.sessionId || "");
          const toolName = String(args.toolName || "");
          const recorded = deps.agentSessionContract.recordToolInvocation(sessionId, toolName);
          return { action: "record_tool", sessionId, toolName, ...recorded };
        }
        case "authorize_write": {
          const decision = deps.agentSessionContract.authorizeWrite({
            sessionId: String(args.sessionId || ""),
            sessionReceipt: args.sessionReceipt ? String(args.sessionReceipt) : undefined,
            paths: Array.isArray(args.paths) ? args.paths.map(String) : undefined
          });
          return {
            action: "authorize_write",
            allowed: decision.decision === "allow",
            ...decision
          };
        }
        case "evaluate_write": {
          const decision = deps.agentSessionContract.evaluatePreferredWriteGate(
            String(args.ideFamily || ""),
            Array.isArray(args.paths) ? args.paths.map(String) : undefined
          );
          return {
            action: "evaluate_write",
            allowed: decision.decision === "allow",
            ...decision
          };
        }
        case "align_gentleman": {
          const alignment = deps.agentSessionContract.alignGentlemanStack();
          return {
            action: "align_gentleman",
            source: alignment.source,
            readinessScore: alignment.readinessScore,
            status: alignment.status,
            constitutionPreserved: alignment.constitutionPreserved,
            sha256Receipt: alignment.sha256Receipt,
            coGovernanceProtocol: alignment.protocol,
            canon: EosGentlemanStackBridge.EXTERNAL_CANON,
            divisionOfLabor: {
              glorian: "constitution, Law IV, session write gates, product/mission golden path",
              gentleAi:
                "Engram memory, ODD+SDD workflow (gentle-ai), focused agents, GGA native review, Context7 docs, agent-teams-lite; doctrine from gentlemanprogramming.com + YouTube main/VODs"
            }
          };
        }
        case "status": {
          const status = deps.agentSessionContract.getSessionStatus(String(args.sessionId || ""));
          return {
            action: "status",
            ...status,
            gentlemanAlignment: deps.agentSessionContract.getGentlemanAlignment()
          };
        }
        default:
          throw new Error(
            "Unsupported eos_agent_session_contract action. Expected: open, ensure, record_tool, authorize_write, evaluate_write, align_gentleman, status"
          );
      }
    },

    eos_refactor_audit: (args, ctx) => {
      const rawTarget =
        typeof args?.dirPath === "string"
          ? args.dirPath
          : typeof args?.targetDir === "string"
            ? args.targetDir
            : "src/core";
      const safeTarget = ctx.resolveProjectPath(rawTarget, "directory", "src/core");
      return EosContinuousRefactorEngine.auditDirectory(safeTarget);
    },

    eos_mcts_tune: (args) => {
      const iterations = Number(args.iterations) || 120;
      const seed = Number(args.seed) || 42;
      const tuner = new EosMctsHyperTuner(seed);
      return tuner.tuneParameters(iterations);
    },

    eos_antigravity_direct: (args) => {
      const directive = String(args.directive || "");
      const target = args.target ? String(args.target) : "eos-system";
      return EosAntigravityDirector.directMission(directive, target, deps.projectRoot);
    },

    eos_antigravity_doctor: (args) => {
      const geminiDir =
        typeof args.geminiConfigDir === "string" && args.geminiConfigDir.trim().length > 0
          ? args.geminiConfigDir.trim()
          : undefined;
      return EosAntigravityDirector.auditAntigravityIntegration(deps.projectRoot, geminiDir);
    },

    eos_sqlite_ledger: (args) => {
      const action = String(args.action || "verify").trim().toLowerCase();
      const dbPath = deps.resolveConfinedLedgerPath(args.databasePath);
      const ledger = new EosDurableSqliteLedger(dbPath);
      try {
        if (action === "record") {
          const validCategories: readonly LedgerCategory[] = [
            "MISSION_DIRECTION",
            "ARCHITECTURE_DECISION",
            "SECURITY_AUDIT",
            "VERIFICATION_RECEIPT",
            "GENTLEMAN_ENGRAM_SYNC"
          ];
          const rawCat = String(args.category || "VERIFICATION_RECEIPT") as LedgerCategory;
          const category: LedgerCategory = validCategories.includes(rawCat)
            ? rawCat
            : "VERIFICATION_RECEIPT";
          return ledger.appendEntry({
            category,
            projectId:
              typeof args.projectId === "string" && args.projectId.trim().length > 0
                ? args.projectId.trim()
                : "eos-system",
            title: String(args.title || "EOS Ledger Event"),
            payload: isPlainRecord(args.payload) ? args.payload : {},
            engramTopicKey: typeof args.engramTopicKey === "string" ? args.engramTopicKey : undefined
          });
        }
        if (action === "search") {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          return {
            action: "search",
            query: String(args.query || ""),
            records: ledger.searchEntries(String(args.query || ""), limit)
          };
        }
        if (action === "recent") {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          const projectId = typeof args.projectId === "string" ? args.projectId : undefined;
          return {
            action: "recent",
            records: ledger.listRecent(limit, projectId)
          };
        }
        return ledger.verifyChainIntegrity();
      } finally {
        ledger.close();
      }
    },

    eos_gentleman_update: (args) => {
      const action = String(args.action || "status").trim().toLowerCase();
      if (action === "status") {
        return {
          action: "status",
          isDue: EosGentlemanAutoUpdater.isAutoUpdateDue(deps.projectRoot),
          state: EosGentlemanAutoUpdater.readState(deps.projectRoot),
          constitutionSha256: EosGentlemanAutoUpdater.computeConstitutionDigest(deps.projectRoot)
        };
      }
      const cliArgs = [
        path.join(deps.projectRoot, "bin", "eos.mjs"),
        "gentleman",
        "update",
        action === "apply" ? "--apply" : "--check",
        "--json"
      ];
      if (args.force === true) cliArgs.push("--force");
      const out = execFileSync(process.execPath, cliArgs, {
        cwd: deps.projectRoot,
        encoding: "utf8",
        timeout: 180000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      return JSON.parse(out.trim());
    },

    glorian_fleet_health_watchdog: (args) => {
      const watchdog = new GlorianFleetHealthWatchdog(deps.projectRoot);
      const dryRun = Boolean(args?.dryRun);
      const format = String(args?.format || "json").toLowerCase();
      const report = watchdog.runFleetHealthAuditSync({ dryRun });
      if (format === "summary") {
        return {
          summary: watchdog.formatHealthReport(report),
          compositeHealthIndex: report.compositeHealthIndex,
          auditStatus: report.auditStatus,
          sha256Receipt: report.sha256Receipt
        };
      }
      return report;
    },

    glorian_constitutional_tribunal: (args) => {
      const tribunal = new GlorianConstitutionalTribunal(deps.projectRoot);
      const actionId = String(args?.actionId || "MUT-ANONYMOUS");
      const category = (args?.category as string) || "CODE_MUTATION";
      const description = String(args?.description || "No description provided");
      const diffOrPayload = args?.diffOrPayload ? String(args.diffOrPayload) : undefined;
      const targetDirectory = args?.targetDirectory ? String(args.targetDirectory) : undefined;
      const declaredInvariants = Array.isArray(args?.declaredInvariants)
        ? args.declaredInvariants.map(String)
        : undefined;
      const format = String(args?.format || "json").toLowerCase();
      const report = tribunal.adjudicate({
        actionId,
        category: category as never,
        description,
        diffOrPayload,
        targetDirectory,
        declaredInvariants
      });
      if (format === "summary") {
        return {
          summary: tribunal.formatTribunalSummary(report),
          overallVerdict: report.overallVerdict,
          compositeScore: report.compositeScore,
          quorumMet: report.quorumMet,
          sha256Receipt: report.sha256Receipt
        };
      }
      return report;
    }
  };
}

export { PHASE3_MIGRATED_TOOL_NAMES } from "../../core/eosMcpToolTaxonomy.ts";
