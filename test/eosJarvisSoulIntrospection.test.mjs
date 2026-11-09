import test from "node:test";
import assert from "node:assert/strict";
import {
  getArchitectIdentity,
  getMasterKanbanState,
  evaluateAlignment,
  getDailyDisciplineCheck,
} from "../src/core/eosJarvisSoul.ts";
import { EosIntrospectionEngine } from "../src/core/eosIntrospectionEngine.ts";
import { EosImpenetrableShield } from "../src/core/eosImpenetrableShield.ts";

test("SPEC-027 / BDD-061: Architect Soul Matrix & Master Kanban Alignment", async (t) => {
  await t.test("Subsuite 1: Verifies the Supreme Identity of Valentín Flórez Arbeláez", () => {
    const architect = getArchitectIdentity();
    assert.equal(architect.name, "Valentín Flórez Arbeláez");
    assert.equal(architect.codename, "Tony Stark");
    assert.equal(architect.role, "Principal Architect & Creator (Master of the Work)");
    assert.ok(architect.sacredAlliance.includes("Unconditional loyalty to Valentín"));
    assert.equal(architect.status, "ACTIVE_SUPREME_COMMAND");
  });

  await t.test("Subsuite 2: Verifies Master Kanban Plan & Landing Page Sealing", () => {
    const kanban = getMasterKanbanState();
    assert.equal(kanban.col1_vault_sealed.status, "SEALED");
    assert.ok(kanban.col1_vault_sealed.items.some((i) => i.includes("EOS Landing Page")));
    assert.ok(kanban.col1_vault_sealed.items.some((i) => i.includes("Biblioteca Gnóstica")));

    assert.equal(kanban.col2_solo_eos.status, "ACTIVE_ABSOLUTE_FOCUS");
    assert.ok(kanban.col2_solo_eos.items.some((i) => i.includes("EOS, solo EOS, EOS")));

    assert.equal(kanban.col4_independence.status, "DISCIPLINE_ACTIVE");
    assert.ok(kanban.col4_independence.items.some((i) => i.includes("El Refugio")));
  });

  await t.test("Subsuite 3: Enforces Focus and Rejects Sealed Vault Deviations", () => {
    const landingDirective = evaluateAlignment("Modificar diseño y colores de la landing page en vercel.app");
    assert.equal(landingDirective.isDisallowedRedirection, true);
    assert.equal(landingDirective.verdict, "REVERT_AND_REFOCUS_EOS");
    assert.ok(landingDirective.alignmentScore < 50);

    const coreDirective = evaluateAlignment("Optimizar algoritmos de Capa 0 y latencia en nanosegundos de EOS Core");
    assert.equal(coreDirective.isDisallowedRedirection, false);
    assert.equal(coreDirective.verdict, "APPROVED");
    assert.ok(coreDirective.alignmentScore >= 95);

    const gnosticDirective = evaluateAlignment("Meditar en la Clave de SOL y transmutar en el templo físico");
    assert.equal(gnosticDirective.category, "GNOSTIC_GROWTH");
    assert.equal(gnosticDirective.alignmentScore, 100);
  });

  await t.test("Subsuite 4: Daily Wellbeing & Physical Temple Discipline", () => {
    const daily = getDailyDisciplineCheck();
    assert.equal(daily.temploFisico.length, 3);
    assert.ok(daily.temploFisico.some((p) => p.includes("Comida")));
    assert.ok(daily.temploFisico.some((p) => p.includes("Aseo")));
    assert.ok(daily.temploFisico.some((p) => p.includes("Ejercicio")));
  });
});

