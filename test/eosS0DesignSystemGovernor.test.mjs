import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosS0DesignSystemGovernor } from "../src/core/eosS0DesignSystemGovernor.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

describe("SPEC-128: Tier S-0 Design Engineering Matrix & Machine-Readable Visual Governor", () => {
  const governor = new EosS0DesignSystemGovernor(projectRoot);

  describe("BDD-383: Anti-Pattern Linter — Banned Fuzzy Drop Shadows", () => {
    it("flags generic fuzzy drop shadows as BLOCKING violations", () => {
      const badSnippet = `.card { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }`;
      const findings = governor.auditMarkup(badSnippet);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, "BLOCKING");
      assert.equal(findings[0].rule, "ANTI_PATTERN_FUZZY_SHADOW");
    });

    it("passes clean hairline borders without fuzzy shadows", () => {
      const goodSnippet = `.card { border: 1px solid var(--border-hairline); }`;
      const findings = governor.auditMarkup(goodSnippet);
      assert.equal(findings.length, 0);
    });
  });

  describe("BDD-384: Linear Transition Curve Linter", () => {
    it("flags linear transitions as BLOCKING violations", () => {
      const badSnippet = `.btn { transition: all 0.3s linear; }`;
      const findings = governor.auditMarkup(badSnippet);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, "BLOCKING");
      assert.equal(findings[0].rule, "ANTI_PATTERN_LINEAR_TRANSITION");
    });
  });

  describe("BDD-385: 4px Geometric Grid Spacing Conformance", () => {
    it("flags non-4px spacing as WARNING violations", () => {
      const badSnippet = `.box { padding: 13px; }`;
      const findings = governor.auditMarkup(badSnippet);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, "WARNING");
      assert.equal(findings[0].rule, "NON_4PX_GRID_SPACING");
    });

    it("passes spacing that strictly follows 4px grid", () => {
      const goodSnippet = `.box { padding: 16px; margin: 24px; gap: 8px; }`;
      const findings = governor.auditMarkup(goodSnippet);
      assert.equal(findings.length, 0);
    });
  });

  describe("BDD-386: Constitutional DESIGN.md Contract Verification", () => {
    it("confirms DESIGN.md contains all mandatory token tiers and catalogs", () => {
      const check = governor.auditDesignContract();
      assert.equal(check.valid, true, `Missing sections: ${check.missingSections.join(", ")}`);
      assert.equal(check.missingSections.length, 0);
    });
  });

  describe("BDD-387: MCP Tool and Workspace Conformance", async () => {
    it("runs auditWorkspace cleanly across production codebase", () => {
      const report = governor.auditWorkspace();
      assert.equal(report.compliant, true);
      assert.equal(report.violations.length, 0);
      assert.ok(report.score >= 95, `Expected score >= 95, got ${report.score}`);
    });

    it("executes eos_design_system_govern through EosMcpServer cleanly", async () => {
      const { EosMcpServer } = await import("../src/mcp/eosMcpServer.ts");
      const server = new EosMcpServer(projectRoot, "full");
      const toolsRes = server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
      assert.ok(toolsRes && toolsRes.result);
      const hasTool = toolsRes.result.tools.some((t) => t.name === "eos_design_system_govern");
      assert.equal(hasTool, true, "Tool eos_design_system_govern must be exposed in tools/list");

      const callRes = server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "eos_design_system_govern",
          arguments: {},
        },
      });
      assert.ok(callRes && callRes.result);
      const parsed = JSON.parse(callRes.result.content[0].text);
      assert.equal(parsed.compliant, true);
      assert.equal(parsed.violationCount, 0);
      assert.ok(parsed.score >= 95);
    });
  });
});
