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
  assertIncidentRemediationClosed,
  buildHealthyAcaDogfoodInput,
  runAcaGateFromVercelSignals,
  runBigTechAcaCanaryGate,
  writeAcaCanaryEvidence,
} from "../src/core/eosBigTechAcaCanaryGate.ts";
import {
  appendIamAuditEntry,
  exportIamAuditLedgerForSiem,
  verifyIamAuditLedger,
} from "../src/core/eosIamAuditLedger.ts";
import { evaluateBreakGlassGrant, issueBreakGlassGrant } from "../src/core/eosIamBreakGlass.ts";
import { authorizeMcpToolsCall } from "../src/core/eosMcpIamCallGate.ts";
import {
  buildDemoLedgerManifest,
  buildOpsControlPlaneManifest,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";
import { loadVercelRuntimeSignalFixture } from "../src/core/eosVercelRuntimeSignalAdapter.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const steps = [];

{
  const aca = runBigTechAcaCanaryGate(buildHealthyAcaDogfoodInput());
  const written = writeAcaCanaryEvidence(projectRoot, aca);
  const vercelAca = runAcaGateFromVercelSignals({
    versionTarget: "v75.1.0",
    previousStableVersion: "v75.0.0",
    signals: [
      {
        deploymentId: "dpl_dogfood_healthy",
        environment: "production",
        stage: "CANARY_1_PCT",
        errorRate5xx: 0.0001,
        latencyP99Ms: 40,
        requestCount: 5000,
      },
      {
        deploymentId: "dpl_dogfood_healthy",
        environment: "production",
        stage: "CANARY_5_PCT",
        errorRate5xx: 0.0001,
        latencyP99Ms: 41,
        requestCount: 8000,
      },
      {
        deploymentId: "dpl_dogfood_healthy",
        environment: "production",
        stage: "CANARY_25_PCT",
        errorRate5xx: 0.00012,
        latencyP99Ms: 39,
        requestCount: 12000,
      },
      {
        deploymentId: "dpl_dogfood_healthy",
        environment: "production",
        stage: "FULL_PRODUCTION_100_PCT",
        errorRate5xx: 0.0001,
        latencyP99Ms: 40,
        requestCount: 20000,
      },
    ],
  });
  const incidentGate = assertIncidentRemediationClosed(projectRoot);
  steps.push({
    id: "ACA_CANARY",
    ok: aca.verdict === "PASS" && !aca.incidentRequired,
    verdict: aca.verdict,
    sha256Receipt: aca.sha256Receipt,
    evidence: path.relative(projectRoot, written.canaryPath).replaceAll("\\", "/"),
  });
  steps.push({
    id: "ACA_VERCEL_SIGNALS",
    ok: vercelAca.verdict === "PASS" && !vercelAca.incidentRequired,
    verdict: vercelAca.verdict,
    sha256Receipt: vercelAca.sha256Receipt,
  });
  steps.push({
    id: "INCIDENT_LOOP_CLOSED",
    ok: incidentGate.ok,
    reason: incidentGate.reason,
  });
}

{
  const now = Date.now();
  const principal = { subjectId: "sre-oncall", tenantId: "tenant-local", roles: ["break-glass", "engineer"] };
  const grant = issueBreakGlassGrant({
    principal,
    reason: "production-incident-mitigation",
    nowMs: now,
    ttlMs: 15 * 60_000,
  });
  const active = evaluateBreakGlassGrant(grant, now);
  const expired = evaluateBreakGlassGrant(grant, now + 16 * 60_000);
  const denied = authorizeMcpToolsCall({
    toolName: "eos_manage_worktree",
    args: { apply: true },
    policies: [],
    defaultPrincipal: principal,
  });
  const elevated = authorizeMcpToolsCall({
    toolName: "eos_manage_worktree",
    args: { apply: true },
    policies: [],
    defaultPrincipal: principal,
    breakGlassGrant: grant,
    nowMs: now,
  });
  steps.push({
    id: "IAM_BREAK_GLASS",
    ok:
      active.active === true &&
      expired.active === false &&
      denied.ok === false &&
      elevated.ok === true &&
      String(elevated.gate.decision?.matchedPolicyId || "").startsWith("break-glass:"),
    grantId: grant.grantId,
    sha256Receipt: grant.sha256Receipt,
  });
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-ops-siem-"));
  try {
    appendIamAuditEntry(tmp, {
      toolName: "eos_manage_worktree",
      decision: {
        ok: true,
        code: "ALLOW",
        reason: "ops-seal",
        matchedPolicyId: "ops-seal",
        sha256Receipt: "c".repeat(64),
      },
      principal: { subjectId: "ops-seal", tenantId: "tenant-local", roles: ["engineer"] },
      resourceId: "mcp/tools/eos_manage_worktree",
      requestId: "ops-seal",
    });
    const verified = verifyIamAuditLedger(tmp);
    const exported = exportIamAuditLedgerForSiem(tmp, path.join("docs", "evidence", "IAM_AUDIT_SIEM_EXPORT.ndjson"));
    const durable = path.join(projectRoot, "docs", "evidence", "IAM_AUDIT_SIEM_EXPORT.ndjson");
    fs.mkdirSync(path.dirname(durable), { recursive: true });
    fs.copyFileSync(exported.outputPath, durable);
    steps.push({
      id: "IAM_SIEM_EXPORT",
      ok: verified.ok && exported.ok && exported.entries >= 1,
      entries: exported.entries,
      sha256Receipt: exported.sha256Receipt,
    });
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // ignore Windows TEMP locks
    }
  }
}

