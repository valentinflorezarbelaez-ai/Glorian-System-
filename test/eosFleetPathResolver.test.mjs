/**
 * Fleet path resolver — reject empty git residue from failed CI checkouts.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveFleetProjectPath } from "../src/core/eosFleetPathResolver.ts";

test("BDD-FLEET-PATH-001: empty git init without package.json is SKIPPED_SIBLING", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-ws-"));
  const sibling = path.join(workspace, "ci-residue-only");
  fs.mkdirSync(path.join(sibling, ".git"), { recursive: true });
  const previousPath = process.env.EOS_FLEET_CI_RESIDUE_PATH;
  const previousRoot = process.env.EOS_WORKSPACE_ROOT;
  process.env.EOS_FLEET_CI_RESIDUE_PATH = sibling;
  process.env.EOS_WORKSPACE_ROOT = workspace;
  try {
    const resolved = resolveFleetProjectPath(path.join(workspace, "control-plane"), {
      id: "ci-residue-only",
      localPathEnv: "EOS_FLEET_CI_RESIDUE_PATH",
      resolvedLocalDir: "ci-residue-only",
    });
    assert.equal(resolved.status, "SKIPPED_SIBLING");
    assert.equal(resolved.path, null);
    assert.equal(resolved.resolution, "NONE");
  } finally {
    if (previousPath === undefined) delete process.env.EOS_FLEET_CI_RESIDUE_PATH;
    else process.env.EOS_FLEET_CI_RESIDUE_PATH = previousPath;
    if (previousRoot === undefined) delete process.env.EOS_WORKSPACE_ROOT;
    else process.env.EOS_WORKSPACE_ROOT = previousRoot;
    try {
      fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // ignore
    }
  }
});

test("BDD-FLEET-PATH-002: git checkout with package.json is AVAILABLE via ENV", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-ok-"));
  const sibling = path.join(workspace, "ci-ready-sibling");
  fs.mkdirSync(path.join(sibling, ".git"), { recursive: true });
  fs.writeFileSync(path.join(sibling, "package.json"), "{}\n", "utf8");
  const previousPath = process.env.EOS_FLEET_CI_READY_PATH;
  const previousRoot = process.env.EOS_WORKSPACE_ROOT;
  process.env.EOS_FLEET_CI_READY_PATH = sibling;
  process.env.EOS_WORKSPACE_ROOT = workspace;
  try {
    const resolved = resolveFleetProjectPath(path.join(workspace, "control-plane"), {
      id: "ci-ready-sibling",
      localPathEnv: "EOS_FLEET_CI_READY_PATH",
      resolvedLocalDir: "ci-ready-sibling",
    });
    assert.equal(resolved.status, "AVAILABLE");
    assert.equal(resolved.resolution, "ENV");
    assert.ok(resolved.path);
  } finally {
    if (previousPath === undefined) delete process.env.EOS_FLEET_CI_READY_PATH;
    else process.env.EOS_FLEET_CI_READY_PATH = previousPath;
    if (previousRoot === undefined) delete process.env.EOS_WORKSPACE_ROOT;
    else process.env.EOS_WORKSPACE_ROOT = previousRoot;
    try {
      fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // ignore
    }
  }
});
