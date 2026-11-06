#!/usr/bin/env node
/**
 * EOS SYSTEM — FAIL-CLOSED SUPPLY CHAIN & SBOM VERIFICATION ENGINE
 * Governed by SPEC-139, CHANGE-074, ADR-0170
 *
 * Validates bit-for-bit SHA-256 congruence between local files on disk
 * and CycloneDX v1.5 SBOM + In-toto SLSA Provenance v1.0 statements.
 *
 * Exits with code 0 on clean verification, code 1 on any mismatch or tampering.
 * Pure Layer-0 (0 npm runtime dependencies).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRoot = path.resolve(__dirname, "..");

// Parse optional CLI arguments
const args = process.argv.slice(2);
let root = defaultRoot;
let sbomPath = undefined;
let provenancePath = undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) {
    root = path.resolve(args[++i]);
  } else if (args[i] === "--sbom" && args[i + 1]) {
    sbomPath = path.resolve(args[++i]);
  } else if (args[i] === "--provenance" && args[i + 1]) {
    provenancePath = path.resolve(args[++i]);
  }
}

console.log("======================================================================");
console.log(" EOS SYSTEM — STRICT SUPPLY CHAIN INTEGRITY VERIFICATION ");
console.log(` [INFO] Root: ${root}`);
console.log("======================================================================");

const result = EosSlsaProvenanceSbom.verifySupplyChain(root, sbomPath, provenancePath);

if (!result.valid) {
  console.error("\n[CRITICAL FAILURE] Supply-chain verification FAILED with violations:");
  for (const err of result.errors) {
    console.error(`  ✖ ${err}`);
  }
  console.error("\n[REJECTED] The supply chain does not match cryptographic attestation. Aborting.\n");
  process.exit(1);
}

console.log("\n[VERIFICATION SUCCEEDED]");
console.log(`  ✔ Verified SBOM Components : ${result.componentsChecked} files bit-for-bit identical`);
console.log(`  ✔ Verified SLSA Subjects   : ${result.subjectsChecked} subjects authenticated`);
if (result.sbomDigest) {
  console.log(`  ✔ SBOM File SHA-256        : sha256:${result.sbomDigest}`);
}
if (result.provenanceDigest) {
  console.log(`  ✔ Provenance File SHA-256  : sha256:${result.provenanceDigest}`);
}
console.log("\n======================================================================");
console.log(" [PASS] 100% Cryptographic congruence confirmed. Zero supply chain drift.");
console.log("======================================================================\n");
process.exit(0);
