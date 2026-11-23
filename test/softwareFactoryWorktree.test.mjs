/**
 * Hermetic coverage for scripts/software-factory-worktree.mjs (fail-closed helpers).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/software-factory-worktree.mjs");
const skill = path.join(root, ".agents/skills/software-factory/SKILL.md");
const doc = path.join(root, "docs/governance/SOFTWARE_FACTORY_SKILL.md");

function run(args, opts = {}) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

describe("software-factory-worktree", () => {
  it("ships skill + governance pointer + helper script", () => {
    assert.ok(fs.existsSync(script));
    assert.ok(fs.existsSync(skill));
    assert.ok(fs.existsSync(doc));
    const body = fs.readFileSync(skill, "utf8");
    assert.match(body, /judgment-day/);
    assert.match(body, /Plan ≠ Execute|Plan!=Execute|Plan≠Execute/);
    assert.match(body, /verify:strict/);
  });

  it("lists worktrees with exit 0", () => {
    const out = run(["list"]);
    assert.match(out, /worktree|branch|HEAD/i);
  });

  it("fail-closed on missing branch for create", () => {
    let failed = false;
    try {
      run(["create"]);
    } catch (err) {
      failed = true;
      assert.equal(err.status, 1);
      assert.match(String(err.stderr || ""), /FAIL|branch/i);
    }
    assert.equal(failed, true);
  });

  it("fail-closed on path traversal in --path", () => {
    let failed = false;
    try {
      run(["create", "--branch", "cursor/sf-test-reject", "--path", "../escape"]);
    } catch (err) {
      failed = true;
      assert.equal(err.status, 1);
      assert.match(String(err.stderr || ""), /FAIL/);
    }
    assert.equal(failed, true);
  });

  it("keeps runtime dependencies empty", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  });
});
