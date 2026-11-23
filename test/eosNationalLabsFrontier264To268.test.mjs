import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import {
  ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS,
  EosInterferometricSarDeformationCore,
  EosMagnetoplasmadynamicThrusterMhdCore,
  EosOpticalLatticeAtomicClockRelativisticSyncCore,
  EosQuantumEntanglementRepeaterBbpsswCore,
  EosSmartContractBytecodeGasSymbolicVerifierCore,
} from "../src/core/index.ts";
import { EosMcpServer } from "../src/mcp/eosMcpServer.ts";

const mcpServer = new EosMcpServer(undefined, "full");

function runCliJson(command) {
  const stdout = execFileSync(process.execPath, [path.join(process.cwd(), "bin/eos.mjs"), command, "--json"], {
    encoding: "utf8",
  });
  return JSON.parse(stdout);
}

async function callWorkspaceMcpRaw(action, extraArgs = {}) {
  return mcpServer.handleRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "eos_enterprise_workspace",
      arguments: { action, ...extraArgs },
    },
  });
}

async function callWorkspaceMcp(action, extraArgs = {}) {
  const res = await callWorkspaceMcpRaw(action, extraArgs);
  assert.equal(res.error, undefined);
  assert.ok(Array.isArray(res.result?.content));
  return JSON.parse(res.result.content[0].text);
}

test("CHANGE-130 Registry: Extended enterprise workspace action catalog reaches 172 actions", () => {
  assert.equal(ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.size, 172);
  for (const action of [
    "optical_atomic_clock_sync",
    "insar_crustal_deformation",
    "mpd_magnetoplasmadynamic_thruster",
    "quantum_repeater_bbpssw",
    "bytecode_symbolic_gas_prover",
  ]) {
    assert.ok(ENTERPRISE_WORKSPACE_EXTENDED_ACTIONS.has(action), `Missing registry action: ${action}`);
  }
});

test("SPEC-264: Optical Lattice Atomic Clock & Relativistic Geodesy Sync Core (BDD-1366..BDD-1370)", async (t) => {
  await t.test("BDD-1366: Nominal Sr-87 optical lattice ensemble achieves femtosecond TAI lock", () => {
    const report = EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync();
    assert.equal(report.specId, "SPEC-264");
    assert.equal(report.regime, "FEMTOSECOND_TAI_LOCKED");
    assert.ok(report.combinedInstabilityE18 <= report.maxFractionalInstabilityE18);
    assert.ok(report.lineQualityFactorQ > 0);
    assert.ok(report.quantumProjectionSnr > 0);
    assert.ok(report.allanDeviationE18 > 0);
    assert.ok(report.bbrResidualE18 > 0);
    assert.ok(report.gravitationalRedshiftE18 > 0);
    assert.ok(report.timingSyncUncertaintyFs > 0);
    assert.equal(Object.isFrozen(report), true);
  });

  await t.test("BDD-1367: High fiber link phase noise triggers BBR or geopotential drift warning", () => {
    const report = EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync({
      fiberLinkPhaseNoiseFs: 3.2,
    });
    assert.equal(report.regime, "BBR_OR_GEOPOTENTIAL_DRIFT_WARN");
  });

  await t.test("BDD-1368: Large geopotential height difference breaches fractional instability ceiling", () => {
    const report = EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync({
      geopotentialHeightDiffMeters: 65.0,
    });
    assert.equal(report.regime, "ALLAN_STABILITY_BREACH");
    assert.ok(report.combinedInstabilityE18 > report.maxFractionalInstabilityE18);
  });

  await t.test("BDD-1369: Atom count < 100 throws PRECONDITION_FAILED and nominal calls repeat digest", () => {
    assert.throws(
      () =>
        EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync({
          interrogationAtomCount: 50,
        }),
      /PRECONDITION_FAILED/,
    );
    const rep1 = EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync();
    const rep2 = EosOpticalLatticeAtomicClockRelativisticSyncCore.evaluateOpticalLatticeAtomicClockRelativisticSync();
    assert.equal(rep1.opticalClockDigestSha256, rep2.opticalClockDigestSha256);
    assert.equal(rep1.opticalClockDigestSha256.length, 64);
  });

  await t.test("BDD-1370: End-to-end CLI clock:optical and MCP optical_atomic_clock_sync dispatch", async () => {
    const cliReport = runCliJson("clock:optical");
    assert.equal(cliReport.specId, "SPEC-264");
    assert.equal(cliReport.regime, "FEMTOSECOND_TAI_LOCKED");

    const mcpReport = await callWorkspaceMcp("optical_atomic_clock_sync", {
      clockEnsembleId: "BIPM-SR87-OPTICAL-LATTICE-01",
    });
    assert.equal(mcpReport.action, "optical_atomic_clock_sync");
    assert.equal(mcpReport.regime, "FEMTOSECOND_TAI_LOCKED");
    assert.equal(mcpReport.opticalClockDigestSha256, cliReport.opticalClockDigestSha256);
  });
});

