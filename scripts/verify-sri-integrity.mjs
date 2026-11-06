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
const jsSri  = computeSri("js/eos.js");

// WASM SRI (optional — Go must be compiled first)
const wasmPath = path.join(root, "assets/eos_apex.wasm");
let wasmSriNote = "WASM not present (run npm run build:apex to compile)";
if (fs.existsSync(wasmPath)) {
  const wasmBytes  = fs.readFileSync(wasmPath);
  const wasmDigest = crypto.createHash("sha384").update(wasmBytes).digest("base64");
  const wasmSri    = `sha384-${wasmDigest}`;
  wasmSriNote = `${wasmSri.slice(0, 32)}...`;
  console.log(`[INFO] WASM SRI computed: ${wasmSriNote}`);
}

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// Auto-inject or update SRI attributes if requested or missing
const shouldFix = process.argv.includes("--fix");

if (shouldFix) {
  html = html.replace(
    /<link rel="stylesheet" href="\/css\/eos\.css[^"]*"( integrity="[^"]*")?( crossorigin="[^"]*")? \/>/,
    `<link rel="stylesheet" href="/css/eos.css?v=15.0" integrity="${cssSri}" crossorigin="anonymous" />`
  );
  html = html.replace(
    /<script src="(\/js\/eos\.js(?:\?[^\"]*)?)"(?: integrity="[^\"]*")?(?: crossorigin="[^\"]*")? defer><\/script>/,
    (_match, scriptUrl) => '<script src="' + scriptUrl + '" integrity="' + jsSri + '" crossorigin="anonymous" defer></script>'
  );
  fs.writeFileSync(path.join(root, "index.html"), html, "utf8");
  console.log(`[SRI FIX] Injected CSS SRI: ${cssSri.slice(0, 24)}...`);
  console.log(`[SRI FIX] Injected JS SRI : ${jsSri.slice(0, 24)}...`);
}

// Invariant verification
assert.ok(html.includes(cssSri), `index.html missing matching CSS SRI hash: expected ${cssSri}`);
assert.ok(html.includes(jsSri), `index.html missing matching JS SRI hash: expected ${jsSri}`);

console.log("[PASS] Subresource Integrity (SRI) SHA-384 verified for CSS & JS bundles.");
console.log(`[INFO] WASM SRI status: ${wasmSriNote}`);
