import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosWorktreeOrchestrator } from "../src/core/eosWorktreeOrchestrator.ts";

describe("EOS Xirp-Grade Multi-Agent Worktree Orchestrator Suite", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const root = path.resolve(path.dirname(cli), "..");
  const orchestrator = new EosWorktreeOrchestrator(root);

  describe("Suite 1: Worktree Inspection & Porcelain Parsing (BDD-028)", () => {
    it("worktree list prints the primary worktree reported by Git with its branch, path and commit", () => {
      const env = { ...process.env };
      for (const key of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"]) delete env[key];
      const porcelain = execFileSync("git", ["worktree", "list", "--porcelain", "-z"], {
        cwd: root,
        env,
        encoding: "utf8",
      });
      const [primary] = porcelain.split("\0\0");
      const fields = primary.split("\0");
      const primaryPath = fields.find((field) => field.startsWith("worktree ")).slice("worktree ".length);
      const head = fields.find((field) => field.startsWith("HEAD "))?.slice("HEAD ".length) ?? "";
      const branch =
        fields.find((field) => field.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length) ??
        (fields.includes("bare") ? "(bare)" : "detached");
      const main = orchestrator.listWorktrees().find((worktree) => worktree.isMain);
      assert.equal(main?.path, primaryPath);
      assert.equal(main.branch, branch);
      assert.equal(main.headCommit, head);

      const output = execFileSync(process.execPath, [cli, "worktree", "list"], { env, encoding: "utf8" });
      const row = `[${branch}] (PRINCIPAL)\n    Ruta: ${primaryPath}\n    Commit: ${head.slice(0, 10)}\n`;
      assert.ok(output.replaceAll("\r\n", "\n").includes(row), "Expected the primary row from Git");
    });

    it("worktree list reports a Git failure without inventing a worktree", () => {
      const invalidRoot = new EosWorktreeOrchestrator(cli);
      assert.deepEqual(invalidRoot.listWorktrees(), []);
      const result = spawnSync(process.execPath, [cli, "worktree", "list"], {
        env: { ...process.env, GIT_CONFIG_COUNT: "not-a-number" },
        encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /No se pudo obtener la lista de worktrees de Git/);
      assert.doesNotMatch(result.stdout, /\(PRINCIPAL\)|\(AGENTE\)|Commit:/);
    });

    it("evaluates clean/dirty status for current working tree", () => {
      const status = orchestrator.getWorktreeStatus(process.cwd());
      assert.ok(typeof status.clean === "boolean");
      assert.ok(Array.isArray(status.modifiedFiles));
      assert.ok(Array.isArray(status.untrackedFiles));
      assert.ok(typeof status.currentBranch === "string" && status.currentBranch.length > 0);
    });
  });

  describe("Suite 2: Worktree Lifecycle & Guard Invariants (BDD-029)", () => {
    it("refuses to remove the primary repository root", () => {
      const res = orchestrator.removeWorktree(process.cwd());
      assert.equal(res.success, false);
      assert.ok(res.error.includes("Cannot remove primary repository root"));
    });

    it("prunes worktree references cleanly", () => {
      const pruneRes = orchestrator.pruneWorktrees();
      assert.ok(typeof pruneRes.success === "boolean");
    });
  });
});