test("SPEC-265: Interferometric SAR Crustal Deformation & Coherence Core (BDD-1371..BDD-1375)", async (t) => {
  await t.test("BDD-1371: C-band repeat-pass 12-day pair achieves coherent phase unwrapping", () => {
    const report = EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation();
    assert.equal(report.specId, "SPEC-265");
    assert.equal(report.regime, "PHASE_UNWRAPPED_COHERENT");
    assert.ok(report.totalCoherence >= 0.65);
    assert.ok(report.criticalBaselineMeters > 0);
    assert.ok(report.geometricCoherence > 0);
    assert.ok(report.temporalCoherence > 0);
    assert.ok(report.thermalCoherence > 0);
    assert.ok(report.losDisplacementMm !== 0);
    assert.ok(report.displacementUncertaintyMm > 0);
    assert.equal(Object.isFrozen(report), true);
  });

  await t.test("BDD-1372: Extended temporal baseline triggers temporal decorrelation warning", () => {
    const report = EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation({
      temporalBaselineDays: 28.0,
    });
    assert.equal(report.regime, "TEMPORAL_DECORRELATION_WARNING");
    assert.ok(report.totalCoherence < 0.65);
    assert.ok(report.totalCoherence >= report.minCoherenceThreshold);
  });

  await t.test("BDD-1373: Excessive perpendicular baseline breaches critical coherence threshold", () => {
    const report = EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation({
      perpendicularBaselineMeters: 3200.0,
    });
    assert.equal(report.regime, "BASELINE_DECORRELATION_CRITICAL");
    assert.ok(report.totalCoherence < report.minCoherenceThreshold);
  });

  await t.test(
    "BDD-1374: Out-of-bounds incidence angle throws PRECONDITION_FAILED and nominal calls repeat digest",
    () => {
      assert.throws(
        () => EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation({ incidenceAngleDeg: 92.0 }),
        /PRECONDITION_FAILED/,
      );
      const rep1 = EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation();
      const rep2 = EosInterferometricSarDeformationCore.evaluateInterferometricSarDeformation();
      assert.equal(rep1.insarDeformationDigestSha256, rep2.insarDeformationDigestSha256);
      assert.equal(rep1.insarDeformationDigestSha256.length, 64);
    },
  );

  await t.test("BDD-1375: End-to-end CLI insar:deform and MCP insar_crustal_deformation dispatch", async () => {
    const cliReport = runCliJson("insar:deform");
    assert.equal(cliReport.specId, "SPEC-265");
    assert.equal(cliReport.regime, "PHASE_UNWRAPPED_COHERENT");

    const mcpReport = await callWorkspaceMcp("insar_crustal_deformation", {
      passPairId: "SENTINEL1-CSK-TANDEM-FAULT-01",
    });
    assert.equal(mcpReport.action, "insar_crustal_deformation");
    assert.equal(mcpReport.regime, "PHASE_UNWRAPPED_COHERENT");
    assert.equal(mcpReport.insarDeformationDigestSha256, cliReport.insarDeformationDigestSha256);
  });
});

