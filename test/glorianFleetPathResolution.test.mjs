import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveFleetProjectPath } from "../scripts/lib/fleet-project-path.mjs";

test("resolveFleetProjectPath resolves current eos-system control plane", () => {
  const resolved = resolveFleetProjectPath({ id: "eos-system" }, process.cwd());
  assert.equal(resolved, path.resolve(process.cwd()));
});

test("resolveFleetProjectPath resolves registered sibling fleet repository", () => {
  // Hermetic: provision a throwaway checkout instead of depending on a sibling
  // repository being present on the developer machine.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-path-"));
  fs.mkdirSync(path.join(tmpDir, ".git"));
  const previous = process.env.EOS_FLEET_CRUD_SLACK_PATH;
  process.env.EOS_FLEET_CRUD_SLACK_PATH = tmpDir;
  try {
    const resolved = resolveFleetProjectPath(
      { id: "crud-slack", resolvedLocalDir: "Crud-slack", localPathEnv: "EOS_FLEET_CRUD_SLACK_PATH" },
      process.cwd(),
    );
    assert.ok(resolved, "Sibling repo should resolve");
    assert.ok(fs.existsSync(resolved), "Resolved path must exist on disk");
    assert.ok(fs.existsSync(path.join(resolved, ".git")), "Resolved path must contain .git repository");
  } finally {
    if (previous === undefined) {
      delete process.env.EOS_FLEET_CRUD_SLACK_PATH;
    } else {
      process.env.EOS_FLEET_CRUD_SLACK_PATH = previous;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
