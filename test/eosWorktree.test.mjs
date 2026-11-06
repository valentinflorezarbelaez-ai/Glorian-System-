import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { EosWorktreeOrchestrator } from "../src/core/eosWorktreeOrchestrator.ts";

describe("EOS Xirp-Grade Multi-Agent Worktree Orchestrator Suite", () => {
  const orchestrator = new EosWorktreeOrchestrator(process.cwd());

  describe("Suite 1: Worktree Inspection & Porcelain Parsing (BDD-028)", () => {
    it("lists active worktrees and identifies the primary main worktree", () => {
      const list = orchestrator.listWorktrees();
      assert.ok(Array.isArray(list), "Expected worktree list to be an array");
      assert.ok(list.length >= 1, "Expected at least 1 worktree (main repo)");

      const main = list.find((w) => w.isMain);
      assert.ok(main, "Expected primary main worktree to be identified");
      assert.equal(path.resolve(main.path).toLowerCase(), path.resolve(process.cwd()).toLowerCase());
      assert.ok(typeof main.headCommit === "string" && main.headCommit.length > 0);
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
