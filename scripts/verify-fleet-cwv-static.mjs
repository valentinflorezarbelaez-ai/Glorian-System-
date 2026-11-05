#!/usr/bin/env node
/**
 * Fleet static CWV / performance markup probe (WITHIN_TESTED_SCOPE).
 * Prefers production fetch; falls back to local index.html under fleet dirs.
 * Not a Lighthouse lab score — static evidence only.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8")
);

const EXCLUDE = new Set(["kegel-ham-sah", "donaciones"]);
const targets = registry.projects.filter(
  (p) => (p.productionUrl || p.resolvedLocalDir) && !EXCLUDE.has(p.id)
);

const signals = [
  { id: "viewport", re: /<meta[^>]+name=["']viewport["']/i },
  { id: "description", re: /<meta[^>]+name=["']description["']/i },
  { id: "defer_or_module", re: /<script[^>]+type=["']module["']|<script[^>]+defer/i },
  { id: "perf_hint", re: /fetchpriority=|content-visibility|speculationrules|preconnect|preload/i }
];

function resolveLocalHtml(project) {
  const envKey = project.localPathEnv;
  const fromEnv = envKey && process.env[envKey] ? process.env[envKey] : null;
  const candidates = [
    fromEnv,
    project.resolvedLocalDir ? path.join(path.dirname(root), project.resolvedLocalDir) : null,
    project.resolvedLocalDir ? path.join(root, "..", project.resolvedLocalDir) : null,
    project.id === "eos-system" ? root : null
  ].filter(Boolean);

  for (const base of candidates) {
    for (const rel of ["index.html", "src/app/layout.tsx", "src/app/page.tsx"]) {
      const p = path.join(base, rel);
      if (fs.existsSync(p)) return { base, file: p, html: fs.readFileSync(p, "utf8") };
    }
  }
  return null;
}

const results = [];
for (const p of targets) {
  const url = p.productionUrl ? p.productionUrl.replace(/\/$/, "") + "/" : null;
  let html = "";
  let source = "none";
  let error = null;

  if (url) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "GlorianFleetCwvStatic/1.0" },
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        html = await res.text();
        source = "remote";
      } else {
        error = `HTTP_${res.status}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  if (!html) {
    const local = resolveLocalHtml(p);
    if (local) {
      html = local.html;
      source = `local:${path.relative(root, local.file)}`;
      error = error ? `${error}; fell_back_local` : null;
    }
  }

  const found = Object.fromEntries(
    signals.map((s) => [s.id, html ? s.re.test(html) : false])
  );
  // TSX layouts often lack classic viewport meta in-file — accept next/viewport exports
  if (!found.viewport && /export\s+const\s+viewport|metadata\s*=/.test(html)) {
    found.viewport = true;
  }
  if (!found.description && /description:\s*["'`]|metadata\s*=/.test(html)) {
    found.description = true;
  }
  if (!found.defer_or_module && /from\s+["']next\//.test(html)) {
    found.defer_or_module = true;
  }
  const score = Object.values(found).filter(Boolean).length;
  results.push({
    id: p.id,
    url,
    source,
    error,
    score,
    max: signals.length,
    found
  });
}

const passing = results.filter((r) => r.source !== "none" && r.score >= 3);
console.log(
  JSON.stringify(
    {
      epistemic: "FLEET_CWV_STATIC_WITHIN_TESTED_SCOPE",
      probed: results.length,
      passing: passing.length,
      results
    },
    null,
    2
  )
);

assert.ok(
  passing.length >= Math.ceil(results.length * 0.7),
  `Expected ≥70% fleet targets with ≥3/4 CWV static signals; got ${passing.length}/${results.length}`
);
console.log(
  `[PASS] Fleet CWV static probe ${passing.length}/${results.length} (≥70% with score≥3)`
);