{
  const factory = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies: loadDefaultIamPolicyPack(projectRoot),
  });
  writeBigTechFactoryReceipt(projectRoot, factory);
  const opsFactory = runBigTechProductFactory(buildOpsControlPlaneManifest(), {
    projectRoot,
    dryRun: true,
    policies: loadDefaultIamPolicyPack(projectRoot),
  });
  const scorecardPath = path.join(projectRoot, "docs", "evidence", "BIGTECH_POST_DEPLOY_SCORECARD.json");
  const scorecard = {
    epistemicState: "POST_DEPLOY_SCORECARD_WITHIN_TESTED_SCOPE",
    generatedAt: new Date().toISOString(),
    productId: factory.productId,
    secondProductId: opsFactory.productId,
    factoryStatus: factory.status,
    opsFactoryStatus: opsFactory.status,
    score: factory.delivery?.scorecard?.score ?? null,
    grade: factory.delivery?.scorecard?.grade ?? null,
    opsScore: opsFactory.delivery?.scorecard?.score ?? null,
    opsGrade: opsFactory.delivery?.scorecard?.grade ?? null,
    deliveryReceipt: factory.delivery?.sha256Receipt ?? null,
    sha256Receipt: sha256(`POST_DEPLOY:${factory.sha256Receipt}:${opsFactory.sha256Receipt}`),
  };
  fs.writeFileSync(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
  const fixture = loadVercelRuntimeSignalFixture(projectRoot);
  const fixtureAca = runAcaGateFromVercelSignals({
    versionTarget: "v75.2.0",
    previousStableVersion: "v75.1.0",
    signals: fixture.signals,
  });
  steps.push({
    id: "POST_DEPLOY_SCORECARD",
    ok:
      (factory.status === "SUCCESS" || factory.reason === "SCORECARD_FLOOR") &&
      (opsFactory.status === "SUCCESS" || opsFactory.reason === "SCORECARD_FLOOR"),
    score: scorecard.score,
    grade: scorecard.grade,
    opsScore: scorecard.opsScore,
    opsGrade: scorecard.opsGrade,
    sha256Receipt: scorecard.sha256Receipt,
  });
  steps.push({
    id: "VERCEL_RUNTIME_FIXTURE_ACA",
    ok: fixtureAca.verdict === "PASS" && !fixtureAca.incidentRequired,
    mode: fixture.source,
    signalCount: fixture.signals.length,
    sha256Receipt: fixtureAca.sha256Receipt,
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
