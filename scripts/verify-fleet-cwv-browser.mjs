#!/usr/bin/env node
/**
 * Optional browser CWV probe via Lighthouse CLI when installed.
 * Fail-open to SKIPPED (exit 0) if lighthouse binary missing — static probe remains SSOT.
 * Writes JSON to a temp file (stdout pipe is brittle on Windows under spawnSync).
 * Epistemic: FLEET_CWV_BROWSER_WITHIN_TESTED_SCOPE · not lab certification.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8")
);

const which = spawnSync(process.platform === "win32" ? "where" : "which", ["lighthouse"], {
  encoding: "utf8"
});
if (which.status !== 0) {
  console.log(
    JSON.stringify(
      {
        epistemic: "FLEET_CWV_BROWSER_WITHIN_TESTED_SCOPE",
        status: "SKIPPED_NO_LIGHTHOUSE_CLI",
        note: "Install lighthouse globally to enable browser CWV; static probe remains mandatory via fleet:cwv-static"
      },
      null,
      2
    )
  );
  process.exit(0);
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => fs.existsSync(p));

const targets = registry.projects
  .filter((p) => p.productionUrl)
  .slice(0, 3)
  .map((p) => p.productionUrl.replace(/\/$/, "") + "/");

const results = [];
for (const url of targets) {
  const outPath = path.join(os.tmpdir(), `eos-cwv-${Date.now()}-${results.length}.json`);
  const env = { ...process.env };
  if (chromePath) env.CHROME_PATH = chromePath;
  const args = [
    url,
    "--only-categories=performance",
    "--quiet",
    "--chrome-flags=--headless --no-sandbox",
    "--output=json",
    `--output-path=${outPath}`
  ];
  const bin = process.platform === "win32" ? "lighthouse.cmd" : "lighthouse";
  const out = spawnSync(bin, args, {
    encoding: "utf8",
    env,
    shell: process.platform === "win32",
    timeout: 240_000,
    maxBuffer: 16 * 1024 * 1024
  });
  try {
    if (!fs.existsSync(outPath)) {
      results.push({
        url,
        status: "FAIL",
        error: ((out.error && out.error.message) || out.stderr || out.stdout || `exit=${out.status}`)
          .toString()
          .slice(0, 240)
      });
      continue;
    }
    const report = JSON.parse(fs.readFileSync(outPath, "utf8"));
    const score = report?.categories?.performance?.score;
    results.push({
      url,
      status: "OK",
      performanceScore: typeof score === "number" ? score : null,
      lighthouseVersion: report?.lighthouseVersion ?? null
    });
  } catch (e) {
    results.push({ url, status: "PARSE_FAIL", error: String(e).slice(0, 200) });
  } finally {
    try {
      fs.unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

const ok = results.filter((r) => r.status === "OK").length;
console.log(
  JSON.stringify(
    {
      epistemic: "FLEET_CWV_BROWSER_WITHIN_TESTED_SCOPE",
      status: "EXECUTED",
      chromePath: chromePath || null,
      probed: results.length,
      ok,
      results
    },
    null,
    2
  )
);
process.exit(0);
