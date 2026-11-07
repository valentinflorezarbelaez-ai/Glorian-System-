import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/**
 * Computes deterministic W3C Subresource Integrity (SRI) SHA-384 string.
 */
function computeSri(filePath) {
  const content = fs.readFileSync(path.join(root, filePath), "utf8").replace(/\r\n/g, "\n");
  const digest = crypto.createHash("sha384").update(content, "utf8").digest("base64");
  return `sha384-${digest}`;
}

const cssSri = computeSri("css/eos.css");
const jsSri = computeSri("js/eos.js");

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// Auto-inject or update SRI attributes if requested or missing
const shouldFix = process.argv.includes("--fix");

// Tag matchers tolerate both single-line and Prettier-wrapped multi-line forms
// (\s+ spans newlines), so reformatting index.html never silently breaks --fix.
const CSS_TAG_RE =
  /<link\s+rel="stylesheet"\s+href="\/css\/eos\.css(?:\?[^"]*)?"(?:\s+integrity="[^"]*")?(?:\s+crossorigin="[^"]*")?\s*\/>/;
const JS_TAG_RE =
  /<script\s+src="\/js\/eos\.js(?:\?[^"]*)?"(?:\s+integrity="[^"]*")?(?:\s+crossorigin="[^"]*")?\s+defer\s*><\/script>/;

if (shouldFix) {
  assert.ok(CSS_TAG_RE.test(html), "SRI fix found no <link> stylesheet tag for /css/eos.css in index.html");
  html = html.replace(
    CSS_TAG_RE,
    `<link rel="stylesheet" href="/css/eos.css?v=15.0" integrity="${cssSri}" crossorigin="anonymous" />`,
  );
  assert.ok(JS_TAG_RE.test(html), "SRI fix found no deferred <script> tag for /js/eos.js in index.html");
  html = html.replace(
    JS_TAG_RE,
    `<script src="/js/eos.js?v=18.0" integrity="${jsSri}" crossorigin="anonymous" defer></script>`,
  );
  fs.writeFileSync(path.join(root, "index.html"), html, "utf8");
  console.log(`[SRI FIX] Injected CSS SRI: ${cssSri.slice(0, 24)}...`);
  console.log(`[SRI FIX] Injected JS SRI : ${jsSri.slice(0, 24)}...`);
}

// Invariant verification
assert.ok(html.includes(cssSri), `index.html missing matching CSS SRI hash: expected ${cssSri}`);
assert.ok(html.includes(jsSri), `index.html missing matching JS SRI hash: expected ${jsSri}`);

console.log("[PASS] Subresource Integrity (SRI) SHA-384 verified for CSS & JS bundles.");
