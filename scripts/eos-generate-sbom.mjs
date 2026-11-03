#!/usr/bin/env node
/**
 * EOS SYSTEM — DETERMINISTIC CYCLONEDX v1.5 SBOM & IN-TOTO SLSA PROVENANCE GENERATOR
 * Governed by SPEC-139, CHANGE-074, ADR-0170
 *
 * Synthesizes:
 * - docs/evidence/sbom.cdx.json (CycloneDX v1.5 JSON)
 * - docs/evidence/provenance.intoto.jsonl (In-toto Statement v1 / SLSA Provenance v1.0)
 *
 * Pure Layer-0 (0 npm runtime dependencies).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

console.log("======================================================================");
console.log(" EOS SYSTEM — SUPPLY CHAIN ATTESTATION & SBOM GENERATOR ");
console.log(` [INFO] Root: ${root}`);
console.log("======================================================================");

try {
  const evidenceDir = path.join(root, "docs", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // 1. Generate CycloneDX v1.5 SBOM
  console.log("\n[1/3] Synthesizing CycloneDX v1.5 Software Bill of Materials...");
  const sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(root);
  const sbomPath = path.join(evidenceDir, "sbom.cdx.json");
  fs.writeFileSync(sbomPath, JSON.stringify(sbom, null, 2) + "\n", "utf8");

  console.log(`  ✔ Serial Number   : ${sbom.serialNumber}`);
  console.log(`  ✔ Main Component  : ${sbom.metadata.component.name} (v${sbom.metadata.component.version})`);
  console.log(`  ✔ Modules Scanned : ${sbom.components.length} files`);
  console.log(`  ✔ Runtime Deps    : ${sbom.metadata.runtimeDependenciesCount} (Strict Layer-0 Pure)`);
  console.log(`  ✔ SBOM File       : ${path.relative(root, sbomPath)}`);
  console.log(`  ✔ SHA-256 Receipt : sha256:${sbom.sha256Receipt}`);

  // 2. Generate In-Toto SLSA Provenance v1.0 Statement
  console.log("\n[2/3] Synthesizing In-Toto SLSA Provenance v1.0 Statement...");
  const commitSha = process.env.GITHUB_SHA || "HEAD";
  const slsa = EosSlsaProvenanceSbom.generateSlsaProvenance(root, commitSha);
  const provenancePath = path.join(evidenceDir, "provenance.intoto.jsonl");
  fs.writeFileSync(provenancePath, JSON.stringify(slsa) + "\n", "utf8");

  console.log(`  ✔ Statement Type  : ${slsa._type}`);
  console.log(`  ✔ Predicate Type  : ${slsa.predicateType}`);
  console.log(`  ✔ Builder ID      : ${slsa.predicate.runDetails.builder.id}`);
  console.log(`  ✔ Subjects Signed : ${slsa.subject.length} artifacts`);
  console.log(`  ✔ Provenance File : ${path.relative(root, provenancePath)}`);
  console.log(`  ✔ SHA-256 Receipt : sha256:${slsa.sha256Receipt}`);

  // 3. Record Attestations in SQLite WAL Ledger
  console.log("\n[3/3] Committing attestations to Durable SQLite WAL Ledger...");
  EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, root);
  EosSlsaProvenanceSbom.recordReceiptInLedger(slsa, root);
  console.log("  ✔ Attestations committed to SQLite WAL ledger.");

  console.log("\n======================================================================");
  console.log(" [SUCCESS] Supply-Chain SBOM and SLSA Provenance generated cleanly.");
  console.log("======================================================================");
} catch (err) {
  console.error("\n[FATAL ERROR] Supply-chain generation aborted:", err);
  process.exit(1);
}
