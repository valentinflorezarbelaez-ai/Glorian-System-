#!/usr/bin/env node
/**
 * GLORIAN SYSTEM — VERCEL SERVERLESS FUNCTION BUDGET GATE (SPEC-269)
 *
 * Enforces host provider quotas (Vercel Hobby plan maximum 12 Serverless Functions).
 * Prevents "exceeded_serverless_functions_per_deployment" failures in production.
 *
 * Governed under SPEC-269 (BDD-1391..BDD-1395).
 * Zero external runtime dependencies (EOS Law V).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptsDir, "..");

export function listActiveServerlessFunctions(rootDir = defaultRoot) {
  const apiDir = path.join(rootDir, "api");
  if (!fs.existsSync(apiDir)) {
    return [];
  }

  const activeFiles = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      const relToApi = path.relative(apiDir, fullPath).replace(/\\/g, "/");

      // Skip files or directories with private prefix "_" (Vercel convention)
      const segments = relToApi.split("/");
      if (segments.some((seg) => seg.startsWith("_"))) {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        if (
          (entry.name.endsWith(".js") || entry.name.endsWith(".mjs") || entry.name.endsWith(".ts")) &&
          !entry.name.endsWith(".d.ts") &&
          !entry.name.includes(".test.")
        ) {
          activeFiles.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
        }
      }
    }
  }

  scan(apiDir);
  activeFiles.sort();
  return activeFiles;
}

export function evaluateVercelFunctionBudget(rootDir = defaultRoot, options = {}) {
  const budgetPath = path.join(rootDir, "docs", "quality", "vercel-function-budget.json");
  const budgetConfig =
    options.budgetConfig ||
    (fs.existsSync(budgetPath)
      ? JSON.parse(fs.readFileSync(budgetPath, "utf8"))
      : {
          plan: "hobby",
          hardLimit: 12,
          budget: 12,
        });

  const activeFunctions = options.activeFunctionsOverride || listActiveServerlessFunctions(rootDir);
  const activeCount = activeFunctions.length;
  const hardLimit = budgetConfig.hardLimit || 12;
  const budget = budgetConfig.budget || hardLimit;
  const headroom = budget - activeCount;

  const passed = activeCount <= budget && budget <= hardLimit;

  return {
    specId: "SPEC-269",
    plan: budgetConfig.plan || "hobby",
    hardLimit,
    budget,
    activeCount,
    headroom,
    passed,
    verdict: passed ? "PASS" : "FAIL_BUDGET_EXCEEDED",
    activeFunctions,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isJson = process.argv.includes("--json");
  const report = evaluateVercelFunctionBudget();

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("======================================================================");
    console.log(" ⚡ GLORIAN SYSTEM — VERCEL SERVERLESS FUNCTION BUDGET GATE (SPEC-269)");
    console.log("======================================================================");
    console.log(` Plan: ${report.plan.toUpperCase()} | Hard Limit: ${report.hardLimit} | Budget: ${report.budget}`);
    console.log(
      ` Active Serverless Functions: ${report.activeCount} / ${report.budget} (Headroom: ${report.headroom})`,
    );
    console.log("----------------------------------------------------------------------");
    report.activeFunctions.forEach((fn, idx) => {
      console.log(`  ${String(idx + 1).padStart(2, " ")}. /${fn}`);
    });
    console.log("----------------------------------------------------------------------");
    if (!report.passed) {
      console.error(`[FAIL] Active functions (${report.activeCount}) exceed allowed budget (${report.budget})!`);
      console.error(`[FAIL] Deployment would fail on Vercel with "exceeded_serverless_functions_per_deployment".`);
      process.exit(1);
    }
    console.log(`✅ [PASS] Function budget conforming (${report.activeCount}/${report.budget} serverless functions).`);
    console.log("======================================================================");
  }

  if (!report.passed) {
    process.exit(1);
  }
}
