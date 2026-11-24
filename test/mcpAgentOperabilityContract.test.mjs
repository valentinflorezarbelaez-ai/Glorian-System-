/**
 * Contract: MCP / cloud agent operability playbook (P2-2 / PR-K).
 * Docs/env only — CLI verify:strict is gate SoT; MCP is optional.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playbook = path.join(root, "docs", "governance", "MCP_AGENT_OPERABILITY.md");
const tier0 = path.join(root, "docs", "governance", "MCP_TIER0_TOKEN_ECONOMY.md");

describe("MCP agent operability contract (PR-K)", () => {
  it("publishes MCP_AGENT_OPERABILITY.md with CLI gate SoT and Tier-0 link", () => {
    assert.ok(fs.existsSync(playbook), "MCP_AGENT_OPERABILITY.md must exist");
    assert.ok(fs.existsSync(tier0), "MCP_TIER0_TOKEN_ECONOMY.md must exist (link target)");
    const body = fs.readFileSync(playbook, "utf8");
    assert.match(body, /verify:strict/);
    assert.match(body, /node bin\/eos\.mjs verify/);
    assert.match(body, /Do not.*invent|must not.*invent|Do not invent/i);
    assert.match(body, /MCP_TIER0_TOKEN_ECONOMY\.md/);
    assert.match(body, /eos-system/);
    assert.match(body, /npm run mcp/);
  });

  it("governance index and AGENTS/CLAUDE point at the playbook", () => {
    const gov = fs.readFileSync(path.join(root, "docs", "governance.md"), "utf8");
    assert.match(gov, /MCP_AGENT_OPERABILITY\.md/);
    const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
    assert.match(agents, /MCP_AGENT_OPERABILITY/);
    const claude = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
    assert.match(claude, /MCP_AGENT_OPERABILITY/);
  });

  it("keeps package.json runtime dependencies empty", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    assert.deepEqual(pkg.dependencies ?? {}, {});
  });
});
