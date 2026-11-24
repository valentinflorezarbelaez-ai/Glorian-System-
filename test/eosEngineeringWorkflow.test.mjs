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
    env,
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
  fs.writeFileSync(
    path.join(repoRoot, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0", scripts: { test: "node --test" } }) + "\n",
    "utf8",
  );
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

  assert.throws(
    () => workflow.inspect(path.join(temporaryRoot, "missing")),
    /Repository path not found.*Check the path/,
  );
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
        receiptPath: null,
      };
    },
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

test("flow input validations, error branches, and boundary guards", (t) => {
  const repoRoot = createFixtureRepository(t);
  const workflow = new EosEngineeringWorkflow();

  // Task exceeding 512 bytes
  const longTask = "x".repeat(600);
  assert.throws(() => workflow.plan(repoRoot, longTask), /Task must contain 1 to 512/);
  assert.throws(() => workflow.start(repoRoot, longTask), /Task must contain 1 to 512/);

  // Invalid workflow ID format
  assert.throws(() => workflow.status(repoRoot, "not-a-uuid"), /Workflow ID must be a UUID/);
  assert.throws(() => workflow.review(repoRoot, "not-a-uuid"), /Workflow ID must be a UUID/);
  assert.throws(() => workflow.apply(repoRoot, "not-a-uuid", "0".repeat(64)), /Workflow ID must be a UUID/);
  assert.throws(() => workflow.close(repoRoot, "not-a-uuid"), /Workflow ID must be a UUID/);

  // Nonexistent workflow record throws ENOENT
  const randomUuid = "12345678-1234-4234-8234-123456789abc";
  assert.throws(() => workflow.status(repoRoot, randomUuid), { code: "ENOENT" });
  assert.throws(() => workflow.review(repoRoot, randomUuid), { code: "ENOENT" });
  assert.throws(() => workflow.apply(repoRoot, randomUuid, "0".repeat(64)), { code: "ENOENT" });
  assert.throws(() => workflow.close(repoRoot, randomUuid), { code: "ENOENT" });
});

