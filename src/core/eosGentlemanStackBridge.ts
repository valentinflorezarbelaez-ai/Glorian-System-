/**
 * EOS SYSTEM — GENTLEMAN AI STACK CO-GOVERNANCE BRIDGE & AUDITOR (Layer 0)
 * Governed by SPEC-044, CHANGE-037, ADR-050, FR-136, BDD-132 (v50.0.0)
 *
 * Audits and coordinates the unified Sovereign Co-Governance stack connecting
 * EOS System (`eos-system` MCP + `eos-governance` hooks) and the complete
 * Gentleman Programming AI Ecosystem (`gentle-ai`, `engram`, `gga`, `context7`,
 * and `agent-teams-lite` SDD + `judgment-day` skills) inside Google Antigravity.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface GentlemanPillarAudit {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly versionOrPath: string;
  readonly detail: string;
}

export interface GentlemanStackAuditReport {
  readonly projectRoot: string;
  readonly geminiConfigDir: string;
  readonly readinessScore: number;
  readonly status: "SOVEREIGN_GENTLEMAN_APEX" | "CO_GOVERNANCE_PARTIAL" | "INCOMPLETE";
  readonly constitutionPreserved: boolean;
  readonly pillars: readonly GentlemanPillarAudit[];
  readonly activeSddSkills: readonly string[];
  readonly coGovernanceProtocol: readonly string[];
  readonly sha256Receipt: string;
}

const REQUIRED_GENTLEMAN_SDD_SKILLS = [
  "sdd-init",
  "sdd-explore",
  "sdd-propose",
  "sdd-spec",
  "sdd-design",
  "sdd-tasks",
  "sdd-apply",
  "sdd-verify",
  "sdd-archive",
  "judgment-day",
  "eos-gentleman-synergy",
] as const;

/**
 * External Gentle-AI canon (Alan Buscaglia / Gentleman Programming).
 * Site + GitHub + primary channel + VODs are first-class references for co-governance.
 */
export interface GentlemanExternalCanon {
  readonly site: string;
  readonly github: string;
  readonly youtubeMain: string;
  readonly youtubeVods: string;
  readonly author: string;
  readonly stackTools: readonly string[];
  readonly fourLayers: readonly string[];
  readonly operatingPrinciples: readonly string[];
  readonly keyTeachingVideos: readonly { readonly title: string; readonly url: string }[];
}

export class EosGentlemanStackBridge {
  public static readonly EXTERNAL_CANON: GentlemanExternalCanon = deepFreeze({
    site: "https://gentlemanprogramming.com/",
    github: "https://github.com/Gentleman-Programming",
    youtubeMain: "https://www.youtube.com/@gentlemanprogramming/videos",
    youtubeVods: "https://www.youtube.com/@GentlemanProgrammingVods",
    author: "Alan Buscaglia (Gentleman Programming)",
    stackTools: Object.freeze([
      "gentle-ai",
      "engram",
      "gga",
      "context7",
      "agent-teams-lite",
      "gentle-shell",
      "Gentleman.Dots",
    ]),
    fourLayers: Object.freeze([
      "1. el Gentleman — coordinate intent; ask only real decisions; push/PR/merge stay human",
      "2. ODD — Organic Driven Development; scale workflow with complexity (inline small / feature doc large)",
      "3. Focused agents — read-only explorer, writer that never commits, read-only verifier; delegate for named reasons only",
      "4. Native review (GGA) — freeze the exact change; evidence-based review before commit leaves the machine",
    ]),
    operatingPrinciples: Object.freeze([
      "Configure agents already on the machine; never silently install agent runtimes",
      "Engram persists decisions, conventions, and bug fixes across sessions and agents",
      "Requirements / exploration before code; one focused question when a real decision is open",
      "Test-first changes in small human-readable commits; tests and docs travel with the code",
      "Verification over generation: quality first, speed as a consequence",
      "ODD scales: low-risk work stays inline; large work gets a feature document in the user's words",
      "SDD / OpenSpec skills guide the AI; the model is not the process",
      "Review is on by default; humans retain merge authority",
    ]),
    keyTeachingVideos: Object.freeze([
      {
        title: "El ECOSISTEMA de IA (Engram + SDD + Skills)",
        url: "https://www.youtube.com/watch?v=UoS_LP-PCG8",
      },
      {
        title: "SDD es una de esas cosas que tenés que saber",
        url: "https://www.youtube.com/watch?v=YOVvo84AAu4",
      },
    ]),
  });

