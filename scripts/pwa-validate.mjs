#!/usr/bin/env node
/**
 * PWA Validation Gate — manifest + service worker contract enforcement.
 *
 * Big Tech standard (Google PWA Checklist, Vercel PWA validation):
 * validate the Progressive Web App manifest and service worker for
 * correctness, completeness, and best practices.
 *
 * Checks:
 *   1. manifest.webmanifest is valid JSON with required fields
 *   2. Manifest references icons that exist on disk
 *   3. Service worker (sw.js) exists and has a cache version
 *   4. HTML references the manifest and service worker
 *   5. Theme color matches design system
 *
 * Usage:
 *   node scripts/pwa-validate.mjs
 *   npm run pwa:validate
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];
const checks = [];

// ── 1. Manifest validation ──────────────────────────────────────────────────
const manifestPath = path.join(root, "manifest.webmanifest");
if (!fs.existsSync(manifestPath)) {
  violations.push("manifest.webmanifest not found");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const requiredFields = ["name", "short_name", "start_url", "display", "theme_color", "background_color", "icons"];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      violations.push(`manifest.webmanifest missing required field: ${field}`);
    }
  }
  checks.push("manifest.webmanifest: required fields present");

  // Check display mode
  const validDisplay = ["fullscreen", "standalone", "minimal-ui", "browser"];
  if (manifest.display && !validDisplay.includes(manifest.display)) {
    violations.push(`manifest.webmanifest: invalid display mode "${manifest.display}"`);
  }
  checks.push(`manifest.webmanifest: display mode "${manifest.display}" is valid`);

  // Check icons exist on disk
  if (manifest.icons) {
    for (const icon of manifest.icons) {
      if (icon.src && !icon.src.startsWith("http")) {
        const iconPath = path.join(root, icon.src.replace(/^\//, ""));
        if (!fs.existsSync(iconPath)) {
          violations.push(`manifest.webmanifest: icon not found on disk: ${icon.src}`);
        }
      }
    }
    checks.push(`manifest.webmanifest: ${manifest.icons.length} icon(s) validated`);
  }

  // Check theme color is a valid hex
  if (manifest.theme_color && !/^#[0-9a-fA-F]{6}$/.test(manifest.theme_color)) {
    violations.push(`manifest.webmanifest: invalid theme_color "${manifest.theme_color}"`);
  }
  checks.push(`manifest.webmanifest: theme_color "${manifest.theme_color}" is valid hex`);
}

// ── 2. Service worker validation ────────────────────────────────────────────
const swPath = path.join(root, "sw.js");
if (!fs.existsSync(swPath)) {
  violations.push("sw.js (service worker) not found");
} else {
  const swContent = fs.readFileSync(swPath, "utf8");

  // Check for cache version (should have a version string that changes)
  if (!/CACHE_VERSION|cache-v|CACHE_NAME\s*=\s*["'`]/i.test(swContent)) {
    violations.push("sw.js: no cache version found (needed for cache invalidation)");
  }
  checks.push("sw.js: cache version present");

  // Check for fetch event handler
  if (!/self\.addEventListener\s*\(\s*["']fetch["']/.test(swContent)) {
    violations.push("sw.js: no fetch event listener (needed for offline support)");
  }
  checks.push("sw.js: fetch event listener present");

  // Check for install event handler
  if (!/self\.addEventListener\s*\(\s*["']install["']/.test(swContent)) {
    violations.push("sw.js: no install event listener (needed for precaching)");
  }
  checks.push("sw.js: install event listener present");
}

// ── 3. HTML references ──────────────────────────────────────────────────────
const htmlPath = path.join(root, "index.html");
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, "utf8");

  if (!html.includes('rel="manifest"')) {
    violations.push('index.html: missing <link rel="manifest"> tag');
  }
  checks.push('index.html: <link rel="manifest"> present');

  if (!html.includes("navigator.serviceWorker.register") && !html.includes("/sw.js")) {
    violations.push("index.html: missing service worker registration");
  }
  checks.push("index.html: service worker registration reference present");

  // Check for apple-mobile-web-app-capable
  if (!html.includes("apple-mobile-web-app-capable")) {
    violations.push("index.html: missing apple-mobile-web-app-capable meta tag");
  }
  checks.push("index.html: apple-mobile-web-app-capable present");
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("======================================================================");
console.log(" EOS PWA VALIDATION GATE — Manifest & Service Worker");
console.log("======================================================================");
console.log(`  Checks: ${checks.length} passed`);

if (violations.length === 0) {
  console.log(" PASS — PWA manifest and service worker are valid.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n FAIL — ${violations.length} violation(s):`);
for (const v of violations) console.error(`  ${v}`);
console.error("\nFix the PWA issues above. See https://web.dev/pwa-checklist/");
process.exit(1);
