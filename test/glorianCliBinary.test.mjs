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

test("help prints the quick manual with the glossary and full help commands", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [cli, "help"], { encoding: "utf8" });
  assert.match(output, /GLORIAN SYSTEM[\s\S]*MANUAL RÁPIDO/);
  assert.match(output, /^\s+eos guide\s+\S/m);
  assert.match(output, /^\s+eos help --all\s+\S/m);
});

test("health reports the local CLI process runtime, uptime and memory after the banner", () => {
  const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [cli, "health"], { encoding: "utf8" });
  assert.match(output, /GLORIAN SYSTEM[\s\S]*\[STATUS\]\s*:\s*UP \(local CLI process\)/);
  assert.ok(output.includes(`Node.js ${process.version} (${process.platform}-${process.arch})`));
  assert.match(output, /^Uptime\s*:\s*\d+s$/m);
  for (const field of ["RSS Mem", "HeapUsed"]) {
    const match = output.match(new RegExp(`^${field}\\s*:\\s*(\\d+(?:\\.\\d+)?) MB$`, "m"));
    assert.ok(match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0, `Expected positive ${field} in MB`);
  }
  assert.doesNotMatch(output, /Subsystems:\s*7\/7 Monitored Online/);
});

for (const command of ["guide", "cheat-sheet"]) {
  test(`${command} prints the CLI banner followed by the architecture glossary`, () => {
    const cli = fileURLToPath(new URL("../bin/eos.mjs", import.meta.url));
    const glossary = fs.readFileSync(new URL("../docs/ARCHITECTURE_GLOSSARY.md", import.meta.url), "utf8");
    const output = execFileSync(process.execPath, [cli, command], { encoding: "utf8" });
    const glossaryStart = output.indexOf(glossary);
    assert.ok(glossaryStart > 0, "Expected the full architecture glossary in stdout");
    assert.match(output.slice(0, glossaryStart), /GLORIAN SYSTEM/);
  });
}

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
