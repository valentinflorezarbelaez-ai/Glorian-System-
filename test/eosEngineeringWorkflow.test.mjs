import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EosEngineeringWorkflow } from "../src/core/eosEngineeringWorkflow.ts";
import { EosWorktreeOrchestrator } from "../src/core/eosWorktreeOrchestrator.ts";

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

function createFixtureRepository(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-engineering-flow-"));
  const repoRoot = path.join(temporaryRoot, "repo");
  fs.mkdirSync(repoRoot);
  git(repoRoot, ["init", "--initial-branch=main"]);
  git(repoRoot, ["config", "user.name", "EOS Workflow Test"]);
  git(repoRoot, ["config", "user.email", "eos-workflow-test@example.invalid"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# Fixture project\n", "utf8");
  fs.writeFileSync(path.join(repoRoot, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", scripts: { test: "node --test" } }) + "\n", "utf8");
  git(repoRoot, ["add", "README.md", "package.json"]);
  git(repoRoot, ["commit", "-m", "Initialize fixture"]);

  t.after(() => {
    const worktrees = new EosWorktreeOrchestrator(repoRoot);
    for (const item of worktrees.listWorktrees().slice(1)) {
      worktrees.removeWorktree(item.path, { force: true });
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  return repoRoot;
}

test("flow inspect and plan are read-only and clearly scoped as heuristics", (t) => {
  const repoRoot = createFixtureRepository(t);
  const workflow = new EosEngineeringWorkflow();
  const originalHead = git(repoRoot, ["rev-parse", "HEAD"]);

  const inspection = workflow.inspect(repoRoot);
  const plan = workflow.plan(repoRoot, "add a health route");

  assert.equal(inspection.headCommit, originalHead);
  assert.equal(inspection.dirtyFiles.length, 0);
  assert.equal(plan.planStatus, "PLAN_ONLY");
  assert.equal(plan.executionPerformed, false);
  assert.match(plan.note, /heurístico/);
  assert.ok(plan.candidateValidationCommands.includes("npm test"));
  assert.equal(plan.proposedSteps.length, 5);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);
  assert.equal(git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]), "");
  assert.equal(fs.existsSync(path.join(repoRoot, ".eos")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, ".worktrees")), false);
});

test("flow gives actionable guidance for invalid repository paths", (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-invalid-repo-path-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const filePath = path.join(temporaryRoot, "README.md");
  fs.writeFileSync(filePath, "not a repository folder\n", "utf8");
  const workflow = new EosEngineeringWorkflow();

  assert.throws(() => workflow.inspect(path.join(temporaryRoot, "missing")), /Repository path not found.*Check the path/);
  assert.throws(() => workflow.inspect(filePath), /is a file, not a folder.*repository folder/);
  assert.throws(() => workflow.inspect(temporaryRoot), /Could not find a Git repository.*initialized Git working tree/);
});

test("flow start creates an isolated worktree without dirtying the target checkout", (t) => {
  const repoRoot = createFixtureRepository(t);
  const workflow = new EosEngineeringWorkflow();
  const originalHead = git(repoRoot, ["rev-parse", "HEAD"]);

  const started = workflow.start(repoRoot, "add bounded health endpoint");

  assert.match(started.workflowId, /^[0-9a-f-]{36}$/i);
  assert.equal(started.baseBranch, "main");
  assert.equal(started.baseCommit, originalHead);
  assert.equal(started.localExcludeUpdated, true);
  const canonicalRepoRoot = fs.realpathSync(git(repoRoot, ["rev-parse", "--show-toplevel"]));
  assert.equal(path.dirname(started.worktreePath), path.join(canonicalRepoRoot, ".worktrees"));
  assert.equal(git(started.worktreePath, ["branch", "--show-current"]), started.branchName);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);
  assert.equal(git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]), "");

  assert.throws(() => workflow.review(repoRoot, started.workflowId), /successful isolated validation/);
  assert.throws(() => workflow.apply(repoRoot, started.workflowId, "0".repeat(64)), /Approval hash/);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);
});

