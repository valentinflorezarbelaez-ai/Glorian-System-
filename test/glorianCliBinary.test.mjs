import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("package.json exposes both glorian and eos binary entries", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.bin.glorian, "./bin/eos.mjs");
  assert.equal(pkg.bin.eos, "./bin/eos.mjs");
});
