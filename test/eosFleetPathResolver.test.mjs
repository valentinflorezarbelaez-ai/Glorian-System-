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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-residue-"));
  const sibling = path.join(tmp, "portafolio");
  fs.mkdirSync(path.join(sibling, ".git"), { recursive: true });
  const previous = process.env.EOS_FLEET_PORTAFOLIO_PATH;
  process.env.EOS_FLEET_PORTAFOLIO_PATH = sibling;
  try {
    const resolved = resolveFleetProjectPath(process.cwd(), {
      id: "portafolio",
      localPathEnv: "EOS_FLEET_PORTAFOLIO_PATH",
      resolvedLocalDir: "portafolio",
    });
    assert.equal(resolved.status, "SKIPPED_SIBLING");
    assert.equal(resolved.path, null);
  } finally {
    if (previous === undefined) delete process.env.EOS_FLEET_PORTAFOLIO_PATH;
    else process.env.EOS_FLEET_PORTAFOLIO_PATH = previous;
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // ignore
    }
  }
});

test("BDD-FLEET-PATH-002: git checkout with package.json is AVAILABLE via ENV", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-ok-"));
  const sibling = path.join(tmp, "portafolio");
  fs.mkdirSync(path.join(sibling, ".git"), { recursive: true });
  fs.writeFileSync(path.join(sibling, "package.json"), "{}\n", "utf8");
  const previous = process.env.EOS_FLEET_PORTAFOLIO_PATH;
  process.env.EOS_FLEET_PORTAFOLIO_PATH = sibling;
  try {
    const resolved = resolveFleetProjectPath(process.cwd(), {
      id: "portafolio",
      localPathEnv: "EOS_FLEET_PORTAFOLIO_PATH",
      resolvedLocalDir: "portafolio",
    });
    assert.equal(resolved.status, "AVAILABLE");
    assert.equal(resolved.resolution, "ENV");
    assert.ok(resolved.path);
  } finally {
    if (previous === undefined) delete process.env.EOS_FLEET_PORTAFOLIO_PATH;
    else process.env.EOS_FLEET_PORTAFOLIO_PATH = previous;
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // ignore
    }
  }
});
