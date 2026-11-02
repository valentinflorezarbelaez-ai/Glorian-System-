import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("eosStudioConsole.html title and header display GLORIAN SYSTEM", () => {
  const html = fs.readFileSync("src/ui/eosStudioConsole.html", "utf8");
  assert.match(html, /<title>Glorian System — Sovereign Studio Console<\/title>/i);
  assert.match(html, /<h1>GLORIAN SYSTEM \/\/ MATRIX/i);
});
