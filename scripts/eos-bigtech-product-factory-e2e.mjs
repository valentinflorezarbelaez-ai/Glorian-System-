#!/usr/bin/env node
/**
 * Big Tech Product Factory E2E dogfood (SPEC-185).
 * Hermetic dry-run: authorize → deliver → scorecard → receipt.
 * WITHIN_TESTED_SCOPE — not production deployment accreditation.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDemoLedgerManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
  isLeastPrivilegeProductPolicyPack,
} from "../src/core/eosBigTechProductFactory.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policies = loadDefaultIamPolicyPack(projectRoot);

if (!isLeastPrivilegeProductPolicyPack(policies)) {
  console.error("[FAIL] Default IAM pack is missing or grants overly broad mcp/tools/ prefix.");
  process.exit(1);
}

const result = runBigTechProductFactory(buildDemoLedgerManifest(), {
  projectRoot,
  dryRun: true,
  policies,
});

const out = writeBigTechFactoryReceipt(projectRoot, result);
const ok = result.status === "SUCCESS" || (result.status === "BLOCKED" && result.reason === "SCORECARD_FLOOR");

console.log(
  JSON.stringify(
    {
      ok,
      status: result.status,
      reason: result.reason,
      scorecardScore: result.delivery?.scorecard?.score ?? null,
      receipt: out,
      sha256Receipt: result.sha256Receipt,
      durationMs: result.durationMs,
      epistemicState: result.epistemicState,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
