import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

test("package.json exposes both glorian and eos binary entries", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.bin.glorian, "./bin/eos.mjs");
  assert.equal(pkg.bin.eos, "./bin/eos.mjs");
});

test("health prints the CLI banner before the status report", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [cli, "health"], { encoding: "utf8" });
  assert.match(output, /GLORIAN SYSTEM[\s\S]*\[STATUS\]/);
});

test("O(1) CLI dispatch resolves version/help cleanly and EosMcpServer defers corpus/graph sync until RAG/graph calls", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const ver = execFileSync(process.execPath, [cli, "version"], { encoding: "utf8" });
  assert.match(ver, /Glorian System v\d+\.\d+\.\d+/);
  const verFlag = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.match(verFlag, /Glorian System v\d+\.\d+\.\d+/);

  const server = new EosMcpServer(process.cwd());
  assert.equal(server["corpusInitialized"], false);
  assert.equal(server["graphInitialized"], false);

  const listRes = server.handleRequest({ jsonrpc: "2.0", id: 10, method: "tools/list" });
  assert.equal(listRes.result.tools.length, 46);
  assert.equal(server["corpusInitialized"], false);
  assert.equal(server["graphInitialized"], false);

  const callRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "eos_health_check", arguments: {} },
  });
  assert.ok(callRes.result.content[0].text.length > 0);
  assert.equal(server["corpusInitialized"], false);
  assert.equal(server["graphInitialized"], false);

  const searchRes = server.handleRequest({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: { name: "eos_semantic_search", arguments: { query: "inviolable laws", topK: 2 } },
  });
  assert.ok(searchRes.result.content[0].text.length > 0);
  assert.equal(server["corpusInitialized"], true);
  assert.equal(server["graphInitialized"], false);

  const meshOut = execFileSync(process.execPath, [cli, "ml-dsa:keygen"], { encoding: "utf8" });
  assert.ok(meshOut.length > 0);
});
