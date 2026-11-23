/**
 * Test Suite: EOS Nightly Deep Quality Gates (SPEC-177)
 *
 * Guards the scheduled deep-gate wiring. Mutation stays opt-in on the per-commit
 * pipeline. The flaky gate is fail-closed on the main Ubuntu Node 22 leg and
 * still runs on the nightly cadence for Node 24. This suite asserts both, plus
 * the P3-2 / PR-M env contract: nightly sets EOS_MUTATION / EOS_FLAKY (+ ENFORCE)
 * while PR / verify:strict paths must not force mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowRel = ".github/workflows/eos-nightly-deep-gates.yml";
const workflowPath = path.join(root, workflowRel);
const ritualRel = "docs/governance/NIGHTLY_MUTATION_FLAKY.md";

test("SPEC-177: The nightly workflow schedules both opt-in deep gates", () => {
  assert.ok(fs.existsSync(workflowPath), `${workflowRel} must exist`);
  const source = fs.readFileSync(workflowPath, "utf8");

  assert.match(source, /^\s*schedule:\s*$/m, "must declare a schedule trigger");
  assert.match(source, /^\s*-\s*cron:\s*".+"/m, "must declare a cron expression");
  assert.match(source, /workflow_dispatch:/, "must remain manually dispatchable");
  assert.match(source, /node scripts\/mutation-gate\.mjs/, "must run the mutation gate");
  assert.match(source, /node scripts\/flaky-gate\.mjs/, "must run the flaky gate");
});

test("SPEC-177 / P3-2: Nightly enables EOS_MUTATION / EOS_FLAKY fail-closed + receipts", () => {
  const source = fs.readFileSync(workflowPath, "utf8");

  assert.match(source, /EOS_MUTATION:\s*"1"/, "nightly must set EOS_MUTATION=1");
  assert.match(source, /EOS_MUTATION_ENFORCE:\s*"1"/, "nightly mutation must be fail-closed");
  assert.match(source, /EOS_FLAKY:\s*"1"/, "nightly must set EOS_FLAKY=1");
  assert.match(source, /EOS_FLAKY_ENFORCE:\s*"1"/, "nightly flaky must be fail-closed");
  assert.match(source, /name:\s*MUTATION_NIGHTLY/, "must upload MUTATION_NIGHTLY artifact");
  assert.match(source, /name:\s*FLAKY_NIGHTLY/, "must upload FLAKY_NIGHTLY artifact");
  assert.match(source, /MUTATION_NIGHTLY\.json/, "must seal mutation nightly receipt JSON");
  assert.match(source, /FLAKY_NIGHTLY\.json/, "must seal flaky nightly receipt JSON");
});

test("SPEC-177 / P3-2: PR path must not force EOS_MUTATION=1", () => {
  const strict = fs.readFileSync(path.join(root, ".github/workflows/eos-strict-gate.yml"), "utf8");
  const sovereign = fs.readFileSync(path.join(root, ".github/workflows/eos-sovereign-cicd.yml"), "utf8");

  assert.doesNotMatch(
    strict,
    /EOS_MUTATION:\s*["']?1["']?/,
    "eos-strict-gate (PR) must leave mutation SKIP",
  );
  // Sovereign may set flaky on main Ubuntu Node 22; mutation must stay unset on the matrix gate.
  assert.doesNotMatch(
    sovereign,
    /EOS_MUTATION:\s*["']?1["']?/,
    "sovereign CI must not force EOS_MUTATION=1 on PR/push matrix",
  );
});

test("SPEC-131: main Ubuntu Node 22 fails closed on the flaky budget", () => {
  const sovereign = fs.readFileSync(path.join(root, ".github/workflows/eos-sovereign-cicd.yml"), "utf8");
  assert.match(sovereign, /timeout-minutes:\s*35/, "the matrix job must budget time for three suite repeats");
  assert.match(
    sovereign,
    /EOS_FLAKY:\s*\$\{\{ github\.ref == 'refs\/heads\/main' && matrix\.os == 'ubuntu-latest' && matrix\.node == '22' && '1' \|\| '' \}\}/,
  );
  assert.match(
    sovereign,
    /EOS_FLAKY_ENFORCE:\s*\$\{\{ github\.ref == 'refs\/heads\/main' && matrix\.os == 'ubuntu-latest' && matrix\.node == '22' && '1' \|\| '' \}\}/,
  );
  assert.match(
    sovereign,
    /EOS_FLAKY_REPEATS:\s*\$\{\{ github\.ref == 'refs\/heads\/main' && matrix\.os == 'ubuntu-latest' && matrix\.node == '22' && '3' \|\| '' \}\}/,
  );
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

test("SPEC-177 / P3-2: Nightly mutation/flaky ritual doc is published", () => {
  const ritualPath = path.join(root, ritualRel);
  assert.ok(fs.existsSync(ritualPath), `${ritualRel} must exist`);
  const ritual = fs.readFileSync(ritualPath, "utf8");
  assert.match(ritual, /EOS_MUTATION/, "ritual must document EOS_MUTATION");
  assert.match(ritual, /EOS_FLAKY/, "ritual must document EOS_FLAKY");
  assert.match(ritual, /MUTATION_NIGHTLY/, "ritual must name MUTATION_NIGHTLY receipt");
  assert.match(ritual, /verify:strict/, "ritual must keep PR/strict path SKIP guidance");
  assert.match(ritual, /eos-nightly-deep-gates\.yml/, "ritual must point at the workflow");
});
