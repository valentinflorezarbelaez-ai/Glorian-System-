#!/usr/bin/env node
/**
 * Big Tech ACA LIVE gate — fail-closed when a Vercel token is configured
 * but the seal fell back to fixture/snapshot without a live deploy probe.
 * Writes GitHub Actions job summary annotations. Zero deps. WITHIN_TESTED_SCOPE.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = path.join(projectRoot, "docs", "evidence", "VERCEL_ACA_LIVE_RECEIPT.json");
const summaryPath = process.env.GITHUB_STEP_SUMMARY || "";

const tokenPresent = Boolean(process.env.VERCEL_TOKEN?.trim());
const requireLive = process.env.EOS_ACA_REQUIRE_LIVE === "1" || tokenPresent;

function readReceipt() {
  if (!fs.existsSync(receiptPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  } catch {
    return null;
  }
}

function appendSummary(md) {
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${md}\n`, "utf8");
}

const receipt = readReceipt();
const mode = receipt?.mode || "MISSING";
const verdict = receipt?.verdict || "UNKNOWN";
const liveModes = new Set(["LIVE_DEPLOYMENT_PROBE", "LIVE_CAPTURED_SNAPSHOT"]);
const isLive = liveModes.has(mode);

const lines = [
  "## ACA LIVE gate",
  "",
  `| Field | Value |`,
  `| --- | --- |`,
  `| mode | \`${mode}\` |`,
  `| verdict | \`${verdict}\` |`,
  `| tokenPresent | \`${tokenPresent}\` |`,
  `| requireLive | \`${requireLive}\` |`,
  `| receipt | \`docs/evidence/VERCEL_ACA_LIVE_RECEIPT.json\` |`,
  "",
];

if (!receipt) {
  lines.push("**FAIL**: ACA receipt missing after seal.");
  appendSummary(lines.join("\n"));
  console.error(JSON.stringify({ ok: false, reason: "RECEIPT_MISSING", requireLive, tokenPresent }));
  process.exit(1);
}

if (requireLive && !isLive) {
  lines.push(
    "**FAIL**: `VERCEL_TOKEN` (or `EOS_ACA_REQUIRE_LIVE=1`) is set but seal mode is not LIVE.",
    "",
    "Expected `LIVE_DEPLOYMENT_PROBE` (preferred) or `LIVE_CAPTURED_SNAPSHOT`.",
  );
  appendSummary(lines.join("\n"));
  console.error(
    JSON.stringify({
      ok: false,
      reason: "LIVE_REQUIRED_BUT_FIXTURE",
      mode,
      verdict,
      tokenPresent,
    }),
  );
  process.exit(1);
}

if (receipt.incidentRequired || verdict === "FAIL") {
  lines.push("**FAIL**: ACA verdict requires incident / remediation.");
  appendSummary(lines.join("\n"));
  console.error(JSON.stringify({ ok: false, reason: "ACA_FAIL", mode, verdict }));
  process.exit(1);
}

lines.push(
  isLive
    ? "**PASS**: LIVE path within tested scope."
    : "**PASS**: Fixture path allowed (no token / live not required).",
);
appendSummary(lines.join("\n"));
console.log(JSON.stringify({ ok: true, mode, verdict, tokenPresent, requireLive, isLive }, null, 2));
