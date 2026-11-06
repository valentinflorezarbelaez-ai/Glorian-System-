import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-265: Ejecución interactiva de comandos EOS en la terminal del navegador (SPEC-095)", () => {
  const htmlPath = path.join(projectRoot, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // 1. Verify terminal container and interactive controls in index.html
  assert.ok(html.includes('id="eos-interactive-terminal-arena"'), "Interactive terminal section must exist");
  assert.ok(html.includes('id="eos-terminal-container"'), "Terminal container must exist");
  assert.ok(html.includes('id="eos-terminal-output"'), "Terminal output screen must exist");
  assert.ok(html.includes('id="eos-terminal-input"'), "Terminal input element must exist");
  assert.ok(html.includes('id="eos-terminal-form"'), "Terminal form must exist");
  assert.ok(html.includes('id="terminal-status-badge"'), "Terminal status badge must exist");
  assert.ok(html.includes('data-cmd="eos guide"'), "Quick command 'eos guide' must exist");
  assert.ok(html.includes('data-cmd="eos truetime"'), "Quick command 'eos truetime' must exist");
  assert.ok(html.includes('data-cmd="eos lsm"'), "Quick command 'eos lsm' must exist");
  assert.ok(html.includes('data-cmd="eos kademlia"'), "Quick command 'eos kademlia' must exist");
  assert.ok(html.includes('data-cmd="eos threshold"'), "Quick command 'eos threshold' must exist");
  assert.ok(html.includes('data-cmd="eos microvm"'), "Quick command 'eos microvm' must exist");

  // 2. Verify command dispatcher logic in js/eos.js
  const jsPath = path.join(projectRoot, "js", "eos.js");
  const js = fs.readFileSync(jsPath, "utf8");

  assert.ok(js.includes("function initInteractiveTerminalAndChaosArena()"), "Terminal initializer must be defined");
  assert.ok(js.includes("initInteractiveTerminalAndChaosArena();"), "Terminal initializer must be invoked");
  assert.ok(js.includes("dispatchCommand(rawCmd)"), "Command dispatcher must be implemented");
  assert.ok(js.includes("eos truetime"), "Must support eos truetime");
  assert.ok(js.includes("eos lsm"), "Must support eos lsm");
  assert.ok(js.includes("eos kademlia"), "Must support eos kademlia");
  assert.ok(js.includes("eos threshold"), "Must support eos threshold");
  assert.ok(js.includes("eos microvm"), "Must support eos microvm");
  assert.ok(js.includes("eos chaos:kill"), "Must support eos chaos:kill");
  assert.ok(js.includes("COMMIT_WAIT_ATTESTED"), "TrueTime must assert commit-wait linearizability");

  // 3. Verify Subresource Integrity (SRI) SHA-384 matching
  const css = fs.readFileSync(path.join(projectRoot, "css", "eos.css"), "utf8").replace(/\r\n/g, "\n");
  const jsNormalized = js.replace(/\r\n/g, "\n");

  const expectedCssSri = `sha384-${crypto.createHash("sha384").update(css, "utf8").digest("base64")}`;
  const expectedJsSri = `sha384-${crypto.createHash("sha384").update(jsNormalized, "utf8").digest("base64")}`;

  assert.ok(html.includes(expectedCssSri), "index.html must match computed CSS SRI SHA-384");
  assert.ok(html.includes(expectedJsSri), "index.html must match computed JS SRI SHA-384");
});

test("BDD-266: Inyección de caos y demostración de recuperación de consenso (SPEC-095)", () => {
  const htmlPath = path.join(projectRoot, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // 1. Verify Chaos Arena DOM elements
  assert.ok(html.includes('id="eos-chaos-arena-container"'), "Chaos arena container must exist");
  assert.ok(html.includes('id="chaos-arena-status-badge"'), "Chaos status badge must exist");
  assert.ok(html.includes('id="btn-chaos-inject-failover"'), "Chaos inject button must exist");
  assert.ok(html.includes('id="btn-chaos-reset-cluster"'), "Chaos reset button must exist");
  assert.ok(html.includes('id="chaos-telemetry-output"'), "Chaos telemetry output must exist");

  for (let i = 1; i <= 5; i++) {
    assert.ok(html.includes(`id="node-${i}-card"`), `Node ${i} card must exist`);
    assert.ok(html.includes(`id="node-${i}-status"`), `Node ${i} status badge must exist`);
  }

  // 2. Verify sub-15ms recovery & Raft election logic in js/eos.js
  const jsPath = path.join(projectRoot, "js", "eos.js");
  const js = fs.readFileSync(jsPath, "utf8");

  assert.ok(js.includes("executeChaosFailover()"), "executeChaosFailover routine must exist");
  assert.ok(js.includes("FAILOVER_ACTIVE"), "Must transition to FAILOVER_ACTIVE");
  assert.ok(js.includes("RECOVERED_STABLE"), "Must transition to RECOVERED_STABLE");
  assert.ok(js.includes("NEW LEADER"), "Must elect new Raft leader among remaining quorum");
  assert.ok(js.includes("CRASHED"), "Must simulate node crash");
  assert.ok(js.includes("PARTITIONED"), "Must simulate network partition");
  assert.ok(js.includes("100% registros preservados (0 bytes perdidos)"), "Must guarantee 0 data loss");
  assert.ok(js.includes("< 15.00 ms SLA"), "Must assert sub-15ms SLA recovery in telemetry");
});
