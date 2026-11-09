#!/usr/bin/env node
/**
 * CLI surface for SPEC-185 Big Tech Product Factory (product:deliver).
 * Defaults to dry-run. Pass --write to materialize under docs/products/.
 */

import {
  buildDemoLedgerManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";

console.log("[GLORIAN PRODUCT FACTORY] Big Tech E2E seal — IAM → deliver → scorecard...\n");

const args = process.argv.slice(2);
const write = args.includes("--write");
const nameArg = args.find((a) => !String(a).startsWith("--"));
const base = buildDemoLedgerManifest();
const liveManifest = nameArg
  ? {
      ...base,
      name: String(nameArg),
      id: String(nameArg)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    }
  : base;

const projectRoot = process.cwd();
// Shipped example grants are used only on explicit dogfood opt-in; otherwise the
// local .eos/iam-policies.json is authoritative (missing/empty/invalid => deny).
const dogfoodPolicy = args.includes("--dogfood-iam-policy") || process.env.EOS_PRODUCT_DOGFOOD_IAM === "1";
const result = runBigTechProductFactory(liveManifest, {
  projectRoot,
  dryRun: !write,
  ...(dogfoodPolicy ? { policies: loadDefaultIamPolicyPack(projectRoot) } : {}),
});
const receiptPath = writeBigTechFactoryReceipt(projectRoot, result);

console.log(`  Status           : ${result.status}`);
console.log(`  Reason           : ${result.reason || "—"}`);
console.log(`  Dry-run          : ${result.dryRun ? "YES (default)" : "NO — materializing"}`);
console.log(`  IAM              : ${result.iam.decision?.code || "NOT_REQUIRED"}`);
console.log(
  `  Scorecard        : ${result.delivery?.scorecard?.score ?? "n/a"} (${result.delivery?.scorecard?.grade ?? "—"})`,
);
console.log(`  Track            : ${result.delivery?.track || "—"}`);
console.log(`  Epistemic        : ${result.epistemicState}`);
console.log(`  Receipt          : ${receiptPath}`);
console.log(`  SHA-256          : ${result.sha256Receipt}`);

if (result.status === "FAILED" || (result.status === "BLOCKED" && result.reason === "IAM_DENIED")) {
  process.exitCode = 1;
}
