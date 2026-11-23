/**
 * Evidence epistemic hygiene: no absolute host plumbing paths in tip receipts,
 * and TLC_RECEIPT must not claim LIVE_TLC + VERIFIED without reproducible tooling.
 * Aligns with docs/specs/spec.md FR-009 / P0-2 remediation.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TLC_EVIDENCE_MODES,
  containsAbsoluteHostPath,
  runTlcVerification,
  sanitizeEvidencePath,
} from "../scripts/run-tlc.mjs";
import { syncGentleAiStack } from "../scripts/sync-gentle-ai-stack.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = path.join(root, "docs/evidence");

/** Versioned tip receipts only — skip gitignored machine-local outputs (e.g. TOOLCHAIN_RECEIPT). */
function listTrackedEvidenceJson() {
  const out = execFileSync("git", ["ls-files", "docs/evidence/*.json"], {
    cwd: root,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rel) => path.basename(rel))
    .filter((name) => name.endsWith(".json") && !name.startsWith(".tlc-receipt-"));
}

const ALLOWED_TLC_TIP_MODES = new Set([
  TLC_EVIDENCE_MODES.LOCAL_SIMULATION,
  TLC_EVIDENCE_MODES.LIVE_TLC,
  TLC_EVIDENCE_MODES.HOST_HISTORICAL,
  TLC_EVIDENCE_MODES.DEFERRED_TO_CI,
]);

test("sanitizeEvidencePath redacts absolute host paths to repo-relative or REDACTED", () => {
  assert.equal(sanitizeEvidencePath("tools/tla2tools.jar"), "tools/tla2tools.jar");
  assert.equal(sanitizeEvidencePath(root), ".");
  assert.equal(
    sanitizeEvidencePath(path.join(root, "tools", "tla2tools.jar")),
    "tools/tla2tools.jar",
  );
  // In-repo absolute under /home or /Users must become real relative path, not fake tools/.
  assert.equal(
    sanitizeEvidencePath(path.join(root, ".cache", "tla2tools.jar")),
    ".cache/tla2tools.jar",
  );
  assert.equal(
    sanitizeEvidencePath("C:\\Users\\valen\\Documents\\Glorian-System\\tools\\tla2tools.jar"),
    "tools/tla2tools.jar",
  );
  assert.equal(sanitizeEvidencePath("C:\\Users\\valen\\AppData\\Local\\engram\\bin\\engram.exe"), "REDACTED_HOST_PATH");
  assert.equal(containsAbsoluteHostPath("C:\\Users\\valen\\foo"), true);
  assert.equal(containsAbsoluteHostPath("tools/tla2tools.jar"), false);
});

test("docs/evidence tip JSON has zero absolute host / user plumbing paths", () => {
  const files = listTrackedEvidenceJson();
  assert.ok(files.length > 0, "expected versioned (git-tracked) evidence JSON files");
  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(evidenceDir, file), "utf8");
    if (containsAbsoluteHostPath(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `host plumbing paths in: ${offenders.join(", ")}`);
});

test("TLC_RECEIPT.json uses closed taxonomy and does not claim unreproducible LIVE+VERIFIED", () => {
  const receiptPath = path.join(evidenceDir, "TLC_RECEIPT.json");
  assert.ok(fs.existsSync(receiptPath), "TLC_RECEIPT.json must exist");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));

  assert.ok(
    ALLOWED_TLC_TIP_MODES.has(receipt.executionMode),
    `executionMode must be in taxonomy (actual: ${receipt.executionMode})`,
  );
  assert.equal(containsAbsoluteHostPath(receipt.tlaJarPath || ""), false);
  assert.notEqual(receipt.status, "VERIFIED");
  assert.notEqual(receipt.executionMode, "LIVE_LOCAL_TLC");

  // LIVE_TLC is host/CI optional — never merge-gate certified (jar gitignored; gate skips Java).
  assert.equal(receipt.reproducibleByMergeGate, false);
  if (receipt.executionMode === TLC_EVIDENCE_MODES.LIVE_TLC) {
    assert.notEqual(receipt.status, "VERIFIED");
  }
});

