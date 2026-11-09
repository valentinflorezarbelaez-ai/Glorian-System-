/**
 * Regression: Domain purity must not treat ContextWindow / MultiWindow
 * relative imports as forbidden browser `window` globals (Law V).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { isForbiddenDomainGlobalSpecifier, validateLayerInvariants } from "../src/core/eosArchitectureGuard.ts";

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
