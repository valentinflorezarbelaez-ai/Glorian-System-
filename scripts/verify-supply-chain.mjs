#!/usr/bin/env node
/**
 * Supply-chain verifier CLI — IV&V packet path `node scripts/verify-supply-chain.mjs`.
 *
 * 1. Regenerates / verifies lockfile CycloneDX via sbom-gate (npm runtime inventory).
 * 2. Generates Layer-0 CycloneDX 1.5 + in-toto SLSA provenance, writes binder artifacts,
 *    and fail-closed verifies digests via EosSlsaProvenanceSbom.verifySupplyChain.
 *
 * Exit 0 only when both lanes pass.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosSlsaProvenanceSbom } from "../src/core/eosSlsaProvenanceSbom.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(root, "docs/evidence");
const l0SbomPath = path.join(evidenceDir, "sbom.l0.cdx.json");
const provenancePath = path.join(evidenceDir, "provenance.intoto.jsonl");

console.log("======================================================================");
console.log(" EOS SUPPLY CHAIN VERIFY — SBOM gate + Layer-0 SLSA");
console.log("======================================================================");

// Lane A: lockfile SBOM (generate then verify so IV&V hosts are never stale).
const sbomGen = spawnSync(process.execPath, [path.join(root, "scripts/sbom-gate.mjs")], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
process.stdout.write(sbomGen.stdout || "");
process.stderr.write(sbomGen.stderr || "");
if (sbomGen.status !== 0) {
  console.error("[FAIL] sbom-gate generate");
  process.exit(sbomGen.status || 1);
}

// Lane B: Layer-0 CycloneDX 1.5 + SLSA provenance (SPEC-061).
fs.mkdirSync(evidenceDir, { recursive: true });
const l0Sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(root);
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() || "HEAD";
const provenance = EosSlsaProvenanceSbom.generateSlsaProvenance(root, head);
fs.writeFileSync(l0SbomPath, JSON.stringify(l0Sbom, null, 2) + "\n", "utf8");
fs.writeFileSync(provenancePath, JSON.stringify(provenance) + "\n", "utf8");

const result = EosSlsaProvenanceSbom.verifySupplyChain(root, l0SbomPath, provenancePath);
console.log(
  JSON.stringify(
    {
      valid: result.valid,
      componentsChecked: result.componentsChecked,
      subjectsChecked: result.subjectsChecked,
      errors: result.errors,
      sbomDigest: result.sbomDigest,
      provenanceDigest: result.provenanceDigest,
      artifacts: {
        lockfileSbom: "docs/evidence/sbom.cdx.json",
        layer0Sbom: "docs/evidence/sbom.l0.cdx.json",
        provenance: "docs/evidence/provenance.intoto.jsonl",
      },
    },
    null,
    2,
  ),
);

if (!result.valid) {
  console.error("[FAIL] EosSlsaProvenanceSbom.verifySupplyChain");
  process.exit(1);
}

console.log("[PASS] Supply chain verify (SBOM gate + Layer-0 SLSA) exit 0");
process.exit(0);
