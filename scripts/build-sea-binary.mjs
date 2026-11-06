#!/usr/bin/env node

/**
 * EOS System — Standalone SEA Binary Builder Script (SPEC-098)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosSingleExecutablePackager } from "../src/core/eosSingleExecutablePackager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

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
