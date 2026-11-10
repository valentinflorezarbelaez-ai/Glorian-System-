/**
 * SPEC-184 FR-935 — IAM append-only audit ledger hermetic gates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendIamAuditEntry,
  exportIamAuditLedgerForSiem,
  verifyIamAuditLedger,
} from "../src/core/eosIamAuditLedger.ts";
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
  const { loadDefaultIamPolicyPack, isLeastPrivilegeProductPolicyPack } =
    await import("../src/core/eosBigTechProductFactory.ts");
  const policies = loadDefaultIamPolicyPack(projectRoot);
  assert.equal(isLeastPrivilegeProductPolicyPack(policies), true);
  const prefixes = policies.map((p) => p.resourcePrefix);
  assert.ok(prefixes.includes("mcp/tools/eos_autonomous_heal"));
  assert.ok(prefixes.includes("mcp/tools/eos_manage_worktree"));
  assert.ok(prefixes.includes("mcp/tools/eos_product_deliver_run"));
  assert.ok(prefixes.includes("mcp/tools/eos_product_foundry_create"));
  assert.ok(!prefixes.includes("mcp/tools/"));
});

test("BDD-937: verify fails closed on every tamper class", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-iam-tamper-"));
  try {
    const decision = {
      ok: true,
      code: "ALLOW",
      reason: "ok",
      matchedPolicyId: "pol-1",
      sha256Receipt: "c".repeat(64),
    };
    const input = {
      toolName: "eos_autonomous_heal",
      decision,
      principal: { subjectId: "eng-1", tenantId: "t1", roles: ["engineer"] },
      resourceId: "mcp/tools/eos_autonomous_heal",
    };
    appendIamAuditEntry(tmp, { ...input, requestId: 1 });
    appendIamAuditEntry(tmp, { ...input, requestId: 2 });
    const ledgerPath = path.join(tmp, ".eos", "iam-audit.jsonl");
    const pristine = fs.readFileSync(ledgerPath, "utf8");

    // Hash mismatch: mutate a hashed field without recomputing entryHash.
    const lines = pristine.trim().split("\n");
    const tampered = JSON.parse(lines[0]);
    tampered.toolName = "eos_evil_tool";
    lines[0] = JSON.stringify(tampered);
    fs.writeFileSync(ledgerPath, lines.join("\n") + "\n");
    const mismatch = verifyIamAuditLedger(tmp);
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.reason, "HASH_MISMATCH_AT_0");
    assert.equal(mismatch.entries, 0);

    // Chain break: restore content but splice a foreign previousHash.
    fs.writeFileSync(ledgerPath, pristine);
    const rows = pristine
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    rows[1].previousHash = "f".repeat(64);
    fs.writeFileSync(ledgerPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const broken = verifyIamAuditLedger(tmp);
    assert.equal(broken.ok, false);
    assert.equal(broken.reason, "CHAIN_BREAK_AT_1");
    assert.equal(broken.entries, 1);

    // Invalid JSON line.
    fs.writeFileSync(ledgerPath, pristine + "{not-json}\n");
    const invalid = verifyIamAuditLedger(tmp);
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, "INVALID_JSON_LINE_2");
    assert.equal(invalid.entries, 2);

    // Empty and absent ledgers verify as empty-ok.
    fs.writeFileSync(ledgerPath, "");
    assert.deepEqual(verifyIamAuditLedger(tmp), { ok: true, entries: 0, reason: null });
    fs.rmSync(ledgerPath);
    assert.deepEqual(verifyIamAuditLedger(tmp), { ok: true, entries: 0, reason: null });
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-938: SIEM export is verified, deterministic, and fail-closed", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-iam-siem-"));
  try {
    const decision = {
      ok: false,
      code: "DENY_INVALID_INPUT",
      reason: "missing",
      matchedPolicyId: null,
      sha256Receipt: "d".repeat(64),
    };
    appendIamAuditEntry(tmp, {
      toolName: "eos_manage_worktree",
      decision,
      principal: null,
      resourceId: null,
      requestId: 7,
    });

    const okExport = exportIamAuditLedgerForSiem(tmp);
    assert.equal(okExport.ok, true);
    assert.equal(okExport.entries, 1);
    assert.equal(okExport.reason, null);
    assert.equal(okExport.sha256Receipt.length, 64);
    const ndjson = fs.readFileSync(okExport.outputPath, "utf8").trim().split("\n");
    assert.equal(ndjson.length, 1);
    const row = JSON.parse(ndjson[0]);
    assert.equal(row.eventType, "glorian.iam.decision");
    assert.equal(row.toolName, "eos_manage_worktree");
    assert.equal(row.ok, false);
    assert.equal(row.entryHash.length, 64);
    assert.equal(Object.hasOwn(row, "previousHash"), false);

    // Deterministic receipt for identical content.
    const again = exportIamAuditLedgerForSiem(tmp);
    assert.equal(again.sha256Receipt, okExport.sha256Receipt);

    // Tamper → export must fail closed and not overwrite the last good export.
    const ledgerPath = path.join(tmp, ".eos", "iam-audit.jsonl");
    fs.writeFileSync(ledgerPath, "{broken\n");
    const before = fs.readFileSync(okExport.outputPath, "utf8");
    const failed = exportIamAuditLedgerForSiem(tmp);
    assert.equal(failed.ok, false);
    assert.equal(failed.reason, "INVALID_JSON_LINE_0");
    assert.equal(failed.sha256Receipt.length, 64);
    assert.equal(fs.readFileSync(okExport.outputPath, "utf8"), before);

    // Empty ledger exports an empty file with ok=true.
    fs.writeFileSync(ledgerPath, "");
    const empty = exportIamAuditLedgerForSiem(tmp);
    assert.equal(empty.ok, true);
    assert.equal(empty.entries, 0);
    assert.equal(fs.readFileSync(empty.outputPath, "utf8"), "");
  } finally {
    removeTempDir(tmp);
  }
});

test("BDD-939: requestId normalization and last-hash recovery", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-iam-recovery-"));
  try {
    const decision = {
      ok: true,
      code: "ALLOW",
      reason: "ok",
      matchedPolicyId: null,
      sha256Receipt: "e".repeat(64),
    };
    const base = { toolName: "eos_product_deliver_run", decision, principal: null, resourceId: null };
    assert.equal(appendIamAuditEntry(tmp, base).entry.requestId, null);
    assert.equal(appendIamAuditEntry(tmp, { ...base, requestId: null }).entry.requestId, null);
    assert.equal(appendIamAuditEntry(tmp, { ...base, requestId: 42 }).entry.requestId, "42");
    assert.equal(verifyIamAuditLedger(tmp).ok, true);

    // Corrupt tail: readLastHash must fall back to genesis instead of crashing.
    const ledgerPath = path.join(tmp, ".eos", "iam-audit.jsonl");
    fs.writeFileSync(ledgerPath, "{corrupt-tail\n");
    const recovered = appendIamAuditEntry(tmp, base);
    assert.equal(recovered.entry.previousHash, "0".repeat(64));

    // Non-64-char entryHash on the last line also falls back to genesis.
    fs.writeFileSync(ledgerPath, JSON.stringify({ entryHash: "too-short" }) + "\n");
    assert.equal(appendIamAuditEntry(tmp, base).entry.previousHash, "0".repeat(64));
  } finally {
    removeTempDir(tmp);
  }
});
