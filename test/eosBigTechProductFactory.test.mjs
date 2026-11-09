/**
 * SPEC-185 Big Tech Product Factory E2E — hermetic BDD.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDemoLedgerManifest,
  isLeastPrivilegeProductPolicyPack,
  loadDefaultIamPolicyPack,
  runBigTechProductFactory,
  writeBigTechFactoryReceipt,
} from "../src/core/eosBigTechProductFactory.ts";
import { MCP_MUTATION_CAPABLE_TOOLS } from "../src/core/eosMcpIamCallGate.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-942/936: default policy pack is fine-grained least privilege", () => {
  const policies = loadDefaultIamPolicyPack(projectRoot);
  assert.ok(policies.length >= 4);
  assert.equal(isLeastPrivilegeProductPolicyPack(policies), true);
  assert.ok(policies.every((p) => p.resourcePrefix !== "mcp/tools/"));
  for (const required of [
    "mcp/tools/eos_product_deliver_run",
    "mcp/tools/eos_product_foundry_create",
    "mcp/tools/eos_manage_worktree",
    "mcp/tools/eos_autonomous_heal",
  ]) {
    assert.ok(
      policies.some((p) => p.resourcePrefix === required),
      `missing ${required}`,
    );
  }
});

test("BDD-940: authorized dry-run factory succeeds", () => {
  const policies = loadDefaultIamPolicyPack(projectRoot);
  const result = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies,
  });
  assert.ok(result.status === "SUCCESS" || result.reason === "SCORECARD_FLOOR");
  assert.equal(result.dryRun, true);
  assert.equal(result.sha256Receipt.length, 64);
  assert.ok(result.iam.allowed);
  assert.ok(result.delivery);
  assert.equal(result.delivery.dryRun, true);
});

test("BDD-941: IAM denial blocks materialization", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-factory-"));
  try {
    const result = runBigTechProductFactory(
      {
        ...buildDemoLedgerManifest(),
        id: "blocked-ledger",
      },
      {
        projectRoot: tmp,
        dryRun: false,
        policies: [],
        principal: null,
      },
    );
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.reason, "IAM_DENIED");
    assert.equal(result.delivery, null);
    assert.equal(fs.existsSync(path.join(tmp, "docs", "products", "blocked-ledger")), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("factory receipt writer emits evidence JSON", () => {
  const policies = loadDefaultIamPolicyPack(projectRoot);
  const result = runBigTechProductFactory(buildDemoLedgerManifest(), {
    projectRoot,
    dryRun: true,
    policies,
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-factory-receipt-"));
  try {
    const target = writeBigTechFactoryReceipt(
      tmp,
      result,
      path.join("docs", "evidence", "BIGTECH_PRODUCT_FACTORY_RECEIPT.json"),
    );
    assert.ok(fs.existsSync(target));
    const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
    assert.equal(parsed.sha256Receipt, result.sha256Receipt);
    assert.equal(parsed.productId, "demo-ledger-mvp");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("eos_product_deliver_run is mutation-capable for IAM writes", () => {
  assert.equal(MCP_MUTATION_CAPABLE_TOOLS.has("eos_product_deliver_run"), true);
});
