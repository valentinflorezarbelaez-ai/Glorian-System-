/**
 * CI policy as code: workflow hardening invariants and supported-runtime parity.
 * Complements verify-supply-chain (runtime imports) and the code-hygiene ratchet
 * (unpinned actions budget) with per-workflow structural guarantees.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(root, ".github", "workflows");
const workflows = fs
  .readdirSync(workflowDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const minimumNodeMajor = Number.parseInt(
  String(pkg.engines?.node ?? "").match(/>=\s*(\d+)/)?.[1] ?? "0",
  10
);

function readWorkflow(file) {
  return fs.readFileSync(path.join(workflowDir, file), "utf8");
}

test("CI-POL-01: every workflow declares least-privilege permissions", () => {
  assert.ok(workflows.length > 0, "No workflow files found");

  for (const file of workflows) {
    const text = readWorkflow(file);
    assert.match(text, /^permissions:/m, `${file} must declare top-level permissions`);
    assert.doesNotMatch(text, /permissions:\s*write-all/, `${file} must not grant write-all`);
  }
});

test("CI-POL-02: workflows never use pull_request_target and pin every remote action", () => {
  let totalRemoteActions = 0;

  for (const file of workflows) {
    const text = readWorkflow(file);
    assert.doesNotMatch(text, /^\s*pull_request_target:/m, `${file} must not use pull_request_target`);

    const uses = [...text.matchAll(/^\s*uses:\s*(\S+)(?:\s*#.*)?$/gm)].map((match) => match[1]);
    for (const ref of uses) {
      if (ref.startsWith("./")) continue;
      totalRemoteActions += 1;
      assert.match(
        ref,
        /@[0-9a-f]{40}$/,
        `${file} action '${ref}' must be pinned to a 40-character commit SHA`
      );
    }
  }

  assert.ok(totalRemoteActions > 0, "no remote action references were found to verify");
});

test("CI-POL-03: checkout steps never persist credentials", () => {
  for (const file of workflows) {
    const text = readWorkflow(file);
    const checkouts = (text.match(/uses:\s*actions\/checkout@/g) ?? []).length;
    const hardened = (text.match(/persist-credentials:\s*false/g) ?? []).length;
    assert.ok(
      hardened >= checkouts,
      `${file} has ${checkouts} checkout steps but only ${hardened} persist-credentials: false`
    );
  }
});

test("CI-POL-04: every job has a timeout and automated triggers declare concurrency", () => {
  for (const file of workflows) {
    const text = readWorkflow(file);
    const jobs = (text.match(/^\s*runs-on:/gm) ?? []).length;
    const timeouts = (text.match(/^\s*timeout-minutes:/gm) ?? []).length;
    assert.ok(jobs > 0, `${file} must define at least one job`);
    assert.ok(timeouts >= jobs, `${file} has ${jobs} jobs but only ${timeouts} timeout-minutes`);

    if (/^\s{2}(push|pull_request):/m.test(text)) {
      assert.match(text, /^concurrency:/m, `${file} must declare concurrency for push/pull_request runs`);
    }
  }
});

test("CI-POL-05: CI runs the minimum supported Node major and never an older one", () => {
  assert.ok(minimumNodeMajor > 0, "package.json engines.node must declare a minimum major");

  const declared = new Set();
  for (const file of workflows) {
    const text = readWorkflow(file);
    for (const match of text.matchAll(/node-version:\s*\[([^\]]+)\]/g)) {
      for (const version of match[1].split(",")) {
        declared.add(Number.parseInt(version.replace(/["'\s]/g, ""), 10));
      }
    }
    for (const match of text.matchAll(/node-version:\s*["']?(\d+)(?:\.\d+)*["']?/g)) {
      declared.add(Number.parseInt(match[1], 10));
    }
  }

  for (const major of declared) {
    assert.ok(
      major >= minimumNodeMajor,
      `workflow uses Node ${major}, below the supported minimum ${minimumNodeMajor}`
    );
  }
  assert.ok(
    declared.has(minimumNodeMajor),
    `no CI job runs the minimum supported Node major (${minimumNodeMajor})`
  );
});
