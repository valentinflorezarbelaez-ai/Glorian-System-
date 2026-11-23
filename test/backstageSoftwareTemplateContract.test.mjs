/**
 * Contract: Backstage Software Template golden path (BS-PR-T / GS-20).
 * Outside Layer-0 — asserts scaffold files exist and root deps stay empty.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateYaml = path.join(root, "templates/backstage/sovereign-component-template.yaml");
const skeleton = path.join(root, "templates/backstage/skeleton");

test("BDD-BS-T-001: Software Template YAML is registered and fetchable", () => {
  assert.ok(fs.existsSync(templateYaml), "sovereign-component-template.yaml must exist");
  const source = fs.readFileSync(templateYaml, "utf8");
  assert.match(source, /kind:\s*Template/);
  assert.match(source, /fetch:template/);
  assert.match(source, /url:\s*\.\/skeleton/);
  assert.match(source, /verify:strict/);

  const catalog = fs.readFileSync(path.join(root, "catalog-info.yaml"), "utf8");
  assert.match(
    catalog,
    /templates\/backstage\/sovereign-component-template\.yaml/,
    "root catalog Location must point at the template",
  );
});

test("BDD-BS-T-002: Skeleton scaffolds catalog-info, AGENTS, verify:strict, CI", () => {
  const required = [
    "catalog-info.yaml",
    "AGENTS.md",
    "package.json",
    "bin/verify.mjs",
    "test/smoke.test.mjs",
    "src/index.mjs",
    ".github/workflows/ci.yml",
    "mkdocs.yaml",
    "README.md",
  ];
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(skeleton, rel)), `missing skeleton file: ${rel}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(skeleton, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {}, "skeleton runtime dependencies must be {}");
  assert.equal(pkg.scripts?.["verify:strict"], "node bin/verify.mjs");

  const agents = fs.readFileSync(path.join(skeleton, "AGENTS.md"), "utf8");
  assert.match(agents, /verify:strict/);
  assert.match(agents, /\$\{\{\s*values\.componentId\s*\}\}/);

  const verify = fs.readFileSync(path.join(skeleton, "bin/verify.mjs"), "utf8");
  assert.match(verify, /dependencies/);
  assert.match(verify, /\.test\.mjs/);
  assert.match(verify, /readdirSync/, "must discover test/*.test.mjs (not hardcode one file)");

  const template = fs.readFileSync(templateYaml, "utf8");
  assert.match(template, /default:\s*javascript-layer0/, "default runtime must match JS skeleton");

  const ci = fs.readFileSync(path.join(skeleton, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /npm run verify:strict/);
});

test("BDD-BS-T-003: Control-plane Layer-0 stays zero runtime deps", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  const depBlob = JSON.stringify(pkg.dependencies ?? {});
  assert.doesNotMatch(depBlob, /@backstage\//);
});

test("BDD-BS-T-004: docs/backstage documents the Software Template path", () => {
  const readme = fs.readFileSync(path.join(root, "docs/backstage/README.md"), "utf8");
  assert.match(readme, /Software Templates/);
  assert.match(readme, /templates\/backstage/);
  assert.match(readme, /AGENTS\.md/);
  assert.match(readme, /verify:strict/);
});
