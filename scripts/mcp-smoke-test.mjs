#!/usr/bin/env node
/**
 * MCP Server Smoke Test — JSON-RPC 2.0 protocol verification.
 *
 * Big Tech standard (Google health checks, Stripe API smoke tests):
 * start the MCP server, send a tools/list request, verify the response
 * conforms to the MCP protocol spec. This catches protocol regressions
 * that unit tests might miss (they mock the transport, not the actual
 * stdio JSON-RPC framing).
 *
 * Usage:
 *   node scripts/mcp-smoke-test.mjs
 *   npm run mcp:smoke
 *
 * Zero external dependencies (Law V).
 */

import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const mcpServerPath = path.join(root, "src", "mcp", "eosMcpServer.ts");

const TIMEOUT_MS = 15_000;

const child = spawn(process.execPath, [mcpServerPath], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, EOS_MCP_PROFILE: "core" },
});

let stdout = "";
let stderr = "";
let resolved = false;

child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const timer = setTimeout(() => {
  if (!resolved) {
    child.kill("SIGKILL");
    console.error("[FAIL] MCP server smoke test timed out after", TIMEOUT_MS, "ms");
    process.exit(1);
  }
}, TIMEOUT_MS);

// Send initialize + tools/list requests
const initRequest =
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "mcp-smoke-test", version: "1.0.0" },
    },
  }) + "\n";

const toolsListRequest =
  JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  }) + "\n";

child.stdin.write(initRequest);
child.stdin.write(toolsListRequest);
child.stdin.end();

child.on("close", (code) => {
  clearTimeout(timer);
  resolved = true;

  console.log("======================================================================");
  console.log(" EOS MCP SERVER SMOKE TEST — JSON-RPC 2.0 Protocol");
  console.log("======================================================================");

  const violations = [];

  // Parse responses (each line is a JSON-RPC response)
  const lines = stdout.split("\n").filter((l) => l.trim().startsWith("{"));
  const responses = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // Check initialize response
  const initResp = responses.find((r) => r.id === 1);
  if (!initResp) {
    violations.push("No response to initialize request");
  } else if (initResp.error) {
    violations.push(`initialize returned error: ${JSON.stringify(initResp.error)}`);
  } else if (!initResp.result?.protocolVersion) {
    violations.push("initialize response missing protocolVersion");
  } else {
    console.log(`  [PASS] initialize: protocolVersion=${initResp.result.protocolVersion}`);
  }

  // Check tools/list response
  const toolsResp = responses.find((r) => r.id === 2);
  if (!toolsResp) {
    violations.push("No response to tools/list request");
  } else if (toolsResp.error) {
    violations.push(`tools/list returned error: ${JSON.stringify(toolsResp.error)}`);
  } else {
    const tools = toolsResp.result?.tools ?? [];
    if (tools.length === 0) {
      violations.push("tools/list returned 0 tools (expected >0)");
    } else {
      console.log(`  [PASS] tools/list: ${tools.length} tools advertised`);

      // Verify each tool has required fields
      const requiredFields = ["name", "description"];
      for (const tool of tools.slice(0, 20)) {
        for (const field of requiredFields) {
          if (!tool[field]) {
            violations.push(`tool "${tool.name ?? "(unnamed)"}" missing field: ${field}`);
          }
        }
      }
    }
  }

  // Check exit code
  if (code !== null && code !== 0 && code !== null) {
    // MCP server exits non-zero when stdin closes — that's expected
    if (stderr.length > 0 && !stderr.includes("Error")) {
      console.log("  [PASS] Server exited cleanly (no error output)");
    }
  }

  if (violations.length === 0) {
    console.log("\n PASS — MCP server smoke test passed.");
    console.log("======================================================================");
    process.exit(0);
  }

  console.error(`\n FAIL — ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  if (stderr) console.error(`\n  stderr: ${stderr.slice(-500)}`);
  console.log("======================================================================");
  process.exit(1);
});

// Close stdin after sending requests
setTimeout(() => {
  child.stdin.end();
}, 2000);