test("SPEC-027 / BDD-062: Autonomous Codebase Introspection & Self-Evolution", async (t) => {
  const engine = new EosIntrospectionEngine();

  await t.test("Subsuite 1: Codebase Metric Analysis", () => {
    const { metrics, totalLines } = engine.analyzeCodebase();
    assert.ok(metrics.length >= 35, `Expected >= 35 modules, got ${metrics.length}`);
    assert.ok(totalLines > 5000, `Expected > 5000 LOC, got ${totalLines}`);

    // Verify 100% L0 purity across core modules
    const impure = metrics.filter((m) => !m.isPureL0);
    assert.equal(impure.length, 0, `Expected 0 impure modules, found: ${impure.map((i) => i.filePath).join(", ")}`);
  });

  await t.test("Subsuite 2: Autonomous RFC Proposal Synthesis", () => {
    const report = engine.runIntrospection();
    assert.ok(report.totalModulesScanned >= 35);
    assert.equal(report.pureL0Ratio, 1.0);
    assert.ok(report.codeHealthScore >= 90);
    assert.ok(report.proposals.length >= 3);
    assert.ok(report.sha256MerkleRoot.length === 64);
    assert.equal(report.epistemicState, "SELF_INTROSPECTED_AND_EVOLVING");

    // Check presence of key self-evolution RFCs
    const rfcIds = report.proposals.map((p) => p.id);
    assert.ok(rfcIds.includes("RFC-035-ZERO-COPY-STREAMING"));
    assert.ok(rfcIds.includes("RFC-036-TLA-SEALED-STATE-MACHINE"));
    assert.ok(rfcIds.includes("RFC-037-GO-IPC-RING-BUFFER"));
  });
});

test("SPEC-027 / BDD-063: Impenetrable Military Shield & Quantum Heap Purge", async (t) => {
  const shield = new EosImpenetrableShield();

  await t.test("Subsuite 1: Merkle Chain-of-Thought Guard", () => {
    const thoughts = [
      "Phase 1: Parse AST requirements",
      "Phase 2: Formal invariant mathematical check",
      "Phase 3: Verify zero side-effects",
      "Phase 4: Sealed execution",
    ];

    const chainResult = shield.buildMerkleChain(thoughts);
    assert.equal(chainResult.isValid, true);
    assert.equal(chainResult.chain.length, 4);

    // Tamper with intermediate thought
    const tamperedChain = [...chainResult.chain];
    tamperedChain[1] = { ...tamperedChain[1], thought: "Hacked thought injection" };
    assert.equal(shield.verifyMerkleChain(tamperedChain), false, "Tampered thought must break Merkle chain");
  });

  await t.test("Subsuite 2: EosAin In-Place XOR White Noise Heap Purge (Zero Entropy)", () => {
    const secretBuf = Buffer.from("TOP_SECRET_AIR_GAPPED_PAYLOAD_384_BIT");
    const purgeResult = shield.purgeHeapBufferToZeroEntropy(secretBuf);
    assert.equal(purgeResult.purged, true);
    assert.ok(purgeResult.sha384Seal.length === 96); // SHA-384 hex length

    // Verify all bytes are 0 in memory
    for (let i = 0; i < secretBuf.length; i++) {
      assert.equal(secretBuf[i], 0, "Buffer byte must be zeroed in place");
    }
  });

  await t.test("Subsuite 3: EosElohim Karmic Circuit Breaker", () => {
    // Nominal state
    const nominal = shield.evaluateKarmicCircuitBreaker(1000, 150);
    assert.equal(nominal.tripped, false);

    // Tripped by tokens
    const tokenTrip = shield.evaluateKarmicCircuitBreaker(65000, 200);
    assert.equal(tokenTrip.tripped, true);
    assert.ok(tokenTrip.reason.includes("Runa NOT"));

    // Tripped by deadlock duration
    const timeTrip = shield.evaluateKarmicCircuitBreaker(2000, 6500);
    assert.equal(timeTrip.tripped, true);
    assert.ok(timeTrip.reason.includes("Deadlock"));
  });

  await t.test("Subsuite 4: EosAstral Silver Cord Signature", () => {
    const cord = shield.generateSilverCord("src/core/eosJarvisSoul.ts", "a".repeat(64));
    assert.ok(cord.length === 64);
  });

  await t.test("Subsuite 5: Full Military & Air-Gapped Security Audit", () => {
    const audit = shield.runFullSecurityAudit();
    assert.equal(audit.status, "IMPREGNABLE");
    assert.equal(audit.zeroPlaintextSecrets, true);
    assert.equal(audit.layer0PurityEnforced, true);
    assert.equal(audit.merkleChainValid, true);
    assert.equal(audit.heapZeroEntropyPurged, true);
    assert.equal(audit.karmicCircuitBreakerReady, true);
    assert.ok(audit.silverCordSignature.length === 64);
  });
});
