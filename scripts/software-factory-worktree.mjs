#!/usr/bin/env node
/**
 * Optional LIDR software-factory worktree helper (agent skill path).
 * Zero npm dependencies. Fail-closed. Paths confined to <repo>/.worktrees/.
 *
 * Usage:
 *   node scripts/software-factory-worktree.mjs list
 *   node scripts/software-factory-worktree.mjs create --branch <name> [--base main] [--path <slug>]
 *   node scripts/software-factory-worktree.mjs remove --branch <name> [--force]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKTREES_ROOT = path.join(REPO_ROOT, ".worktrees");
const MAX_BRANCH_LEN = 120;

function fail(message, code = 1) {
  process.stderr.write(`[software-factory-worktree] FAIL: ${message}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write(`Usage:
  node scripts/software-factory-worktree.mjs list
  node scripts/software-factory-worktree.mjs create --branch <name> [--base main] [--path <slug>]
  node scripts/software-factory-worktree.mjs remove --branch <name> [--force]
`);
}

function cleanGitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_WORK_TREE;
  delete env.GIT_PREFIX;
  return env;
}

function git(args, opts = {}) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: cleanGitEnv(),
      ...opts,
    });
  } catch (err) {
    const stderr = err && err.stderr ? String(err.stderr).trim() : "";
    const stdout = err && err.stdout ? String(err.stdout).trim() : "";
    fail(stderr || stdout || err.message || "git command failed");
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--force") {
      out.force = true;
      continue;
    }
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        fail(`Missing value for --${key}`);
      }
      out[key] = value;
      i += 1;
      continue;
    }
    out._.push(token);
  }
  return out;
}

function sanitizeBranch(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    fail("Branch name is required");
  }
  const branch = raw.trim();
  if (branch.length > MAX_BRANCH_LEN) {
    fail(`Branch name exceeds ${MAX_BRANCH_LEN} characters`);
  }
  if (branch.startsWith("-") || branch.startsWith("/") || branch.endsWith("/")) {
    fail("Branch name must be a relative Git ref (no leading/trailing slash or dash)");
  }
  if (branch.includes("..") || branch.includes("\\") || branch.includes("\0")) {
    fail("Branch name contains forbidden sequences");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    fail("Branch name may only contain [A-Za-z0-9._/-]");
  }
  return branch;
}

function branchSlug(branch) {
  return branch.replace(/\//g, "-");
}

function assertUnderWorktrees(targetPath) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(WORKTREES_ROOT);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    fail(`Refusing path outside .worktrees/: ${resolved}`);
  }
  if (resolved === root) {
    fail("Refusing to operate on .worktrees root itself");
  }
  return resolved;
}

function resolveWorktreePath(branch, customSlug) {
  const slug = customSlug ? String(customSlug).trim() : branchSlug(branch);
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    fail("--path must be a single path segment under .worktrees/");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) {
    fail("--path may only contain [A-Za-z0-9._-]");
  }
  return assertUnderWorktrees(path.join(WORKTREES_ROOT, slug));
}

function cmdList() {
  const out = git(["worktree", "list", "--porcelain"]);
  process.stdout.write(out.endsWith("\n") ? out : `${out}\n`);
}

function cmdCreate(args) {
  const branch = sanitizeBranch(args.branch);
  const base = sanitizeBranch(args.base || "main");
  const target = resolveWorktreePath(branch, args.path);

  if (!fs.existsSync(WORKTREES_ROOT)) {
    fs.mkdirSync(WORKTREES_ROOT, { recursive: true });
  }
  if (fs.existsSync(target)) {
    fail(`Worktree destination already exists: ${target}`);
  }

  // Prefer creating a new branch from base; if branch exists, check it out in the worktree.
  const localBranches = git(["branch", "--list", branch]).trim();
  if (localBranches) {
    git(["worktree", "add", target, branch]);
  } else {
    git(["worktree", "add", "-b", branch, target, base]);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        action: "create",
        branch,
        base,
        path: target,
      },
      null,
      2,
    ) + "\n",
  );
}

function cmdRemove(args) {
  const branch = sanitizeBranch(args.branch);
  const target = resolveWorktreePath(branch, args.path);

  if (!fs.existsSync(target)) {
    fail(`Worktree path does not exist: ${target}`);
  }

  if (!args.force) {
    const status = git(["-C", target, "status", "--porcelain"]).trim();
    if (status) {
      fail("Worktree is dirty; pass --force to remove anyway");
    }
  }

  const removeArgs = ["worktree", "remove"];
  if (args.force) removeArgs.push("--force");
  removeArgs.push(target);
  git(removeArgs);
  git(["worktree", "prune"]);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        action: "remove",
        branch,
        path: target,
        force: Boolean(args.force),
      },
      null,
      2,
    ) + "\n",
  );
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    usage();
    process.exit(argv.length === 0 ? 1 : 0);
  }
  const args = parseArgs(argv);
  const command = args._[0];
  if (!command) {
    usage();
    fail("Missing command");
  }

  switch (command) {
    case "list":
      cmdList();
      break;
    case "create":
      if (!args.branch) fail("create requires --branch");
      cmdCreate(args);
      break;
    case "remove":
      if (!args.branch) fail("remove requires --branch");
      cmdRemove(args);
      break;
    default:
      usage();
      fail(`Unknown command: ${command}`);
  }
}

main();
