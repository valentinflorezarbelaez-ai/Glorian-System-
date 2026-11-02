import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("index.html displays Glorian System in title and application metadata", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /<title>Glorian System/i);
  assert.match(html, /<meta name="application-name" content="Glorian System"/i);
  assert.match(html, /"name":\s*"Glorian System \(formerly EOS System\)"/i);
  assert.match(html, /<meta property="og:title" content="Glorian System/i);
});