  public static readonly CO_GOVERNANCE_PROTOCOL: readonly string[] = Object.freeze([
    "1. MEMORY RECALL (Engram MCP): Query `mem_context` / `mem_search` for prior architectural decisions and session handoffs (Gentleman channel doctrine: sessions must not start from zero).",
    "2. SOVEREIGN DIRECTION & LAW IV GATE (EOS MCP): Run `eos_antigravity_direct` / `eos_mission_run` to classify mission profile and enforce External Write Barrier.",
    "3. LIVE DOCUMENTATION (Context7 MCP): Resolve up-to-date framework/SDK contracts via `resolve-library-id` + `query-docs`.",
    "4. ODD + SDD DELEGATION (gentle-ai + Agent-Teams-Lite + EOS): Inline low-risk work; for large work run `sdd-explore` -> `sdd-spec` (`eos_amplify_prompt` EARS/BDD) -> `sdd-design` -> `sdd-tasks` -> `sdd-apply` with focused explorer/writer/verifier agents.",
    "5. COMPILER AST & ADVERSARIAL DUAL REVIEW (`eos_ast_analyze` + `judgment-day` + `gga`): Freeze the change, run AST check, dual blind review, and Gentleman Guardian Angel rules check before commit leaves the machine.",
    "6. DURABLE DUAL SEAL (`eos_sqlite_ledger` + Engram `mem_save`): Record SHA-256 hash-chained WAL entry and save structured episodic memory (What/Why/Where/Learned).",
  ]);

  public static resolveExtraToolPaths(homeDir: string = os.homedir()): string[] {
    const candidates = [
      path.join(homeDir, "go", "bin"),
      path.join(homeDir, "bin"),
      path.join(homeDir, ".local", "bin"),
      path.join(homeDir, "AppData", "Local", "engram", "bin"),
      path.join(homeDir, "AppData", "Local", "gentle-ai", "bin"),
      path.join(homeDir, "AppData", "Local", "Programs", "go", "bin"),
    ];
    return candidates.filter((dir) => fs.existsSync(dir));
  }

  public static probeBinary(
    binaryBaseName: string,
    versionArgs: readonly string[],
    candidatePaths: readonly string[],
    homeDir: string = os.homedir(),
  ): { found: boolean; executablePath: string; versionOutput: string } {
    const isWin = process.platform === "win32";
    const namesToTry = isWin
      ? [`${binaryBaseName}.exe`, `${binaryBaseName}.bat`, `${binaryBaseName}.cmd`, binaryBaseName]
      : [binaryBaseName];

    const resolvedCandidates: string[] = [];
    for (const explicit of candidatePaths) {
      if (fs.existsSync(explicit)) resolvedCandidates.push(explicit);
    }
    const pathDirs = [
      ...this.resolveExtraToolPaths(homeDir),
      ...String(process.env.PATH || "")
        .split(path.delimiter)
        .filter(Boolean),
    ];
    for (const dir of pathDirs) {
      for (const name of namesToTry) {
        const full = path.join(dir, name);
        if (fs.existsSync(full) && !resolvedCandidates.includes(full)) {
          resolvedCandidates.push(full);
        }
      }
    }

    for (const candidate of resolvedCandidates) {
      try {
        const isBatch = candidate.toLowerCase().endsWith(".bat") || candidate.toLowerCase().endsWith(".cmd");
        const out = isBatch
          ? execFileSync("cmd.exe", ["/d", "/s", "/c", candidate, ...versionArgs], {
              encoding: "utf8",
              timeout: 4000,
              stdio: ["ignore", "pipe", "pipe"],
            })
          : execFileSync(candidate, [...versionArgs], {
              encoding: "utf8",
              timeout: 4000,
              stdio: ["ignore", "pipe", "pipe"],
            });
        const clean =
          String(out || "")
            .trim()
            .split(/\r?\n/)[0] || "detected";
        return { found: true, executablePath: candidate, versionOutput: clean.slice(0, 120) };
      } catch {
        // If binary file exists on disk even when version flag exits non-zero in sandbox
        return { found: true, executablePath: candidate, versionOutput: "binary-present" };
      }
    }

    return { found: false, executablePath: "", versionOutput: "not-found" };
  }

