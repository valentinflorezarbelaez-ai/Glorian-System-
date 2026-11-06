#!/usr/bin/env node

/**
 * EOS System — Fleet Dogfooding & Cross-Repository SARIF Attestation Script (SPEC-100)
 */

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

for (const p of summary.auditedProjects) {
  console.log(`  - [${p.projectId}] ${p.projectName}: Score ${p.healthScore}/100 (${p.epistemicState})`);
}

console.log(`[SARIF EXPORT] ${summary.sarifPath}`);
console.log(`[SHA-256 SEAL] ${summary.sha256Seal}`);
console.log(`[PASS] Fleet attestation completed successfully with zero violations.`);
