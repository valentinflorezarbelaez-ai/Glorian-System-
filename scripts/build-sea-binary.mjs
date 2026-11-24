#!/usr/bin/env node

/**
 * EOS System — Standalone SEA Binary Builder Script (SPEC-098)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosHermeticSeaCompiler } from "../src/core/eosHermeticSeaCompiler.ts";
import { EosSingleExecutablePackager } from "../src/core/eosSingleExecutablePackager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const bundleRelease = args.has("--bundle-release");
const dryRun = args.has("--dry-run");

console.log("=== EOS Single Executable Application (SEA) Builder ===");

const packager = new EosSingleExecutablePackager(projectRoot);
const config = packager.generateSeaConfig();
console.log(`[SEA CONFIG] Generated ${config.output} (main: ${config.main})`);

const result = packager.compileBlob();
console.log(`[SEA BLOB] Successfully compiled: ${result.blobPath}`);
console.log(`[SIZE] ${result.blobBytes} bytes`);
console.log(`[SHA-256] ${result.sha256}`);

const winRecipe = packager.getPlatformInjectionRecipe("win-x64");
console.log(`[RECIPE: WIN] ${winRecipe.injectionCommand}`);

if (bundleRelease) {
  const distDir = path.join(projectRoot, "dist");
  const seaResult = EosHermeticSeaCompiler.compileStandaloneBinary({
    projectRoot,
    outputDir: distDir,
    dryRun,
  });

  const candidatePaths = [
    result.blobPath,
    seaResult.blobPath,
    seaResult.binaryPath,
    seaResult.signaturePath,
    seaResult.provenancePath,
    seaResult.sbomPath,
  ].filter((candidate) => typeof candidate === "string" && fs.existsSync(candidate));

  const seen = new Set();
  const checksumLines = [];
  for (const filePath of candidatePaths) {
    const fileName = path.basename(filePath);
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    checksumLines.push(`${digest}  ${fileName}`);
  }

  const checksumPath = path.join(distDir, "SHA256SUMS.txt");
  fs.writeFileSync(checksumPath, checksumLines.join("\n") + "\n", "utf8");

  console.log(`[SEA BUNDLE] Platform: ${seaResult.targetPlatform} (dryRun=${seaResult.dryRun})`);
  console.log(`[SEA BUNDLE] Binary target: ${seaResult.binaryPath}`);
  console.log(`[SEA BUNDLE] SHA256SUMS: ${checksumPath} (${checksumLines.length} entries)`);
}
