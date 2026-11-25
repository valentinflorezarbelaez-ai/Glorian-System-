/**
 * Hermetic coverage for scripts/software-factory-worktree.mjs (fail-closed helpers).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/software-factory-worktree.mjs");
const skill = path.join(root, ".agents/skills/software-factory/SKILL.md");
const doc = path.join(root, "docs/governance/SOFTWARE_FACTORY_SKILL.md");

describe("software-factory-worktree", () => {
  let fixtureRoot;
  let fixtureScript;

  before(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glorian-worktree-"));
    fixtureScript = path.join(fixtureRoot, "scripts", path.basename(script));
    fs.mkdirSync(path.dirname(fixtureScript));
    fs.copyFileSync(script, fixtureScript);
    const env = { ...process.env };
    for (const name of ["GIT_INDEX_FILE", "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"]) delete env[name];
    const git = (args) => execFileSync("git", args, { cwd: fixtureRoot, env, stdio: "pipe" });
    git(["init", "--quiet"]);
    git(["add", "--", "scripts/software-factory-worktree.mjs"]);
    git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--no-gpg-sign", "-qm", "Fixture"]);
  });

  after(() => {
    if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function run(args) {
    return execFileSync(process.execPath, [fixtureScript, ...args], {
      cwd: fixtureRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
  }

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

  it("fail-closed when remove path is not a registered worktree for branch", () => {
    // Use --path so the orphan dir matches resolveWorktreePath (not branchSlug mismatch).
    const orphanDir = path.join(fixtureRoot, ".worktrees", "sf-orphan-unregistered");
    fs.mkdirSync(orphanDir, { recursive: true });
    assert.throws(
      () => run(["remove", "--branch", "cursor/sf-orphan-unregistered", "--path", "sf-orphan-unregistered"]),
      (err) => err.status === 1 && /No registered git worktree/.test(String(err.stderr)),
    );
    assert.ok(fs.existsSync(orphanDir));
  });

  it("remove prefers registered --path worktree over stray default-slug dir", () => {
    const branch = "cursor/sf-path-pref";
    const customSlug = "sf-custom";
    const customDir = path.join(fixtureRoot, ".worktrees", customSlug);
    const strayDefault = path.join(fixtureRoot, ".worktrees", branch.replace(/\//g, "-"));

    const created = JSON.parse(run(["create", "--branch", branch, "--base", "HEAD", "--path", customSlug]));
    const registeredPath = fs.realpathSync.native(customDir);
    assert.equal(fs.realpathSync.native(created.path), registeredPath);
    fs.mkdirSync(strayDefault);

    const removed = JSON.parse(run(["remove", "--branch", branch, "--force"]));
    assert.equal(removed.path, registeredPath);
    assert.equal(fs.existsSync(customDir), false);
    assert.equal(fs.existsSync(strayDefault), true, "stray default-slug dir should remain");
  });

  it("keeps runtime dependencies empty", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  });
});
