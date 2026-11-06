#!/usr/bin/env node
/** Hermetic Fleet RAG Golden Path demo — WITHIN_TESTED_SCOPE */
import { runFleetRagGoldenPath } from "../src/core/eosFleetRagGoldenPath.ts";

const query = process.argv.slice(2).join(" ") || "Golden Paths Backstage Soundcheck authorization creators";
const result = runFleetRagGoldenPath(query, { topK: 3 });
console.log(JSON.stringify(result, null, 2));
process.exit(result.status === "SUCCESS" ? 0 : 1);