test("SPEC-266: Magnetoplasmadynamic (MPD) Thruster & Lorentz MHD Core (BDD-1376..BDD-1380)", async (t) => {
  await t.test("BDD-1376: Nominal AF-MPD lithium 450 kW thruster operates in locked acceleration regime", () => {
    const report = EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd();
    assert.equal(report.specId, "SPEC-266");
    assert.equal(report.regime, "LORENTZ_PLASMA_ACCELERATION_LOCKED");
    assert.ok(report.onsetStabilityRatio <= 0.85);
    assert.ok(report.selfFieldThrustNewtons > 0);
    assert.ok(report.appliedFieldThrustNewtons > 0);
    assert.ok(report.totalThrustNewtons > 0);
    assert.ok(report.exhaustVelocityMPerSec > 0);
    assert.ok(report.specificImpulseSec > 0);
    assert.ok(report.thrustEfficiency > 0);
    assert.equal(Object.isFrozen(report), true);
  });

  await t.test("BDD-1377: Discharge current pushing stability ratio into 85%-100% triggers erosion warning", () => {
    const report = EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd({
      dischargeCurrentAmps: 5000.0,
    });
    assert.equal(report.regime, "ANODE_FALL_EROSION_WARNING");
    assert.ok(report.onsetStabilityRatio > 0.85 && report.onsetStabilityRatio <= 1.0);
  });

  await t.test("BDD-1378: Overcurrent exceeding onset current triggers onset instability critical", () => {
    const report = EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd({
      dischargeCurrentAmps: 6200.0,
    });
    assert.equal(report.regime, "ONSET_INSTABILITY_CRITICAL");
    assert.ok(report.onsetStabilityRatio > 1.0);
  });

  await t.test("BDD-1379: Inverted electrode radii throw PRECONDITION_FAILED and nominal calls repeat digest", () => {
    assert.throws(
      () =>
        EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd({
          anodeRadiusMeters: 0.01,
          cathodeRadiusMeters: 0.05,
        }),
      /PRECONDITION_FAILED/,
    );
    const rep1 = EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd();
    const rep2 = EosMagnetoplasmadynamicThrusterMhdCore.evaluateMagnetoplasmadynamicThrusterMhd();
    assert.equal(rep1.mpdThrusterDigestSha256, rep2.mpdThrusterDigestSha256);
    assert.equal(rep1.mpdThrusterDigestSha256.length, 64);
  });

  await t.test("BDD-1380: End-to-end CLI mpd:thruster and MCP mpd_magnetoplasmadynamic_thruster dispatch", async () => {
    const cliReport = runCliJson("mpd:thruster");
    assert.equal(cliReport.specId, "SPEC-266");
    assert.equal(cliReport.regime, "LORENTZ_PLASMA_ACCELERATION_LOCKED");

    const mcpReport = await callWorkspaceMcp("mpd_magnetoplasmadynamic_thruster", {
      thrusterId: "AF-MPD-LITHIUM-500KW-01",
    });
    assert.equal(mcpReport.action, "mpd_magnetoplasmadynamic_thruster");
    assert.equal(mcpReport.regime, "LORENTZ_PLASMA_ACCELERATION_LOCKED");
    assert.equal(mcpReport.mpdThrusterDigestSha256, cliReport.mpdThrusterDigestSha256);
  });
});

test("SPEC-267: Quantum Entanglement Repeater & BBPSSW Purification Core (BDD-1381..BDD-1385)", async (t) => {
  await t.test("BDD-1381: 2-level 4-segment BBPSSW repeater chain locks Bell-pair distillation", () => {
    const report = EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw();
    assert.equal(report.specId, "SPEC-267");
    assert.equal(report.regime, "BELL_PAIR_DISTILLATION_LOCKED");
    assert.ok(report.endToEndFidelity >= report.minEndToEndFidelity);
    assert.ok(report.purifiedLinkFidelity > report.rawBellPairFidelity);
    assert.ok(report.purificationSuccessProb > 0);
    assert.equal(report.segmentCount, 4);
    assert.ok(report.memoryDecoherenceFactor >= 0.88);
    assert.ok(report.distilledEbitRatePerSec > 0);
    assert.equal(Object.isFrozen(report), true);
  });

  await t.test("BDD-1382: Long classical heralding delay drops memory factor below 0.88 warning threshold", () => {
    const report = EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw({
      heraldingRoundTripMs: 18.0,
      minEndToEndFidelity: 0.78,
    });
    assert.equal(report.regime, "DECOHERENCE_RATE_DEGRADED");
    assert.ok(report.memoryDecoherenceFactor < 0.88);
  });

  await t.test("BDD-1383: Raw Bell pair fidelity <= 0.5 triggers below purification threshold", () => {
    const report = EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw({
      rawBellPairFidelity: 0.48,
    });
    assert.equal(report.regime, "BELOW_PURIFICATION_THRESHOLD");
  });

  await t.test(
    "BDD-1384: Invalid repeaterSwapLevels throws PRECONDITION_FAILED and nominal calls repeat digest",
    () => {
      assert.throws(
        () =>
          EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw({ repeaterSwapLevels: 0 }),
        /PRECONDITION_FAILED/,
      );
      const rep1 = EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw();
      const rep2 = EosQuantumEntanglementRepeaterBbpsswCore.evaluateQuantumEntanglementRepeaterBbpssw();
      assert.equal(rep1.quantumRepeaterDigestSha256, rep2.quantumRepeaterDigestSha256);
      assert.equal(rep1.quantumRepeaterDigestSha256.length, 64);
    },
  );

  await t.test("BDD-1385: End-to-end CLI qnet:repeater and MCP quantum_repeater_bbpssw dispatch", async () => {
    const cliReport = runCliJson("qnet:repeater");
    assert.equal(cliReport.specId, "SPEC-267");
    assert.equal(cliReport.regime, "BELL_PAIR_DISTILLATION_LOCKED");

    const mcpReport = await callWorkspaceMcp("quantum_repeater_bbpssw", {
      linkTopologyId: "QNET-BBPSSW-REPEATER-CHAIN-01",
    });
    assert.equal(mcpReport.action, "quantum_repeater_bbpssw");
    assert.equal(mcpReport.regime, "BELL_PAIR_DISTILLATION_LOCKED");
    assert.equal(mcpReport.quantumRepeaterDigestSha256, cliReport.quantumRepeaterDigestSha256);
  });
});

