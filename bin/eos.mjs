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
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printBanner } from "./commands/cliShared.mjs";
import { handleCoreCommands } from "./commands/cliCore.mjs";
import { handleDevOpsCommands } from "./commands/cliDevOps.mjs";
import { handleSpotifyCommands } from "./commands/cliSpotify.mjs";
import { handleFrontierCommands } from "./commands/cliFrontier.mjs";
import { handleResilienceCommands } from "./commands/cliResilience.mjs";
import { handleSovereignCommands } from "./commands/cliSovereign.mjs";
import { handleSentinelCommands } from "./commands/cliSentinel.mjs";
import { handlePlatformCommands } from "./commands/cliPlatform.mjs";
import { handleKernelCommands } from "./commands/cliKernel.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const args = process.argv.slice(2);
const command = (args[0] || "help").toLowerCase();
const ctx = {
  root,
  packageMetadata,
  args,
  command,
  printBanner: () => printBanner(packageMetadata),
};

async function main() {
  if (await handleCoreCommands(ctx)) return;
  if (await handleDevOpsCommands(ctx)) return;
  if (await handleSpotifyCommands(ctx)) return;
  if (await handleFrontierCommands(ctx)) return;
  if (await handleResilienceCommands(ctx)) return;
  if (await handleSovereignCommands(ctx)) return;
  if (await handleSentinelCommands(ctx)) return;
  if (await handlePlatformCommands(ctx)) return;
  await handleKernelCommands(ctx);
}

await main();
