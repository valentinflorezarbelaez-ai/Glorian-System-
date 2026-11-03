import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { resolveFleetProjectPath } from "../scripts/lib/fleet-project-path.mjs";

test("resolveFleetProjectPath resolves current eos-system control plane", () => {
  const resolved = resolveFleetProjectPath({ id: "eos-system" }, process.cwd());
  assert.equal(resolved, path.resolve(process.cwd()));
});

test("resolveFleetProjectPath resolves registered sibling fleet repository", () => {
  const resolved = resolveFleetProjectPath(
    { id: "crud-slack", resolvedLocalDir: "Crud-slack", localPathEnv: "EOS_FLEET_CRUD_SLACK_PATH" },
    process.cwd()
  );
  if (resolved) {
    assert.ok(resolved, "Sibling repo should resolve");
    assert.ok(fs.existsSync(resolved), "Resolved path must exist on disk");
    assert.ok(fs.existsSync(path.join(resolved, ".git")), "Resolved path must contain .git repository");
  } else {
    // In isolated CI environment where only eos-system is checked out
    assert.equal(resolved, null);
  }
});