test("BDD-FLOW-FAULT-001: detects truncated JSON and tampered workflow state records fail-closed", async (t) => {
  const repoRoot = createFixtureRepository(t);
  const workflow = new EosEngineeringWorkflow(() => ({
    async run() {
      return {
        success: true,
        status: "COMPLETED",
        exitCode: 0,
        timeoutMs: 1000,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null,
      };
    },
  }));

  const started = workflow.start(repoRoot, "harden state integrity");
  fs.writeFileSync(path.join(started.worktreePath, "feature.txt"), "deterministic state\n", "utf8");
  git(started.worktreePath, ["add", "feature.txt"]);
  git(started.worktreePath, ["commit", "-m", "Add deterministic feature"]);
  await workflow.validate(repoRoot, started.workflowId, "npm", ["test"]);
  const review = workflow.review(repoRoot, started.workflowId);

  const canonicalRoot = fs.realpathSync(repoRoot);
  const recordFile = path.join(canonicalRoot, ".eos", "workflows", `${started.workflowId}.json`);
  const validRaw = fs.readFileSync(recordFile, "utf8");

  // 1. Tamper a field on disk without updating recordDigestSha256
  const parsed = JSON.parse(validRaw);
  parsed.task = "tampered task description";
  fs.writeFileSync(recordFile, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  assert.throws(() => workflow.apply(repoRoot, started.workflowId, review.diffSha256), /integrity digest mismatch/);

  // 2. Truncate JSON mid-write (simulated power loss on disk corruption)
  fs.writeFileSync(recordFile, validRaw.slice(0, 42), "utf8");
  assert.throws(() => workflow.status(repoRoot, started.workflowId), /Workflow state JSON is corrupted or truncated/);
  assert.equal(git(repoRoot, ["status", "--porcelain", "--untracked-files=all"]), "");
});

test("BDD-FLOW-FAULT-002: refuses concurrent base-branch drift and recovers idempotently from post-merge crash", async (t) => {
  const okSandbox = () => ({
    async run() {
      return {
        success: true,
        status: "COMPLETED",
        exitCode: 0,
        timeoutMs: 1000,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null,
      };
    },
  });

  // Case A: Concurrent commit on main between review and apply
  const repoDrift = createFixtureRepository(t);
  const wfDrift = new EosEngineeringWorkflow(okSandbox);
  const s1 = wfDrift.start(repoDrift, "isolated branch change");
  fs.writeFileSync(path.join(s1.worktreePath, "branch.txt"), "isolated\n", "utf8");
  git(s1.worktreePath, ["add", "branch.txt"]);
  git(s1.worktreePath, ["commit", "-m", "Isolated commit"]);
  await wfDrift.validate(repoDrift, s1.workflowId, "npm", ["test"]);
  const rev1 = wfDrift.review(repoDrift, s1.workflowId);

  fs.writeFileSync(path.join(repoDrift, "concurrent.txt"), "main moved\n", "utf8");
  git(repoDrift, ["add", "concurrent.txt"]);
  git(repoDrift, ["commit", "-m", "Concurrent main advance"]);
  const advancedMainHead = git(repoDrift, ["rev-parse", "HEAD"]);

  assert.throws(() => wfDrift.apply(repoDrift, s1.workflowId, rev1.diffSha256), /base checkout changed after review/);
  assert.equal(git(repoDrift, ["rev-parse", "HEAD"]), advancedMainHead);
  assert.equal(git(repoDrift, ["status", "--porcelain", "--untracked-files=all"]), "");

  // Case B: Simulated crash immediately after git merge --ff-only before appliedHead was persisted
  const repoCrash = createFixtureRepository(t);
  const wfCrash = new EosEngineeringWorkflow(okSandbox);
  const s2 = wfCrash.start(repoCrash, "idempotent crash recovery");
  fs.writeFileSync(path.join(s2.worktreePath, "recover.txt"), "safe fast-forward\n", "utf8");
  git(s2.worktreePath, ["add", "recover.txt"]);
  git(s2.worktreePath, ["commit", "-m", "Commit for crash recovery"]);
  await wfCrash.validate(repoCrash, s2.workflowId, "npm", ["test"]);
  const rev2 = wfCrash.review(repoCrash, s2.workflowId);

  git(repoCrash, ["merge", "--ff-only", "--no-edit", s2.branchName]);
  assert.equal(wfCrash.status(repoCrash, s2.workflowId).appliedHead, null);

  const recoveredHead = wfCrash.apply(repoCrash, s2.workflowId, rev2.diffSha256);
  assert.equal(recoveredHead, rev2.headCommit);
  assert.equal(wfCrash.status(repoCrash, s2.workflowId).appliedHead, rev2.headCommit);
  assert.equal(git(repoCrash, ["status", "--porcelain", "--untracked-files=all"]), "");
});

test("BDD-FLOW-FAULT-003: polyglot plan detection and fail-closed guards across validate, review, apply, and close", async (t) => {
  // 1. Polyglot package manager/test candidate command detection
  const stacks = [
    { files: { "go.mod": "module ex\n" }, expected: "go test ./..." },
    { files: { "Cargo.toml": "[package]\nname='x'\n", "Cargo.lock": "" }, expected: "cargo test --locked" },
    {
      files: { "pyproject.toml": "[tool.pytest.ini_options]\n", "test_app.py": "def test_ok(): assert True\n" },
      expected: "python -m pytest",
    },
    { files: { "pubspec.yaml": "name: app\n", "test/app_test.dart": "void main() {}\n" }, expected: "flutter test" },
    { files: { "pom.xml": "<project/>" }, expected: "mvn test" },
    {
      files: { "build.gradle": "plugins { id 'java' }\n" },
      expected: process.platform === "win32" ? "gradlew.bat test" : "./gradlew test",
    },
  ];
  const wf = new EosEngineeringWorkflow(() => ({
    async run() {
      return {
        success: false,
        status: "COMMAND_FAILED",
        exitCode: 1,
        timeoutMs: 1000,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null,
      };
    },
  }));
  for (const s of stacks) {
    const r = createFixtureRepository(t);
    fs.unlinkSync(path.join(r, "package.json"));
    for (const [f, content] of Object.entries(s.files)) {
      fs.mkdirSync(path.dirname(path.join(r, f)), { recursive: true });
      fs.writeFileSync(path.join(r, f), content, "utf8");
    }
    git(r, ["add", "."]);
    git(r, ["commit", "-m", "Add polyglot marker"]);
    const p = wf.plan(r, "check polyglot candidates");
    assert.ok(
      p.candidateValidationCommands.includes(s.expected),
      `Missing ${s.expected} in ${p.candidateValidationCommands}`,
    );
  }
  {
    const rPnpm = createFixtureRepository(t);
    fs.writeFileSync(path.join(rPnpm, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
    fs.writeFileSync(
      path.join(rPnpm, "package.json"),
      JSON.stringify({ name: "p", scripts: { test: "echo ok", typecheck: "tsc", lint: "eslint ." } }),
      "utf8",
    );
    git(rPnpm, ["add", "."]);
    git(rPnpm, ["commit", "-m", "Add pnpm scripts"]);
    const pp = wf.plan(rPnpm, "check pnpm scripts");
    assert.ok(pp.candidateValidationCommands.includes("pnpm test"));
    assert.ok(pp.candidateValidationCommands.includes("pnpm run typecheck"));
    assert.ok(pp.candidateValidationCommands.includes("pnpm run lint"));
  }

  // 2. Lifecycle preconditions: no commits yet, dirty worktree before validate, failed validation, review/apply mismatch
  const repo = createFixtureRepository(t);
  const s = wf.start(repo, "exercise fail-closed transitions");
  assert.throws(() => wf.inspect(""), /1 to 4096 UTF-8 bytes/);
  await assert.rejects(() => wf.validate(repo, s.workflowId, "npm", ["test"]), /No committed changes/);

  fs.writeFileSync(path.join(s.worktreePath, "untracked.txt"), "dirty\n", "utf8");
  await assert.rejects(() => wf.validate(repo, s.workflowId, "npm", ["test"]), /Commit the worktree changes/);
  git(s.worktreePath, ["add", "untracked.txt"]);
  git(s.worktreePath, ["commit", "-m", "Commit untracked"]);

  const failedRun = await wf.validate(repo, s.workflowId, "npm", ["test"]);
  assert.equal(failedRun.success, false);
  assert.throws(() => wf.review(repo, s.workflowId), /successful isolated validation/);

  // Pass validation, review, then mutate base checkout dirty & invalid confirm SHA
  const wfOk = new EosEngineeringWorkflow(() => ({
    async run() {
      return {
        success: true,
        status: "COMPLETED",
        exitCode: 0,
        timeoutMs: 1000,
        appliedChanges: false,
        changedFiles: [],
        conflicts: [],
        excludedPaths: [],
        receiptPath: null,
      };
    },
  }));
  await wfOk.validate(repo, s.workflowId, "npm", ["test"]);
  const rev = wfOk.review(repo, s.workflowId);
  assert.throws(() => wfOk.apply(repo, s.workflowId, "not-sha"), /64-character SHA-256/);

  fs.writeFileSync(path.join(repo, "dirty-host.txt"), "dirty\n", "utf8");
  assert.throws(() => wfOk.apply(repo, s.workflowId, rev.diffSha256), /base checkout must be clean/);
  fs.unlinkSync(path.join(repo, "dirty-host.txt"));

  assert.match(wfOk.close(repo, s.workflowId), /branch preserved/);
  assert.throws(() => wfOk.close(repo, s.workflowId), /already closed/);
  await assert.rejects(() => wfOk.validate(repo, s.workflowId, "npm", ["test"]), /workflow is closed/);
});
