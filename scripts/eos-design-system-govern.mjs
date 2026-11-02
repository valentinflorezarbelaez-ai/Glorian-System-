#!/usr/bin/env node
/**
 * SPEC-128: Tier S-0 Design Engineering Matrix CLI & Linter
 *
 * Audits stylesheets and markup against constitutional DESIGN.md specifications.
 */

import path from "node:path";
import { EosS0DesignSystemGovernor } from "../src/core/eosS0DesignSystemGovernor.ts";

const args = process.argv.slice(2);
const isJson = args.includes("--json");
const targetDir = args.find((a) => !a.startsWith("-")) || path.resolve(".");

const governor = new EosS0DesignSystemGovernor(path.resolve("."));
const report = governor.auditDirectory(targetDir);

if (isJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "CONFORMING" ? 0 : 1);
}

console.log("======================================================================");
console.log(" 🎨 EOS SYSTEM — TIER S-0 DESIGN SYSTEM GOVERNOR (SPEC-128)           ");
console.log("======================================================================");
console.log(` Target Directory: ${targetDir}`);
console.log(` Contract Valid  : ${report.contractVerified ? "YES (DESIGN.md)" : "NO"}`);
console.log(` Files Audited   : ${report.totalFilesAudited}`);
console.log(` Perfection Index: ${report.perfectionIndex}% | Status: [${report.status}]`);
console.log(` Violations      : ${report.blockingViolationsCount} blocking, ${report.warningsCount} warnings`);
console.log("----------------------------------------------------------------------");

if (report.findings.length > 0) {
  for (const f of report.findings.slice(0, 10)) {
    const icon = f.severity === "BLOCKING" ? "❌" : "⚠️";
    console.log(`${icon} [${f.rule}] ${f.file || "unknown"}:${f.line || 0}`);
    console.log(`   ↳ ${f.description}`);
    if (f.matchedSnippet) console.log(`   ↳ Snippet: ${f.matchedSnippet}`);
  }
  if (report.findings.length > 10) {
    console.log(`... and ${report.findings.length - 10} more findings.`);
  }
} else {
  console.log("✅ 100% CONFORMING: No design system violations detected.");
}

console.log("======================================================================");
process.exit(report.status === "CONFORMING" ? 0 : 1);
