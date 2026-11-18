/**
 * BDD Test Suite for SPEC-342 (BDD-1836):
 * Hermetic Evidence Directory Resolution & Receipt Isolation
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveEvidenceDir, resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";

describe("SPEC-342 (BDD-1836): Evidence Directory Resolution & Receipt Isolation", () => {
  test("resolves default docs/evidence when EOS_EVIDENCE_DIR is unset", () => {
    const prev = process.env.EOS_EVIDENCE_DIR;
    try {
      delete process.env.EOS_EVIDENCE_DIR;
      const expected = path.join(process.cwd(), "docs", "evidence");
      assert.equal(resolveEvidenceDir(), expected);
      assert.equal(resolveEvidencePath("MY_RECEIPT.json"), path.join(expected, "MY_RECEIPT.json"));
    } finally {
      if (prev !== undefined) process.env.EOS_EVIDENCE_DIR = prev;
    }
  });

  test("BDD-1836: honors EOS_EVIDENCE_DIR and isolates receipts from tracked workspace", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-evd-test-"));
    const prev = process.env.EOS_EVIDENCE_DIR;
    try {
      process.env.EOS_EVIDENCE_DIR = tmpDir;
      const resolved = resolveEvidenceDir();
      assert.equal(resolved, tmpDir);

      const targetPath = resolveEvidencePath("ISOLATED_RECEIPT.json");
      assert.equal(targetPath, path.join(tmpDir, "ISOLATED_RECEIPT.json"));

      fs.writeFileSync(targetPath, JSON.stringify({ ok: true, hermetic: true }));
      assert.ok(fs.existsSync(targetPath));

      // Assert that docs/evidence is clean and does NOT contain ISOLATED_RECEIPT.json
      const workspaceReceipt = path.join(process.cwd(), "docs", "evidence", "ISOLATED_RECEIPT.json");
      assert.equal(fs.existsSync(workspaceReceipt), false);
    } finally {
      if (prev !== undefined) process.env.EOS_EVIDENCE_DIR = prev;
      else delete process.env.EOS_EVIDENCE_DIR;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
