import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const checks = [];

function check(name, assertion) {
  assertion();
  checks.push(name);
  console.log(`[PASS] ${name}`);
}

console.log("EOS landing and repository contract checks");

check("Repository documentation and package metadata exist", () => {
  for (const file of ["README.md", "docs/specs/spec.md", "package.json"]) {
    assert.ok(exists(file), `Missing ${file}`);
  }
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(pkg.type, "module");
  assert.ok(pkg.engines?.node, "Node.js runtime requirement must be declared");
});

check("PWA manifest references existing local assets", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.ok(manifest.name === "Glorian System" || manifest.name === "EOS System", "Manifest name must be Glorian System or EOS System");
  assert.ok(manifest.short_name === "Glorian" || manifest.short_name === "EOS System", "Manifest short_name must be Glorian or EOS System");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith("/"), `Expected a same-origin icon: ${icon.src}`);
    assert.ok(exists(icon.src.slice(1)), `Manifest icon does not exist: ${icon.src}`);
  }
});

const html = read("index.html");
const css = read("css/eos.css");
const js = read("js/eos.js");

check("HTML landmarks, metadata, and in-page links are coherent", () => {
  assert.match(html, /<html\b[^>]*\blang="es"/i, "Document language must be declared");
  assert.match(html, /<title>[^<]+<\/title>/i, "Page title is required");
  assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/i, "Page description is required");
  assert.match(html, /<nav\b[^>]*aria-label=/i, "Primary navigation needs an accessible name");
  assert.match(html, /<main\b[^>]*id="main-content"/i, "Main landmark and skip-link target are required");
  assert.match(html, /class="skip-link"\s+href="#main-content"/i, "Keyboard skip link is required");

  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const idSet = new Set(ids);
  assert.equal(idSet.size, ids.length, "HTML IDs must be unique");
  const fragmentLinks = [...html.matchAll(/\bhref="#([^"]+)"/g)].map((match) => match[1]);
  for (const fragment of fragmentLinks) {
    assert.ok(idSet.has(fragment), `Broken in-page link: #${fragment}`);
  }
});

check("Visible command controls map to registered local actions", () => {
  const commandKeys = new Set(
    [...js.matchAll(/^\s*"([^"\n]+)"\s*:/gm)].map((match) => match[1])
  );
  assert.ok(commandKeys.size > 0, "No command registry entries found in js/eos.js");
  const pageCommands = [...html.matchAll(/\bdata-cmd="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(pageCommands.length > 0, "Landing page does not expose any command controls");
  for (const command of pageCommands) {
    assert.ok(commandKeys.has(command), `UI command has no registered preview: ${command}`);
  }
  assert.match(html, /<dialog\b[^>]*id="eos-cmdk-dialog"/i, "Accessible command dialog is required");
  assert.match(js, /getElementById\("eos-cmdk-dialog"\)/, "Command dialog must be wired to the page script");
  assert.ok(exists("js/eos.js"));
});

check("Performance claims have corresponding implementation", () => {
  assert.match(css, /content-visibility:\s*auto/i);
  assert.match(css, /contain-intrinsic-size\s*:/i);
  assert.match(css, /touch-action:\s*manipulation/i);
  assert.match(html, /<script\s+type="speculationrules"/i);
  assert.match(html, /fetchpriority="high"/i);
});

check("Offline shell and deployment security configuration are present", () => {
  const sw = read("sw.js");
  assert.match(sw, /const STATIC_CACHE\s*=/);
  assert.match(sw, /const API_CACHE\s*=/);
  assert.match(sw, /OFFLINE_STANDALONE_MODE/);
  const precache = sw.match(/const PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(precache, "Service worker precache list is missing");
  for (const [, asset] of precache[1].matchAll(/"(\/[^"?]+)(?:\?[^\"]*)?"/g)) {
    const localPath = asset === "/" ? "index.html" : asset.slice(1);
    assert.ok(exists(localPath), `Precached asset does not exist: ${asset}`);
  }

  const vercel = JSON.parse(read("vercel.json"));
  const globalHeaders = vercel.headers?.find((entry) => entry.source === "/(.*)");
  assert.ok(globalHeaders, "Global response headers must be configured");
  const headerNames = new Set(globalHeaders.headers.map(({ key }) => key.toLowerCase()));
  for (const requiredHeader of ["content-security-policy", "x-content-type-options", "referrer-policy"]) {
    assert.ok(headerNames.has(requiredHeader), `Missing deployment header: ${requiredHeader}`);
  }
  assert.ok(exists("favicon.svg"));
});

console.log(`Landing contract checks passed: ${checks.length}/${checks.length}.`);
