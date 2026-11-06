#!/usr/bin/env node
/**
 * EOS CHANGELOG GENERATOR
 * Auto-generates CHANGELOG.md from IMPLEMENTATION_AUTHORIZATION.md.
 * Follows https://keepachangelog.com/en/1.1.0/ format.
 * Run: npm run changelog
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, "..");

const authContent = fs.readFileSync(path.join(root, "IMPLEMENTATION_AUTHORIZATION.md"), "utf8");
const pkg         = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Parse every "## Authorization Record:" block
const authRegex = /## Authorization Record: (AUTH-[\w-]+)\n([\s\S]*?)(?=\n## Authorization Record:|$)/g;
const records   = [];
let match;

while ((match = authRegex.exec(authContent)) !== null) {
  const id   = match[1];
  const body = match[2].trim();

  const versionMatch   = body.match(/Milestone\*\*:.*?v(\d+\.\d+\.\d+)/);
  const scopeMatch     = body.match(/\*\*Scope\*\*:\s*([^\n*]+)/);
  const dateMatch      = id.match(/AUTH-(\d{4}-\d{2}-\d{2})/);

  records.push({
    id,
    version: versionMatch?.[1] ?? "unknown",
    date:    dateMatch?.[1]    ?? "2026-10-26",
    scope:   scopeMatch?.[1]?.trim().slice(0, 200) ?? body.slice(0, 120),
  });
}

// Group by version, sort descending
const byVersion = new Map();
for (const r of records) {
  if (r.version === "unknown") continue;
  if (!byVersion.has(r.version)) byVersion.set(r.version, { date: r.date, entries: [] });
  byVersion.get(r.version).entries.push(r);
}

const sortedVersions = [...byVersion.keys()].sort((a, b) => {
  const [a1, a2, a3] = a.split(".").map(Number);
  const [b1, b2, b3] = b.split(".").map(Number);
  return b1 - a1 || b2 - a2 || b3 - a3;
});

const lines = [
  "# Changelog",
  "",
  "All notable changes to EOS System are documented here.",
  "Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).",
  "Auto-generated from `IMPLEMENTATION_AUTHORIZATION.md` — run `npm run changelog` to regenerate.",
  "",
  "## [Unreleased]",
  "",
];

for (const version of sortedVersions) {
  const { date, entries } = byVersion.get(version);
  lines.push(`## [${version}] — ${date}`, "", "### Added / Changed", "");
  for (const e of entries) {
    lines.push(`- **${e.id}**: ${e.scope}`);
  }
  lines.push("");
}

lines.push(
  "---",
  "",
  `*Generated ${new Date().toISOString()} from IMPLEMENTATION_AUTHORIZATION.md*`,
  `*Current version: ${pkg.version} | Total authorizations: ${records.length}*`,
  "",
);

const changelog = lines.join("\n");
fs.writeFileSync(path.join(root, "CHANGELOG.md"), changelog, "utf8");
console.log(`[CHANGELOG] Generated CHANGELOG.md — ${sortedVersions.length} versions, ${records.length} authorizations.`);
