#!/usr/bin/env node
/**
 * Optional browser CWV probe via Lighthouse CLI when installed.
 * Fail-open to SKIPPED (exit 0) if lighthouse binary missing — static probe remains SSOT.
 * Epistemic: FLEET_CWV_BROWSER_WITHIN_TESTED_SCOPE · not lab certification.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

const targets = registry.projects
  .filter((p) => p.productionUrl)
  .slice(0, 3)
  .map((p) => p.productionUrl.replace(/\/$/, "") + "/");

const results = [];
for (const url of targets) {
  const out = spawnSync(
    "lighthouse",
    [url, "--only-categories=performance", "--quiet", "--chrome-flags=--headless", "--output=json", "--output-path=stdout"],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 120_000 }
  );
  if (out.status !== 0) {
    results.push({ url, status: "FAIL", error: (out.stderr || out.stdout || "").slice(0, 200) });
    continue;
  }
  try {
    const report = JSON.parse(out.stdout);
    const score = report?.categories?.performance?.score;
    results.push({
      url,
      status: "OK",
      performanceScore: typeof score === "number" ? score : null
    });
  } catch (e) {
    results.push({ url, status: "PARSE_FAIL", error: String(e) });
  }
}

console.log(
  JSON.stringify(
    {
      epistemic: "FLEET_CWV_BROWSER_WITHIN_TESTED_SCOPE",
      status: "EXECUTED",
      probed: results.length,
      results
    },
    null,
    2
  )
);
process.exit(0);
