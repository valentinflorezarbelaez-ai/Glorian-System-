/**
 * Control-plane health probes — provenance HEAD binding (Big Tech supply-chain hygiene).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runControlPlaneHealthProbes } from "../src/core/eosControlPlaneHealthProbes.ts";

test("TIP_SEAL_PIN fails when provenance commitSha diverges from git HEAD", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-health-"));
  fs.mkdirSync(path.join(tmp, "docs/evidence"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "docs/projects"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".git/refs/heads"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ dependencies: {} }), "utf8");
  fs.writeFileSync(path.join(tmp, "docs/evidence/sbom.cdx.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(tmp, "docs/projects/registry.json"),
    JSON.stringify({ projects: [{ id: "a" }], totalFleetProjects: 1 }),
    "utf8",
  );
  const head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  fs.writeFileSync(path.join(tmp, ".git/HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(tmp, ".git/refs/heads/main"), `${head}\n`, "utf8");
  const stale = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  fs.writeFileSync(
    path.join(tmp, "docs/evidence/provenance.intoto.jsonl"),
    JSON.stringify({
      predicate: { buildDefinition: { externalParameters: { commitSha: stale } } },
    }) + "\n",
    "utf8",
  );

  const report = runControlPlaneHealthProbes(tmp);
  const tip = report.probes.find((p) => p.id === "TIP_SEAL_PIN");
  assert.ok(tip);
  assert.equal(tip.ok, false);
  assert.match(tip.detail, /≠HEAD/);
  assert.equal(report.status, "DEGRADED");
});

test("TIP_SEAL_PIN passes when provenance commitSha equals git HEAD", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eos-health-ok-"));
  fs.mkdirSync(path.join(tmp, "docs/evidence"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "docs/projects"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".git/refs/heads"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ dependencies: {} }), "utf8");
  fs.writeFileSync(path.join(tmp, "docs/evidence/sbom.cdx.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(tmp, "docs/projects/registry.json"),
    JSON.stringify({ projects: [{ id: "a" }], totalFleetProjects: 1 }),
    "utf8",
  );
  const head = "cccccccccccccccccccccccccccccccccccccccc";
  fs.writeFileSync(path.join(tmp, ".git/HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(path.join(tmp, ".git/refs/heads/main"), `${head}\n`, "utf8");
  fs.writeFileSync(
    path.join(tmp, "docs/evidence/provenance.intoto.jsonl"),
    JSON.stringify({
      predicate: { buildDefinition: { externalParameters: { commitSha: head } } },
    }) + "\n",
    "utf8",
  );

  const report = runControlPlaneHealthProbes(tmp);
  const tip = report.probes.find((p) => p.id === "TIP_SEAL_PIN");
  assert.ok(tip);
  assert.equal(tip.ok, true);
  assert.match(tip.detail, /bound to HEAD/);
});
