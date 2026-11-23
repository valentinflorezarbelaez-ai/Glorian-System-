/**
 * Contract tests for Goal-Driven Development (LIDR M7) harness.
 * Vague goals fail; good goals pass; protected-path rewrites are blocked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  DEFAULT_PROTECTED_PATHS,
  assertMutationAllowed,
  assertWithinCaps,
  evaluateMetric,
  extractGoalFenceFromPrBody,
  parseGoalDocument,
  summarizeValidation,
  validateGoalDocument,
} from "../src/core/eosGoalDrivenDevelopmentContract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GOOD_GOAL_JSON = `{
  "id": "GOAL-L0-DEPS",
  "title": "Layer-0 runtime dependency count stays at zero",
  "metric": { "name": "runtime_dependencies_count", "unit": "count" },
  "threshold": { "op": "eq", "value": 0 },
  "check": { "command": "node -e \\"const p=require('./package.json'); process.exit(Object.keys(p.dependencies||{}).length===0?0:1)\\"", "timeoutMs": 30000 },
  "caps": { "maxAttempts": 3, "maxCostUsd": 5 },
  "protectedPaths": ["test/**", ".github/workflows/**", "package.json", "scripts/validate-gdd-goal.mjs"],
  "doneWhen": "check exits 0 and runtime_dependencies_count eq 0"
}`;

const GOOD_GOAL_YAML = `
id: GOAL-VERIFY-STRICT
title: Canonical verify strict gate remains wired
metric:
  name: verify_strict_exit_code
  unit: exit_code
threshold:
  op: eq
  value: 0
check:
  command: node -e "const p=require('./package.json'); process.exit(p.scripts['verify:strict']==='node bin/eos.mjs verify'?0:1)"
  timeoutMs: 30000
caps:
  maxAttempts: 3
  maxCostUsd: 2.5
protectedPaths:
  - test/**
  - .github/workflows/**
  - package.json
doneWhen: package.json verify:strict maps to node bin/eos.mjs verify
`.trim();

test("BDD-GDD-01: good JSON goal passes fail-closed schema", () => {
  const result = validateGoalDocument(GOOD_GOAL_JSON);
  assert.equal(result.ok, true, summarizeValidation(result));
  assert.equal(result.goal.id, "GOAL-L0-DEPS");
  assert.equal(result.goal.metric.name, "runtime_dependencies_count");
  assert.equal(result.goal.threshold.op, "eq");
  assert.equal(result.goal.caps.maxAttempts, 3);
  assert.equal(result.receiptSha256.length, 64);
});

test("BDD-GDD-02: good YAML-subset goal passes", () => {
  const result = validateGoalDocument(GOOD_GOAL_YAML);
  assert.equal(result.ok, true, summarizeValidation(result));
  assert.equal(result.goal.id, "GOAL-VERIFY-STRICT");
  assert.ok(result.goal.protectedPaths.includes("test/**"));
});

test("BDD-GDD-03: vague prose goal fails closed", () => {
  const vague = JSON.stringify({
    title: "Make the system better somehow",
    description: "Agents should improve quality until it feels done.",
  });
  const result = validateGoalDocument(vague);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === "VAGUE_GOAL"));
  assert.equal(result.goal, null);
});

test("BDD-GDD-04: missing caps fails closed (unbounded loop anti-trap)", () => {
  const noCaps = JSON.parse(GOOD_GOAL_JSON);
  delete noCaps.caps;
  const result = validateGoalDocument(JSON.stringify(noCaps));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path === "caps" || i.path.startsWith("caps.")));
});

test("BDD-GDD-05: empty / unparseable documents fail", () => {
  assert.equal(validateGoalDocument("").ok, false);
  assert.equal(validateGoalDocument("   ").ok, false);
  assert.equal(validateGoalDocument("{not-json").ok, false);
});

test("BDD-GDD-06: metric evaluation respects threshold ops", () => {
  assert.equal(evaluateMetric(0, { op: "eq", value: 0 }).passed, true);
  assert.equal(evaluateMetric(1, { op: "eq", value: 0 }).passed, false);
  assert.equal(evaluateMetric(95, { op: "gte", value: 90 }).passed, true);
  assert.equal(evaluateMetric(89, { op: "gte", value: 90 }).passed, false);
  assert.equal(evaluateMetric(0.1, { op: "lte", value: 0.15 }).passed, true);
});

test("BDD-GDD-07: attempt and cost caps stop unbounded loops", () => {
  const caps = { maxAttempts: 3, maxCostUsd: 1.0 };
  assert.equal(assertWithinCaps({ attempt: 3, costUsdAccumulated: 0.5 }, caps).ok, true);
  const overAttempts = assertWithinCaps({ attempt: 4, costUsdAccumulated: 0.1 }, caps);
  assert.equal(overAttempts.ok, false);
  assert.ok(overAttempts.issues.some((i) => i.code === "ATTEMPT_CAP_EXCEEDED"));
  const overCost = assertWithinCaps({ attempt: 1, costUsdAccumulated: 1.5 }, caps);
  assert.equal(overCost.ok, false);
  assert.ok(overCost.issues.some((i) => i.code === "COST_CAP_EXCEEDED"));
});

test("BDD-GDD-08: rewriting tests/CI/check is blocked (builder ≠ verifier)", () => {
  const blocked = assertMutationAllowed(
    ["test/eosFoo.test.mjs", "src/core/eosFoo.ts"],
    ["test/**", ".github/workflows/**", "scripts/validate-gdd-goal.mjs"],
  );
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.blockedPaths.includes("test/eosFoo.test.mjs"));

  const ciBlocked = assertMutationAllowed(
    [".github/workflows/ci.yml"],
    ["test/**", ".github/workflows/**"],
  );
  assert.equal(ciBlocked.allowed, false);

  const allowed = assertMutationAllowed(
    ["src/core/eosFoo.ts", "docs/goals/example.json"],
    ["test/**", ".github/workflows/**", "scripts/validate-gdd-goal.mjs"],
  );
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.blockedPaths.length, 0);
});

test("BDD-GDD-09: PR body fence extraction prefers last real goal over TODO template", () => {
  const body = `
## Summary
Stuff

## Goal Contract
\`\`\`yaml
id: GOAL-TODO
title: Replace with a measurable outcome
metric:
  name: example_metric
  unit: count
threshold:
  op: eq
  value: 0
check:
  command: "<replace with a real measurable check command>"
  timeoutMs: 30000
caps:
  maxAttempts: 3
  maxCostUsd: 5
doneWhen: check exits 0 and example_metric eq 0
\`\`\`

\`\`\`yaml
id: GOAL-DEMO
title: Demo measurable goal
metric:
  name: demo_metric
  unit: count
threshold:
  op: eq
  value: 1
check:
  command: node -e "process.exit(Number(process.env.DEMO_OK||0)===1?0:1)"
  timeoutMs: 5000
caps:
  maxAttempts: 2
  maxCostUsd: 1
doneWhen: demo_metric eq 1
\`\`\`
`;
  const fence = extractGoalFenceFromPrBody(body);
  assert.ok(fence);
  assert.match(fence, /GOAL-DEMO/);
  assert.doesNotMatch(fence, /GOAL-TODO/);
  const result = validateGoalDocument(fence);
  assert.equal(result.ok, true, summarizeValidation(result));
});

test("BDD-GDD-10: docs/goals fixtures validate via CLI", () => {
  const goalsDir = path.join(root, "docs/goals");
  assert.ok(fs.existsSync(goalsDir), "docs/goals must exist");
  const script = path.join(root, "scripts/validate-gdd-goal.mjs");
  const run = spawnSync(process.execPath, [script, "--dir", "docs/goals"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /GDD_PASS/);
});

test("BDD-GDD-11: package.json declares goal:validate script", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(typeof pkg.scripts["goal:validate"], "string");
  assert.match(pkg.scripts["goal:validate"], /validate-gdd-goal\.mjs/);
});

test("BDD-GDD-12: parseGoalDocument distinguishes json vs yaml", () => {
  assert.equal(parseGoalDocument(GOOD_GOAL_JSON).format, "json");
  assert.equal(parseGoalDocument(GOOD_GOAL_YAML).format, "yaml");
});

test("BDD-GDD-13: unfilled PR template goal fails closed", () => {
  const templatePath = path.join(root, ".github/pull_request_template.md");
  const template = fs.readFileSync(templatePath, "utf8");
  const fence = extractGoalFenceFromPrBody(template);
  assert.ok(fence, "PR template must still contain a goal fence for authors to fill");
  const result = validateGoalDocument(fence);
  assert.equal(result.ok, false, "unfilled template must not validate as Done");
  assert.ok(
    result.issues.some((i) => i.code === "VAGUE_GOAL" || i.path === "id" || i.path === "check.command"),
    summarizeValidation(result),
  );
});

test("BDD-GDD-14: GOAL-TODO / example_metric / trivial exit(0) rejected", () => {
  const stub = {
    id: "GOAL-TODO",
    title: "Replace with a measurable outcome",
    metric: { name: "example_metric", unit: "count" },
    threshold: { op: "eq", value: 0 },
    check: { command: 'node -e "process.exit(0)"', timeoutMs: 30000 },
    caps: { maxAttempts: 3, maxCostUsd: 5 },
    doneWhen: "check exits 0 and example_metric eq 0",
  };
  const result = validateGoalDocument(JSON.stringify(stub));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.path === "id" && i.code === "VAGUE_GOAL"));
  assert.ok(result.issues.some((i) => i.path === "metric.name"));
  assert.ok(result.issues.some((i) => i.path === "check.command"));
});

test("BDD-GDD-15: shorthand string check applies denylist and length cap", () => {
  const base = JSON.parse(GOOD_GOAL_JSON);
  base.check = "sudo rm -rf /";
  const destructive = validateGoalDocument(JSON.stringify(base));
  assert.equal(destructive.ok, false);
  assert.ok(destructive.issues.some((i) => /destructive|blocked/i.test(i.message)));

  base.check = "x".repeat(600);
  const tooLong = validateGoalDocument(JSON.stringify(base));
  assert.equal(tooLong.ok, false);
  assert.ok(tooLong.issues.some((i) => /512/.test(i.message) || i.path === "check"));

  base.check = 'node -e "process.exit(0)"';
  const trivial = validateGoalDocument(JSON.stringify(base));
  assert.equal(trivial.ok, false);
  assert.ok(trivial.issues.some((i) => /trivial|always-green/i.test(i.message)));

  base.check = "npm run verify:strict";
  const ok = validateGoalDocument(JSON.stringify(base));
  assert.equal(ok.ok, true, summarizeValidation(ok));
});

test("BDD-GDD-16: angle-bracket placeholders rejected on check/doneWhen/metric even if id filled", () => {
  const stub = {
    id: "GOAL-REAL-FILLED",
    title: "A real filled title",
    metric: { name: "runtime_dependencies_count", unit: "count" },
    threshold: { op: "eq", value: 0 },
    check: { command: "<replace with a real measurable check command>", timeoutMs: 30000 },
    caps: { maxAttempts: 3, maxCostUsd: 5 },
    doneWhen: "check exits 0 and <metric> satisfies threshold",
  };
  const withCheck = validateGoalDocument(JSON.stringify(stub));
  assert.equal(withCheck.ok, false);
  assert.ok(withCheck.issues.some((i) => i.path === "check.command" && /placeholder/i.test(i.message)));
  assert.ok(withCheck.issues.some((i) => i.path === "doneWhen" && /placeholder/i.test(i.message)));

  stub.check = { command: "npm run verify:strict", timeoutMs: 30000 };
  stub.doneWhen = "check exits 0 and runtime_dependencies_count eq 0";
  stub.metric = { name: "<metric_name>", unit: "count" };
  const withMetric = validateGoalDocument(JSON.stringify(stub));
  assert.equal(withMetric.ok, false);
  assert.ok(withMetric.issues.some((i) => i.path === "metric.name"));
});

test("BDD-GDD-17: DEFAULT_PROTECTED_PATHS includes GDD types companion", () => {
  assert.ok(DEFAULT_PROTECTED_PATHS.includes("src/core/eosGoalDrivenDevelopmentContract.types.ts"));
  const verdict = assertMutationAllowed(
    ["src/core/eosGoalDrivenDevelopmentContract.types.ts"],
    DEFAULT_PROTECTED_PATHS,
  );
  assert.equal(verdict.allowed, false);
});

test("BDD-GDD-18: comparison operators pass; template tokens still fail", () => {
  const base = JSON.parse(GOOD_GOAL_JSON);

  base.check = {
    command: 'node -e "const n=Number(process.env.LATENCY_MS||0); process.exit(n < 200 ? 0 : 1)"',
    timeoutMs: 30000,
  };
  base.doneWhen = "latency_ms < 200";
  assert.equal(validateGoalDocument(JSON.stringify(base)).ok, true, "latency_ms < 200 must pass");

  base.check = {
    command: 'node -e "const x=Number(process.env.X||0); process.exit(x > 0 && x < 10 ? 0 : 1)"',
    timeoutMs: 30000,
  };
  base.doneWhen = "x > 0 && x < 10";
  assert.equal(validateGoalDocument(JSON.stringify(base)).ok, true, "x > 0 && x < 10 must pass");

  base.check = {
    command: "<replace with a real measurable check command>",
    timeoutMs: 30000,
  };
  base.doneWhen = "check exits 0 and <metric> satisfies threshold";
  const template = validateGoalDocument(JSON.stringify(base));
  assert.equal(template.ok, false);
  assert.ok(template.issues.some((i) => i.path === "check.command"));
  assert.ok(template.issues.some((i) => i.path === "doneWhen"));
});
