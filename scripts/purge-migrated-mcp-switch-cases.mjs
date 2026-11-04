/**
 * SPEC-155 T7 — Delete dead god-file switch arms already served by Phase-1/2 registry.
 * Big-Tech service-boundary hygiene: one dispatch path, no unreachable duplicates.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE1_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpCoreUtilitarianHandlers.ts";
import { PHASE2_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpPhase2UtilitarianHandlers.ts";
import { PHASE3_MIGRATED_TOOL_NAMES } from "../src/mcp/tools/eosMcpPhase3CoreHandlers.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src/mcp/eosMcpServer.ts");
const migrated = new Set([
  ...PHASE1_MIGRATED_TOOL_NAMES,
  ...PHASE2_MIGRATED_TOOL_NAMES,
  ...PHASE3_MIGRATED_TOOL_NAMES
]);

const before = fs.readFileSync(target, "utf8");
const beforeLines = before.split(/\r?\n/).length;

// Match each `case "eos_...": { ... }` arm with brace depth tracking.
const caseRe = /case\s+"([^"]+)":\s*\{/g;
let match;
const ranges = [];
while ((match = caseRe.exec(before)) !== null) {
  const toolName = match[1];
  if (!migrated.has(toolName)) continue;
  const start = match.index;
  let i = match.index + match[0].length;
  let depth = 1;
  while (i < before.length && depth > 0) {
    const ch = before[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  // Include trailing whitespace / newlines after the arm.
  while (i < before.length && /[ \t\r\n]/.test(before[i])) i++;
  ranges.push([start, i, toolName]);
}

ranges.sort((a, b) => b[0] - a[0]);
let after = before;
const removed = [];
for (const [start, end, name] of ranges) {
  after = after.slice(0, start) + after.slice(end);
  removed.push(name);
}

const marker = "    // SPEC-155 T7: Phase-1/2 utilitarian tools dispatch via registry only (dead switch arms purged).\n";
if (!after.includes("dead switch arms purged")) {
  // Insert near dispatch registry preference comment if present.
  after = after.replace(
    /\/\/ SPEC-155: prefer modular utilitarian facades before the legacy god-file switch\./,
    `$&\n${marker.trimEnd()}`
  );
}

fs.writeFileSync(target, after);
const afterLines = after.split(/\r?\n/).length;
const locDelta = beforeLines - afterLines;
const pct = ((locDelta / beforeLines) * 100).toFixed(2);

console.log(
  JSON.stringify(
    {
      removedCount: removed.length,
      removed: removed.sort(),
      beforeLines,
      afterLines,
      linesRemoved: locDelta,
      percentReductionOfGodFile: Number(pct),
      targetPercent: 25,
      meetsT7LocGoalOnGodFile: locDelta / beforeLines >= 0.25
    },
    null,
    2
  )
);
