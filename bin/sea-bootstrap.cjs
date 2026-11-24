#!/usr/bin/env node
/* global __dirname */
/**
 * Glorian System — Hermetic Single-Executable Application (SEA) Bootstrap Entry
 * Compliant with Node.js 24 Single-Executable Application specification.
 * Zero external runtime dependencies.
 */

const path = require("node:path");
const fs = require("node:fs");

function getControlPlaneVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
    if (pkg && typeof pkg.version === "string" && pkg.version.trim()) return `v${pkg.version.trim()}`;
  } catch {
    // Hermetic fallback when executing standalone binary outside repo
  }
  return "v75.0.0";
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`Glorian System Control Plane ${getControlPlaneVersion()} (Standalone SEA Binary)`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Glorian System Control Plane — Standalone Hermetic Executable (SEA)");
    console.log("Usage: glorian [command] [options]");
    console.log("Commands: doctor, remediate, fuzz, arena, zk:prove, compile, verify");
    console.log("Environment: Zero runtime dependencies, Ed25519 signed, SLSA Level-4 provenanced");
    return;
  }

  // Check if ambient bin/eos.mjs is present in working context
  const possiblePaths = [path.resolve(__dirname, "eos.mjs"), path.resolve(process.cwd(), "bin/eos.mjs")];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate)) {
      import(require("node:url").pathToFileURL(candidate).href).catch((err) => {
        console.error("Glorian SEA Bootstrap Execution Error:", err);
        process.exit(1);
      });
      return;
    }
  }

  console.log("Glorian System Control Plane (Hermetic Standalone Binary)");
  console.log(`Node runtime: ${process.version} (${process.platform} ${process.arch})`);
  console.log("Execution environment: Distroless/Hermetic host");
}

main();
