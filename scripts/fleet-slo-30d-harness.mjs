#!/usr/bin/env node
/**
 * Absolute-Max W4 — 30-day continuous fleet SLO harness (synthetic edge probes).
 *
 * Appends one daily sample to docs/evidence/FLEET_SLO_30D_LEDGER.jsonl and seals a
 * rolling receipt. Epistemic: SYNTHETIC_EDGE_SLO_CONTINUOUS_WITHIN_TESTED_SCOPE.
 * Not CrUX, not multi-region SRE, not FEDERAL_ATO.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(root, "docs/evidence/FLEET_SLO_30D_LEDGER.jsonl");
const receiptPath = path.join(root, "docs/evidence/FLEET_SLO_30D_RECEIPT.json");
const WINDOW_DAYS = 30;

function runProductionSloProbe() {
  return spawnSync(process.execPath, [path.join(root, "scripts/fleet-production-slo.mjs")], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
  });
}

// One bounded retry absorbs transient edge flakes without inventing calendar days.
let probe = runProductionSloProbe();
let retries = 0;
if ((probe.status ?? 1) !== 0) {
  retries = 1;
  probe = runProductionSloProbe();
}

const sloReceiptPath = path.join(root, "docs/evidence/FLEET_PRODUCTION_SLO_RECEIPT.json");
const sample = {
  capturedAt: new Date().toISOString(),
  exitCode: probe.status ?? 1,
  retries,
  sloReceiptPresent: fs.existsSync(sloReceiptPath),
  metrics: null,
};
if (sample.sloReceiptPresent) {
  try {
    const slo = JSON.parse(fs.readFileSync(sloReceiptPath, "utf8"));
    sample.metrics = slo.metrics || slo.summary || null;
  } catch {
    sample.metrics = null;
  }
}

fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
fs.appendFileSync(ledgerPath, JSON.stringify(sample) + "\n", "utf8");

const lines = fs
  .readFileSync(ledgerPath, "utf8")
  .split(/\n/)
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
const windowSamples = lines.filter((row) => Date.parse(row.capturedAt || 0) >= cutoff);
const okSamples = windowSamples.filter((row) => row.exitCode === 0);

const receipt = {
  epistemicState: "SYNTHETIC_EDGE_SLO_CONTINUOUS_WITHIN_TESTED_SCOPE",
  claimsDenied: ["CrUX field data", "multi-region SRE", "FEDERAL_ATO", "Level-5"],
  windowDays: WINDOW_DAYS,
  measuredAt: new Date().toISOString(),
  sampleCountInWindow: windowSamples.length,
  okSampleCount: okSamples.length,
  coverageRatio: windowSamples.length === 0 ? 0 : okSamples.length / windowSamples.length,
  readyForAtoExitCriteria: windowSamples.length >= WINDOW_DAYS && okSamples.length === windowSamples.length,
  ledgerPath: "docs/evidence/FLEET_SLO_30D_LEDGER.jsonl",
};
receipt.sha256 = crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ receipt: "docs/evidence/FLEET_SLO_30D_RECEIPT.json", ...receipt }, null, 2));
process.exit(probe.status === 0 ? 0 : 1);
