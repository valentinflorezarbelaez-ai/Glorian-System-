/**
 * Regression: Domain purity must not treat ContextWindow / MultiWindow
 * relative imports as forbidden browser `window` globals (Law V).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyLayer,
  detectCircularDependencies,
  extractImports,
  isForbiddenDomainGlobalSpecifier,
  scanArchitecture,
  validateLayerInvariants,
} from "../src/core/eosArchitectureGuard.ts";
import { extractImportTargets } from "../scripts/verify-module-consumers.mjs";

test("BDD-ARCH-WINDOW-001: exact window/document globals only", () => {
  assert.equal(isForbiddenDomainGlobalSpecifier("window"), true);
  assert.equal(isForbiddenDomainGlobalSpecifier("document"), true);
  assert.equal(isForbiddenDomainGlobalSpecifier("./eosContextWindowManager.ts"), false);
  assert.equal(isForbiddenDomainGlobalSpecifier("./eosMultiWindowSloGovernor.ts"), false);
});

test("BDD-ARCH-WINDOW-002: Domain imports of *Window* modules are clean", () => {
  const violations = validateLayerInvariants({
    filePath: "/fake/src/core/eosPlatformOpsCeiling.ts",
    relativeFilePath: "src/core/eosPlatformOpsCeiling.ts",
    layer: "DOMAIN",
    imports: [
      {
        rawSpecifier: "./eosMultiWindowSloGovernor.ts",
        resolvedPath: "src/core/eosMultiWindowSloGovernor.ts",
        isExternal: false,
        lineNumber: 20,
      },
      {
        rawSpecifier: "./eosContextWindowManager.ts",
        resolvedPath: "src/core/eosContextWindowManager.ts",
        isExternal: false,
        lineNumber: 21,
      },
    ],
    violations: [],
  });
  assert.equal(violations.length, 0);
});

test("BDD-AST-UNIFIED-002: extractImports and scanArchitecture catch multiline & re-export violations and ignore string/comment noise", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-arch-guard-"));
  try {
    const coreDir = path.join(tmpRoot, "src", "core");
    const uiDir = path.join(tmpRoot, "src", "ui");
    const appDir = path.join(tmpRoot, "src", "application");
    const infraDir = path.join(tmpRoot, "src", "infrastructure");
    fs.mkdirSync(coreDir, { recursive: true });
    fs.mkdirSync(uiDir, { recursive: true });
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(infraDir, { recursive: true });

    assert.equal(classifyLayer("src/core/mod.ts"), "DOMAIN");
    assert.equal(classifyLayer("src/application/svc.ts"), "APPLICATION");
    assert.equal(classifyLayer("src/mcp/db.ts"), "INFRASTRUCTURE");
    assert.equal(classifyLayer("src/ui/view.tsx"), "PRESENTATION");
    assert.equal(classifyLayer("misc/other.ts"), "UNKNOWN");

    fs.writeFileSync(path.join(uiDir, "widget.ts"), "export const w = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(coreDir, "cycleA.ts"),
      [
        "/* import 'express' */",
        "const s = `import 'koa'`;",
        "import {",
        "  useState,",
        "} from 'react';",
        "export * from './cycleB.ts';",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(path.join(coreDir, "cycleB.ts"), "import './cycleA.ts';\n", "utf8");
    fs.writeFileSync(path.join(appDir, "useUi.ts"), "import '../ui/widget.ts';\n", "utf8");

    const parsed = extractImports(
      fs.readFileSync(path.join(coreDir, "cycleA.ts"), "utf8"),
      path.join(coreDir, "cycleA.ts"),
      tmpRoot,
    );
    assert.deepEqual(
      parsed.map((i) => i.rawSpecifier),
      ["react", "./cycleB.ts"],
    );

    const report = scanArchitecture(path.join(tmpRoot, "src"), tmpRoot);
    assert.equal(report.isClean, false);
    assert.ok(report.circularDependencies.length >= 1);
    assert.ok(report.violations.some((v) => v.details.includes("react")));
    assert.ok(report.violations.some((v) => v.details.includes("../ui/widget.ts")));
    assert.equal(detectCircularDependencies(new Map()).length, 0);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("BDD-AST-UNIFIED-003: verify-module-consumers extractImportTargets captures re-exports and ignores comments/templates", () => {
  const source = [
    "// import './commentedOut.ts';",
    "const doc = `import './insideTemplate.ts'`;",
    "export * from './barrelStar.ts';",
    "export { thing } from './barrelNamed.ts';",
    "import {\n  item\n} from './multiline.ts';",
  ].join("\n");
  const targets = [...extractImportTargets(source)];
  assert.deepEqual(targets, ["./barrelStar.ts", "./barrelNamed.ts", "./multiline.ts"]);
});
