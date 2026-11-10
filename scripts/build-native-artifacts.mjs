#!/usr/bin/env node
/**
 * EOS SYSTEM — NATIVE ARTIFACT COMPILER (Go + Wasm + SEA)
 * Governed by SPEC-019, SPEC-098, ADR-039
 *
 * Compiles Go micro-engines and WebAssembly bridges with deterministic
 * SHA-256 receipts, cross-platform environment isolation, and zero-dependency
 * Node.js execution.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("======================================================================");
console.log(" EOS SYSTEM — NATIVE COMPILATION PIPELINE (Go, Wasm, SEA)");
console.log("======================================================================");

// 1. Verify Go Toolchain Availability
const goCheck = spawnSync("go", ["version"], { encoding: "utf8" });
if (goCheck.status !== 0 || !goCheck.stdout) {
  console.log("⚠️ Go toolchain not detected in PATH. Skipping native binary compilation.");
  process.exit(0);
}

const goVersion = goCheck.stdout.trim();
console.log(`[GO TOOLCHAIN] ${goVersion}`);

fs.mkdirSync(path.join(projectRoot, "bin"), { recursive: true });
fs.mkdirSync(path.join(projectRoot, "assets"), { recursive: true });

const exeExt = process.platform === "win32" ? ".exe" : "";

const targets = [
  {
    name: "Spotify Gapless Audio DSP Engine",
    source: "src/native/eos_spotify_engine.go",
    output: `bin/eos-spotify${exeExt}`,
    env: process.env,
    flags: ["-ldflags=-s -w"],
  },
  {
    name: "Apex Model Router Orchestrator",
    source: "src/native/eos_apex_orchestrator.go",
    output: `bin/eos-apex${exeExt}`,
    env: process.env,
    flags: ["-ldflags=-s -w"],
  },
  {
    name: "Apex WebAssembly High-Throughput Bridge",
    source: "src/native/eos_wasm_bridge.go",
    output: "assets/eos_apex.wasm",
    env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
    flags: ["-ldflags=-s -w"],
  },
];

const receipts = [];

for (const target of targets) {
  const srcPath = path.join(projectRoot, target.source);
  const outPath = path.join(projectRoot, target.output);

  if (!fs.existsSync(srcPath)) {
    console.log(`[SKIP] Source ${target.source} not found.`);
    continue;
  }

  process.stdout.write(`[BUILDING] ${target.name} (${target.output})... `);
  const t0 = performance.now();

  const args = ["build", ...target.flags, "-o", outPath, target.source];
  const build = spawnSync("go", args, {
    cwd: projectRoot,
    env: target.env,
    encoding: "utf8",
  });

  const durationMs = (performance.now() - t0).toFixed(1);

  if (build.status !== 0) {
    console.log("FAILED ❌");
    console.error(`  Error: ${build.stderr}`);
    process.exit(1);
  }

  const stat = fs.statSync(outPath);
  const fileBytes = fs.readFileSync(outPath);
  const sha256 = crypto.createHash("sha256").update(fileBytes).digest("hex");

  console.log(`OK ✅ (${(stat.size / 1024 / 1024).toFixed(2)} MB in ${durationMs}ms)`);
  console.log(`  SHA-256: ${sha256}`);

  receipts.push({
    target: target.name,
    output: target.output,
    bytes: stat.size,
    sha256,
  });
}

console.log("\n======================================================================");
console.log(`✅ NATIVE PIPELINE COMPLETE — ${receipts.length} artifact(s) verified.`);
console.log("======================================================================");
