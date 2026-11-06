/**
 * Commit governance: Conventional Commits enforced at commit time, and hooks
 * tracked as executable so Linux/macOS clones run them too.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMIT_TYPES, validateCommitMessage } from "../scripts/verify-commit-message.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const linterPath = path.join(root, "scripts", "verify-commit-message.mjs");

test("COMMIT-01: conventional messages are accepted", () => {
  const messages = [
    "feat(session): keep the shared agent ledger consistent",
    "fix: retry atomic replacement on EPERM",
    "test(ledger)!: drop the in-repo ledger fixture",
    "docs(runbook): document the release pin",
    ...COMMIT_TYPES.map((type) => `${type}: automated ${type} change`)
  ];

  for (const message of messages) {
    const result = validateCommitMessage(message);
    assert.equal(result.ok, true, `${message} -> ${result.errors.join("; ")}`);
  }
});

test("COMMIT-02: non-conventional messages are rejected with a reason", () => {
  const messages = [
    "updated stuff",
    "Feat(scope): uppercase type",
    "feat(Scope): uppercase scope",
    "feat:missing space",
    "feat: ",
    "feat: subject ends with a period.",
    "feat: " + "x".repeat(120)
  ];

  for (const message of messages) {
    const result = validateCommitMessage(message);
    assert.equal(result.ok, false, `expected rejection: ${JSON.stringify(message)}`);
    assert.ok(result.errors.length > 0);
  }
});

test("COMMIT-03: git-generated headers stay exempt", () => {
  for (const message of [
    "Merge branch 'main' into chore/engineering-hardening",
    "Merge pull request #42 from user/branch",
    'Revert "fix: retry atomic replacement on EPERM"',
    "fixup! feat(session): keep the ledger consistent"
  ]) {
    assert.equal(validateCommitMessage(message).ok, true, message);
  }
  assert.equal(validateCommitMessage("# comment only\n\n").ok, false);
});

test("COMMIT-04: the CLI reports invalid messages with a non-zero exit code", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commit-msg-"));
  try {
    const invalidFile = path.join(dir, "invalid.txt");
    fs.writeFileSync(invalidFile, "updated stuff\n", "utf8");
    assert.throws(
      () => execFileSync(process.execPath, [linterPath, invalidFile], { stdio: "pipe" }),
      (error) => error.status === 1
    );

    const validFile = path.join(dir, "valid.txt");
    fs.writeFileSync(validFile, "fix: reject invalid commit headers\n", "utf8");
    execFileSync(process.execPath, [linterPath, validFile], { stdio: "pipe" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("COMMIT-05: commit-msg hook is wired and every hook is tracked as executable", () => {
  const hookPath = path.join(root, ".githooks", "commit-msg");
  assert.ok(fs.existsSync(hookPath), ".githooks/commit-msg must exist");
  assert.match(fs.readFileSync(hookPath, "utf8"), /verify-commit-message\.mjs/);

  const listing = execFileSync("git", ["ls-files", "-s", ".githooks"], {
    cwd: root,
    encoding: "utf8"
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  assert.ok(listing.length >= 3, `expected pre-commit, pre-push and commit-msg, got ${listing.length}`);
  for (const entry of listing) {
    const [mode, , , file] = entry.split(/\s+/);
    assert.equal(mode, "100755", `${file} must be tracked as 100755 so POSIX clones execute it`);
  }
});
