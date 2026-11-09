#!/usr/bin/env node
/**
 * Big Tech ops seal (compose existing SPECs — no new OpenSpec id):
 * ACA canary + IAM break-glass/SIEM export + post-deploy scorecard + incident gate.
 * WITHIN_TESTED_SCOPE.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHealthyAcaDogfoodInput,
  runBigTechAcaCanaryGate,
  writeAcaCanaryEvidence,
} from "../src/core/eosBigTechAcaCanaryGate.ts";
import {
  appendIamAuditEntry,
  exportIamAuditLedgerForSiem,
  verifyIamAuditLedger,
} from "../src/core/eosIamAuditLedger.ts";
import { evaluateBreakGlassGrant, issueBreakGlassGrant } from "../src/core/eosIamBreakGlass.ts";
import {
  buildDemoLedgerManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const steps = [];

{
  const aca = runBigTechAcaCanaryGate(buildHealthyAcaDogfoodInput());
  const written = writeAcaCanaryEvidence(projectRoot, aca);
  steps.push({
    id: "ACA_CANARY",
    ok: aca.verdict === "PASS" && !aca.incidentRequired,
    verdict: aca.verdict,
    sha256Receipt: aca.sha256Receipt,
    evidence: path.relative(projectRoot, written.canaryPath).replaceAll("\\", "/"),
  });
}

{
  const now = Date.now();
  const grant = issueBreakGlassGrant({
    principal: { subjectId: "sre-oncall", tenantId: "tenant-local", roles: ["break-glass", "engineer"] },
    reason: "production-incident-mitigation",
    nowMs: now,
    ttlMs: 15 * 60_000,
  });
  const active = evaluateBreakGlassGrant(grant, now);
  const expired = evaluateBreakGlassGrant(grant, now + 16 * 60_000);
  steps.push({
    id: "IAM_BREAK_GLASS",
    ok: active.active === true && expired.active === false,
    grantId: grant.grantId,
    sha256Receipt: grant.sha256Receipt,
  });
}

{
  // Verify and export the operational MCP audit ledger at the project root.
  // Missing or empty ledger => entries 0 => step fails (no synthetic audit data).
  const verified = verifyIamAuditLedger(projectRoot);
  const exported = exportIamAuditLedgerForSiem(
    projectRoot,
    path.join("docs", "evidence", "IAM_AUDIT_SIEM_EXPORT.ndjson"),
  );
  steps.push({
    id: "IAM_SIEM_EXPORT",
    ok: verified.ok && exported.ok && exported.entries >= 1,
    entries: exported.entries,
    sha256Receipt: exported.sha256Receipt,
  });
}

{
  const factory = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies: loadDefaultIamPolicyPack(projectRoot),
  });
  writeBigTechFactoryReceipt(projectRoot, factory);
  const scorecardPath = path.join(projectRoot, "docs", "evidence", "BIGTECH_POST_DEPLOY_SCORECARD.json");
  const scorecard = {
    epistemicState: "POST_DEPLOY_SCORECARD_WITHIN_TESTED_SCOPE",
    generatedAt: new Date().toISOString(),
    productId: factory.productId,
    factoryStatus: factory.status,
    score: factory.delivery?.scorecard?.score ?? null,
    grade: factory.delivery?.scorecard?.grade ?? null,
    deliveryReceipt: factory.delivery?.sha256Receipt ?? null,
    sha256Receipt: sha256(`POST_DEPLOY:${factory.sha256Receipt}:${factory.status}`),
  };
  fs.writeFileSync(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
  steps.push({
    id: "POST_DEPLOY_SCORECARD",
    ok: factory.status === "SUCCESS",
    score: scorecard.score,
    grade: scorecard.grade,
    sha256Receipt: scorecard.sha256Receipt,
  });
}

const allOk = steps.every((s) => s.ok);
const receipt = {
  epistemicState: allOk ? "BIGTECH_OPS_WAVE_WITHIN_TESTED_SCOPE" : "REMEDIATION_REQUIRED",
  generatedAt: new Date().toISOString(),
  composes: ["SPEC-042", "SPEC-066", "SPEC-100", "SPEC-156", "SPEC-184", "SPEC-185"],
  steps,
  metrics: { allOk, stepCount: steps.length },
  sha256Receipt: "",
};
receipt.sha256Receipt = sha256(JSON.stringify({ steps: receipt.steps, metrics: receipt.metrics }));

const outPath = path.join(projectRoot, "docs", "evidence", "BIGTECH_OPS_WAVE_RECEIPT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
console.log(`[BIGTECH-OPS] wrote ${path.relative(projectRoot, outPath)}`);
if (!allOk) process.exitCode = 1;
ss.exitCode = 1;
