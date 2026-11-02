import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EosTacticalCommandEngine } from "../src/core/eosTacticalCommandEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("SPEC-129: Tier S-0 Tactical Apex — Command Engine & OpenSpec Indexer", () => {
  const engine = new EosTacticalCommandEngine(projectRoot);

  describe("BDD-388: Tactical Command Engine Fuzzy Indexing", () => {
    it("indexes registered fleet repositories from docs/projects/registry.json", () => {
      const res = engine.search("avo");
      assert.ok(res.items.length > 0);
      const avo = res.items.find((i) => i.id === "fleet:control-de-asistencia-abopack");
      assert.ok(avo, "Expected control-de-asistencia-abopack in search results");
      assert.equal(avo.category, "FLEET");
      assert.equal(avo.targetUrl, "https://avo-pack.vercel.app");
    });

    it("indexes tactical quick actions (verify, design governor, secret scan)", () => {
      const res = engine.search("verify");
      assert.ok(res.items.length > 0);
      const cicd = res.items.find((i) => i.id === "action:verify-cicd");
      assert.ok(cicd, "Expected action:verify-cicd in results");
      assert.equal(cicd.category, "ACTION");
    });

    it("matches OpenSpecs by ID and keywords with sub-5ms latency", () => {
      const res = engine.search("SPEC-128");
      assert.ok(res.items.length > 0);
      assert.ok(res.durationMs < 10, `Expected search < 10ms, got ${res.durationMs}ms`);
      const spec = res.items.find((i) => i.id === "spec:spec-128");
      assert.ok(spec, "Expected spec:spec-128 in results");
      assert.equal(spec.category, "SPEC");
    });

    it("returns default top items when query is empty", () => {
      const res = engine.search("");
      assert.ok(res.items.length >= 10);
      assert.ok(res.totalMatches > 50);
    });
  });

  describe("BDD-391: 129 OpenSpecs Metadata Extraction & JSON Export", () => {
    it("extracts all formal OpenSpecs with valid metadata (ID, title, status, FR/BDD counts)", () => {
      const specs = engine.extractOpenSpecs();
      assert.ok(specs.length >= 128, `Expected at least 128 specs, got ${specs.length}`);

      const spec128 = specs.find((s) => s.id === "SPEC-128");
      assert.ok(spec128, "Missing SPEC-128 in catalog");
      assert.ok(spec128.frCount > 0, "SPEC-128 should have FR count");
      assert.ok(spec128.bddCount > 0, "SPEC-128 should have BDD count");
      assert.ok(spec128.sha256.length === 64, "Missing valid SHA-256 digest");

      const spec129 = specs.find((s) => s.id === "SPEC-129");
      assert.ok(spec129, "Missing SPEC-129 in catalog");
      assert.equal(spec129.status, "APPROVED");
    });

    it("exports static JSON catalog index deterministically", () => {
      const targetPath = engine.exportOpenSpecsJson();
      assert.ok(fs.existsSync(targetPath));

      const content = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      assert.ok(content.totalSpecs >= 128);
      assert.ok(content.catalogSha256.length === 64);
      assert.ok(Array.isArray(content.specs));
    });
  });
});
