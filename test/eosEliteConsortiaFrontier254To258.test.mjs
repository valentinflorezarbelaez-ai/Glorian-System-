/**
 * SPEC-254..SPEC-258 / CHANGE-128 — BDD Verification Suite (Elite Consortia Frontier):
 * - SPEC-254: EosComputationalLithographyOpcCore (BDD-1316..BDD-1320)
 * - SPEC-255: EosDifferentialPrivacyAbacGovernorCore (BDD-1321..BDD-1325)
 * - SPEC-256: EosLobAlmgrenChrissVpinCore (BDD-1326..BDD-1330)
 * - SPEC-257: EosUnifiedMemoryDmaDvfsQosCore (BDD-1331..BDD-1335)
 * - SPEC-258: EosRelativisticBeamTwissLuminosityCore (BDD-1336..BDD-1340)
 * + Exact 162-Action Fail-Closed JSON-RPC `-32602` (`ENUM_VIOLATION`) Guard Verification
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS,
  EosComputationalLithographyOpcCore,
  EosDifferentialPrivacyAbacGovernorCore,
  EosLobAlmgrenChrissVpinCore,
  EosRelativisticBeamTwissLuminosityCore,
  EosUnifiedMemoryDmaDvfsQosCore,
} from "../src/core/index.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function runCliJson(cmd, extraArgs = []) {
  const raw = execFileSync(process.execPath, [path.join(projectRoot, "bin", "eos.mjs"), cmd, ...extraArgs, "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

async function callWorkspaceMcpRaw(action) {
  const server = new EosMcpServer(projectRoot, "full");
  return server.handleRequest({
    jsonrpc: "2.0",
    id: `test-${action}`,
    method: "tools/call",
    params: {
      name: "eos_enterprise_workspace",
      arguments: { action },
    },
  });
}

async function callWorkspaceMcp(action) {
  const response = await callWorkspaceMcpRaw(action);
  assert.equal(response.error, undefined, `Unexpected JSON-RPC error for ${action}: ${JSON.stringify(response.error)}`);
  const text = response?.result?.content?.[0]?.text;
  assert.equal(typeof text, "string", `Expected JSON string payload for ${action}`);
  return JSON.parse(text);
}

test("CHANGE-128 Registry: Fail-closed JSON-RPC -32602 for unknown eos_enterprise_workspace actions", async () => {
  assert.equal(ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.size, 162);
  const res = await callWorkspaceMcpRaw("nonexistent_frontier_action_xyz");
  assert.equal(res.error?.code, -32602);
});

test("SPEC-254: Computational Lithography & OPC Core (BDD-1316..BDD-1320)", async (t) => {
  await t.test("BDD-1316: High-NA EUV nominal optics converge within EPE tolerance", () => {
    const report = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc({
      wavelengthNm: 13.5,
      numericalAperture: 0.55,
      k1ProcessFactor: 0.32,
      targetCdNm: 8.0,
      opcIterations: 6,
    });
    assert.equal(report.verdict, "LITHO_OPC_CONVERGED");
    assert.ok(report.nils >= 1.8);
    assert.ok(report.residualEpeNm <= 0.25);
    assert.equal(report.convergedWithinTolerance, true);
  });

  await t.test("BDD-1317: Under-iterated OPC requires SRAF assist", () => {
    const report = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc({
      opcIterations: 2,
      initialEpeNm: 1.8,
      maxEpeToleranceNm: 0.25,
    });
    assert.equal(report.verdict, "SRAF_ASSIST_REQUIRED");
    assert.ok(report.residualEpeNm > 0.25);
  });

  await t.test("BDD-1318: Sub-diffraction CD violation triggers DIFFRACTION_LIMIT_BREACH", () => {
    const report = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc({
      targetCdNm: 3.0,
    });
    assert.equal(report.verdict, "DIFFRACTION_LIMIT_BREACH");
  });

  await t.test("BDD-1319: Violating Abbe k1 lower bound throws & digest is deterministic", () => {
    assert.throws(
      () => EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc({ k1ProcessFactor: 0.1 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc();
    const b = EosComputationalLithographyOpcCore.evaluateComputationalLithographyOpc();
    assert.equal(a.opcDigestSha256, b.opcDigestSha256);
    assert.equal(a.opcDigestSha256.length, 64);
  });

  await t.test("BDD-1320: CLI litho:opc & MCP asml_opc_lithography end-to-end", async () => {
    const cli = runCliJson("litho:opc");
    const mcp = await callWorkspaceMcp("asml_opc_lithography");
    assert.equal(cli.verdict, "LITHO_OPC_CONVERGED");
    assert.equal(mcp.verdict, "LITHO_OPC_CONVERGED");
    assert.equal(cli.opcDigestSha256, mcp.opcDigestSha256);
  });
});

test("SPEC-255: Differential Privacy & Zero-Trust ABAC Core (BDD-1321..BDD-1325)", async (t) => {
  await t.test("BDD-1321: Authorized Zero-Trust access & sequential DP charge", () => {
    const report = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
      subjectClearance: 4,
      requiredClearance: 3,
      epsilonTotalBudget: 2.0,
      epsilonAlreadySpent: 0.6,
      queryEpsilon: 0.4,
    });
    assert.equal(report.verdict, "PRIVACY_AND_ABAC_AUTHORIZED");
    assert.equal(report.remainingEpsilonBudget, 1.0);
    assert.equal(report.abacAuthorized, true);
  });

  await t.test("BDD-1322: Privacy budget exhaustion triggers PRIVACY_BUDGET_EXHAUSTED", () => {
    const report = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
      epsilonTotalBudget: 2.0,
      epsilonAlreadySpent: 1.8,
      queryEpsilon: 0.4,
    });
    assert.equal(report.verdict, "PRIVACY_BUDGET_EXHAUSTED");
    assert.equal(report.privacyBudgetAuthorized, false);
  });

  await t.test("BDD-1323: Zero-Trust ABAC denial overrides available privacy budget", () => {
    const report = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
      mfaVerified: false,
      epsilonAlreadySpent: 0,
      queryEpsilon: 0.1,
    });
    assert.equal(report.verdict, "ABAC_ZERO_TRUST_DENIED");
    assert.equal(report.abacAuthorized, false);

    const kAnonDenied = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
      kAnonymityThreshold: 10,
      minEquivalenceClassSize: 4,
    });
    assert.equal(kAnonDenied.verdict, "ABAC_ZERO_TRUST_DENIED");
  });

  await t.test("BDD-1324: Analytical Laplace/Gaussian scales & invalid epsilon guard", () => {
    assert.throws(
      () => EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({ epsilonTotalBudget: 0 }),
      /PRECONDITION_FAILED/,
    );
    const report = EosDifferentialPrivacyAbacGovernorCore.evaluateDifferentialPrivacyAbac({
      l1Sensitivity: 2.0,
      queryEpsilon: 0.5,
    });
    assert.equal(report.laplaceScale, 4.0);
    assert.ok(report.gaussianSigma > 0);
    assert.equal(report.privacyAbacDigestSha256.length, 64);
  });

  await t.test("BDD-1325: CLI privacy:abac & MCP differential_privacy_abac end-to-end", async () => {
    const cli = runCliJson("privacy:abac");
    const mcp = await callWorkspaceMcp("differential_privacy_abac");
    assert.equal(cli.verdict, "PRIVACY_AND_ABAC_AUTHORIZED");
    assert.equal(mcp.verdict, "PRIVACY_AND_ABAC_AUTHORIZED");
    assert.equal(cli.privacyAbacDigestSha256, mcp.privacyAbacDigestSha256);
  });
});

test("SPEC-256: LOB Almgren-Chriss & VPIN Core (BDD-1326..BDD-1330)", async (t) => {
  await t.test("BDD-1326: Balanced LOB yields optimal schedule conserving share sum", () => {
    const report = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin({
      orderSizeShares: 50000,
      horizonSlices: 10,
    });
    assert.equal(report.verdict, "EXECUTION_TRAJECTORY_OPTIMAL");
    assert.equal(report.scheduledShareSum, 50000);
    assert.equal(report.scheduledSlices.length, 10);
  });

  await t.test("BDD-1327: Toxic flow imbalance triggers TOXIC_FLOW_VPIN_HALT", () => {
    const report = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin({
      volumeBuckets: [
        { buyVolume: 9000, sellVolume: 1000 },
        { buyVolume: 9000, sellVolume: 1000 },
      ],
    });
    assert.equal(report.verdict, "TOXIC_FLOW_VPIN_HALT");
    assert.ok(Math.abs(report.vpin - 0.8) < 1e-6);
  });

  await t.test("BDD-1328: Wide spread triggers HIGH_MARKET_IMPACT_WARN", () => {
    const report = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin({
      bestBidPrice: 100.0,
      bestAskPrice: 100.4,
    });
    assert.equal(report.verdict, "HIGH_MARKET_IMPACT_WARN");
    assert.ok(report.spreadBps > 25);
  });

  await t.test("BDD-1329: Crossed book throws & digest is deterministic", () => {
    assert.throws(
      () => EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin({ bestBidPrice: 101, bestAskPrice: 100 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin();
    const b = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin();
    assert.equal(a.lobVpinDigestSha256, b.lobVpinDigestSha256);
    assert.equal(a.lobVpinDigestSha256.length, 64);
  });

  await t.test("BDD-1330: CLI lob:vpin & MCP lob_almgren_chriss_vpin end-to-end", async () => {
    const cli = runCliJson("lob:vpin");
    const mcp = await callWorkspaceMcp("lob_almgren_chriss_vpin");
    assert.equal(cli.verdict, "EXECUTION_TRAJECTORY_OPTIMAL");
    assert.equal(mcp.verdict, "EXECUTION_TRAJECTORY_OPTIMAL");
    assert.equal(cli.lobVpinDigestSha256, mcp.lobVpinDigestSha256);
  });
});

test("SPEC-257: Unified Memory DMA, DVFS & Thermal QoS Core (BDD-1331..BDD-1335)", async (t) => {
  await t.test("BDD-1331: Nominal fabric DMA & P0_TURBO silicon thermals", () => {
    const report = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos();
    assert.equal(report.verdict, "QOS_AND_THERMAL_NOMINAL");
    assert.equal(report.pState, "P0_TURBO");
    assert.ok(report.grantedStreams.every((s) => s.fulfilled));
  });

  await t.test("BDD-1332: Moderate over-temperature triggers P1_EFFICIENCY_CLAMP", () => {
    const report = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos({
      voltageVolts: 1.35,
      frequencyGhz: 4.8,
    });
    assert.equal(report.verdict, "DVFS_PSTATE_THROTTLED");
    assert.equal(report.pState, "P1_EFFICIENCY_CLAMP");
  });

  await t.test("BDD-1333: Bandwidth saturation protects priority 0 RT stream", () => {
    const report = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos({
      totalUnifiedBandwidthGBps: 500,
    });
    assert.equal(report.verdict, "THERMAL_OR_BANDWIDTH_SATURATED");
    assert.equal(report.pState, "P2_BW_THROTTLED");
    assert.equal(report.grantedStreams[0].streamId, "DISPLAY_SCANOUT");
    assert.equal(report.grantedStreams[0].fulfilled, true);
  });

  await t.test("BDD-1334: Electrical bounds guard & deterministic digest", () => {
    assert.throws(
      () => EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos({ voltageVolts: 2.5 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos();
    const b = EosUnifiedMemoryDmaDvfsQosCore.evaluateUnifiedMemoryDmaDvfsQos();
    assert.equal(a.dvfsQosDigestSha256, b.dvfsQosDigestSha256);
    assert.equal(a.dvfsQosDigestSha256.length, 64);
  });

  await t.test("BDD-1335: CLI dvfs:qos & MCP unified_memory_dvfs_qos end-to-end", async () => {
    const cli = runCliJson("dvfs:qos");
    const mcp = await callWorkspaceMcp("unified_memory_dvfs_qos");
    assert.equal(cli.verdict, "QOS_AND_THERMAL_NOMINAL");
    assert.equal(mcp.verdict, "QOS_AND_THERMAL_NOMINAL");
    assert.equal(cli.dvfsQosDigestSha256, mcp.dvfsQosDigestSha256);
  });
});

test("SPEC-258: Relativistic Symplectic FODO Beam Twiss Core (BDD-1336..BDD-1340)", async (t) => {
  await t.test("BDD-1336: HL-LHC 6.8 TeV protons lock symplectic det=1 & >1e34 luminosity", () => {
    const report = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity();
    assert.equal(report.verdict, "BEAM_OPTICS_LUMINOSITY_LOCKED");
    assert.equal(report.fodoStable, true);
    assert.ok(Math.abs(report.symplecticDeterminant - 1) < 1e-6);
    assert.ok(report.luminosityCm2s > 1e34);
  });

  await t.test("BDD-1337: Over-focused FODO triggers LATTICE_RESONANCE_UNSTABLE", () => {
    const report = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity({
      fodoHalfCellLengthM: 53.45,
      fodoFocalLengthM: 20.0,
    });
    assert.equal(report.verdict, "LATTICE_RESONANCE_UNSTABLE");
    assert.equal(report.fodoStable, false);
    assert.ok(Math.abs(report.symplecticDeterminant - 1) < 1e-6);
  });

  await t.test("BDD-1338: Elevated beam energy radiation loss escalates verdict", () => {
    const report = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity({
      beamEnergyGev: 9500,
      maxSynchrotronLossKev: 15.0,
    });
    assert.equal(report.verdict, "SYNCHROTRON_LOSS_ELEVATED");
    assert.ok(report.synchrotronLossKevPerTurn > 15.0);
  });

  await t.test("BDD-1339: Sub-rest-mass validation throws & digest is deterministic", () => {
    assert.throws(
      () => EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity({ beamEnergyGev: 0.5 }),
      /PRECONDITION_FAILED/,
    );
    const a = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity();
    const b = EosRelativisticBeamTwissLuminosityCore.evaluateRelativisticBeamTwissLuminosity();
    assert.equal(a.beamOpticsDigestSha256, b.beamOpticsDigestSha256);
    assert.equal(a.beamOpticsDigestSha256.length, 64);
  });

  await t.test("BDD-1340: CLI beam:twiss & MCP relativistic_beam_twiss end-to-end", async () => {
    const cli = runCliJson("beam:twiss");
    const mcp = await callWorkspaceMcp("relativistic_beam_twiss");
    assert.equal(cli.verdict, "BEAM_OPTICS_LUMINOSITY_LOCKED");
    assert.equal(mcp.verdict, "BEAM_OPTICS_LUMINOSITY_LOCKED");
    assert.equal(cli.beamOpticsDigestSha256, mcp.beamOpticsDigestSha256);
  });
});
