import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-241: Presencia de visualizadores de TrueTime y LSM-Tree en el DOM (SPEC-083)", () => {
  const htmlPath = path.join(projectRoot, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // 1. Verify all 4 visualizer containers
  assert.ok(html.includes('id="visualizer-truetime"'), "TrueTime visualizer container must exist");
  assert.ok(html.includes('id="visualizer-lsm"'), "LSM-Tree visualizer container must exist");
  assert.ok(html.includes('id="visualizer-threshold"'), "Threshold Shamir visualizer container must exist");
  assert.ok(html.includes('id="visualizer-microvm"'), "MicroVM enclave visualizer container must exist");

  // 2. Verify interactive control IDs
  assert.ok(html.includes('id="sim-truetime-epsilon"'));
  assert.ok(html.includes('id="btn-truetime-commit-wait"'));
  assert.ok(html.includes('id="truetime-display-earliest"'));
  assert.ok(html.includes('id="truetime-display-latest"'));

  assert.ok(html.includes('id="lsm-key-input"'));
  assert.ok(html.includes('id="lsm-val-input"'));
  assert.ok(html.includes('id="btn-lsm-put"'));
  assert.ok(html.includes('id="btn-lsm-get"'));
  assert.ok(html.includes('id="btn-lsm-flush"'));

  assert.ok(html.includes('id="threshold-secret-input"'));
  assert.ok(html.includes('id="threshold-k-input"'));
  assert.ok(html.includes('id="threshold-n-input"'));
  assert.ok(html.includes('id="btn-threshold-split"'));
  assert.ok(html.includes('id="btn-threshold-combine"'));

  assert.ok(html.includes('id="microvm-vcpus-input"'));
  assert.ok(html.includes('id="microvm-mem-input"'));
  assert.ok(html.includes('id="btn-microvm-generate"'));

  // 3. Verify Subresource Integrity (SRI) SHA-384 matches exactly
  const css = fs.readFileSync(path.join(projectRoot, "css", "eos.css"), "utf8").replace(/\r\n/g, "\n");
  const js = fs.readFileSync(path.join(projectRoot, "js", "eos.js"), "utf8").replace(/\r\n/g, "\n");

  const expectedCssSri = `sha384-${crypto.createHash("sha384").update(css, "utf8").digest("base64")}`;
  const expectedJsSri = `sha384-${crypto.createHash("sha384").update(js, "utf8").digest("base64")}`;

  assert.ok(html.includes(expectedCssSri), "index.html must match computed CSS SRI SHA-384");
  assert.ok(html.includes(expectedJsSri), "index.html must match computed JS SRI SHA-384");
});

test("BDD-242: Lógica de cálculo en el cliente para TrueTime y Shamir (SPEC-083)", () => {
  const jsPath = path.join(projectRoot, "js", "eos.js");
  const js = fs.readFileSync(jsPath, "utf8");

  // 1. Verify initialization function is defined and invoked
  assert.ok(js.includes("function initZenithHyperscalerVisualizers()"));
  assert.ok(js.includes("initZenithHyperscalerVisualizers();"));

  // 2. Verify TrueTime mathematical calculation logic
  assert.ok(js.includes("const earliest = Math.floor(now - eps)"));
  assert.ok(js.includes("const latest = Math.ceil(now + eps)"));
  assert.ok(js.includes("COMMIT_WAIT_ATTESTED"));

  // 3. Verify LSM-Tree and Bloom filter client logic
  assert.ok(js.includes("bloomFilter.add(k)"));
  assert.ok(js.includes("BLOOM: VERDADERO NEGATIVO"));
  assert.ok(js.includes("MemTable alcanzó límite (4). Volcada secuencialmente a SSTable L0"));

  // 4. Verify Shamir Threshold secret reconstruction logic
  assert.ok(js.includes("count < currentThreshold"));
  assert.ok(js.includes("RECHAZO FAIL-CLOSED: Fragmentos insuficientes"));
  assert.ok(js.includes("SECRETO RECONSTRUIDO EXITOSAMENTE"));

  // 5. Verify Firecracker profile generation
  assert.ok(js.includes("OCI_FIRECRACKER_V1"));
  assert.ok(js.includes("KVM_ACCELERATED"));
});
