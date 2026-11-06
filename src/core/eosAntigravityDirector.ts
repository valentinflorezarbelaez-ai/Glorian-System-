/**
 * EOS SYSTEM — SOVEREIGN ANTIGRAVITY MCP CONTROL PLANE & MISSION DIRECTOR (Layer 0)
 * Governed by SPEC-043, CHANGE-036, ADR-049 (v49.0.0)
 *
 * Pure Layer-0 orchestration engine that connects EOS as the active Mission Director
 * inside Google Antigravity via Model Context Protocol (MCP), progressive-disclosure
 * skills, workspace rules, and fail-closed Gamma lifecycle hooks.
 *
 * Zero external runtime dependencies.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";

export type AntigravityMissionProfile =
  | "SDD_FULL_21_STEP"
  | "ARCHITECTURE_AUDIT"
  | "SECURITY_HARDENING"
  | "FLEET_ORCHESTRATION"
  | "PERFORMANCE_TUNING"
  | "BUGFIX_FDIR";

export type WriteBarrierStatus =
  | "AUTHORIZED"
  | "BLOCKED_BY_LAW_IV";

export interface PrescribedMcpStep {
  readonly order: number;
  readonly toolName: string;
  readonly phase: string;
  readonly purpose: string;
  readonly mandatory: boolean;
  readonly suggestedArguments: Readonly<Record<string, unknown>>;
}

export interface MissionDirectionPlan {
  readonly directive: string;
  readonly profile: AntigravityMissionProfile;
  readonly targetIdentifier: string;
  readonly matchedProjectId: string | null;
  readonly writeBarrierStatus: WriteBarrierStatus;
  readonly missingPreconditions: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly prescribedMcpDag: readonly PrescribedMcpStep[];
  readonly verificationGates: readonly string[];
  readonly sha256Receipt: string;
}

export interface GammaHookDecision {
  readonly decision: "allow" | "deny";
  readonly reason?: string;
  readonly matchedRule?: string;
}

export interface AntigravityCheckDimension {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly detail: string;
}

export interface AntigravityDoctorReport {
  readonly projectRoot: string;
  readonly geminiConfigDir: string;
  readonly readinessScore: number;
  readonly status: "SOVEREIGN_DIRECTING" | "DEGRADED" | "DISCONNECTED";
  readonly singleServerInvariantVerified: boolean;
  readonly checks: readonly AntigravityCheckDimension[];
  readonly remediationCommands: readonly string[];
  readonly sha256Receipt: string;
}

export interface SynthesizedMcpServerConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

const GAMMA_DESTRUCTIVE_PATTERNS: ReadonlyArray<{ readonly id: string; readonly regex: RegExp }> = [
  { id: "GAMMA-001-ROOT-WIPE", regex: /(?:^|[;&|]\s*)rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(?:\/|~|\*|\.\.)(?:\s|$)/i },
  { id: "GAMMA-002-FORCE-PUSH-MAIN", regex: /\bgit\s+push\s+(?:--force|-f)\s+\S+\s+(?:main|master)\b/i },
  { id: "GAMMA-003-SQL-DROP", regex: /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i },
  { id: "GAMMA-004-DISK-FORMAT", regex: /\b(?:Format-Volume|mkfs\.[a-z0-9]+|diskpart)\b/i },
  { id: "GAMMA-005-WIN-SYSTEM-DEL", regex: /\b(?:del|erase|rd|rmdir)\s+\/[a-z\s/]*[sq][a-z\s/]*\s+[a-z]:\\(?:\s|$|\*)/i }
];

export class EosAntigravityDirector {
  public static readonly DIRECTOR_INSTRUCTIONS_PLAYBOOK = [
    "# EOS System — Sovereign Antigravity MCP Director Playbook (v50.0.0)",
    "",
    "You are connected to `eos-system`, the authoritative Engineering Operating System Control Plane,",
    "co-governing Google Antigravity alongside the Gentleman Programming AI Stack (`gentle-ai`, `engram`, `gga`, `context7`, `agent-teams-lite`).",
    "Use EOS MCP tools proactively to direct, validate, and certify engineering tasks:",
    "",
    "## 1. Mission Intake, Memory Recall & Direction (Always First on Non-Trivial Tasks)",
    "- Query `engram` (`mem_context` / `mem_search`) for cross-session architectural memory when available.",
    "- Call `eos_antigravity_direct` with the user's `directive` and `target` project/workspace.",
    "  It classifies the mission profile, enforces Law IV External Write Barrier against `docs/projects/registry.json`,",
    "  and returns the exact ordered DAG of EOS MCP tools to run.",
    "- Call `eos_antigravity_doctor` and `eos_gentleman_audit` whenever diagnosing MCP, Gentleman stack, plugin, skill, or junction health.",
    "",
    "## 2. Specification, Compiler AST & Architectural Intelligence",
    "- `eos_amplify_prompt`: Transform informal user requests into IEEE 830 / EARS requirements and BDD scenarios (synergizes with `sdd-*` skills).",
    "- `eos_semantic_search` & `eos_hnsw_knn_search`: Query architectural specs, ADRs, and domain invariants (pair with `context7` for live SDK docs).",
    "- `eos_check_openspec`: Verify zero specification drift across Living OpenSpec artifacts.",
    "- `eos_ast_analyze`: Parse real TypeScript Compiler ASTs to verify Layer-0 purity, Node 24 strip-only conformance, and exact cyclomatic complexity.",
    "- `eos_check_architecture` & `eos_get_blast_radius`: Audit Hexagonal Layer-0 purity (0 runtime deps, 0 cycles) and transitive impact.",
    "",
    "## 3. Pre-Mutation Consensus & Patch Safety",
    "- `eos_evaluate_decision` & `eos_tmr_consensus`: Run Bayesian 7-Law tribunal and 3-sandbox Byzantine consensus before high-impact mutations.",
    "- `eos_validate_patch`: Scan proposed file contents for syntax validity, secret leaks, and destructive patterns (pair with `judgment-day` + `gga`).",
    "",
    "## 4. Durable SQLite WAL Ledger, Fleet Governance & Progressive Delivery",
    "- `eos_sqlite_ledger`: Record, search (FTS5), and verify SHA-256 hash-chained receipts in the zero-dependency `node:sqlite` WAL ledger (pair with Engram `mem_save`).",
    "- `eos_turbo_verify`: Execute sub-200ms in-memory 4-stage credential, architecture, and inventory verification.",
    "- `eos_fleet_soundcheck` & `eos_audit_fleet`: Verify Spotify Soundcheck scores and deployment quorum (>= 70) across all registered repositories.",
    "- `eos_mcts_tune` & `eos_canary_rollout`: Run UCT parameter hyper-tuning and fail-closed progressive canary delivery (1% -> 5% -> 25% -> 100%)."
  ].join("\n");

  /**
   * Classifies a user directive into a deterministic EOS execution profile.
   */
  public static classifyProfile(directive: string): AntigravityMissionProfile {
    assertPrecondition(typeof directive === "string" && directive.trim().length > 0, "Directive must be a non-empty string");
    const lower = directive.toLowerCase();

    if (/(?:\bsecurity\b|\bseguridad\b|\bsecret|\bauth\b|\bowasp\b|\bvulnerab|\bsandbox\b|\bbarrier\b|\bcve\b|\bencrypt)/.test(lower)) {
      return "SECURITY_HARDENING";
    }
    if (/(?:\bfix\b|\bbug\b|\berror\b|\bfail|\bbroken\b|\bheal\b|\bcrash\b|\bregress|\bcorregir\b|\breparar\b)/.test(lower)) {
      return "BUGFIX_FDIR";
    }
    if (/(?:\bfleet\b|\bflota\b|\bcanary\b|\bcanario\b|\brollout\b|\bsoundcheck\b|\bmulti-repo\b|\bworktree\b|\bdeploy\b|\bdespleg)/.test(lower)) {
      return "FLEET_ORCHESTRATION";
    }
    if (/(?:\bperformance\b|\brendimiento\b|\blatenc|\bbenchmark\b|\bmcts\b|\bcwv\b|\blcp\b|\bthroughput\b|\bzero-copy\b|\boptimiz)/.test(lower)) {
      return "PERFORMANCE_TUNING";
    }
    if (/(?:\barchitect|\barquitect|\bhexagonal\b|\bblast\b|\btopolog|\brefactor|\bdead\s*code\b|\baudit\b|\bauditar\b)/.test(lower)) {
      return "ARCHITECTURE_AUDIT";
    }
    return "SDD_FULL_21_STEP";
  }

  /**
   * Directs an Antigravity mission end-to-end: classifies profile, checks Law IV External Write Barrier,
   * prescribes the ordered EOS MCP tool DAG, and seals a cryptographic SHA-256 receipt.
   */
  public static directMission(
    directive: string,
    targetProjectOrPath: string = "eos-system",
    projectRoot: string = process.cwd()
  ): MissionDirectionPlan {
    assertPrecondition(typeof directive === "string" && directive.trim().length > 0, "Directive must be non-empty");
    assertPrecondition(Buffer.byteLength(directive, "utf8") <= 32768, "Directive exceeds 32 KiB bound");

    const cleanDirective = directive.trim();
    const cleanTarget = (targetProjectOrPath || "eos-system").trim();
    const resolvedRoot = path.resolve(projectRoot);
    const profile = this.classifyProfile(cleanDirective);

    const barrier = this.evaluateWriteBarrier(cleanTarget, resolvedRoot);
    const prescribedMcpDag = this.buildMcpDag(profile, cleanDirective, barrier.matchedProjectId || cleanTarget);
    const requiredSkills = this.selectSkillsForProfile(profile);
    const verificationGates = [
      "mcp:eos-system/eos_turbo_verify",
      "cli:npm run verify:strict",
      "mcp:eos-system/eos_fleet_soundcheck"
    ];

    const canonicalPayload = JSON.stringify({
      directive: cleanDirective,
      profile,
      target: cleanTarget,
      matchedProjectId: barrier.matchedProjectId,
      writeBarrierStatus: barrier.status,
      dagTools: prescribedMcpDag.map((s) => s.toolName)
    });
    const sha256Receipt = pureSha256(canonicalPayload);
    assertPostcondition(sha256Receipt.length === 64, "Mission receipt must be a 64-char SHA-256 hex digest");

    return deepFreeze({
      directive: cleanDirective,
      profile,
      targetIdentifier: cleanTarget,
      matchedProjectId: barrier.matchedProjectId,
      writeBarrierStatus: barrier.status,
      missingPreconditions: barrier.missingPreconditions,
      requiredSkills,
      prescribedMcpDag,
      verificationGates,
      sha256Receipt
    });
  }

  /**
   * Evaluates a shell command against the EOS Gamma Security Barrier (Law VI) for Antigravity PreToolUse hooks.
   */
  public static evaluateGammaCommand(commandLine: string): GammaHookDecision {
    if (typeof commandLine !== "string" || commandLine.trim().length === 0) {
      return deepFreeze({ decision: "allow" });
    }
    for (const rule of GAMMA_DESTRUCTIVE_PATTERNS) {
      if (rule.regex.test(commandLine)) {
        return deepFreeze({
          decision: "deny",
          matchedRule: rule.id,
          reason: `Blocked by EOS Gamma Security Barrier (Law VI) [${rule.id}]: Destructive command pattern prohibited.`
        });
      }
    }
    return deepFreeze({ decision: "allow" });
  }

  /**
   * Synthesizes the canonical stdio MCP configuration entry for `~/.gemini/config/mcp_config.json`.
   */
  public static synthesizeAntigravityMcpEntry(
    projectRoot: string = process.cwd(),
    fleetOverrides: Readonly<Record<string, string>> = {}
  ): SynthesizedMcpServerConfig {
    const resolvedRoot = path.resolve(projectRoot);
    const parentDir = path.dirname(resolvedRoot);
    const serverScript = path.join(resolvedRoot, "src", "mcp", "eosMcpServer.ts");

    const defaultFleetCandidates: Record<string, string> = {
      EOS_FLEET_EOS_SYSTEM_PATH: resolvedRoot,
      EOS_FLEET_ABERAMENTHO_PATH: path.join(parentDir, "Aberamentho-s-Pleroma-music"),
      EOS_FLEET_PORTAFOLIO_PATH: path.join(parentDir, "portafolio"),
      EOS_FLEET_PTG_PATH: path.join(parentDir, "Performance-Talent-Group-1"),
      EOS_FLEET_CRUD_SLACK_PATH: path.join(parentDir, "Crud-slack")
    };

    const env: Record<string, string> = {
      EOS_PROJECT_ROOT: resolvedRoot
    };

    for (const [envKey, candidatePath] of Object.entries(defaultFleetCandidates)) {
      const override = fleetOverrides[envKey] || process.env[envKey];
      if (override && override.trim().length > 0) {
        env[envKey] = path.resolve(override.trim());
      } else if (fs.existsSync(candidatePath)) {
        env[envKey] = path.resolve(candidatePath);
      }
    }

    return deepFreeze({
      command: "node",
      args: [serverScript],
      env
    });
  }

  /**
   * Audits the end-to-end health of the Antigravity <-> EOS MCP, plugin, hooks, skills, and junction setup.
   */
  public static auditAntigravityIntegration(
    projectRoot: string = process.cwd(),
    geminiConfigDir: string = path.join(os.homedir(), ".gemini", "config")
  ): AntigravityDoctorReport {
    const resolvedRoot = path.resolve(projectRoot);
    const resolvedGeminiDir = path.resolve(geminiConfigDir);
    const checks: AntigravityCheckDimension[] = [];
    const remediationCommands: string[] = [];

    // 1. Repository Plugin Bundle (20 pts)
    const pluginSourceDir = path.join(resolvedRoot, "integrations", "antigravity", "eos-governance");
    const requiredPluginFiles = [
      "plugin.json",
      "hooks.json",
      path.join("scripts", "eos-hook.mjs"),
      path.join("rules", "AGENTS.md")
    ];
    const missingPluginFiles = requiredPluginFiles.filter((rel) => !fs.existsSync(path.join(pluginSourceDir, rel)));
    const duplicatePluginMcp = fs.existsSync(path.join(pluginSourceDir, "mcp_config.json"));
    const pluginBundleOk = missingPluginFiles.length === 0 && !duplicatePluginMcp;
    checks.push({
      id: "REPO_PLUGIN_BUNDLE",
      label: "EOS Governance Native Plugin Bundle",
      passed: pluginBundleOk,
      score: pluginBundleOk ? 20 : 0,
      maxScore: 20,
      detail: pluginBundleOk
        ? "plugin.json, hooks.json, scripts/eos-hook.mjs, and rules/AGENTS.md verified with SingleServerInvariant."
        : duplicatePluginMcp
          ? "Duplicate mcp_config.json detected inside plugin bundle (violates SingleServerInvariant)."
          : `Missing plugin files: ${missingPluginFiles.join(", ")}`
    });

    // 2. Repository Skills Bundle (20 pts)
    const repoSkillsDir = path.join(resolvedRoot, ".agents", "skills");
    const requiredSkills = ["eos-director", "eos-sdd-pipeline", "eos-fleet-ops"];
    const missingSkills = requiredSkills.filter((s) => !fs.existsSync(path.join(repoSkillsDir, s, "SKILL.md")));
    const skillsBundleOk = missingSkills.length === 0;
    checks.push({
      id: "REPO_SKILLS_BUNDLE",
      label: "Progressive-Disclosure EOS Skills (.agents/skills)",
      passed: skillsBundleOk,
      score: skillsBundleOk ? 20 : 0,
      maxScore: 20,
      detail: skillsBundleOk
        ? "All 3 orchestration skills (eos-director, eos-sdd-pipeline, eos-fleet-ops) present."
        : `Missing SKILL.md files for: ${missingSkills.join(", ")}`
    });

    // 3. Global mcp_config.json Registration & Fleet Env Bindings (20 pts)
    const globalMcpPath = path.join(resolvedGeminiDir, "mcp_config.json");
    let mcpScore = 0;
    let mcpDetail = "mcp_config.json not found in Antigravity config directory.";
    let singleServerOk = !duplicatePluginMcp;

    if (fs.existsSync(globalMcpPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(globalMcpPath, "utf8"));
        const servers = parsed && typeof parsed.mcpServers === "object" ? parsed.mcpServers : {};
        const eosKeys = Object.keys(servers).filter((k) => k.toLowerCase().includes("eos"));
        if (eosKeys.length > 1) singleServerOk = false;

        const eosEntry = servers["eos-system"];
        if (eosEntry && Array.isArray(eosEntry.args) && eosEntry.args.length > 0) {
          const scriptTarget = String(eosEntry.args[0]);
          const scriptExists = fs.existsSync(scriptTarget);
          const hasProjectRootEnv = Boolean(eosEntry.env && eosEntry.env.EOS_PROJECT_ROOT);
          if (scriptExists && hasProjectRootEnv && singleServerOk) {
            mcpScore = 20;
            mcpDetail = "eos-system stdio server registered with verified entrypoint and EOS_PROJECT_ROOT + fleet env bindings.";
          } else if (scriptExists) {
            mcpScore = 10;
            mcpDetail = "eos-system registered, but EOS_PROJECT_ROOT / EOS_FLEET_*_PATH env bindings are incomplete.";
          } else {
            mcpDetail = `eos-system args[0] points to non-existent file: ${scriptTarget}`;
          }
        } else {
          mcpDetail = "eos-system entry missing from mcpServers in mcp_config.json.";
        }
      } catch {
        mcpDetail = "Failed to parse mcp_config.json.";
      }
    }
    if (mcpScore < 20) remediationCommands.push("node bin/eos.mjs antigravity install");
    checks.push({
      id: "GLOBAL_MCP_CONFIG",
      label: "Antigravity Global mcp_config.json Wiring",
      passed: mcpScore === 20,
      score: mcpScore,
      maxScore: 20,
      detail: mcpDetail
    });

    // 4. Global Plugin Link / Directory Health (20 pts)
    const globalPluginLink = path.join(resolvedGeminiDir, "plugins", "eos-governance");
    const globalPluginManifest = path.join(globalPluginLink, "plugin.json");
    const globalPluginOk = fs.existsSync(globalPluginLink) && fs.existsSync(globalPluginManifest);
    if (!globalPluginOk && !remediationCommands.includes("node bin/eos.mjs antigravity install")) {
      remediationCommands.push("node bin/eos.mjs antigravity install");
    }
    checks.push({
      id: "GLOBAL_PLUGIN_LINK",
      label: "Global Antigravity Plugin Link (plugins/eos-governance)",
      passed: globalPluginOk,
      score: globalPluginOk ? 20 : 0,
      maxScore: 20,
      detail: globalPluginOk
        ? "plugins/eos-governance resolves cleanly to active plugin manifest."
        : "plugins/eos-governance is missing or is a dangling NTFS junction."
    });

    // 5. Global Skills Link / Directory Health (20 pts)
    const globalSkillsLink = path.join(resolvedGeminiDir, "skills");
    const globalDirectorSkill = path.join(globalSkillsLink, "eos-director", "SKILL.md");
    const globalSkillsOk = fs.existsSync(globalSkillsLink) && fs.existsSync(globalDirectorSkill);
    if (!globalSkillsOk && !remediationCommands.includes("node bin/eos.mjs antigravity install")) {
      remediationCommands.push("node bin/eos.mjs antigravity install");
    }
    checks.push({
      id: "GLOBAL_SKILLS_LINK",
      label: "Global Antigravity Skills Link (skills/eos-director)",
      passed: globalSkillsOk,
      score: globalSkillsOk ? 20 : 0,
      maxScore: 20,
      detail: globalSkillsOk
        ? "Global skills directory resolves cleanly with eos-director skill active."
        : "Global skills directory is missing, lacks eos-director, or is a dangling NTFS junction."
    });

    const readinessScore = checks.reduce((sum, c) => sum + c.score, 0);
    assertPostcondition(readinessScore >= 0 && readinessScore <= 100, "Readiness score must be within [0, 100]");

    const status: AntigravityDoctorReport["status"] = readinessScore >= 95
      ? "SOVEREIGN_DIRECTING"
      : readinessScore >= 60
        ? "DEGRADED"
        : "DISCONNECTED";

    const sha256Receipt = pureSha256(
      JSON.stringify({
        projectRoot: resolvedRoot,
        readinessScore,
        status,
        singleServerOk,
        checks: checks.map((c) => ({ id: c.id, passed: c.passed, score: c.score }))
      })
    );

    return deepFreeze({
      projectRoot: resolvedRoot,
      geminiConfigDir: resolvedGeminiDir,
      readinessScore,
      status,
      singleServerInvariantVerified: singleServerOk,
      checks,
      remediationCommands,
      sha256Receipt
    });
  }

  private static evaluateWriteBarrier(
    target: string,
    projectRoot: string
  ): { status: WriteBarrierStatus; matchedProjectId: string | null; missingPreconditions: string[] } {
    const regPath = path.join(projectRoot, "docs", "projects", "registry.json");
    if (!fs.existsSync(regPath)) {
      return {
        status: "BLOCKED_BY_LAW_IV",
        matchedProjectId: null,
        missingPreconditions: ["REGISTRY_NOT_FOUND"]
      };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(regPath, "utf8"));
      const projects: any[] = Array.isArray(parsed.projects) ? parsed.projects : [];
      const normalizedTarget = target.toLowerCase().replace(/\\/g, "/");

      const matched = projects.find((p) => {
        if (String(p.id || "").toLowerCase() === normalizedTarget) return true;
        if (String(p.name || "").toLowerCase() === normalizedTarget) return true;
        if (p.id === "eos-system" && path.resolve(projectRoot).toLowerCase().replace(/\\/g, "/") === normalizedTarget) {
          return true;
        }
        const envKey = typeof p.localPathEnv === "string" ? p.localPathEnv : "";
        const envVal = envKey && process.env[envKey] ? path.resolve(process.env[envKey]!).toLowerCase().replace(/\\/g, "/") : "";
        if (envVal && envVal === normalizedTarget) return true;
        if (typeof p.localPath === "string" && path.resolve(p.localPath).toLowerCase().replace(/\\/g, "/") === normalizedTarget) {
          return true;
        }
        return false;
      });

      if (!matched) {
        return {
          status: "BLOCKED_BY_LAW_IV",
          matchedProjectId: null,
          missingPreconditions: [
            "REGISTERED in docs/projects/registry.json",
            "INTAKE_COMPLETE",
            "SPECIFICATION_APPROVED",
            "AUDIT_COMPLETE",
            "LEVEL_2+ IMPLEMENTATION_AUTHORIZED"
          ]
        };
      }

      const missing: string[] = [];
      if (matched.status !== "REGISTERED") missing.push("REGISTERED");
      if (matched.intake !== "INTAKE_COMPLETE") missing.push("INTAKE_COMPLETE");
      if (matched.specification !== "SPECIFICATION_APPROVED") missing.push("SPECIFICATION_APPROVED");
      if (matched.audit !== "AUDIT_COMPLETE") missing.push("AUDIT_COMPLETE");
      const auth = String(matched.authorization || "");
      if (!auth.includes("LEVEL_2") && !auth.includes("LEVEL_3")) {
        missing.push("LEVEL_2_OR_LEVEL_3_AUTHORIZED");
      }

      return {
        status: missing.length === 0 ? "AUTHORIZED" : "BLOCKED_BY_LAW_IV",
        matchedProjectId: String(matched.id),
        missingPreconditions: missing
      };
    } catch {
      return {
        status: "BLOCKED_BY_LAW_IV",
        matchedProjectId: null,
        missingPreconditions: ["REGISTRY_PARSE_ERROR"]
      };
    }
  }

  private static selectSkillsForProfile(profile: AntigravityMissionProfile): string[] {
    switch (profile) {
      case "FLEET_ORCHESTRATION":
        return ["eos-director", "eos-fleet-ops"];
      case "SDD_FULL_21_STEP":
        return ["eos-director", "eos-sdd-pipeline"];
      default:
        return ["eos-director"];
    }
  }

  private static buildMcpDag(
    profile: AntigravityMissionProfile,
    directive: string,
    targetId: string
  ): PrescribedMcpStep[] {
    switch (profile) {
      case "SECURITY_HARDENING":
        return [
          {
            order: 1,
            toolName: "eos_semantic_search",
            phase: "RECONNAISSANCE",
            purpose: "Retrieve security invariants, Law VI secret rules, and boundary contracts.",
            mandatory: true,
            suggestedArguments: { query: directive.slice(0, 120), topK: 3 }
          },
          {
            order: 2,
            toolName: "eos_nsa_zero_trust_check",
            phase: "SECURITY_AUDIT",
            purpose: "Audit zero-trust compartment boundaries and credential isolation.",
            mandatory: true,
            suggestedArguments: {}
          },
          {
            order: 3,
            toolName: "eos_validate_patch",
            phase: "PATCH_VALIDATION",
            purpose: "Verify candidate changes contain zero secrets or destructive patterns.",
            mandatory: true,
            suggestedArguments: { filePath: "src/target.ts", content: "<candidate>" }
          },
          {
            order: 4,
            toolName: "eos_turbo_verify",
            phase: "VERIFICATION",
            purpose: "Execute fast in-memory credential and architecture verification gate.",
            mandatory: true,
            suggestedArguments: {}
          }
        ];

      case "FLEET_ORCHESTRATION":
        return [
          {
            order: 1,
            toolName: "eos_fleet_soundcheck",
            phase: "FLEET_AUDIT",
            purpose: "Evaluate Spotify Soundcheck scores (0..100) and deployment quorum across registered repos.",
            mandatory: true,
            suggestedArguments: {}
          },
          {
            order: 2,
            toolName: "eos_mcts_tune",
            phase: "HYPER_TUNING",
            purpose: "Converge runtime parameters via Monte Carlo Tree Search (UCT).",
            mandatory: false,
            suggestedArguments: { iterations: 120, seed: 42 }
          },
          {
            order: 3,
            toolName: "eos_canary_rollout",
            phase: "PROGRESSIVE_DELIVERY",
            purpose: "Execute progressive canary stages (1% -> 5% -> 25% -> 100%) with fail-closed rollback.",
            mandatory: true,
            suggestedArguments: { versionTarget: "v49.0.0", previousVersion: "v48.0.0" }
          }
        ];

      case "PERFORMANCE_TUNING":
        return [
          {
            order: 1,
            toolName: "eos_nano_benchmark",
            phase: "BASELINE_BENCHMARK",
            purpose: "Capture nanosecond percentile baseline (p50, p99, ops/sec) before optimization.",
            mandatory: true,
            suggestedArguments: {}
          },
          {
            order: 2,
            toolName: "eos_mcts_tune",
            phase: "PARAMETER_CONVERGENCE",
            purpose: "Explore optimal concurrency, ring buffer, and GC thresholds via UCT MCTS.",
            mandatory: true,
            suggestedArguments: { iterations: 120, seed: 42 }
          },
          {
            order: 3,
            toolName: "eos_turbo_verify",
            phase: "VERIFICATION",
            purpose: "Confirm zero architectural regressions after optimization.",
            mandatory: true,
            suggestedArguments: {}
          }
        ];

      case "ARCHITECTURE_AUDIT":
        return [
          {
            order: 1,
            toolName: "eos_check_architecture",
            phase: "HEXAGONAL_GUARD",
            purpose: "Verify Layer-0 hexagonal purity (0 runtime dependencies) and 0 circular imports.",
            mandatory: true,
            suggestedArguments: { targetDir: "src" }
          },
          {
            order: 2,
            toolName: "eos_refactor_audit",
            phase: "DEBT_ANALYSIS",
            purpose: "Scan for dead code, duplication, and complexity hotspots with SHA-256 receipt.",
            mandatory: true,
            suggestedArguments: { targetDir: "src/core" }
          },
          {
            order: 3,
            toolName: "eos_check_openspec",
            phase: "SPEC_ALIGNMENT",
            purpose: "Ensure codebase remains 100% aligned with approved OpenSpec artifacts.",
            mandatory: true,
            suggestedArguments: {}
          }
        ];

      case "BUGFIX_FDIR":
        return [
          {
            order: 1,
            toolName: "eos_semantic_search",
            phase: "ROOT_CAUSE_SEARCH",
            purpose: "Locate governing specifications and invariants for the failing component.",
            mandatory: true,
            suggestedArguments: { query: directive.slice(0, 120), topK: 3 }
          },
          {
            order: 2,
            toolName: "eos_get_blast_radius",
            phase: "IMPACT_ISOLATION",
            purpose: "Compute transitive dependents and predictive test suites affected by the fix.",
            mandatory: true,
            suggestedArguments: { changedFiles: ["src/core/eosKernelPrimitives.ts"] }
          },
          {
            order: 3,
            toolName: "eos_validate_patch",
            phase: "PATCH_VALIDATION",
            purpose: "Validate candidate fix for syntax and security compliance before commit.",
            mandatory: true,
            suggestedArguments: { filePath: "src/fix.ts", content: "<candidate>" }
          },
          {
            order: 4,
            toolName: "eos_turbo_verify",
            phase: "REGRESSION_GATE",
            purpose: "Confirm clean verification state across repository invariants.",
            mandatory: true,
            suggestedArguments: {}
          }
        ];

      case "SDD_FULL_21_STEP":
      default:
        return [
          {
            order: 1,
            toolName: "eos_amplify_prompt",
            phase: "REQUIREMENTS_EARS_BDD",
            purpose: "Amplify raw directive into formal IEEE 830 EARS requirements and BDD acceptance criteria.",
            mandatory: true,
            suggestedArguments: { rawPrompt: directive.slice(0, 500), targetModel: "gemini", strictLevel: "sovereign" }
          },
          {
            order: 2,
            toolName: "eos_check_architecture",
            phase: "ARCHITECTURE_GATE",
            purpose: "Verify clean/hexagonal boundaries and zero circular dependencies before implementation.",
            mandatory: true,
            suggestedArguments: { targetDir: "src" }
          },
          {
            order: 3,
            toolName: "eos_evaluate_decision",
            phase: "CONSTITUTIONAL_TRIBUNAL",
            purpose: "Validate architectural plan against the Seven Inviolable Commandments.",
            mandatory: true,
            suggestedArguments: {
              title: `SDD Mission (${targetId})`,
              description: directive.slice(0, 300),
              proposedAction: "Implement strictly against approved SPEC, PLAN, TASKS, and LEVEL 2+ authorization."
            }
          },
          {
            order: 4,
            toolName: "eos_turbo_verify",
            phase: "STRICT_VERIFICATION",
            purpose: "Run fast 4-stage in-memory verification prior to full 7-stage CI/CD pipeline.",
            mandatory: true,
            suggestedArguments: {}
          },
          {
            order: 5,
            toolName: "eos_fleet_soundcheck",
            phase: "FLEET_CERTIFICATION",
            purpose: "Confirm sovereign fleet health and deployment quorum.",
            mandatory: true,
            suggestedArguments: {}
          }
        ];
    }
  }
}
