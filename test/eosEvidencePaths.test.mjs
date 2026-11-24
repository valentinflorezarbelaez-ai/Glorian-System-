/**
 * BDD Test Suite for SPEC-342 (BDD-1836):
 * Hermetic Evidence Directory Resolution & Receipt Isolation
 */

import { test, describe } from "node:test";
import { execFileSync } from "node:child_process";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveEvidenceDir, resolveEvidencePath } from "../src/core/eosEvidencePaths.ts";
import { assertTrackedEvidenceUnchanged, snapshotTrackedEvidence } from "../scripts/lib/trackedEvidence.mjs";

describe("SPEC-342 (BDD-1836): Evidence Directory Resolution & Receipt Isolation", () => {
  test("test processes clean up their own temporary directory and preserve caller-owned evidence", (t) => {
    const provided = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-caller-evidence-"));
    t.after(() => fs.rmSync(provided, { recursive: true, force: true }));
    const preload = new URL("./lib/testEvidence.mjs", import.meta.url).href;
    const writeReceipt = `
      const dir = process.env.EOS_EVIDENCE_DIR;
      const file = require("node:path").join(dir, "receipt.json");
      require("node:fs").writeFileSync(file, "{}");
      console.log(dir);
    `;
    function emitReceipt(override) {
      return execFileSync(process.execPath, ["--import", preload, "-e", writeReceipt], {
        env: { ...process.env, EOS_EVIDENCE_DIR: override },
        encoding: "utf8",
      }).trim();
    }
    const generated = emitReceipt(" ");
    assert.equal(fs.existsSync(generated), false);
    assert.equal(emitReceipt(provided), provided);
    assert.equal(fs.readFileSync(path.join(provided, "receipt.json"), "utf8"), "{}");
  });

  test("detects writes and deletions relative to the user's working copy", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-evidence-guard-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const dir = path.join(root, "docs", "evidence");
    fs.mkdirSync(dir, { recursive: true });
    const receipt = path.join(dir, "receipt.json");
    fs.writeFileSync(receipt, "indexed");
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "--", "docs/evidence/receipt.json"], { cwd: root });
    fs.writeFileSync(receipt, "existing local edit");
    const before = snapshotTrackedEvidence(root);
    fs.writeFileSync(path.join(dir, "local-run.json"), "{}");
    assertTrackedEvidenceUnchanged(before, snapshotTrackedEvidence(root));
    fs.writeFileSync(receipt, "changed during test");
    assert.throws(
      () => assertTrackedEvidenceUnchanged(before, snapshotTrackedEvidence(root)),
      /docs\/evidence\/receipt\.json/,
    );
    fs.unlinkSync(receipt);
    assert.throws(
      () => assertTrackedEvidenceUnchanged(before, snapshotTrackedEvidence(root)),
      /docs\/evidence\/receipt\.json/,
    );
  });

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
