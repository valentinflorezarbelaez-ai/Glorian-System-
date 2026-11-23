/**
 * Contract: DEPENDENCY_POLICY_L0 is published and aligned with Layer-0 SoT.
 * Remediation P3-1 / PR-L — docs-only discoverability; no new runtime deps.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(root, "docs", "governance", "DEPENDENCY_POLICY_L0.md");
const spec002Path = path.join(root, "openspec", "specs", "SPEC-002-HEXAGONAL-L0.md");

describe("DEPENDENCY_POLICY_L0 contract", () => {
  it("publishes docs/governance/DEPENDENCY_POLICY_L0.md with SPEC-002 SoT pointer", () => {
    assert.ok(fs.existsSync(policyPath), "DEPENDENCY_POLICY_L0.md must exist");
    assert.ok(fs.existsSync(spec002Path), "SPEC-002-HEXAGONAL-L0.md must exist as formal SoT");
    const body = fs.readFileSync(policyPath, "utf8");
    assert.match(body, /dependencies:\s*\{\}/);
    assert.match(body, /SPEC-002-HEXAGONAL-L0\.md/);
    assert.match(body, /sbom\.cdx\.json|verify-supply-chain/);
    assert.match(body, /boundary:check|import-boundary-gate/);
  });

  it("keeps package.json runtime dependencies empty", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.deepEqual(pkg.dependencies ?? {}, {});
  });

  it("constitution rules cite the published policy path", () => {
    const cursorRule = fs.readFileSync(path.join(root, ".cursor", "rules", "eos-governance.mdc"), "utf8");
    const kiroRule = fs.readFileSync(path.join(root, ".kiro", "steering", "eos-governance.md"), "utf8");
    assert.match(cursorRule, /docs\/governance\/DEPENDENCY_POLICY_L0\.md/);
    assert.match(kiroRule, /docs\/governance\/DEPENDENCY_POLICY_L0\.md/);
  });
});