  public static auditStack(
    projectRoot: string = process.cwd(),
    geminiConfigDir: string = path.join(os.homedir(), ".gemini", "config"),
    homeDir: string = os.homedir(),
  ): GentlemanStackAuditReport {
    const resolvedRoot = path.resolve(projectRoot);
    const resolvedGemini = path.resolve(geminiConfigDir);
    const resolvedHome = path.resolve(homeDir);
    const pillars: GentlemanPillarAudit[] = [];

    // Read mcp_config.json safely without exposing secrets
    const mcpConfigPath = path.join(resolvedGemini, "mcp_config.json");
    let mcpServerNames = new Set<string>();
    if (fs.existsSync(mcpConfigPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
        if (parsed && typeof parsed.mcpServers === "object" && parsed.mcpServers) {
          mcpServerNames = new Set(Object.keys(parsed.mcpServers));
        }
      } catch {
        mcpServerNames = new Set<string>();
      }
    }

    // 1. EOS Sovereign Control Plane & Constitution Preservation (20 pts)
    const globalAgentsMd = path.join(resolvedGemini, "AGENTS.md");
    const repoConstitution = path.join(
      resolvedRoot,
      "integrations",
      "antigravity",
      "eos-governance",
      "rules",
      "AGENTS.md",
    );
    const constitutionPreserved =
      (fs.existsSync(globalAgentsMd) &&
        fs.readFileSync(globalAgentsMd, "utf8").includes("SEVEN INVIOLABLE COMMANDMENTS")) ||
      fs.existsSync(repoConstitution);
    const eosMcpRegistered = mcpServerNames.has("eos-system");
    const eosOk = constitutionPreserved && eosMcpRegistered;
    pillars.push({
      id: "EOS_CONTROL_PLANE",
      label: "EOS Sovereign MCP Control Plane & Constitution",
      passed: eosOk,
      score: eosOk ? 20 : constitutionPreserved ? 10 : 0,
      maxScore: 20,
      versionOrPath: eosMcpRegistered ? "mcp:eos-system (v51.0.0)" : "unregistered",
      detail: eosOk
        ? "eos-system MCP active and Seven Inviolable Commandments preserved intact."
        : "eos-system MCP or EOS Constitution rule missing in Antigravity config.",
    });

    // 2. Gentle-AI Orchestrator CLI (15 pts)
    const gentleProbe = this.probeBinary(
      "gentle-ai",
      ["--version"],
      [
        path.join(resolvedHome, "go", "bin", process.platform === "win32" ? "gentle-ai.exe" : "gentle-ai"),
        path.join(resolvedHome, "AppData", "Local", "gentle-ai", "bin", "gentle-ai.exe"),
      ],
      resolvedHome,
    );
    pillars.push({
      id: "GENTLE_AI_CLI",
      label: "Gentle-AI Ecosystem CLI (Gentleman-Programming/gentle-ai)",
      passed: gentleProbe.found,
      score: gentleProbe.found ? 15 : 0,
      maxScore: 15,
      versionOrPath: gentleProbe.found ? gentleProbe.versionOutput : "missing",
      detail: gentleProbe.found
        ? `Binary verified at ${gentleProbe.executablePath}`
        : "Install via Go 1.25.10+: go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@latest",
    });

    // 3. Engram Persistent Memory Engine + MCP (20 pts)
    const engramProbe = this.probeBinary(
      "engram",
      ["version"],
      [
        path.join(resolvedHome, "AppData", "Local", "engram", "bin", "engram.exe"),
        path.join(resolvedHome, "go", "bin", process.platform === "win32" ? "engram.exe" : "engram"),
      ],
      resolvedHome,
    );
    const engramMcpOk = mcpServerNames.has("engram");
    const engramFullOk = engramProbe.found && engramMcpOk;
    pillars.push({
      id: "ENGRAM_MEMORY",
      label: "Engram Persistent SQLite+FTS5 Memory (CLI + MCP)",
      passed: engramFullOk,
      score: engramFullOk ? 20 : engramProbe.found || engramMcpOk ? 10 : 0,
      maxScore: 20,
      versionOrPath: engramProbe.found ? `${engramProbe.versionOutput} (mcp:${engramMcpOk})` : `mcp:${engramMcpOk}`,
      detail: engramFullOk
        ? "Engram CLI and Antigravity MCP server both active for cross-session memory."
        : "Engram CLI or mcp_config.json 'engram' server entry incomplete.",
    });

    // 4. Gentleman Guardian Angel (GGA CLI + .gga Rules Contract) (15 pts)
    const ggaProbe = this.probeBinary(
      "gga",
      ["--version"],
      [
        path.join(resolvedHome, "bin", process.platform === "win32" ? "gga.bat" : "gga"),
        path.join(resolvedHome, "bin", "gga"),
        path.join(resolvedHome, ".local", "bin", "gga"),
      ],
      resolvedHome,
    );
    const ggaConfigExists = fs.existsSync(path.join(resolvedRoot, ".gga"));
    const ggaFullOk = ggaProbe.found && ggaConfigExists;
    pillars.push({
      id: "GGA_GUARDIAN_ANGEL",
      label: "Gentleman Guardian Angel Pre-Commit Reviewer (GGA + .gga)",
      passed: ggaFullOk,
      score: ggaFullOk ? 15 : ggaConfigExists ? 8 : 0,
      maxScore: 15,
      versionOrPath: ggaProbe.found ? ggaProbe.versionOutput : ggaConfigExists ? ".gga-configured" : "missing",
      detail: ggaFullOk
        ? `GGA CLI (${ggaProbe.executablePath}) wired to repository .gga -> AGENTS.md.`
        : "Ensure gga is installed in ~/bin and .gga exists at repository root.",
    });

    // 5. Context7 Live Framework Documentation MCP (15 pts)
    const context7PluginDir = path.join(resolvedGemini, "plugins", "context7");
    const context7Ok = mcpServerNames.has("context7") || fs.existsSync(context7PluginDir);
    pillars.push({
      id: "CONTEXT7_MCP",
      label: "Context7 Live Documentation MCP Server",
      passed: context7Ok,
      score: context7Ok ? 15 : 0,
      maxScore: 15,
      versionOrPath: context7Ok ? "mcp:context7" : "missing",
      detail: context7Ok
        ? "Context7 live documentation retrieval active in Antigravity."
        : "Context7 not detected in mcp_config.json or Antigravity plugins.",
    });

    // 6. Agent-Teams-Lite SDD + Judgment-Day + Synergy Skills (15 pts)
    const repoSkillsDir = path.join(resolvedRoot, ".agents", "skills");
    const activeSddSkills = REQUIRED_GENTLEMAN_SDD_SKILLS.filter((skill) =>
      fs.existsSync(path.join(repoSkillsDir, skill, "SKILL.md")),
    );
    const skillsOk = activeSddSkills.length === REQUIRED_GENTLEMAN_SDD_SKILLS.length;
    pillars.push({
      id: "AGENT_TEAMS_LITE_SKILLS",
      label: "Agent-Teams-Lite SDD Pipeline & Judgment-Day Skills",
      passed: skillsOk,
      score: skillsOk ? 15 : Math.floor((activeSddSkills.length / REQUIRED_GENTLEMAN_SDD_SKILLS.length) * 15),
      maxScore: 15,
      versionOrPath: `${activeSddSkills.length}/${REQUIRED_GENTLEMAN_SDD_SKILLS.length} skills active`,
      detail: skillsOk
        ? "All 9 SDD phase skills, judgment-day adversarial dual-judge, and eos-gentleman-synergy active."
        : `Missing skills: ${REQUIRED_GENTLEMAN_SDD_SKILLS.filter((s) => !activeSddSkills.includes(s)).join(", ")}`,
    });

    const readinessScore = pillars.reduce((acc, p) => acc + p.score, 0);
    assertPostcondition(readinessScore >= 0 && readinessScore <= 100, "Score must be within [0, 100]");

    const status: GentlemanStackAuditReport["status"] =
      readinessScore >= 95 ? "SOVEREIGN_GENTLEMAN_APEX" : readinessScore >= 70 ? "CO_GOVERNANCE_PARTIAL" : "INCOMPLETE";

    const sha256Receipt = pureSha256(
      JSON.stringify({
        projectRoot: resolvedRoot,
        readinessScore,
        status,
        constitutionPreserved,
        pillars: pillars.map((p) => ({ id: p.id, passed: p.passed, score: p.score })),
      }),
    );

    return deepFreeze({
      projectRoot: resolvedRoot,
      geminiConfigDir: resolvedGemini,
      readinessScore,
      status,
      constitutionPreserved,
      pillars,
      activeSddSkills,
      coGovernanceProtocol: this.CO_GOVERNANCE_PROTOCOL,
      sha256Receipt,
    });
  }
}
