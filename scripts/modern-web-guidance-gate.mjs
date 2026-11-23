#!/usr/bin/env node
/**
 * Modern Web Guidance (MWG) Fail-Closed Gate
 *
 * Ensures Google Chrome Modern Web Guidance stays installed as an agent skill /
 * frontend tooling artifact outside Layer-0:
 *   - Skill tree present under .agents/skills/modern-web-guidance/
 *   - skills-lock.json pins GoogleChrome/modern-web-guidance
 *   - modern-web-guidance is NOT a package.json runtime or dev dependency
 *   - src/core/ never imports modern-web-guidance (Law V)
 *   - Skill registry lists the skill for agentic-engineer discoverability
 *
 * Usage:
 *   node scripts/modern-web-guidance-gate.mjs
 *   npm run mwg:gate
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];
const passes = [];

function fail(msg) {
  violations.push(msg);
}

function ok(msg) {
  passes.push(msg);
}

function readJson(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    fail(`Missing required file: ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    fail(`Invalid JSON in ${rel}: ${err.message}`);
    return null;
  }
}

function isDir(rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
}

function isFile(rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile();
}

function countGuideMarkdown(dirAbs) {
  let count = 0;
  if (!fs.existsSync(dirAbs)) return 0;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const full = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) count += countGuideMarkdown(full);
    else if (entry.isFile() && entry.name.endsWith(".md")) count += 1;
  }
  return count;
}

console.log("======================================================================");
console.log(" EOS MODERN WEB GUIDANCE GATE — Agent Skill + Layer-0 Isolation");
console.log("======================================================================");

// 1. Skill entrypoint
const skillRel = ".agents/skills/modern-web-guidance/SKILL.md";
if (isFile(skillRel)) {
  const skillBody = fs.readFileSync(path.join(root, skillRel), "utf8");
  if (!skillBody.includes("name: modern-web-guidance")) {
    fail(`${skillRel} missing frontmatter name: modern-web-guidance`);
  } else if (!/npx\s+(-y\s+)?modern-web-guidance@latest/.test(skillBody)) {
    fail(`${skillRel} must document npx modern-web-guidance@latest search/retrieve`);
  } else {
    ok(`Skill entrypoint present: ${skillRel}`);
  }
} else {
  fail(`Missing skill entrypoint: ${skillRel}`);
}

// 2. Guides corpus
const guidesRel = ".agents/skills/modern-web-guidance/guides";
if (isDir(guidesRel)) {
  const guideCount = countGuideMarkdown(path.join(root, guidesRel));
  if (guideCount < 50) {
    fail(`Expected >= 50 MWG guide markdown files under ${guidesRel}, found ${guideCount}`);
  } else {
    ok(`Guides corpus present (${guideCount} markdown files under ${guidesRel})`);
  }
} else {
  fail(`Missing guides directory: ${guidesRel}`);
}

// 3. skills-lock.json pin
const lock = readJson("skills-lock.json");
if (lock) {
  const entry = lock.skills && lock.skills["modern-web-guidance"];
  if (!entry) {
    fail("skills-lock.json missing skills.modern-web-guidance entry");
  } else {
    const before = violations.length;
    const sourceOk =
      entry.source === "GoogleChrome/modern-web-guidance" || entry.source === "googlechrome/modern-web-guidance";
    if (!sourceOk) {
      fail(`skills-lock.json source must be GoogleChrome/modern-web-guidance, found: ${entry.source}`);
    }
    if (!entry.commit || typeof entry.commit !== "string" || entry.commit.length < 7) {
      fail("skills-lock.json modern-web-guidance.commit must be a non-empty git SHA");
    }
    if (entry.skillPath !== "skills/modern-web-guidance/SKILL.md") {
      fail(`skills-lock.json skillPath mismatch: ${entry.skillPath}`);
    }
    if (violations.length === before) {
      ok(`skills-lock.json pins GoogleChrome/modern-web-guidance@${String(entry.commit).slice(0, 12)}`);
    }
  }
}

// 4. package.json must not depend on modern-web-guidance; runtime deps stay 0
const pkg = readJson("package.json");
if (pkg) {
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  if (runtimeDeps.length !== 0) {
    fail(`Law V: package.json dependencies must be empty, found: ${runtimeDeps.join(", ")}`);
  } else {
    ok("package.json runtime dependencies remain empty (Law V)");
  }
  const banned = ["modern-web-guidance", "@googlechrome/modern-web-guidance"];
  for (const name of banned) {
    if (runtimeDeps.includes(name) || devDeps.includes(name)) {
      fail(`${name} must not appear in package.json dependencies/devDependencies (use npx + .agents skill)`);
    }
  }
  if (!banned.some((n) => runtimeDeps.includes(n) || devDeps.includes(n))) {
    ok("modern-web-guidance is not a package.json dependency (npx / skill install only)");
  }
}

// 5. Layer-0 isolation: no MWG imports under src/core
const coreDir = path.join(root, "src", "core");
if (isDir("src/core")) {
  const coreFiles = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".mjs"));
  let coreHits = 0;
  for (const file of coreFiles) {
    const content = fs.readFileSync(path.join(coreDir, file), "utf8");
    if (/modern-web-guidance/i.test(content)) {
      fail(`src/core/${file} references modern-web-guidance (forbidden in Layer-0)`);
      coreHits += 1;
    }
  }
  if (coreHits === 0) {
    ok(`Layer-0 isolation: scanned ${coreFiles.length} src/core files — no MWG references`);
  }
} else {
  fail("Missing src/core directory");
}

// 6. Discoverability: skill registry + runbook
const registryRel = ".atl/skill-registry.md";
if (isFile(registryRel)) {
  const registry = fs.readFileSync(path.join(root, registryRel), "utf8");
  if (!registry.includes("`modern-web-guidance`") && !registry.includes("modern-web-guidance")) {
    fail(`${registryRel} must list modern-web-guidance for agentic-engineer discoverability`);
  } else {
    ok(`Skill registry lists modern-web-guidance (${registryRel})`);
  }
} else {
  fail(`Missing skill registry: ${registryRel}`);
}

const runbookRel = "docs/runbooks/modern-web-guidance.md";
if (isFile(runbookRel)) {
  const runbook = fs.readFileSync(path.join(root, runbookRel), "utf8");
  if (!/Layer-0|dependencies:\s*\{\}/i.test(runbook)) {
    fail(`${runbookRel} must document Layer-0 / dependencies:{} boundary`);
  } else if (!/npx\s+(-y\s+)?modern-web-guidance@latest/.test(runbook)) {
    fail(`${runbookRel} must document npx modern-web-guidance@latest usage`);
  } else {
    ok(`Runbook present: ${runbookRel}`);
  }
} else {
  fail(`Missing runbook: ${runbookRel}`);
}

console.log("");
for (const p of passes) console.log(`  [PASS] ${p}`);
console.log("");

if (violations.length === 0) {
  console.log(" PASS — Modern Web Guidance skill is discoverable and Layer-0 remains pure.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(` FAIL — ${violations.length} Modern Web Guidance gate violation(s):`);
for (const v of violations) console.error(`  [VIOLATION] ${v}`);
console.error("");
console.error("Keep MWG under .agents/skills + docs/tooling. Never add it to Layer-0 or package.json dependencies.");
console.error("Reinstall with: npx -y modern-web-guidance@latest install");
process.exit(1);
