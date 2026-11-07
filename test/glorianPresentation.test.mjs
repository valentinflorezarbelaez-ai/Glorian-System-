import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("index.html displays Glorian System in title and application metadata", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /<title>Glorian System/i);
  assert.match(html, /<meta name="application-name" content="Glorian System"/i);
  assert.match(html, /<meta property="og:title" content="Glorian System/i);
  assert.match(html, /archetype-hud-switcher/);
  assert.match(html, /GLORIAN_SOLAR/);
  assert.match(html, /130 SPECS/);
  assert.match(html, /138 SUITES/);
});

test("Schema.org JSON-LD declares Glorian System identity (external file for CSP)", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /application\/ld\+json/);
  const jsonld = fs.readFileSync("js/structured-data.jsonld", "utf8");
  const data = JSON.parse(jsonld);
  assert.equal(data.name, "Glorian System (formerly EOS System)");
  assert.equal(data["@type"], "SoftwareApplication");
});