test("SPEC-268: Smart-Contract Bytecode Gas & Symbolic CEI Verifier Core (BDD-1386..BDD-1390)", async (t) => {
  await t.test("BDD-1386: Bounded loop and CEI compliance proves symbolic gas and reentrancy safety", () => {
    const report = EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier();
    assert.equal(report.specId, "SPEC-268");
    assert.equal(report.regime, "SYMBOLIC_GAS_AND_CEI_PROVED");
    assert.equal(report.ceiInvariantSatisfied, true);
    assert.ok(report.gasUtilizationRatio <= 0.85);
    assert.equal(report.cyclomaticPaths, 11);
    assert.ok(report.worstCaseGasUsed <= report.blockGasLimitCeiling);
    assert.equal(Object.isFrozen(report), true);
  });

  await t.test("BDD-1387: Elevated loop bound or mutex-guarded post-call write triggers gas stipend warning", () => {
    const report = EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier({
      maxLoopBound: 25,
    });
    assert.equal(report.regime, "GAS_STIPEND_PRESSURE_WARNING");
    assert.ok(report.gasUtilizationRatio > 0.85);

    const reportPostWrite =
      EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier({
        stateWritesAfterExternalCall: 1,
        reentrancyMutexLocked: true,
      });
    assert.equal(reportPostWrite.regime, "GAS_STIPEND_PRESSURE_WARNING");
  });

  await t.test("BDD-1388: Post-call state write without mutex triggers reentrancy critical failure", () => {
    const report = EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier({
      stateWritesAfterExternalCall: 2,
      reentrancyMutexLocked: false,
    });
    assert.equal(report.regime, "REENTRANCY_OR_UNBOUNDED_GAS_CRITICAL");
    assert.equal(report.ceiInvariantSatisfied, false);
  });

  await t.test(
    "BDD-1389: Disconnected CFG (edges < nodes - 1) throws PRECONDITION_FAILED and nominal calls repeat digest",
    () => {
      assert.throws(
        () =>
          EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier({
            cfgNodeCount: 10,
            cfgEdgeCount: 5,
          }),
        /PRECONDITION_FAILED/,
      );
      const rep1 = EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier();
      const rep2 = EosSmartContractBytecodeGasSymbolicVerifierCore.evaluateSmartContractBytecodeGasSymbolicVerifier();
      assert.equal(rep1.bytecodeGasDigestSha256, rep2.bytecodeGasDigestSha256);
      assert.equal(rep1.bytecodeGasDigestSha256.length, 64);
    },
  );

  await t.test("BDD-1390: End-to-end CLI evm:prove and MCP bytecode_symbolic_gas_prover dispatch", async () => {
    const cliReport = runCliJson("evm:prove");
    assert.equal(cliReport.specId, "SPEC-268");
    assert.equal(cliReport.regime, "SYMBOLIC_GAS_AND_CEI_PROVED");

    const mcpReport = await callWorkspaceMcp("bytecode_symbolic_gas_prover", {
      contractId: "EVM-VAULT-SETTLEMENT-CORE-01",
    });
    assert.equal(mcpReport.action, "bytecode_symbolic_gas_prover");
    assert.equal(mcpReport.regime, "SYMBOLIC_GAS_AND_CEI_PROVED");
    assert.equal(mcpReport.bytecodeGasDigestSha256, cliReport.bytecodeGasDigestSha256);
  });
});
