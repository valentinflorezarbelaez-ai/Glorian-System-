/**
 * Hermetic unit coverage for scripts/modern-web-guidance-gate.mjs
 * (presence + Layer-0 isolation invariants used by verify:strict Stage 3.05).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gateScript = path.join(root, "scripts/modern-web-guidance-gate.mjs");

describe("modern-web-guidance-gate", () => {
  it("exits 0 when MWG skill, lock, registry, and runbook are present", () => {
    assert.ok(fs.existsSync(gateScript), "gate script must exist");
    const out = execFileSync(process.execPath, [gateScript], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(out, /PASS — Modern Web Guidance skill is discoverable/);
  });

  it("keeps MWG out of package.json dependencies", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const runtime = Object.keys(pkg.dependencies || {});
    const dev = Object.keys(pkg.devDependencies || {});
    assert.equal(runtime.length, 0);
    assert.ok(!runtime.includes("modern-web-guidance"));
    assert.ok(!dev.includes("modern-web-guidance"));
  });

  it("pins GoogleChrome/modern-web-guidance in skills-lock.json", () => {
    const lock = JSON.parse(fs.readFileSync(path.join(root, "skills-lock.json"), "utf8"));
    const entry = lock.skills["modern-web-guidance"];
    assert.ok(entry);
    assert.match(String(entry.source), /GoogleChrome\/modern-web-guidance/i);
    assert.ok(String(entry.commit).length >= 7);
  });
});
