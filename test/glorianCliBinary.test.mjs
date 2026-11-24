import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("package.json exposes both glorian and eos binary entries", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.bin.glorian, "./bin/eos.mjs");
  assert.equal(pkg.bin.eos, "./bin/eos.mjs");
});

test("health prints the CLI banner before the status report", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [cli, "health"], { encoding: "utf8" });
  assert.match(output, /GLORIAN SYSTEM[\s\S]*\[STATUS\]/);
});
