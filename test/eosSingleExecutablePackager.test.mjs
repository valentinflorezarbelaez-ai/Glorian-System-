import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosSingleExecutablePackager } from "../src/core/eosSingleExecutablePackager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-271: Generación determinista del archivo de configuración SEA y blob compilado (SPEC-098)", () => {
  const packager = new EosSingleExecutablePackager(projectRoot);

  // 1. Generate and test sea-config.json
  const config = packager.generateSeaConfig();
  assert.equal(config.main, "bin/eos.mjs");
  assert.equal(config.output, "dist/eos.blob");
  assert.equal(config.disableExperimentalSEAWarning, true);

  const configPath = path.join(projectRoot, "sea-config.json");
  assert.ok(fs.existsSync(configPath), "sea-config.json file must exist on disk");

  // 2. Compile SEA blob
  const result = packager.compileBlob();
  assert.ok(fs.existsSync(result.blobPath), "Compiled blob must exist in dist/eos.blob");
  assert.ok(result.blobBytes > 0, "Compiled blob must have non-zero size");
  assert.equal(result.sha256.length, 64, "Blob hash must be 64-hex SHA-256");
});

test("BDD-272: Verificación de metadatos de empaquetado y compatibilidad multiplataforma (SPEC-098)", () => {
  const packager = new EosSingleExecutablePackager(projectRoot);

  const winRecipe = packager.getPlatformInjectionRecipe("win-x64");
  assert.equal(winRecipe.binaryName, "eos.exe");
  assert.ok(winRecipe.injectionCommand.includes("NODE_SEA_BLOB"));
  assert.ok(winRecipe.injectionCommand.includes("--sentinel-fuse"));

  const linuxRecipe = packager.getPlatformInjectionRecipe("linux-x64");
  assert.equal(linuxRecipe.binaryName, "eos");
  assert.ok(linuxRecipe.copyCommand.includes("cp $(command -v node)"));

  const darwinRecipe = packager.getPlatformInjectionRecipe("darwin-arm64");
  assert.equal(darwinRecipe.binaryName, "eos-darwin");
  assert.ok(darwinRecipe.injectionCommand.includes("--macho-segment-name NODE_SEA"));
  assert.ok(darwinRecipe.signatureCommand.includes("codesign"));
});
