#!/usr/bin/env node

/**
 * EOS SYSTEM — IDEMPOTENT ANTIGRAVITY MCP & GOVERNANCE PLUGIN INSTALLER
 * Governed by SPEC-043, CHANGE-036, ADR-049, FR-131, BDD-127 (v49.0.0)
 *
 * Repairs dangling NTFS junctions in ~/.gemini/config/, wires eos-system stdio MCP
 * with portable EOS_FLEET_*_PATH bindings (preserving all third-party servers and secrets),
 * enables the native eos-governance plugin, synchronizes Antigravity MCP schema cache,
 * and verifies 100/100 Sovereign Directing readiness.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosAntigravityDirector } from "../src/core/eosAntigravityDirector.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "..");

function removeReparsePointOnly(linkPath) {
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    throw err;
  }

  if (!stat.isSymbolicLink()) {
    return false;
  }

  try {
    fs.unlinkSync(linkPath);
    return true;
  } catch {
    fs.rmdirSync(linkPath);
    return true;
  }
}

function copyDirectoryRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensureJunctionOrCopy(sourceDir, targetLink, mergeSubdirsOnly = false) {
  fs.mkdirSync(path.dirname(targetLink), { recursive: true });

  let existingStat = null;
  try {
    existingStat = fs.lstatSync(targetLink);
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }

  if (existingStat) {
    if (existingStat.isSymbolicLink()) {
      removeReparsePointOnly(targetLink);
    } else if (existingStat.isDirectory()) {
      if (mergeSubdirsOnly) {
        for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            copyDirectoryRecursive(path.join(sourceDir, entry.name), path.join(targetLink, entry.name));
          }
        }
        return "MERGED_INTO_EXISTING_DIRECTORY";
      }
      fs.rmSync(targetLink, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetLink);
    }
  }

  try {
    const linkType = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(sourceDir, targetLink, linkType);
    return "JUNCTION_LINKED";
  } catch {
    copyDirectoryRecursive(sourceDir, targetLink);
    return "COPIED_FALLBACK";
  }
}

export function installAntigravityIntegration(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || DEFAULT_PROJECT_ROOT);
  const geminiConfigDir = path.resolve(
    options.geminiConfigDir || path.join(os.homedir(), ".gemini", "config")
  );
  const appDataMcpDir = options.appDataMcpDir !== undefined
    ? (options.appDataMcpDir ? path.resolve(options.appDataMcpDir) : null)
    : path.join(os.homedir(), ".gemini", "antigravity", "mcp", "eos-system");
  const fleetOverrides = options.fleetOverrides || {};

  const actions = [];
  fs.mkdirSync(geminiConfigDir, { recursive: true });

  // 1. Wire ~/.gemini/config/mcp_config.json preserving all third-party servers untouched
  const mcpConfigPath = path.join(geminiConfigDir, "mcp_config.json");
  let mcpDoc = { mcpServers: {} };
  if (fs.existsSync(mcpConfigPath)) {
    const raw = fs.readFileSync(mcpConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      mcpDoc = parsed;
    }
  }
  if (!mcpDoc.mcpServers || typeof mcpDoc.mcpServers !== "object" || Array.isArray(mcpDoc.mcpServers)) {
    mcpDoc.mcpServers = {};
  }

  const synthesizedEntry = EosAntigravityDirector.synthesizeAntigravityMcpEntry(projectRoot, fleetOverrides);
  mcpDoc.mcpServers["eos-system"] = {
    command: synthesizedEntry.command,
    args: [...synthesizedEntry.args],
    env: { ...synthesizedEntry.env }
  };
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpDoc, null, 2) + "\n", "utf8");
  actions.push(`Updated eos-system entry in ${mcpConfigPath} (${Object.keys(synthesizedEntry.env).length} env bindings)`);

  // 2. Link ~/.gemini/config/plugins/eos-governance -> integrations/antigravity/eos-governance
  const pluginSourceDir = path.join(projectRoot, "integrations", "antigravity", "eos-governance");
  const globalPluginLink = path.join(geminiConfigDir, "plugins", "eos-governance");
  const pluginMode = ensureJunctionOrCopy(pluginSourceDir, globalPluginLink, false);
  actions.push(`Configured plugin bundle ${globalPluginLink} (${pluginMode})`);

  // 3. Link ~/.gemini/config/skills -> .agents/skills
  const skillsSourceDir = path.join(projectRoot, ".agents", "skills");
  const globalSkillsLink = path.join(geminiConfigDir, "skills");
  const skillsMode = ensureJunctionOrCopy(skillsSourceDir, globalSkillsLink, true);
  actions.push(`Configured global skills ${globalSkillsLink} (${skillsMode})`);

  // 4. Enable eos-governance in ~/.gemini/config/config.json preserving existing preferences
  const globalConfigPath = path.join(geminiConfigDir, "config.json");
  let configDoc = {};
  if (fs.existsSync(globalConfigPath)) {
    try {
      const parsedConfig = JSON.parse(fs.readFileSync(globalConfigPath, "utf8"));
      if (parsedConfig && typeof parsedConfig === "object" && !Array.isArray(parsedConfig)) {
        configDoc = parsedConfig;
      }
    } catch {
      configDoc = {};
    }
  }
  if (!configDoc.plugins || typeof configDoc.plugins !== "object" || Array.isArray(configDoc.plugins)) {
    configDoc.plugins = {};
  }
  configDoc.plugins["eos-governance"] = { enabled: true };
  fs.writeFileSync(globalConfigPath, JSON.stringify(configDoc, null, 2) + "\n", "utf8");
  actions.push(`Enabled eos-governance plugin in ${globalConfigPath}`);

  // 5. Synchronize Antigravity MCP cache (instructions.md + new tool schemas) when present
  if (appDataMcpDir && fs.existsSync(appDataMcpDir)) {
    fs.writeFileSync(
      path.join(appDataMcpDir, "instructions.md"),
      EosAntigravityDirector.DIRECTOR_INSTRUCTIONS_PLAYBOOK + "\n",
      "utf8"
    );
    const toolSchemas = [
      {
        name: "eos_antigravity_direct",
        description:
          "Primary Antigravity Mission Director: classifies an engineering directive into its EOS execution profile, checks Law IV External Write Barrier preconditions against registry.json, prescribes the ordered DAG of EOS MCP tools to run, and returns a SHA-256 receipt.",
        parameters: {
          properties: {
            directive: {
              description: "User request or engineering mission directive to direct",
              type: "string"
            },
            target: {
              description: "Target registered project ID or workspace path (default: 'eos-system')",
              type: "string"
            }
          },
          required: ["directive"],
          type: "object"
        }
      },
      {
        name: "eos_antigravity_doctor",
        description:
          "Audits the end-to-end Antigravity <-> EOS MCP integration health: global mcp_config.json fleet env bindings, SingleServerInvariant, native eos-governance plugin, hooks, progressive-disclosure skills, and NTFS junction integrity.",
        parameters: {
          properties: {
            geminiConfigDir: {
              description: "Optional path to ~/.gemini/config directory",
              type: "string"
            }
          },
          type: "object"
        }
      },
      {
        name: "eos_sqlite_ledger",
        description:
          "Zero-dependency Durable SQLite WAL + FTS5 + SHA-256 hash-chained bitemporal ledger (node:sqlite). Supports append ('record'), full-text search ('search'), listing ('recent'), and cryptographic chain verification ('verify').",
        parameters: {
          properties: {
            action: {
              description: "Ledger operation to execute (default: 'verify')",
              enum: ["record", "search", "recent", "verify"],
              type: "string"
            },
            category: {
              description: "Entry category (for 'record')",
              enum: ["MISSION_DIRECTION", "ARCHITECTURE_DECISION", "SECURITY_AUDIT", "VERIFICATION_RECEIPT", "GENTLEMAN_ENGRAM_SYNC"],
              type: "string"
            },
            projectId: {
              description: "Target project ID (default: 'eos-system')",
              type: "string"
            },
            title: {
              description: "Entry title (required for 'record')",
              type: "string"
            },
            payload: {
              description: "Structured JSON metadata payload (for 'record')",
              type: "object"
            },
            engramTopicKey: {
              description: "Optional Engram topic_key cross-reference",
              type: "string"
            },
            query: {
              description: "FTS5 full-text search query (for 'search')",
              type: "string"
            },
            limit: {
              description: "Maximum records to return (1-100, default: 10)",
              type: "number"
            },
            databasePath: {
              description: "Optional confined ledger database path within projectRoot or ':memory:'",
              type: "string"
            }
          },
          type: "object"
        }
      },
      {
        name: "eos_ast_analyze",
        description:
          "Compiler-grade TypeScript AST architecture & Node 24 strip-only verifier. Parses real TypeScript ASTs to verify Layer-0 zero-dependency purity, absence of prohibited TS constructs (enum, namespace, parameter properties), exported symbols, and exact cyclomatic complexity.",
        parameters: {
          properties: {
            targetDir: {
              description: "Target directory relative to project root (default: 'src/core')",
              type: "string"
            }
          },
          type: "object"
        }
      },
      {
        name: "eos_gentleman_audit",
        description:
          "Audits the unified EOS System + Gentleman Programming AI Ecosystem co-governance stack inside Google Antigravity (eos-system MCP, gentle-ai CLI, engram CLI+MCP, gga+.gga, context7 MCP, and agent-teams-lite SDD + judgment-day skills).",
        parameters: {
          properties: {
            geminiConfigDir: {
              description: "Optional path to ~/.gemini/config directory",
              type: "string"
            }
          },
          type: "object"
        }
      },
      {
        name: "eos_gentleman_update",
        description:
          "Autonomous Evergreen Auto-Updater for Gentle-AI and the complete Gentleman Programming AI Stack (gentle-ai, engram, gga, agent-teams-lite skills). Checks upstream SemVer tags & commits, verifies SHA-256 checksums, hot-swaps binaries with rollback, and preserves the EOS Constitution.",
        parameters: {
          properties: {
            action: {
              description: "Operation mode: 'status' (fast state read), 'check' (upstream SemVer check), or 'apply' (download, verify SHA-256 & hot-swap upgrades)",
              enum: ["status", "check", "apply"],
              type: "string"
            },
            force: {
              description: "Force re-verification/re-sync even when versions match",
              type: "boolean"
            }
          },
          type: "object"
        }
      }
    ];
    for (const schema of toolSchemas) {
      fs.writeFileSync(
        path.join(appDataMcpDir, `${schema.name}.json`),
        JSON.stringify(schema),
        "utf8"
      );
    }
    actions.push(`Synchronized instructions.md and tool schemas in ${appDataMcpDir}`);
  }

  const doctorReport = EosAntigravityDirector.auditAntigravityIntegration(projectRoot, geminiConfigDir);
  return {
    installed: doctorReport.readinessScore >= 95,
    actions,
    doctorReport
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = installAntigravityIntegration();
  console.log("======================================================================");
  console.log(" EOS SYSTEM v51.0.0 — ANTIGRAVITY SOVEREIGN MCP INSTALLER");
  console.log("======================================================================");
  for (const action of result.actions) {
    console.log(`  [+] ${action}`);
  }
  console.log("\n--- ANTIGRAVITY CONTROL PLANE DOCTOR ---");
  console.log(`  Status                 : ${result.doctorReport.status}`);
  console.log(`  Readiness Score        : ${result.doctorReport.readinessScore}/100`);
  console.log(`  SingleServerInvariant  : ${result.doctorReport.singleServerInvariantVerified ? "VERIFIED" : "VIOLATED"}`);
  console.log(`  SHA-256 Receipt        : sha256:${result.doctorReport.sha256Receipt}`);
  for (const check of result.doctorReport.checks) {
    console.log(`    • [${check.passed ? "PASS" : "FAIL"}] ${check.label} (${check.score}/${check.maxScore}) — ${check.detail}`);
  }
  if (!result.installed) {
    process.exit(1);
  }
}
