#!/usr/bin/env node
/**
 * Honest incident pipeline drill (Netflix SRE / Google SEV hygiene).
 *
 * 1) Injects a bounded chaos evaluation signal (no production mutation).
 * 2) Classifies SEV via EosIncidentSeverityClassifier.
 * 3) Appends docs/evidence/INCIDENT_LEDGER.jsonl (hash-chained).
 * 4) Writes a drill postmortem stub under docs/postmortems/ when SEV ≤ P2.
 *
 * Epistemic: INCIDENT_DRILL_WITHIN_TESTED_SCOPE — does not invent fake outages
 * as production truth. DORA MTTR becomes meaningful only when this ledger grows.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosIncidentSeverityClassifier } from "../src/core/eosIncidentSeverityClassifier.ts";
import { EosProductionChaosMonkey } from "../src/core/eosProductionChaosMonkey.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(root, "docs/evidence/INCIDENT_LEDGER.jsonl");
const postmortemDir = path.join(root, "docs/postmortems");

const mode = process.argv.includes("--nominal") ? "nominal" : "chaos-drill";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readLastHash() {
  if (!fs.existsSync(ledgerPath)) return "GENESIS";
  const lines = fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return "GENESIS";
  try {
    return JSON.parse(lines[lines.length - 1]).entrySha256 || "GENESIS";
  } catch {
    return "GENESIS";
  }
}

const classifier = new EosIncidentSeverityClassifier();
let signal;
let chaosReceipt = null;

if (mode === "nominal") {
  signal = {
    burnRateMultiplier: 0,
    blastRadiusPercent: 0,
    durationMinutes: 0,
    dataLoss: false,
    customerFacing: false,
    errorBudgetRemaining: 100,
  };
} else {
  // Hermetic mock transport — never mutates production; proves chaos→SEV wiring.
  chaosReceipt = EosProductionChaosMonkey.executeExperimentSync("https://glorian-system.vercel.app/", {
    burstCount: 5,
    mockTransport: (i) => ({ status: i === 2 ? 503 : 200, latencyMs: 40 + i * 7 }),
  });
  // Synthetic degraded signal representing a detected drill — not a claim of live outage.
  signal = {
    burnRateMultiplier: 2.5,
    blastRadiusPercent: 8,
    durationMinutes: 12,
    dataLoss: false,
    customerFacing: true,
    errorBudgetRemaining: 70,
  };
}

const classification = classifier.classify(signal);
const now = new Date().toISOString();
const incidentId = `INC-DRILL-${now.slice(0, 10).replace(/-/g, "")}-${sha256(now).slice(0, 8)}`;
const prevHash = readLastHash();
const entry = {
  incidentId,
  recordedAt: now,
  mode,
  epistemicState: "INCIDENT_DRILL_WITHIN_TESTED_SCOPE",
  claimsDenied: ["live production outage", "FEDERAL_ATO", "Level-5"],
  signal,
  classification,
  chaosReceipt,
  prevHash,
};
entry.entrySha256 = sha256(JSON.stringify({ ...entry, entrySha256: undefined }));

fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
fs.appendFileSync(ledgerPath, JSON.stringify(entry) + "\n", "utf8");

let postmortemPath = null;
if (classification.severity === "P0" || classification.severity === "P1" || classification.severity === "P2") {
  fs.mkdirSync(postmortemDir, { recursive: true });
  postmortemPath = path.join(postmortemDir, `${incidentId}.md`);
  const body = `# Postmortem drill — ${incidentId}

**Epistemic**: INCIDENT_DRILL_WITHIN_TESTED_SCOPE · not a claim of live customer outage  
**Severity**: ${classification.severity}  
**Actions**: ${classification.actions.join(", ")}  
**Auto-revert**: ${classification.autoRevert}  
**War room**: ${classification.warRoomRequired}  
**Postmortem required**: ${classification.postMortemRequired}

## Summary

Bounded chaos/SEV drill executed by \`scripts/incident-honesty-pipeline.mjs\` so DORA MTTR and CFR stop reading as "zero incidents forever".

## Signal

\`\`\`json
${JSON.stringify(signal, null, 2)}
\`\`\`

## Classification rationale

${classification.rationale}

## Follow-ups

1. Confirm on-call page path in \`docs/runbooks/INCIDENT_ONE_PAGER.md\`.
2. Re-run \`npm run dora:track\` after real incidents are filed here.
3. External IV&V must treat drill receipts as drills, not production SEVs.
`;
  fs.writeFileSync(postmortemPath, body, "utf8");
}

const summary = {
  incidentId,
  severity: classification.severity,
  mode,
  ledger: "docs/evidence/INCIDENT_LEDGER.jsonl",
  postmortem: postmortemPath ? path.relative(root, postmortemPath).replace(/\\/g, "/") : null,
  entrySha256: entry.entrySha256,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
