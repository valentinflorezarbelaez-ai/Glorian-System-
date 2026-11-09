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

test("BDD-247: Sovereign 5/5 Scorecard operational ceiling evaluation", async () => {
  const { evaluateSovereignFiveScorecard } = await import("../src/core/eosSovereignFiveScorecard.ts");
  const scorecard = evaluateSovereignFiveScorecard(projectRoot);

  assert.equal(scorecard.title, "Glorian Sovereign 5/5 Scorecard");
  assert.ok(["5/5", "4/5", "3/5", "BELOW"].includes(scorecard.grade));
  assert.ok(scorecard.percent > 0 && scorecard.percent <= 100);
  assert.ok(scorecard.pillars.length === 5);
  assert.ok(scorecard.claimsDenied.includes("Level 5"));
  assert.ok(scorecard.claimsDenied.includes("NSA_GRADE"));
  assert.equal(scorecard.sha256Receipt.length, 64);

  // Verify pillar IDs
  const pillarIds = scorecard.pillars.map((p) => p.id);
  assert.ok(pillarIds.includes("LAYER0_PURITY"));
  assert.ok(pillarIds.includes("MCP_MODULAR_AUTHORITY"));
  assert.ok(pillarIds.includes("FLEET_LAW_IV"));
  assert.ok(pillarIds.includes("EVIDENCE_TIP_SEAL"));
  assert.ok(pillarIds.includes("EPISTEMIC_HONESTY"));

  // Synthetic root to test drift, dependencies penalty, and lower grades
  const os = await import("node:os");
  const tmpRoot = path.join(os.default.tmpdir(), `eos-scorecard-${Date.now()}`);
  fs.mkdirSync(path.join(tmpRoot, "docs/projects"), { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ dependencies: { "external-dep": "1.0.0" } }));
  fs.writeFileSync(
    path.join(tmpRoot, "docs/projects/registry.json"),
    JSON.stringify({ projects: [{ ownerApproval: "" }] }),
  );
  fs.writeFileSync(path.join(tmpRoot, "README.md"), "# Absolute Level-5 Marketing\nWithout any constraints.");

  try {
    const degradedScorecard = evaluateSovereignFiveScorecard(tmpRoot);
    assert.equal(degradedScorecard.grade, "BELOW");
    assert.equal(degradedScorecard.epistemicState, "SOVEREIGN_PROGRESS_WITHIN_TESTED_SCOPE");
    assert.equal(degradedScorecard.pillars.find((p) => p.id === "LAYER0_PURITY").score, 0);
    assert.equal(degradedScorecard.pillars.find((p) => p.id === "EVIDENCE_TIP_SEAL").score, 0);
    assert.equal(degradedScorecard.pillars.find((p) => p.id === "EPISTEMIC_HONESTY").score, 5);

    // Grade 4/5 (score 80): pure layer 0, tip seal, epistemic honesty, 10 projects ok, but 0 migrated tools
    fs.writeFileSync(path.join(tmpRoot, "package.json"), JSON.stringify({ dependencies: {} }));
    fs.mkdirSync(path.join(tmpRoot, "docs/evidence"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "docs/evidence/provenance.intoto.jsonl"), "receipt");
    fs.writeFileSync(path.join(tmpRoot, "README.md"), "Within tested scope notice.");
    const tenProjects = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, ownerApproval: "APPROVED" }));
    fs.writeFileSync(path.join(tmpRoot, "docs/projects/registry.json"), JSON.stringify({ projects: tenProjects }));

    const grade4 = evaluateSovereignFiveScorecard(tmpRoot);
    assert.ok(["4/5", "5/5"].includes(grade4.grade));

    // Grade 3/5: remove tip seal
    fs.unlinkSync(path.join(tmpRoot, "docs/evidence/provenance.intoto.jsonl"));
    const grade3 = evaluateSovereignFiveScorecard(tmpRoot);
    assert.ok(["3/5", "4/5"].includes(grade3.grade));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
