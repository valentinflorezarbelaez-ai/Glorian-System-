#!/usr/bin/env node
/**
 * Generate fleet product scorecards from registry governance (Big Tech EngProd).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFleetProductScorecards } from "../src/core/eosFleetProductScorecard.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"),
);
const result = writeFleetProductScorecards(projectRoot, registry.projects || []);

const receipt = {
  epistemicState: "FLEET_PRODUCT_SCORECARDS_WITHIN_TESTED_SCOPE",
  generatedAt: new Date().toISOString(),
  written: result.written,
  count: result.scorecards.length,
  grades: Object.fromEntries(result.scorecards.map((s) => [s.productId, { score: s.score, grade: s.grade }])),
  sha256Receipt: crypto
    .createHash("sha256")
    .update(JSON.stringify(result.scorecards.map((s) => s.sha256Receipt)))
    .digest("hex"),
};

const out = path.join(projectRoot, "docs", "evidence", "FLEET_PRODUCT_SCORECARDS_RECEIPT.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
if (result.scorecards.length < 1) process.exitCode = 1;
