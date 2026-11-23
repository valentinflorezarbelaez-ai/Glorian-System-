/**
 * Contract tests — fleet posture CONTROL_PLANE_ONLY vs FLEET_VERIFIED (P1-2 / PR-G).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateFleetPosture, fleetPostureReceiptFields } from "../src/core/eosFleetPathResolver.ts";
import { EosFleetDogfoodingEngine } from "../src/core/eosFleetDogfoodingEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function makeSiblingCheckout(rootDir, name) {
  const dir = path.join(rootDir, name);
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name }, null, 2)}\n`, "utf8");
  return dir;
}

test("BDD-PR-G-001: GIVEN unset EOS_FLEET_*_PATH WHEN posture evaluated THEN CONTROL_PLANE_ONLY and fleetLiveAudit false", () => {
  const projects = [
    { id: "eos-system", localPathEnv: "EOS_FLEET_EOS_SYSTEM_PATH" },
    { id: "crud-slack", localPathEnv: "EOS_FLEET_CRUD_SLACK_PATH", resolvedLocalDir: "Crud-slack" },
  ];
  const env = { ...process.env };
  delete env.EOS_FLEET_EOS_SYSTEM_PATH;
  delete env.EOS_FLEET_CRUD_SLACK_PATH;

  const snapshot = evaluateFleetPosture(projectRoot, projects, env);
  assert.equal(snapshot.posture, "CONTROL_PLANE_ONLY");
  assert.equal(snapshot.fleetLiveAudit, false);
  assert.ok(snapshot.envPathsUnset.includes("EOS_FLEET_CRUD_SLACK_PATH"));
  assert.ok(snapshot.envPathsUnset.includes("EOS_FLEET_EOS_SYSTEM_PATH"));

  const fields = fleetPostureReceiptFields(snapshot);
  assert.equal(fields.posture, "CONTROL_PLANE_ONLY");
  assert.equal(fields.fleetLiveAudit, false);
  assert.ok(fields.envPathsUnsetCount >= 1);
});

test("BDD-PR-G-002: GIVEN mounted paths + set envs WHEN posture evaluated THEN FLEET_VERIFIED and fleetLiveAudit true", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-fleet-posture-"));
  try {
    const sibling = makeSiblingCheckout(tmp, "Crud-slack");
    const projects = [
      { id: "eos-system", localPathEnv: "EOS_FLEET_EOS_SYSTEM_PATH" },
      { id: "crud-slack", localPathEnv: "EOS_FLEET_CRUD_SLACK_PATH", resolvedLocalDir: "Crud-slack" },
    ];
    const env = {
      ...process.env,
      EOS_FLEET_EOS_SYSTEM_PATH: projectRoot,
      EOS_FLEET_CRUD_SLACK_PATH: sibling,
    };

    const snapshot = evaluateFleetPosture(projectRoot, projects, env);
    assert.equal(snapshot.posture, "FLEET_VERIFIED");
    assert.equal(snapshot.fleetLiveAudit, true);
    assert.equal(snapshot.envPathsUnset.length, 0);
    assert.equal(snapshot.siblingsSkipped, 0);
    assert.equal(snapshot.siblingsAvailable, 1);

    const fields = fleetPostureReceiptFields(snapshot);
    assert.equal(fields.posture, "FLEET_VERIFIED");
    assert.equal(fields.fleetLiveAudit, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("BDD-PR-G-003: GIVEN cloud-like unset paths WHEN fleet:audit runs THEN receipt is CONTROL_PLANE_ONLY never FLEET_VERIFIED", () => {
  const previous = {};
  const keys = Object.keys(process.env).filter((k) => /^EOS_FLEET_[A-Z0-9_]+_PATH$/.test(k));
  for (const key of keys) {
    previous[key] = process.env[key];
    delete process.env[key];
  }

  try {
    const engine = new EosFleetDogfoodingEngine(projectRoot);
    const summary = engine.auditEntireFleet();
    assert.equal(summary.posture, "CONTROL_PLANE_ONLY");
    assert.equal(summary.fleetLiveAudit, false);
    assert.equal(summary.epistemicState, "CONTROL_PLANE_ONLY");
    assert.notEqual(summary.posture, "FLEET_VERIFIED");
    assert.ok(summary.postureReceipt);
    assert.equal(summary.postureReceipt.fleetLiveAudit, false);

    for (const project of summary.auditedProjects) {
      assert.notEqual(
        project.epistemicState,
        "PRODUCTION_READY_WITHIN_TESTED_SCOPE",
        `${project.projectId} must not claim live PRODUCTION_READY without FLEET_VERIFIED`,
      );
    }
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("BDD-PR-G-004: Cursor environment posture doc exists and names both modes", () => {
  const docPath = path.join(projectRoot, "docs", "governance", "CURSOR_ENVIRONMENT_FLEET_POSTURE.md");
  assert.ok(fs.existsSync(docPath), "CURSOR_ENVIRONMENT_FLEET_POSTURE.md must exist");
  const body = fs.readFileSync(docPath, "utf8");
  assert.ok(body.includes("CONTROL_PLANE_ONLY"));
  assert.ok(body.includes("FLEET_VERIFIED"));
  assert.ok(body.includes("EOS_FLEET_"));
  assert.ok(body.includes("fleetLiveAudit"));
});
