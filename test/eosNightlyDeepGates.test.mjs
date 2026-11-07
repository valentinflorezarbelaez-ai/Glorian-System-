/**
 * Test Suite: EOS Nightly Deep Quality Gates (SPEC-177)
 *
 * Guards the scheduled deep-gate wiring. The expensive gates (mutation, flaky)
 * are opt-in inside the per-commit pipeline, so they only protect the repository
 * if something actually runs them on a fixed cadence. This suite asserts the
 * nightly workflow keeps that promise — a schedule, the two deep gates, and a
 * write-capable refresh path reachable only by an explicit manual dispatch.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowRel = ".github/workflows/eos-nightly-deep-gates.yml";
const workflowPath = path.join(root, workflowRel);

test("SPEC-177: The nightly workflow schedules both opt-in deep gates", () => {
  assert.ok(fs.existsSync(workflowPath), `${workflowRel} must exist`);
  const source = fs.readFileSync(workflowPath, "utf8");

  assert.match(source, /^\s*schedule:\s*$/m, "must declare a schedule trigger");
  assert.match(source, /^\s*-\s*cron:\s*".+"/m, "must declare a cron expression");
  assert.match(source, /workflow_dispatch:/, "must remain manually dispatchable");
  assert.match(source, /node scripts\/mutation-gate\.mjs/, "must run the mutation gate");
  assert.match(source, /node scripts\/flaky-gate\.mjs/, "must run the flaky gate");
});

test("SPEC-177: The write-capable ratchet refresh is manual-dispatch only", () => {
  const source = fs.readFileSync(workflowPath, "utf8");

  // The scheduled path must stay read-only: the token that can push is scoped to
  // a job gated behind an explicit workflow_dispatch input.
  const refreshJob = source.slice(source.indexOf("ratchet-refresh:"));
  assert.ok(refreshJob.length > 0, "the ratchet-refresh job must exist");
  assert.match(refreshJob, /github\.event_name == 'workflow_dispatch'/, "refresh job must be gated by the event name");
  assert.match(refreshJob, /inputs\.update-ratchets/, "refresh job must be gated by the dispatch input");
  assert.match(refreshJob, /contents:\s*write/, "refresh job needs contents: write to push its branch");
});
