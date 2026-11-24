#!/usr/bin/env node

/**
 * EOS SYSTEM — UNIVERSAL CLI ENTRY POINT (Layer 0)
 * Governed by ADR-016, FR-023 & BDD-018
 *
 * Provides a unified, IDE-agnostic command line interface for Cursor, Antigravity,
 * VS Code, JetBrains, Neovim, and CI/CD pipelines.
 *
 * Usage:
 *   eos verify               - Run configured local repository checks
 *   eos audit                - Audit sovereign fleet repositories
 *   eos test                 - Run unit tests and chaos resilience suite
 *   eos mcp                  - Launch native Model Context Protocol (MCP) server
 *   eos jarvis [directive]   - Execute autonomous cognitive directive
 *   eos health               - Print CNCF health and memory telemetry
 *   eos help                 - Display this operational manual
 *
 * Zero external runtime dependencies.
 * PERFORMANCE: Lazy-loads only the required command handler module.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printBanner } from "./commands/cliShared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const args = process.argv.slice(2);
const command = (args[0] || "help").toLowerCase();

// PERFORMANCE: Lazy-load only the handler that matches the command.
// Each handler module is imported on-demand, avoiding the cost of parsing
// all 9 handler files (total ~4,000+ lines) for simple commands like "help".
const HANDLER_MODULES = {
  core: () => import("./commands/cliCore.mjs"),
  devops: () => import("./commands/cliDevOps.mjs"),
  spotify: () => import("./commands/cliSpotify.mjs"),
  frontier: () => import("./commands/cliFrontier.mjs"),
  resilience: () => import("./commands/cliResilience.mjs"),
  sovereign: () => import("./commands/cliSovereign.mjs"),
  sentinel: () => import("./commands/cliSentinel.mjs"),
  platform: () => import("./commands/cliPlatform.mjs"),
  kernel: () => import("./commands/cliKernel.mjs"),
};

const ctx = {
  root,
  packageMetadata,
  args,
  command,
  printBanner: () => printBanner(packageMetadata, args),
};

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    const { handleKernelCommands } = await HANDLER_MODULES.kernel();
    return handleKernelCommands(ctx);
  }

  const handlers = [
    ["core", "handleCoreCommands"],
    ["devops", "handleDevOpsCommands"],
    ["spotify", "handleSpotifyCommands"],
    ["frontier", "handleFrontierCommands"],
    ["resilience", "handleResilienceCommands"],
    ["sovereign", "handleSovereignCommands"],
    ["sentinel", "handleSentinelCommands"],
    ["platform", "handlePlatformCommands"],
    ["kernel", "handleKernelCommands"],
  ];

  for (const [moduleKey, exportName] of handlers) {
    const mod = await HANDLER_MODULES[moduleKey]();
    const handler = mod[exportName];
    if (await handler(ctx)) return;
  }
}

await main();
