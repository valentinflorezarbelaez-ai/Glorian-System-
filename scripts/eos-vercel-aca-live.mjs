#!/usr/bin/env node
/**
 * Live-or-fixture Vercel → ACA seal (SPEC-107).
 * Prefer EOS_VERCEL_RUNTIME_SNAPSHOT_JSON if set; else committed fixture.
 * Never embeds secrets. WITHIN_TESTED_SCOPE.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAcaGateFromVercelSignals,
  writeAcaCanaryEvidence,
} from "../src/core/eosBigTechAcaCanaryGate.ts";
import {
  loadVercelRuntimeSignalFixture,
  mapVercelRuntimeSnapshotToSignals,
} from "../src/core/eosVercelRuntimeSignalAdapter.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

let mapped;
let mode = "FIXTURE";
const liveRaw = process.env.EOS_VERCEL_RUNTIME_SNAPSHOT_JSON?.trim();
if (liveRaw) {
  const snap = JSON.parse(liveRaw);
  mapped = mapVercelRuntimeSnapshotToSignals(snap, "LIVE_SNAPSHOT");
  mode = "LIVE_SNAPSHOT";
} else {
  mapped = loadVercelRuntimeSignalFixture(projectRoot);
}

const aca = runAcaGateFromVercelSignals({
  versionTarget: process.env.EOS_CANARY_VERSION || "v75.2.0",
  previousStableVersion: process.env.EOS_CANARY_PREVIOUS || "v75.1.0",
  signals: mapped.signals,
});
const written = writeAcaCanaryEvidence(projectRoot, aca);

const receipt = {
  epistemicState: aca.incidentRequired
    ? "REMEDIATION_REQUIRED"
    : "VERCEL_ACA_LIVE_OR_FIXTURE_WITHIN_TESTED_SCOPE",
  generatedAt: new Date().toISOString(),
  mode,
  signalCount: mapped.signals.length,
  totalErrorEvents: mapped.totalErrorEvents,
  verdict: aca.verdict,
  incidentRequired: aca.incidentRequired,
  canaryReceipt: aca.sha256Receipt,
  evidence: path.relative(projectRoot, written.canaryPath).replaceAll("\\", "/"),
  sha256Receipt: "",
};
receipt.sha256Receipt = sha256(JSON.stringify({ mode, verdict: aca.verdict, canary: aca.sha256Receipt }));

const outPath = path.join(projectRoot, "docs", "evidence", "VERCEL_ACA_LIVE_RECEIPT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
if (aca.incidentRequired || aca.verdict === "FAIL") process.exitCode = 1;
