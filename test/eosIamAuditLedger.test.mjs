/**
 * SPEC-184 FR-935 — IAM append-only audit ledger hermetic gates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendIamAuditEntry, verifyIamAuditLedger } from "../src/core/eosIamAuditLedger.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Windows runners briefly lock freshly written JSONL under %TEMP%; never fail assertions on cleanup. */
function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // Best-effort: leftover temp dirs must not fail hermetic gates on Windows EPERM.
  }
}

test("BDD-935: hash-chained audit entries verify", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-iam-audit-"));
  try {
    const d1 = {
      ok: false,
      code: "DENY_INVALID_INPUT",
      reason: "missing",
      matchedPolicyId: null,
      sha256Receipt: "a".repeat(64),
    };
    const d2 = {
      ok: true,
      code: "ALLOW",
      reason: "ok",
      matchedPolicyId: "pol-1",
      sha256Receipt: "b".repeat(64),
    };
    const first = appendIamAuditEntry(tmp, {
      toolName: "eos_manage_worktree",
      decision: d1,
      principal: null,
      resourceId: "mcp/tools/eos_manage_worktree",
      requestId: 1,
    });
    assert.equal(first.entry.previousHash, "0".repeat(64));
    const second = appendIamAuditEntry(tmp, {
      toolName: "eos_manage_worktree",
      decision: d2,
      principal: { subjectId: "eng-1", tenantId: "tenant-local", roles: ["engineer"] },
      resourceId: "mcp/tools/eos_manage_worktree",
      requestId: 2,
    });
    assert.equal(second.entry.previousHash, first.entry.entryHash);
    const verified = verifyIamAuditLedger(tmp);
    assert.equal(verified.ok, true);
    assert.equal(verified.entries, 2);
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-935b: MCP mutating deny appends an audit row", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-iam-mcp-"));
  try {
    // Minimal package.json so EosMcpServer accepts the project root.
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "tmp", version: "0.0.0" }));
    const server = new EosMcpServer(tmp, "full");
    server.configureIamPolicies([]);
    server.configureIamDefaultPrincipal(null);
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: "audit-1",
      method: "tools/call",
      params: {
        name: "eos_manage_worktree",
        arguments: { action: "create", branch: "x", apply: true },
      },
    });
    assert.equal(response.error?.code, -32030);
    const ledger = path.join(tmp, ".eos", "iam-audit.jsonl");
    assert.ok(fs.existsSync(ledger));
    const line = fs.readFileSync(ledger, "utf8").trim().split("\n").pop();
    const entry = JSON.parse(line);
    assert.equal(entry.ok, false);
    assert.equal(entry.toolName, "eos_manage_worktree");
    assert.equal(entry.entryHash.length, 64);
    assert.equal(verifyIamAuditLedger(tmp).ok, true);
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-936: default pack covers heal/worktree/deliver/foundry", async () => {
  const { loadDefaultIamPolicyPack, isLeastPrivilegeProductPolicyPack } = await import(
    "../src/core/eosBigTechProductFactory.ts"
  );
  const policies = loadDefaultIamPolicyPack(projectRoot);
  assert.equal(isLeastPrivilegeProductPolicyPack(policies), true);
  const prefixes = policies.map((p) => p.resourcePrefix);
  assert.ok(prefixes.includes("mcp/tools/eos_autonomous_heal"));
  assert.ok(prefixes.includes("mcp/tools/eos_manage_worktree"));
  assert.ok(prefixes.includes("mcp/tools/eos_product_deliver_run"));
  assert.ok(prefixes.includes("mcp/tools/eos_product_foundry_create"));
  assert.ok(!prefixes.includes("mcp/tools/"));
});
