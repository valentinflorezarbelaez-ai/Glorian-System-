#!/usr/bin/env node

/**
 * EOS System — Fleet Dogfooding & Cross-Repository SARIF Attestation Script (SPEC-100)
 *
 * Posture honesty (PR-G / P1-2):
 * - CONTROL_PLANE_ONLY when any EOS_FLEET_*_PATH is unset (default cloud / CI)
 * - FLEET_VERIFIED only when paths are mounted and this audit completes green
 * Never advertise live Soundcheck success under CONTROL_PLANE_ONLY.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosFleetDogfoodingEngine } from "../src/core/eosFleetDogfoodingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("=== EOS Autonomous Fleet Dogfooding Auditor (SPEC-100) ===");

const auditor = new EosFleetDogfoodingEngine(projectRoot);
const summary = auditor.auditEntireFleet();

console.log(`[FLEET AUDIT] Total registered projects audited: ${summary.totalProjects}`);
console.log(`[FLEET AVERAGE SCORE] ${summary.averageHealthScore}/100`);
console.log(`[FLEET POSTURE] ${summary.posture} (fleetLiveAudit=${summary.fleetLiveAudit})`);
console.log(`[EPISTEMIC] ${summary.epistemicState}`);

for (const p of summary.auditedProjects) {
  console.log(`  - [${p.projectId}] ${p.projectName}: Score ${p.healthScore}/100 (${p.epistemicState})`);
}

const evidenceDir = path.join(projectRoot, "docs", "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const postureReceipt = {
  epistemicState: summary.epistemicState,
  generatedAtIso: summary.generatedAtIso,
  specRef: "SPEC-100",
  remediationRef: "P1-2/PR-G",
  ...summary.postureReceipt,
  averageHealthScore: summary.averageHealthScore,
  totalProjects: summary.totalProjects,
  sarifPath: path.relative(projectRoot, summary.sarifPath).replace(/\\/g, "/"),
  sha256Seal: summary.sha256Seal,
};
postureReceipt.sha256Receipt = crypto
  .createHash("sha256")
  .update(
    JSON.stringify({
      posture: postureReceipt.posture,
      fleetLiveAudit: postureReceipt.fleetLiveAudit,
      envPathsUnset: postureReceipt.envPathsUnset,
      siblingsAvailable: postureReceipt.siblingsAvailable,
      siblingsSkipped: postureReceipt.siblingsSkipped,
      sha256Seal: postureReceipt.sha256Seal,
    }),
  )
  .digest("hex");

const posturePath = path.join(evidenceDir, "FLEET_POSTURE_RECEIPT.json");
fs.writeFileSync(posturePath, `${JSON.stringify(postureReceipt, null, 2)}\n`, "utf8");

console.log(`[SARIF EXPORT] ${summary.sarifPath}`);
console.log(`[POSTURE RECEIPT] ${posturePath}`);
console.log(`[SHA-256 SEAL] ${summary.sha256Seal}`);

if (summary.posture === "FLEET_VERIFIED" && summary.fleetLiveAudit) {
  console.log(`[PASS] Fleet live attestation FLEET_VERIFIED — Soundcheck dogfood eligible.`);
} else {
  console.log(
    `[PASS] CONTROL_PLANE_ONLY receipt emitted — registry Law IV checked; live Soundcheck success NOT claimed.`,
  );
  console.log(`[POSTURE REASON] ${summary.postureSnapshot.reason}`);
}

// Optional fail-closed for dogfood hosts that require mounted siblings.
const strict = process.env.EOS_FLEET_POSTURE_STRICT === "1" || process.env.EOS_FLEET_POSTURE_STRICT === "true";
if (strict && summary.posture !== "FLEET_VERIFIED") {
  console.error(`[FAIL] EOS_FLEET_POSTURE_STRICT=1 requires FLEET_VERIFIED; current posture=${summary.posture}`);
  process.exit(1);
}
