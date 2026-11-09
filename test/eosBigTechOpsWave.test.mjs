/**
 * Big Tech ops wave hermetic gates — composes SPEC-042/066/100/156/184/185.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHealthyAcaDogfoodInput,
  runBigTechAcaCanaryGate,
  writeAcaCanaryEvidence,
} from "../src/core/eosBigTechAcaCanaryGate.ts";
import { resolveFleetProjectPath, resolveFleetRegistryPaths } from "../src/core/eosFleetPathResolver.ts";
import { appendIamAuditEntry, exportIamAuditLedgerForSiem } from "../src/core/eosIamAuditLedger.ts";
import { evaluateBreakGlassGrant, issueBreakGlassGrant } from "../src/core/eosIamBreakGlass.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Windows TEMP locks must not fail assertions.
  }
}

test("BDD-ACA-001: healthy ACA canary gate passes without incident", () => {
  const result = runBigTechAcaCanaryGate(buildHealthyAcaDogfoodInput());
  assert.equal(result.verdict, "PASS");
  assert.equal(result.incidentRequired, false);
  assert.equal(result.mesh.verifiedSafe, true);
  assert.equal(result.sha256Receipt.length, 64);
});

test("BDD-ACA-002: ACA hard fail requires incident loop", () => {
  const healthy = buildHealthyAcaDogfoodInput();
  const result = runBigTechAcaCanaryGate({
    ...healthy,
    canarySamples: {
      errorRate: [0.2, 0.25, 0.22, 0.28],
      p99LatencyMs: [900, 950, 1000, 980],
      memoryMb: [2000, 2100, 2050, 2200],
    },
  });
  assert.ok(result.verdict === "FAIL" || result.incidentRequired === true);
  assert.equal(result.incidentRequired, true);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-aca-"));
  try {
    const written = writeAcaCanaryEvidence(tmp, result);
    assert.ok(fs.existsSync(written.canaryPath));
    assert.ok(written.incidentPath && fs.existsSync(written.incidentPath));
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-IAM-BG-001: break-glass TTL expires fail-closed", () => {
  const now = 1_700_000_000_000;
  const grant = issueBreakGlassGrant({
    principal: { subjectId: "sre-1", tenantId: "t1", roles: ["break-glass"] },
    reason: "sev1-customer-outage",
    nowMs: now,
    ttlMs: 10 * 60_000,
  });
  assert.equal(evaluateBreakGlassGrant(grant, now).active, true);
  assert.equal(evaluateBreakGlassGrant(grant, now + 11 * 60_000).code, "BREAK_GLASS_EXPIRED");
});

test("BDD-IAM-SIEM-001: verified ledger exports SIEM NDJSON", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-siem-"));
  try {
    appendIamAuditEntry(tmp, {
      toolName: "eos_product_deliver_run",
      decision: {
        ok: false,
        code: "DENY_NO_POLICY",
        reason: "deny",
        matchedPolicyId: null,
        sha256Receipt: "d".repeat(64),
      },
      principal: null,
      resourceId: "mcp/tools/eos_product_deliver_run",
      requestId: 7,
    });
    const exported = exportIamAuditLedgerForSiem(tmp);
    assert.equal(exported.ok, true);
    assert.equal(exported.entries, 1);
    const body = fs.readFileSync(exported.outputPath, "utf8").trim();
    const row = JSON.parse(body);
    assert.equal(row.eventType, "glorian.iam.decision");
    assert.equal(row.toolName, "eos_product_deliver_run");
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-FLEET-PATH-001: control plane resolves; missing sibling skipped", () => {
  const self = resolveFleetProjectPath(projectRoot, {
    id: "eos-system",
    name: "Glorian",
    localPathEnv: "EOS_FLEET_EOS_SYSTEM_PATH",
  });
  assert.equal(self.status, "AVAILABLE");
  assert.equal(self.resolution, "CONTROL_PLANE");

  const missing = resolveFleetProjectPath(projectRoot, {
    id: "no-such-fleet-repo",
    resolvedLocalDir: "__definitely-missing-sibling__",
    localPathEnv: "EOS_FLEET_NO_SUCH_PATH",
  });
  assert.equal(missing.status, "SKIPPED_SIBLING");

  const registry = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "docs", "projects", "registry.json"), "utf8"),
  );
  const resolved = resolveFleetRegistryPaths(projectRoot, registry.projects || []);
  assert.ok(resolved.some((r) => r.id === "eos-system" && r.status === "AVAILABLE"));
});

test("BDD-FLEET-PATH-002: ENV and LOCAL_PATH resolution branches", () => {
  const envKey = "EOS_FLEET_PATH_RESOLVER_TEST_PATH";
  const previous = process.env[envKey];
  process.env[envKey] = projectRoot;
  try {
    const viaEnv = resolveFleetProjectPath(projectRoot, {
      id: "path-resolver-env",
      localPathEnv: envKey,
    });
    assert.equal(viaEnv.status, "AVAILABLE");
    assert.equal(viaEnv.resolution, "ENV");
  } finally {
    if (previous === undefined) delete process.env[envKey];
    else process.env[envKey] = previous;
  }

  const viaLocal = resolveFleetProjectPath(projectRoot, {
    id: "path-resolver-local",
    localPath: projectRoot,
  });
  assert.equal(viaLocal.status, "AVAILABLE");
  assert.equal(viaLocal.resolution, "LOCAL_PATH");
});

test("BDD-IAM-BG-002: invalid grant and short reason fail-closed", () => {
  assert.equal(evaluateBreakGlassGrant(null).code, "BREAK_GLASS_INVALID");
  assert.throws(
    () =>
      issueBreakGlassGrant({
        principal: { subjectId: "x", tenantId: "t", roles: ["break-glass"] },
        reason: "short",
      }),
    /BREAK_GLASS_REASON_REQUIRED/,
  );
});

test("BDD-IAM-SIEM-002: broken chain refuses SIEM export", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-siem-bad-"));
  try {
    const ledgerDir = path.join(tmp, ".eos");
    fs.mkdirSync(ledgerDir, { recursive: true });
    fs.writeFileSync(
      path.join(ledgerDir, "iam-audit.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        toolName: "x",
        code: "ALLOW",
        ok: true,
        subjectId: null,
        tenantId: null,
        resourceId: null,
        matchedPolicyId: null,
        decisionReceipt: "e".repeat(64),
        requestId: null,
        previousHash: "f".repeat(64),
        entryHash: "a".repeat(64),
      })}\n`,
      "utf8",
    );
    const exported = exportIamAuditLedgerForSiem(tmp);
    assert.equal(exported.ok, false);
    assert.ok(exported.reason);
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-ACA-003: mesh rollback marks incident required", () => {
  const healthy = buildHealthyAcaDogfoodInput();
  const result = runBigTechAcaCanaryGate({
    ...healthy,
    telemetrySequence: [
      {
        stage: "CANARY_1_PCT",
        sampleRequests: 1000,
        failedRequests: 50,
        p99LatencyMs: 400,
        baselineP99LatencyMs: 40,
      },
    ],
  });
  assert.equal(result.verdict, "ROLLED_BACK_SAFE");
  assert.equal(result.incidentRequired, true);
  assert.equal(result.mesh.rollbackExecuted, true);
});
