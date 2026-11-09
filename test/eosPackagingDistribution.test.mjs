import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as EosRoot from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-245: Integridad del punto de entrada unificado src/index.ts (SPEC-085)", () => {
  // 1. Verify Zenith and Frontier Hyperscaler core classes exist in root export
  assert.equal(typeof EosRoot.EosTrueTimeEngine, "function");
  assert.equal(typeof EosRoot.EosLsmTreeStorageEngine, "function");
  assert.equal(typeof EosRoot.EosThresholdCryptography, "function");
  assert.equal(typeof EosRoot.EosMicroVmEnclaveLauncher, "function");
  assert.equal(typeof EosRoot.EosPeerNode, "function");

  // Frontier Hyperscaler Modules (v72.0.0)
  assert.equal(typeof EosRoot.EosFirecrackerDaemonSupervisor, "function");
  assert.equal(typeof EosRoot.EosEventLoopSaturationGovernor, "function");
  assert.equal(typeof EosRoot.EosTlsPeerTransport, "function");
  assert.equal(typeof EosRoot.secureZeroizeBuffer, "function");

  // Supreme Hyperscaler Omnipresence Modules (v73.0.0)
  assert.equal(typeof EosRoot.EosWebGpuTensorEngine, "function");
  assert.equal(typeof EosRoot.EosEbpfKernelProbeEngine, "function");
  assert.equal(typeof EosRoot.EosWanKademliaMesh, "function");
  assert.equal(typeof EosRoot.EosUnboundedFormalProver, "function");
  assert.equal(typeof EosRoot.EosKubernetesFleetOperator, "function");

  // Planetary Scale & Enterprise Standard Maturation Modules (v75.0.0)
  assert.equal(typeof EosRoot.EosSingleExecutablePackager, "function");
  assert.equal(typeof EosRoot.EosOtlpTelemetryEngine, "function");
  assert.equal(typeof EosRoot.EosFleetDogfoodingEngine, "function");

  // 2. Verify MCP Server and Catalog tools
  assert.equal(typeof EosRoot.EosMcpServer, "function");
  assert.ok(EosRoot.CORE_TIER0_TOOL_NAMES instanceof Set);
  assert.equal(EosRoot.CORE_TIER0_TOOL_NAMES.size, 46);

  // 3. Verify Pure Layer-0 Kernel Primitives
  assert.equal(typeof EosRoot.pureSha256, "function");
  assert.equal(typeof EosRoot.deepFreeze, "function");
  assert.equal(typeof EosRoot.assertPrecondition, "function");
  assert.equal(typeof EosRoot.assertPostcondition, "function");
});

test("BDD-246: Verificación de empaquetado OCI y manifiesto de distribución (SPEC-085)", () => {
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  assert.equal(pkg.version, "75.0.0");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.main, "./src/index.ts");
  assert.equal(pkg.types, "./src/index.ts");
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);

  const dockerfilePath = path.join(projectRoot, "Dockerfile");
  assert.ok(fs.existsSync(dockerfilePath));
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");

  assert.ok(dockerfile.includes("gcr.io/distroless/static-debian12:nonroot"));
  assert.ok(dockerfile.includes("gcr.io/distroless/nodejs24-debian12:nonroot"));
  assert.ok(dockerfile.includes("USER nonroot:nonroot"));
});
