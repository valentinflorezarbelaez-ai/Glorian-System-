import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));

delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

function git(directory, args) {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_WORK_TREE;
  delete env.GIT_PREFIX;
  return execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env
  }).trim();
}

test("flow inspect CLI handles a repository path with spaces without writing to the target", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flow-cli-smoke-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const repoRoot = path.join(temporaryRoot, "sample repository with spaces");
  fs.mkdirSync(repoRoot);
  git(repoRoot, ["init", "--initial-branch=main"]);
  git(repoRoot, ["config", "user.name", "EOS CLI Smoke Test"]);
  git(repoRoot, ["config", "user.email", "eos-cli-smoke@example.invalid"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# Smoke fixture\n", "utf8");
  git(repoRoot, ["add", "README.md"]);
  git(repoRoot, ["commit", "-m", "Initialize smoke fixture"]);
  const originalHead = git(repoRoot, ["rev-parse", "HEAD"]);
  const originalStatus = git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);
  const output = execFileSync(process.execPath, [cliPath, "flow", "inspect", repoRoot], {
    cwd: temporaryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  assert.match(output, /Repositorio\s+:.*sample repository with spaces/);
  assert.match(output, /Rama \/ HEAD\s+: main \/ [0-9a-f]{12}/);
  assert.match(output, /Archivos sin commit:\s+0/);
  assert.match(output, /Preparación prod\.\s+: No evaluada/);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);
  assert.equal(git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]), originalStatus);
  assert.equal(fs.existsSync(path.join(repoRoot, ".eos")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, ".worktrees")), false);
});
