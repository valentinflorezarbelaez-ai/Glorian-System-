import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosDatalogVerifier } from "../src/core/eosDatalogVerifier.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(root, "test");

test("Predictive test selection maps every direct test importer of a core module", () => {
  const modulePath = "src/core/eosZeroCopyScanner.ts";
  const expected = fs
    .readdirSync(testDir)
    .filter((file) => file.endsWith(".test.mjs"))
    .filter((file) => {
      const source = fs.readFileSync(path.join(testDir, file), "utf8");
      return Array.from(source.matchAll(/from\s+["']([^"']+)["']/g)).some(([, specifier]) =>
        specifier.replace(/\\/g, "/").endsWith("/src/core/eosZeroCopyScanner.ts"),
      );
    })
    .map((file) => `test/${file}`);

  assert.ok(expected.length > 0, "fixture precondition: at least one suite imports the scanner");

  const blast = new EosDatalogVerifier().queryBlastRadius(modulePath);
  for (const suite of expected) {
    assert.ok(
      blast.predictiveTestSuites.includes(suite),
      `PTS must select ${suite} for a direct import of ${modulePath}`,
    );
  }
});

test("GitHub Actions workflows pin third-party actions to full commit SHAs", () => {
  const workflowDir = path.join(root, ".github", "workflows");
  const files = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, "expected at least one workflow definition");

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(workflowDir, file), "utf8");
    for (const match of source.matchAll(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)["']?/gm)) {
      const ref = match[1];
      if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
      if (!/@[0-9a-f]{40}$/.test(ref)) violations.push(`${file}: ${ref}`);
    }
  }

  assert.deepEqual(violations, [], `every remote action must be pinned to a 40-hex SHA: ${violations.join(", ")}`);
});

test("GitHub Actions workflows enforce least-privilege and credential hygiene", () => {
  const workflowDir = path.join(root, ".github", "workflows");
  const files = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, "expected at least one workflow definition");

  const missingPermissions = [];
  const persistedCredentials = [];
  const dangerousTriggers = [];
  const unpinnedInstalls = [];

  for (const file of files) {
    const source = fs.readFileSync(path.join(workflowDir, file), "utf8");

    // Every workflow must declare an explicit top-level least-privilege permission set.
    if (!/^permissions:\s*$/m.test(source)) missingPermissions.push(file);

    // pull_request_target is the documented trigger for actions/labeler,
    // actions/first-interaction and dependabot/fetch-metadata. It is safe as
    // long as the workflow never checks out the untrusted PR head (a "pwn
    // request"). Flag only that dangerous combination, not the trigger itself.
    if (/^\s*pull_request_target:/m.test(source)) {
      const checksOutUntrustedHead =
        /ref:\s*.*github\.event\.pull_request\.head/.test(source) || /ref:\s*.*refs\/pull\//.test(source);
      if (checksOutUntrustedHead) dangerousTriggers.push(file);
    }

    // Lockfile-integrity installs only: a non-global `npm install` resolves
    // dependencies non-deterministically and must be `npm ci`. Global CLI tool
    // installs pinned to an exact version (`npm install -g pkg@1.2.3`) are a
    // different concern and stay allowed.
    const hasNonGlobalInstall = source
      .split("\n")
      .some((line) => /npm\s+install\b/.test(line) && !/\s(?:-g|--global)\b/.test(line));
    if (hasNonGlobalInstall && !/npm\s+ci\b/.test(source)) unpinnedInstalls.push(file);

    // Each actions/checkout step must drop the persisted GITHUB_TOKEN.
    for (const step of source.split(/\n(?=\s*-\s+name:)/)) {
      if (/uses:\s*actions\/checkout@/.test(step) && !/persist-credentials:\s*false/.test(step)) {
        persistedCredentials.push(file);
      }
    }
  }

  assert.deepEqual(
    missingPermissions,
    [],
    `every workflow must declare top-level permissions: ${missingPermissions.join(", ")}`,
  );
  assert.deepEqual(
    dangerousTriggers,
    [],
    `workflows must not combine pull_request_target with a checkout of the untrusted PR head: ${dangerousTriggers.join(", ")}`,
  );
  assert.deepEqual(
    unpinnedInstalls,
    [],
    `workflows must install with npm ci, not npm install: ${unpinnedInstalls.join(", ")}`,
  );
  assert.deepEqual(
    persistedCredentials,
    [],
    `actions/checkout must set persist-credentials: false: ${persistedCredentials.join(", ")}`,
  );
});

test("Repository exposes the required community health and governance files", () => {
  // GitHub community-health surface plus the legal file the README links to.
  const required = [
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    ".github/CODEOWNERS",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
  ];
  const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
  assert.deepEqual(missing, [], `missing community health files: ${missing.join(", ")}`);
});

test("GitHub Actions workflows bound every job with a timeout", () => {
  const workflowDir = path.join(root, ".github", "workflows");
  const files = fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, "expected at least one workflow definition");

  // A job without timeout-minutes can hang a runner indefinitely.
  const unbounded = files.filter(
    (file) => !/timeout-minutes:\s*\d+/.test(fs.readFileSync(path.join(workflowDir, file), "utf8")),
  );
  assert.deepEqual(unbounded, [], `every workflow must declare a job timeout-minutes: ${unbounded.join(", ")}`);
});