test("flow start refuses a dirty base before creating workflow state", (t) => {
  const repoRoot = createFixtureRepository(t);
  fs.writeFileSync(path.join(repoRoot, "uncommitted.txt"), "keep this change\n", "utf8");
  const workflow = new EosEngineeringWorkflow();

  assert.throws(() => workflow.start(repoRoot, "change a module"), /dirty checkout/);
  assert.equal(fs.existsSync(path.join(repoRoot, ".eos")), false);
  assert.equal(fs.existsSync(path.join(repoRoot, ".worktrees")), false);
});

test("flow only fast-forwards the exact validated and hash-approved diff", async (t) => {
  const repoRoot = createFixtureRepository(t);
  let sandboxOptions;
  const workflow = new EosEngineeringWorkflow(() => ({
    async run(options) {
      sandboxOptions = options;
      return {
        success: true,
        status: "COMPLETED",
        exitCode: 0,
        timeoutMs: 1000,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null
      };
    }
  }));
  const originalHead = git(repoRoot, ["rev-parse", "HEAD"]);
  const started = workflow.start(repoRoot, "add a bounded endpoint");

  fs.writeFileSync(path.join(started.worktreePath, "health.txt"), "process liveness only\n", "utf8");
  git(started.worktreePath, ["add", "health.txt"]);
  git(started.worktreePath, ["commit", "-m", "Add bounded health endpoint"]);

  const validation = await workflow.validate(repoRoot, started.workflowId, "npm", ["test"]);
  assert.equal(validation.success, true);
  assert.equal(sandboxOptions.applyChanges, false);
  assert.equal(sandboxOptions.worktreePath, started.worktreePath);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);

  const review = workflow.review(repoRoot, started.workflowId);
  assert.deepEqual(review.changedFiles, ["health.txt"]);
  assert.match(review.diff, /process liveness only/);
  assert.equal(review.headCommit, git(started.worktreePath, ["rev-parse", "HEAD"]));
  assert.throws(() => workflow.apply(repoRoot, started.workflowId, "0".repeat(64)), /Approval hash/);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), originalHead);

  const appliedHead = workflow.apply(repoRoot, started.workflowId, review.diffSha256);
  assert.equal(appliedHead, review.headCommit);
  assert.equal(git(repoRoot, ["rev-parse", "HEAD"]), review.headCommit);
  assert.equal(git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]), "");
  assert.throws(() => workflow.apply(repoRoot, started.workflowId, review.diffSha256), /already been applied/);

  const appliedStatus = workflow.status(repoRoot, started.workflowId);
  assert.equal(appliedStatus.appliedHead, review.headCommit);
  assert.equal(appliedStatus.validationStatus, "COMPLETED");
  assert.equal(appliedStatus.worktreeAvailable, true);
  assert.match(workflow.close(repoRoot, started.workflowId), /branch preserved/);
  const closedStatus = workflow.status(repoRoot, started.workflowId);
  assert.equal(closedStatus.worktreeAvailable, false);
  assert.equal(closedStatus.closedAt !== null, true);
  assert.equal(closedStatus.branchHead, review.headCommit);
});

test("flow close refuses dirty worktrees unless force is explicit and preserves the branch", (t) => {
  const repoRoot = createFixtureRepository(t);
  const workflow = new EosEngineeringWorkflow();
  const started = workflow.start(repoRoot, "document cleanup behavior");
  fs.writeFileSync(path.join(started.worktreePath, "uncommitted.txt"), "preserve unless forced\n", "utf8");

  assert.throws(() => workflow.close(repoRoot, started.workflowId), /uncommitted path/);
  assert.equal(fs.existsSync(started.worktreePath), true);
  assert.equal(git(repoRoot, ["branch", "--show-current"]), "main");

  assert.match(workflow.close(repoRoot, started.workflowId, true), /discarded; branch preserved/);
  assert.equal(fs.existsSync(started.worktreePath), false);
  assert.equal(git(repoRoot, ["show-ref", "--verify", `refs/heads/${started.branchName}`]).length > 0, true);
  assert.equal(workflow.status(repoRoot, started.workflowId).closedAt !== null, true);
});