test("TLC_RECEIPT.HOST_HISTORICAL.json archives host metrics without plumbing paths", () => {
  const archivePath = path.join(evidenceDir, "TLC_RECEIPT.HOST_HISTORICAL.json");
  assert.ok(fs.existsSync(archivePath), "host-historical archive must exist");
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  assert.equal(archive.executionMode, TLC_EVIDENCE_MODES.HOST_HISTORICAL);
  assert.equal(archive.status, TLC_EVIDENCE_MODES.HOST_HISTORICAL);
  assert.equal(archive.reproducibleByMergeGate, false);
  assert.notEqual(archive.status, "VERIFIED");
  assert.equal(containsAbsoluteHostPath(JSON.stringify(archive)), false);
  assert.ok(Array.isArray(archive.models) && archive.models.length > 0);
});

test("run-tlc forceMock emits DEFERRED_TO_CI without host paths", () => {
  const receiptPath = path.join(os.tmpdir(), `eos-tlc-hygiene-${process.pid}.json`);
  try {
    const receipt = runTlcVerification({ forceMock: true, receiptPath });
    assert.equal(receipt.executionMode, TLC_EVIDENCE_MODES.DEFERRED_TO_CI);
    assert.equal(receipt.status, TLC_EVIDENCE_MODES.DEFERRED_TO_CI);
    assert.equal(receipt.tlaJarPath, "NOT_DETECTED_LOCALLY");
    assert.equal(receipt.reproducibleByMergeGate, false);
    assert.equal(containsAbsoluteHostPath(JSON.stringify(receipt)), false);
  } finally {
    try {
      fs.unlinkSync(receiptPath);
    } catch {
      // temp cleanup
    }
  }
});

test("syncGentleAiStack writes sanitized Gentle receipt without host plumbing", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-gentle-sync-"));
  try {
    // Minimal repo-shaped tree so sync can write evidence under tmpRoot.
    fs.mkdirSync(path.join(tmpRoot, "docs", "evidence"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, ".agents", "skills", "sdd-init"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, ".githooks"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, ".githooks", "pre-commit"), "#!/bin/sh\nexit 0\n");
    fs.mkdirSync(path.join(tmpRoot, "src", "mcp"), { recursive: true });
    // Stub the real definitions source of truth (not legacy server/catalog regex targets).
    fs.writeFileSync(
      path.join(tmpRoot, "src", "mcp", "eosMcpToolDefinitions.ts"),
      [
        "export const EOS_MCP_TOOL_DEFINITIONS = [",
        '  { name: "eos_health_check", description: "stub", inputSchema: { type: "object" } },',
        "];",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(tmpRoot, "src", "mcp", "eosMcpToolCatalog.ts"),
      'export const CORE_TIER0_TOOL_NAMES = new Set(["eos_health_check"]);\n',
    );

    const receipt = await syncGentleAiStack({ projectRoot: tmpRoot });
    assert.equal(receipt.projectRoot, ".");
    assert.equal(receipt.reproducibleByMergeGate, false);
    assert.equal(receipt.executionMode, TLC_EVIDENCE_MODES.LOCAL_SIMULATION);
    assert.equal(receipt.epistemicState, TLC_EVIDENCE_MODES.LOCAL_SIMULATION);
    assert.equal(receipt.mcpToolCount.fullProfile, 1);
    assert.equal(receipt.mcpToolCount.coreProfile, 1);
    assert.equal(containsAbsoluteHostPath(JSON.stringify(receipt)), false);

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, "docs", "evidence", "EVD-GENTLE-STACK-SYNC.json"), "utf8"),
    );
    assert.equal(onDisk.projectRoot, ".");
    assert.equal(onDisk.reproducibleByMergeGate, false);
    assert.ok(onDisk.epistemicState);
    assert.equal(containsAbsoluteHostPath(JSON.stringify(onDisk)), false);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
