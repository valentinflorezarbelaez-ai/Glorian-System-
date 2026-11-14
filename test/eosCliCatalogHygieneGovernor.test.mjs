/**
 * SPEC-250 / CHANGE-125 — Layer-0 CLI Catalog Parity & Module Headroom Governor Tests (BDD-1271..BDD-1275).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { EosCliCatalogAndHygieneGovernorCore } from "../src/core/index.ts";

describe("SPEC-250: CLI Catalog Parity & Module Headroom Governor (BDD-1271..BDD-1275)", () => {
  it("BDD-1271: Live Glorian repository passes with HYGIENE_GOVERNED, 100% CLI catalog parity, and >= 12 lines headroom", () => {
    const report = EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
      projectRoot: process.cwd(),
    });
    assert.equal(report.verdict, "HYGIENE_GOVERNED");
    assert.equal(report.catalogCoverageRatio, 1);
    assert.deepEqual(report.missingFromHelpCatalog, []);
    assert.deepEqual(report.breachedModules, []);
    assert.deepEqual(report.nearCeilingModules, []);
    assert.ok(report.minHeadroomLines >= 12, `Expected minHeadroomLines >= 12, got ${report.minHeadroomLines}`);
    assert.ok(report.totalCommandsRegistered >= 300);
    assert.ok(report.totalModulesScanned >= 400);
    assert.equal(report.sha256Receipt.length, 64);
    assert.equal(Object.isFrozen(report), true);
  });

  it("BDD-1272: Flags uncatalogued CLI command as HYGIENE_WARNING", () => {
    const report = EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
      registeredCommands: ["verify", "undocumented:cmd"],
      helpCatalogText: "eos verify\n",
      developerGuideText: "verify",
      moduleLineCounts: [{ filePath: "src/core/clean.ts", lineCount: 120 }],
    });
    assert.equal(report.verdict, "HYGIENE_WARNING");
    assert.deepEqual(report.missingFromHelpCatalog, ["undocumented:cmd"]);
    assert.equal(report.catalogCoverageRatio, 0.5);
  });

  it("BDD-1273: Flags near-ceiling module below 12 lines headroom as HYGIENE_WARNING", () => {
    const report = EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
      registeredCommands: ["verify"],
      helpCatalogText: "eos verify\n",
      developerGuideText: "verify",
      moduleLineCounts: [{ filePath: "src/core/heavy.ts", lineCount: 792 }],
    });
    assert.equal(report.verdict, "HYGIENE_WARNING");
    assert.equal(report.nearCeilingModules.length, 1);
    assert.equal(report.nearCeilingModules[0].headroomLines, 8);
    assert.equal(report.breachedModules.length, 0);
  });

  it("BDD-1274: Flags module exceeding 800-line hard limit as HYGIENE_BREACH", () => {
    const report = EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
      registeredCommands: ["verify"],
      helpCatalogText: "eos verify\n",
      developerGuideText: "verify",
      moduleLineCounts: [{ filePath: "src/core/bloated.ts", lineCount: 812 }],
    });
    assert.equal(report.verdict, "HYGIENE_BREACH");
    assert.equal(report.breachedModules.length, 1);
    assert.equal(report.breachedModules[0].filePath, "src/core/bloated.ts");
    assert.equal(report.minHeadroomLines, -12);
    assert.throws(
      () =>
        EosCliCatalogAndHygieneGovernorCore.auditCliCatalogAndModuleHeadroom({
          projectRoot: process.cwd(),
          helpCatalogRelPath: "../../outside.mjs",
        }),
      /Path traversal outside projectRoot is forbidden/,
    );
  });

  it("BDD-1275: CLI hygiene:audit JSON output & synchronized help --all verification", () => {
    const cliPath = path.join(process.cwd(), "bin/eos.mjs");
    const hygieneRaw = execFileSync(process.execPath, [cliPath, "hygiene:audit", "--json"], {
      encoding: "utf8",
    });
    const hygiene = JSON.parse(hygieneRaw.trim());
    assert.equal(hygiene.verdict, "HYGIENE_GOVERNED");
    assert.deepEqual(hygiene.missingFromHelpCatalog, []);
    assert.equal(hygiene.sha256Receipt.length, 64);

    const helpAll = execFileSync(process.execPath, [cliPath, "help", "--all"], {
      encoding: "utf8",
    });
    for (const token of ["hygiene:audit", "ship", "eda:prove", "apollo:bundle", "aladdin:stress", "bench:swe"]) {
      assert.ok(helpAll.includes(token), `help --all missing ${token}`);
    }
  });
});
