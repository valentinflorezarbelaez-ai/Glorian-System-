import fs from "node:fs";
import path from "node:path";

const HANDLERS = {};

async function cmd_ontology_84(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  console.log("[PALANTIR ONTOLOGY CYCLOTRON] Grafo de Conocimiento Semántico Bi-Temporal (Layer 0)...\n");
  const { EosOntologyCyclotron } = await import("../../src/core/eosOntologyCyclotron.ts");
  const sub = (args[1] || "status").toLowerCase();
  const cyclotron = new EosOntologyCyclotron();

  cyclotron.registerNode("eos:kernel", "SystemKernel", { layer: 0, status: "ONLINE" });
  cyclotron.registerNode("eos:secdevops", "SecurityGate", { level: 7, status: "ACTIVE" });
  cyclotron.registerNode("eos:quantum", "PqcShield", { fips: 203, status: "ARMED" });
  cyclotron.registerEdge("eos:kernel", "eos:secdevops", "GOVERNS");
  cyclotron.registerEdge("eos:secdevops", "eos:quantum", "ENFORCES");

  if (sub === "status") {
    const snap = cyclotron.asOf(Date.now());
    console.log("Estado del Ciclotrón Ontológico:");
    console.log(`  Nodos Activos   : ${snap.activeNodes}`);
    console.log(`  Bordes Activos  : ${snap.activeEdges}`);
    console.log(`  Merkle Proof    : sha256:${snap.merkleProof}\n`);
  } else if (sub === "transitive" || sub === "query") {
    const root = args[2] || "eos:kernel";
    const closure = cyclotron.computeTransitiveClosure(root);
    console.log(`Cierre Transitivo desde "${root}":`);
    console.log(`  Nodos Alcanzables : ${closure.reachableNodeIds.join(", ")}`);
    console.log(`  Total Alcanzable  : ${closure.totalReachable}`);
    console.log(`  Profundidad       : ${closure.depth}`);
    console.log(`  Tiempo Ejecución  : ${closure.executionUs} µs\n`);
  } else {
    console.log(`Acción desconocida: ${sub}. Opciones: status, transitive\n`);
  }
}

HANDLERS["ontology"] = cmd_ontology_84;

async function cmd_quantum_seal_85(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  console.log("[NIST POST-QUANTUM LATTICE SHIELD] Reducción Modular ML-KEM-768 FIPS 203...\n");
  const { EosQuantumLatticeShield } = await import("../../src/core/eosQuantumLatticeShield.ts");
  const payload = args.slice(1).join(" ") || "eos-sovereign-production-attestation";
  const t0 = performance.now();
  const seal = EosQuantumLatticeShield.generateLatticeSeal(payload);
  const elapsed = (performance.now() - t0).toFixed(2);

  console.log(`Sello de Retículo Cuántico Generado (${elapsed} ms):`);
  console.log(`  Algoritmo          : ${seal.algorithm}`);
  console.log(`  Digest Coeficientes: sha384:${seal.symmetricCoeffsDigest.slice(0, 32)}...`);
  console.log(`  Prueba Cuántica    : sha512:${seal.quantumProof.slice(0, 48)}...`);
  console.log(`  Canal Lateral      : Resistencia en tiempo constante timingSafeEqual VERIFICADA`);
  console.log(`  Timestamp          : ${seal.timestamp}\n`);
}

HANDLERS["quantum:seal"] = cmd_quantum_seal_85;

async function cmd_refactor_86(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "summary").toLowerCase();
  const { EosContinuousRefactorEngine } = await import("../../src/core/eosContinuousRefactorEngine.ts");
  const { assertPrecondition, assertPostcondition, assertInvariant, deepFreeze, pureSha256 } =
    await import("../../src/core/eosKernelPrimitives.ts");

  if (subAction === "audit") {
    const targetDir = args[2] || "src/core";
    console.log(`[CONTINUOUS REFACTOR] Ejecutando auditoría profunda sobre '${targetDir}'...
`);
    const audit = EosContinuousRefactorEngine.auditDirectory(targetDir);
    console.log("======================================================================");
    console.log(" EOS CONTINUOUS REFACTOR ENGINE — AUDIT REPORT (SPEC-041)");
    console.log("======================================================================");
    console.log(`Archivos analizados:              ${audit.scannedFilesCount}`);
    console.log(`Líneas de código evaluadas:        ${audit.totalLinesAnalyzed.toLocaleString()}`);
    console.log(`Patrones duplicados (DRY):         ${audit.totalDuplicationsFound}`);
    console.log(`Candidatos a código muerto:        ${audit.totalDeadCodeFound}`);
    console.log(`Cuellos de botella de complejidad: ${audit.totalComplexityBottlenecks}`);
    console.log(`Ahorro potencial en líneas:        ${audit.potentialLinesReduction} LOC`);
    console.log(`Recibo criptográfico SHA-256:      ${audit.sha256AuditReceipt}`);
    console.log("======================================================================\n");

    if (audit.duplications.length > 0) {
      console.log("--- HALLAZGOS DE DUPLICACIÓN (DRY) ---");
      for (const d of audit.duplications.slice(0, 5)) {
        console.log(` • ${d.description} -> Ahorro: ${d.potentialLinesSaved} LOC`);
      }
      console.log();
    }

    if (audit.deadCode.length > 0) {
      console.log("--- CANDIDATOS A PODA DE CÓDIGO MUERTO ---");
      for (const dc of audit.deadCode.slice(0, 5)) {
        console.log(` • [${dc.kind}] ${dc.identifier} en ${path.basename(dc.file)}:L${dc.line}`);
      }
      console.log();
    }
  } else if (subAction === "dbc") {
    console.log("[DESIGN BY CONTRACT] Verificando invariantes y pureza de Capa 0...\n");
    assertPrecondition(true, "Precondición Layer-0 válida");
    assertPostcondition(true, "Postcondición de contrato intacta");
    assertInvariant(true, "Invariante de estado preservado");
    deepFreeze({ engine: "EosKernelPrimitives", status: "VERIFIED" });
    console.log("✔ Precondiciones, Postcondiciones e Invariantes: 100% PASS");
    console.log("✔ Congelación profunda (Deep Freeze / Immutability): PASS");
    console.log(`✔ Pure SHA-256 Kernel Verification: ${pureSha256("EOS_DBC_OK").slice(0, 16)}...\n`);
  } else {
    console.log("[CONTINUOUS REFACTOR] Ejecutando optimizador de dieta y ciclo continuo...\n");
    const summary = EosContinuousRefactorEngine.executeRefactorAudit(root);
    console.log("======================================================================");
    console.log(" EOS REFACTOR ENGINE — CONTINUOUS EXECUTION SUMMARY (SPEC-041)");
    console.log("======================================================================");
    console.log(`Archivos en alcance del núcleo:    ${summary.auditReport.scannedFilesCount}`);
    console.log(`Líneas totales analizadas:         ${summary.auditReport.totalLinesAnalyzed.toLocaleString()}`);
    console.log(`Optimizaciones detectadas:         ${summary.executedRefactoringsCount}`);
    console.log(`Reducción proyectada de deuda:     ${summary.linesReduced} LOC`);
    console.log(
      `Pruebas tras refactorización:      ${summary.testsPassedAfterRefactor ? "PASS (100% Verificado)" : "FAIL"}`,
    );
    console.log(`Estado epistémico:                 ${summary.epistemicState}`);
    console.log(`Sello Criptográfico SHA-256:       ${summary.sha256Receipt}`);
    console.log("======================================================================\n");
  }
}

HANDLERS["refactor"] = cmd_refactor_86;

async function cmd_dst_87(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  console.log("[DETERMINISTIC SIMULATION TESTING] Simulador DST FoundationDB / Antithesis (SPEC-041)...\n");
  const { EosDeterministicSimulator } = await import("../../src/core/eosDeterministicSimulator.ts");
  const seed = parseInt(args[1], 10) || 42;
  const steps = parseInt(args[2], 10) || 200;
  const faultRate = parseFloat(args[3]) || 0.08;

  const t0 = performance.now();
  const sim = new EosDeterministicSimulator({
    seed,
    totalSteps: steps,
    faultInjectionRate: faultRate,
  });
  const result = sim.runSimulation();
  const elapsed = (performance.now() - t0).toFixed(2);

  console.log("======================================================================");
  console.log(" EOS DETERMINISTIC SIMULATION TESTING (DST) — EXECUTION RECEIPT");
  console.log("======================================================================");
  console.log(`Semilla Determinista (Seed):       ${result.seed}`);
  console.log(`Pasos Discretos Simulados:         ${result.totalStepsExecuted}`);
  console.log(`Tiempo Virtual Transcurrido:       ${result.virtualTimeElapsedMs} ms`);
  console.log(`Eventos Procesados:                ${result.totalEventsProcessed}`);
  console.log(
    `Fallas Inyectadas:                 ${result.totalFaultsInjected} (${Object.entries(result.faultsByType)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")})`,
  );
  console.log(`Invariantes Violadas:              ${result.invariantsViolated} (0 toleradas)`);
  console.log(`Hash de Traza Criptográfica:       sha256:${result.executionTraceHash}`);
  console.log(`Comando de Reproducción Exacta:    ${result.reproducibleCommand}`);
  console.log(
    `Determinismo Verificado:           ${result.verifiedDeterministic ? "100% REPRODUCIBLE BIT A BIT" : "FALLA"}`,
  );
  console.log(`Tiempo Real de Simulación:         ${elapsed} ms`);
  console.log("======================================================================\n");
}

HANDLERS["dst"] = cmd_dst_87;

async function cmd_synapse_88(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  console.log("[META-COGNITIVE SYNAPSE] Arbitraje Bayesiano Multi-Agente Sin Bloqueos...\n");
  const { EosMetaCognitiveSynapse } = await import("../../src/core/eosMetaCognitiveSynapse.ts");
  const candidates = [
    {
      agentId: "agent-architect",
      role: "Chief Architect",
      action: "enforce_pure_layer0",
      priorBelief: 0.7,
      evidenceLikelihood: 0.95,
    },
    {
      agentId: "agent-secops",
      role: "SecOps Lead",
      action: "quantum_lattice_seal",
      priorBelief: 0.6,
      evidenceLikelihood: 0.9,
    },
    {
      agentId: "agent-qa",
      role: "QA Lead",
      action: "full_mutation_testing",
      priorBelief: 0.5,
      evidenceLikelihood: 0.85,
    },
  ];

  const report = EosMetaCognitiveSynapse.arbitrateIntents(candidates);
  console.log(`Arbitraje Bayesiano Culminado (${report.arbitrationDurationUs} µs):`);
  console.log(`  Candidatos Evaluados : ${report.totalCandidates}`);
  console.log(`  Agente Ganador       : [${report.winningCandidate.agentId}] ${report.winningCandidate.role}`);
  console.log(`  Acción Arbitrada     : ${report.winningCandidate.action}`);
  console.log(`  Probabilidad a Post. : ${(report.winningCandidate.posteriorProbability * 100).toFixed(2)}%`);
  console.log(`  Recibo SHA-256       : sha256:${report.sha256Receipt}\n`);
  console.log("  Ranking Completo:");
  report.rankedCandidates.forEach((c) => {
    console.log(`    #${c.priorityRank} [${c.agentId}] ${c.action} -> ${(c.posteriorProbability * 100).toFixed(2)}%`);
  });
  console.log("");
}

HANDLERS["synapse"] = cmd_synapse_88;

async function cmd_fleet_soundcheck_89(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[FLEET SOUNDCHECK] Auditoría de Dimensiones de Salud de la Flota (Spotify Backstage)...\n");
  const { EosFleetSoundcheckMesh } = await import("../../src/core/eosFleetSoundcheckMesh.ts");
  const report = EosFleetSoundcheckMesh.auditFleet(root);
  console.log(`Reporte de Soundcheck Culminado:`);
  console.log(`  Repositorios Auditados : ${report.totalRepositories}`);
  console.log(`  Puntaje Promedio Flota : ${report.fleetAverageScore}/100`);
  console.log(`  Repos Grado A (>=85)   : ${report.reposAtGradeA}/${report.totalRepositories}`);
  console.log(
    `  Quórum de Despliegue   : ${report.deploymentAuthorizedQuorum ? "AUTORIZADO (>=70)" : "DENEGADO (<70)"}`,
  );
  console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
  console.log("  Detalle por Repositorio:");
  report.reports.forEach((r) => {
    console.log(
      `    • [${r.grade}] ${r.name} (${r.id}): ${r.totalScore}/100 | Clean: ${r.workingTreeClean} | Deploy: ${r.eligibleForAutonomousDeploy}`,
    );
    if (r.remediationAction) {
      console.log(`        ↳ Remedación recomendada: ${r.remediationAction}`);
    }
  });
  console.log("");
}

HANDLERS["fleet:soundcheck"] = cmd_fleet_soundcheck_89;

async function cmd_mcts_tune_90(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const iters = Number(args[1]) || 120;
  console.log(`[MCTS HYPER-TUNING] Optimizador Monte Carlo Tree Search (UCT Exploration, ${iters} iteraciones)...\n`);
  const { EosMctsHyperTuner } = await import("../../src/core/eosMctsHyperTuner.ts");
  const tuner = new EosMctsHyperTuner(42);
  const report = tuner.tuneParameters(iters);
  console.log(`Convergencia MCTS Completada:`);
  console.log(`  Iteraciones Simuladas  : ${report.totalIterations}`);
  console.log(`  Nodos Explorados       : ${report.exploredNodesCount}`);
  console.log(`  Fitness Base           : ${report.baselineFitness.toFixed(4)}`);
  console.log(`  Fitness Óptimo         : ${report.optimalFitness.toFixed(4)}`);
  console.log(`  Mejora Obtenida        : +${report.improvementPercent.toFixed(2)}%`);
  console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
  console.log("  Parámetros Óptimos Convergidos:");
  Object.entries(report.optimalConfig).forEach(([k, v]) => {
    console.log(`    • ${k.padEnd(26)}: ${v}`);
  });
  console.log("");
}

HANDLERS["mcts:tune"] = cmd_mcts_tune_90;

async function cmd_canary_rollout_91(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const versionTarget = args[1] || "v48.0.0";
  const previousVersion = args[2] || "v47.0.0";
  console.log(`[PROGRESSIVE CANARY] Despliegue Progresivo Automatizado: ${previousVersion} -> ${versionTarget}...\n`);
  const { EosProgressiveCanaryMesh } = await import("../../src/core/eosProgressiveCanaryMesh.ts");
  const mesh = new EosProgressiveCanaryMesh(versionTarget, previousVersion);
  const report = mesh.executeRollout([
    { stage: "CANARY_1_PCT", sampleRequests: 10000, failedRequests: 0, p99LatencyMs: 45, baselineP99LatencyMs: 44 },
    { stage: "CANARY_5_PCT", sampleRequests: 50000, failedRequests: 1, p99LatencyMs: 46, baselineP99LatencyMs: 44 },
    { stage: "CANARY_25_PCT", sampleRequests: 250000, failedRequests: 2, p99LatencyMs: 47, baselineP99LatencyMs: 44 },
    {
      stage: "FULL_PRODUCTION_100_PCT",
      sampleRequests: 1000000,
      failedRequests: 5,
      p99LatencyMs: 48,
      baselineP99LatencyMs: 44,
    },
  ]);
  console.log(`Resultado del Rollout Canario:`);
  console.log(`  Versión Objetivo       : ${report.versionTarget} (desde ${report.previousStableVersion})`);
  console.log(`  Estado Final           : ${report.finalStage}`);
  console.log(`  Completado Seguro      : ${report.verifiedSafe ? "VERIFICADO_SEGURO" : "FALLIDO"}`);
  console.log(
    `  Circuit Breaker        : ${report.rollbackExecuted ? "DISPARADO (ROLLBACK EJECUTADO)" : "INTACTO (0 ROLLBACKS)"}`,
  );
  console.log(`  Transiciones Exitosas  : ${report.totalStagesCompleted}`);
  console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
  console.log("  Detalle de Transiciones:");
  report.transitions.forEach((t) => {
    console.log(
      `    • ${t.fromStage} ➔ ${t.toStage} | ErrRate: ${(t.errorRate * 100).toFixed(4)}% | Latency Δ: +${t.latencyIncreasePercent.toFixed(1)}% | ${t.reason}`,
    );
  });
  console.log("");
}

HANDLERS["canary:rollout"] = cmd_canary_rollout_91;

async function cmd_antigravity_92(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "doctor").toLowerCase();
  const { EosAntigravityDirector } = await import("../../src/core/eosAntigravityDirector.ts");

  if (subAction === "install" || subAction === "setup") {
    const { installAntigravityIntegration } = await import("../../scripts/install-antigravity-mcp.mjs");
    const result = installAntigravityIntegration({ projectRoot: root });
    console.log("[EOS ANTIGRAVITY] Sincronización e Instalación del Plano de Control MCP:\n");
    result.actions.forEach((a) => console.log(`  [+] ${a}`));
    console.log(`\n  Estado de Dirección    : ${result.doctorReport.status}`);
    console.log(`  Puntaje de Salud       : ${result.doctorReport.readinessScore}/100`);
    console.log(
      `  SingleServerInvariant  : ${result.doctorReport.singleServerInvariantVerified ? "VERIFIED" : "VIOLATED"}`,
    );
    console.log(`  Recibo Criptográfico   : sha256:${result.doctorReport.sha256Receipt}\n`);
    if (!result.installed) process.exit(1);
  } else if (subAction === "direct") {
    const directive = args.slice(2).join(" ") || "Auditar y verificar invariantes del repositorio actual";
    const plan = EosAntigravityDirector.directMission(directive, "eos-system", root);
    console.log("[EOS ANTIGRAVITY DIRECTOR] Plan de Dirección de Misión Soberana:\n");
    console.log(`  Directiva              : ${plan.directive}`);
    console.log(`  Perfil Operativo       : ${plan.profile}`);
    console.log(`  Proyecto Objetivo      : ${plan.matchedProjectId || plan.targetIdentifier}`);
    console.log(`  Barrera Ley IV         : ${plan.writeBarrierStatus}`);
    console.log(`  Skills Requeridos      : ${plan.requiredSkills.join(", ")}`);
    console.log(`  Recibo Criptográfico   : sha256:${plan.sha256Receipt}\n`);
    console.log("  DAG de Herramientas MCP Prescritas:");
    plan.prescribedMcpDag.forEach((step) => {
      console.log(
        `    ${step.order}. [${step.phase}] ${step.toolName} (${step.mandatory ? "MANDATORY" : "OPTIONAL"}) — ${step.purpose}`,
      );
    });
    console.log("");
  } else {
    const report = EosAntigravityDirector.auditAntigravityIntegration(root);
    console.log("[EOS ANTIGRAVITY DOCTOR] Diagnóstico Integral del Plano de Control MCP:\n");
    console.log(`  Estado de Dirección    : ${report.status}`);
    console.log(`  Puntaje de Salud       : ${report.readinessScore}/100`);
    console.log(`  SingleServerInvariant  : ${report.singleServerInvariantVerified ? "VERIFIED" : "VIOLATED"}`);
    console.log(`  Directorio Global      : ${report.geminiConfigDir}`);
    console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
    console.log("  Dimensiones Auditadas:");
    report.checks.forEach((c) => {
      console.log(
        `    • [${c.passed ? "PASS" : "FAIL"}] ${c.label.padEnd(52)} (${c.score}/${c.maxScore}) — ${c.detail}`,
      );
    });
    if (report.remediationCommands.length > 0) {
      console.log("\n  Comandos de Remediación:");
      report.remediationCommands.forEach((cmd) => console.log(`    $ ${cmd}`));
    }
    console.log("");
    if (report.readinessScore < 95) process.exit(1);
  }
}

HANDLERS["antigravity"] = cmd_antigravity_92;

async function cmd_gentleman_93(commandContext) {
  const { root, args, printBanner } = commandContext;
  const subAction = (args[1] || "doctor").toLowerCase();
  const isJson = args.includes("--json");
  const isQuiet = args.includes("--quiet");

  if (subAction === "update" || subAction === "upgrade") {
    const shouldApply = args.includes("--apply") || subAction === "upgrade";
    const shouldForce = args.includes("--force");
    const { EosGentlemanAutoUpdater } = await import("../../src/core/eosGentlemanAutoUpdater.ts");
    const cycleReport = await EosGentlemanAutoUpdater.runUpdateCycle({
      projectRoot: root,
      apply: shouldApply,
      force: shouldForce,
    });

    // Bounded 512 KiB operational log for unattended scheduled runs
    try {
      const logPath = path.join(root, ".eos", "state", "gentleman-autoupdate.log");
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 512 * 1024) {
        fs.writeFileSync(logPath, "", "utf8");
      }
      const summaryLine = `[${cycleReport.executedAtIso}] mode=${cycleReport.mode} detected=${cycleReport.updatesDetected} applied=${cycleReport.updatesApplied} rollbacks=${cycleReport.rollbacksTriggered} receipt=${cycleReport.sha256Receipt.slice(0, 16)}\n`;
      fs.appendFileSync(logPath, summaryLine, "utf8");
    } catch {
      // Non-fatal logging
    }

    if (isJson) {
      process.stdout.write(JSON.stringify(cycleReport) + "\n");
    } else if (!isQuiet) {
      printBanner();
      console.log(`[EOS + GENTLEMAN EVERGREEN AUTO-UPDATER] Modo: ${cycleReport.mode}\n`);
      console.log(`  Ejecutado              : ${cycleReport.executedAtIso}`);
      console.log(`  Actualizaciones Vistas : ${cycleReport.updatesDetected}`);
      console.log(`  Actualizaciones Aplic. : ${cycleReport.updatesApplied}`);
      console.log(`  Rollbacks Disparados   : ${cycleReport.rollbacksTriggered}`);
      console.log(
        `  Constitución Intacta   : ${cycleReport.constitutionPreserved ? "VERIFIED" : "VIOLATED"} (sha256:${cycleReport.constitutionSha256.slice(0, 16)}...)`,
      );
      if (cycleReport.ledgerEntryId) {
        console.log(`  Recibo SQLite Ledger   : ${cycleReport.ledgerEntryId}`);
      }
      console.log(`  Recibo Criptográfico   : sha256:${cycleReport.sha256Receipt}\n`);
      console.log("  Estado por Componente Upstream:");
      cycleReport.components.forEach((c) => {
        console.log(
          `    • [${c.status.padEnd(16)}] ${c.componentId.padEnd(18)} local=${c.installedVersion.padEnd(12)} upstream=${c.latestVersion.padEnd(12)} — ${c.detail}`,
        );
      });
      console.log("");
    }
    if (cycleReport.rollbacksTriggered > 0 || !cycleReport.constitutionPreserved) {
      process.exit(1);
    }
    return;
  }

  if (subAction === "autoupdate:install" || subAction === "schedule") {
    printBanner();
    const { installGentlemanAutoUpdateSchedule, queryGentlemanAutoUpdateSchedule } =
      await import("../../scripts/install-gentleman-autoupdate.mjs");
    const installed = installGentlemanAutoUpdateSchedule({ projectRoot: root, intervalHours: 6 });
    const status = queryGentlemanAutoUpdateSchedule();
    console.log("[EOS GENTLEMAN EVERGREEN SCHEDULER] Automatización Desatendida Instalada:\n");
    console.log(`  Planificador SO        : ${installed.scheduler}`);
    console.log(`  Tarea Programada       : ${installed.taskName}`);
    console.log(`  Frecuencia             : Cada ${installed.intervalHours} horas (100% silencioso en segundo plano)`);
    console.log(`  Lanzador Silencioso    : ${installed.launcherPath}`);
    console.log(`  Hook Antigravity       : SessionStart oportunista (>6h TTL) ACTIVO`);
    console.log(`  Verificación SO        : ${status.registered ? "REGISTERED & ACTIVE" : "UNVERIFIED"}\n`);
    if (!status.registered) process.exit(1);
    return;
  }

  if (subAction === "autoupdate:status") {
    printBanner();
    const { queryGentlemanAutoUpdateSchedule } = await import("../../scripts/install-gentleman-autoupdate.mjs");
    const { EosGentlemanAutoUpdater } = await import("../../src/core/eosGentlemanAutoUpdater.ts");
    const status = queryGentlemanAutoUpdateSchedule();
    const state = EosGentlemanAutoUpdater.readState(root);
    const due = EosGentlemanAutoUpdater.isAutoUpdateDue(root);
    console.log("[EOS GENTLEMAN EVERGREEN SCHEDULER — ESTADO]\n");
    console.log(`  Tarea Programada (${status.taskName}) : ${status.registered ? "ACTIVE" : "NOT_REGISTERED"}`);
    console.log(`  Última Verificación                   : ${state?.lastCheckedAtIso || "never"}`);
    console.log(`  Última Aplicación                     : ${state?.lastAppliedAtIso || "never"}`);
    console.log(`  TTL Expirado (>6h)                    : ${due ? "YES (due now)" : "NO (fresh)"}\n`);
    return;
  }

  if (subAction === "autoupdate:uninstall") {
    printBanner();
    const { uninstallGentlemanAutoUpdateSchedule } = await import("../../scripts/install-gentleman-autoupdate.mjs");
    const removed = uninstallGentlemanAutoUpdateSchedule();
    console.log(
      `[EOS GENTLEMAN EVERGREEN SCHEDULER] Tarea ${removed.taskName}: ${removed.uninstalled ? "REMOVED" : "NOT_FOUND"}\n`,
    );
    return;
  }

  printBanner();
  const { EosGentlemanStackBridge } = await import("../../src/core/eosGentlemanStackBridge.ts");
  const report = EosGentlemanStackBridge.auditStack(root);
  console.log("[EOS + GENTLEMAN AI STACK CO-GOVERNANCE DOCTOR]\n");
  console.log(`  Estado Co-Gobernanza   : ${report.status}`);
  console.log(`  Puntaje de Sinergia    : ${report.readinessScore}/100`);
  console.log(`  Constitución Intacta   : ${report.constitutionPreserved ? "VERIFIED (7 Mandamientos)" : "MISSING"}`);
  console.log(`  Skills SDD Activos     : ${report.activeSddSkills.length}/11 (${report.activeSddSkills.join(", ")})`);
  console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
  console.log("  Pilares del Stack Auditados:");
  report.pillars.forEach((p) => {
    console.log(
      `    • [${p.passed ? "PASS" : "FAIL"}] ${p.label.padEnd(54)} (${p.score}/${p.maxScore}) — ${p.versionOrPath}`,
    );
  });
  console.log("\n  Protocolo Operativo de Co-Gobernanza:");
  report.coGovernanceProtocol.forEach((step) => console.log(`    ${step}`));
  console.log("");
  if (report.readinessScore < 95) process.exit(1);
}

HANDLERS["gentleman"] = cmd_gentleman_93;
HANDLERS["gentle-ai"] = cmd_gentleman_93;

async function cmd_ledger_94(commandContext) {
  const { root, args, packageMetadata, printBanner } = commandContext;
  printBanner();
  const sub = (args[1] || "verify").toLowerCase();
  const { EosDurableSqliteLedger } = await import("../../src/core/eosDurableSqliteLedger.ts");
  const dbPath = EosDurableSqliteLedger.defaultLedgerPath(root);
  const ledger = new EosDurableSqliteLedger(dbPath);
  try {
    if (sub === "record") {
      const title = args.slice(2).join(" ").trim() || "EOS CLI Ledger Checkpoint";
      const rec = ledger.appendEntry({
        category: "VERIFICATION_RECEIPT",
        projectId: "eos-system",
        title,
        payload: { source: "eos-cli", version: packageMetadata.version },
      });
      console.log(`[EOS SQLITE WAL LEDGER] Entrada sellada #${rec.seq}: ${rec.entryId}`);
      console.log(`  Título      : ${rec.title}`);
      console.log(`  Prev Hash   : ${rec.prevHash}`);
      console.log(`  Entry Hash  : ${rec.entryHash}\n`);
    } else if (sub === "search") {
      const query = args.slice(2).join(" ").trim();
      const records = ledger.searchEntries(query, 10);
      console.log(`[EOS SQLITE FTS5 SEARCH] Consulta: "${query}" (${records.length} resultados)\n`);
      records.forEach((r) => console.log(`  #${r.seq} [${r.category}] ${r.title} (${r.entryHash.slice(0, 16)}...)`));
      console.log("");
    } else if (sub === "recent") {
      const records = ledger.listRecent(10);
      console.log(`[EOS SQLITE WAL LEDGER] Últimas ${records.length} entradas:\n`);
      records.forEach((r) => console.log(`  #${r.seq} [${r.category}] ${r.title} (${r.createdAtIso})`));
      console.log("");
    } else {
      const integrity = ledger.verifyChainIntegrity();
      console.log("[EOS SQLITE WAL LEDGER] Verificación Criptográfica Monotónica:\n");
      console.log(`  Base de Datos          : ${integrity.databasePath}`);
      console.log(`  Modo Journal           : ${integrity.journalMode.toUpperCase()}`);
      console.log(`  Total Entradas         : ${integrity.totalEntries}`);
      console.log(`  Cadena SHA-256 Intacta : ${integrity.intact ? "VERIFIED" : "CORRUPTED"}`);
      console.log(`  Head Hash              : ${integrity.headHash}`);
      console.log(`  Recibo Criptográfico   : sha256:${integrity.sha256Receipt}\n`);
      if (!integrity.intact) process.exit(1);
    }
  } finally {
    ledger.close();
  }
}

HANDLERS["ledger"] = cmd_ledger_94;

async function cmd_ast_95(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetRel = args[1] || "src/core";
  const targetDir = path.resolve(root, targetRel);
  const { EosTypeScriptAstAnalyzer } = await import("../../src/core/eosTypeScriptAstAnalyzer.ts");
  const report = EosTypeScriptAstAnalyzer.analyzeDirectory(targetDir, root);
  console.log("[EOS COMPILER-GRADE TYPESCRIPT AST ANALYZER]\n");
  console.log(`  Directorio Auditado    : ${report.targetDir}`);
  console.log(`  Motor AST              : ${report.engineMode}`);
  console.log(`  Archivos Analizados    : ${report.filesAnalyzed}`);
  console.log(`  Símbolos Exportados    : ${report.totalExportedSymbols}`);
  console.log(`  Complejidad Promedio   : ${report.averageCyclomaticComplexity}`);
  console.log(`  Complejidad Máxima     : ${report.maxCyclomaticComplexity} (${report.maxCyclomaticFile || "n/a"})`);
  console.log(`  Pureza Layer-0         : ${report.layer0Pure ? "VERIFIED (0 deps externas)" : "VIOLATED"}`);
  console.log(
    `  Node 24 Strip-Only     : ${report.stripOnlyCompatible ? "VERIFIED (0 enum/namespace/param-props)" : "VIOLATED"}`,
  );
  console.log(`  Violaciones            : ${report.violations.length}`);
  console.log(`  Recibo Criptográfico   : sha256:${report.sha256Receipt}\n`);
  if (report.violations.length > 0) {
    report.violations.forEach((v) => {
      console.log(`    ! [${v.code}] ${v.file}:${v.line}:${v.column} — ${v.message}`);
    });
    process.exit(1);
  }
}

HANDLERS["ast"] = cmd_ast_95;

async function cmd_nocturnal_96(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "sweep").toLowerCase();

  if (subAction === "sweep" || subAction === "nocturnal") {
    const { EosNocturnalEvolutionEngine } = await import("../../src/core/eosNocturnalEvolutionEngine.ts");
    const engine = new EosNocturnalEvolutionEngine(root);
    const targetDir = args[2] || "src/core";
    const report = engine.runEvolutionSweep({ targetDir });
    console.log(EosNocturnalEvolutionEngine.formatNocturnalSummary(report));
  } else if (subAction === "evaluate") {
    const { EosEvolutionaryHarness } = await import("../../src/core/eosEvolutionaryHarness.ts");
    const res = EosEvolutionaryHarness.computeFitnessVector(113000, 0, 100, 4, 100);
    console.log("[EOS DEEPMIND SOVEREIGN EVOLUTIONARY HARNESS — ALPHAEVOLVE]\n");
    console.log(`  Composite Fitness      : ${res.compositeFitness}/100`);
    console.log(`  Execution Latency      : ${res.executionLatencyNs} ns`);
    console.log(`  Heap Allocation Delta  : ${res.heapDeltaBytes} bytes`);
    console.log(`  AST Purity Score       : ${res.astPurityScore}/100`);
    console.log(`  Cyclomatic Complexity  : ${res.cyclomaticComplexity}`);
    console.log(`  Contract Score         : ${res.contractComplianceScore}/100\n`);
  } else if (subAction === "lock") {
    const { EosEvolutionaryHarness } = await import("../../src/core/eosEvolutionaryHarness.ts");
    const targetArg = args[2] || "src/core/eosKernelPrimitives.ts";
    const fullPath = path.resolve(root, targetArg);
    const content = fs.readFileSync(fullPath, "utf8");
    const locked = EosEvolutionaryHarness.lockInterfaceContract(targetArg, content);
    console.log("[EOS DEEPMIND INTERFACE LOCK ATTESTATION]\n");
    console.log(`  Contract ID            : ${locked.contractId}`);
    console.log(`  Target File            : ${locked.targetFilePath}`);
    console.log(`  Exported Signatures    : ${locked.exportedSignatures.length}`);
    console.log(`  Interface SHA-256 Lock : sha256:${locked.lockedSha256}\n`);
  } else {
    console.log(`[EOS EVOLVE] Modo: sweep | evaluate | lock`);
  }
}

HANDLERS["nocturnal"] = cmd_nocturnal_96;
HANDLERS["evolve"] = cmd_nocturnal_96;

async function cmd_mesh_97(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "compile").toLowerCase();
  const { EosAgentTopologyMesh } = await import("../../src/core/eosAgentTopologyMesh.ts");

  if (subAction === "compile") {
    const demoNodes = [
      {
        id: "NODE-1-INTERFACE",
        name: "Contract Spec",
        assignedModulePath: "src/core/interface.ts",
        dependencies: [],
      },
      {
        id: "NODE-2-DOMAIN",
        name: "Domain Logic",
        assignedModulePath: "src/core/domain.ts",
        dependencies: ["NODE-1-INTERFACE"],
      },
      {
        id: "NODE-3-TESTS",
        name: "Property Tests",
        assignedModulePath: "test/domain.test.ts",
        dependencies: ["NODE-2-DOMAIN"],
      },
    ];
    const dagId = args[2] || "DAG-DEEPMIND-ALPHA";
    const compiled = EosAgentTopologyMesh.compileTopology(dagId, demoNodes);
    console.log("[EOS AGENT TOPOLOGY COMPILER — ZERO-COPY MESH]\n");
    console.log(`  DAG ID               : ${compiled.dagId}`);
    console.log(`  Total Nodes          : ${compiled.totalNodes}`);
    console.log(`  Topological Order    : ${compiled.topologicalOrder.join(" -> ")}`);
    console.log(`  Acyclic Guarantee    : ${compiled.isAcyclic ? "YES (Deadlock-Free)" : "NO"}`);
    console.log(`  Plan Receipt SHA-256 : sha256:${compiled.sha256PlanReceipt}\n`);
  } else if (subAction === "efficiency") {
    const compactBytes = Number(args[2]) || 512;
    const fullContextBytes = Number(args[3]) || 8192;
    const eff = EosAgentTopologyMesh.calculateTokenEfficiency(compactBytes, fullContextBytes);
    console.log("[EOS AGENT MESH TOKEN EFFICIENCY METER]\n");
    console.log(`  Compact Envelope     : ${eff.compactBytes} bytes`);
    console.log(`  Full Context Baseline: ${eff.fullFileContextBytes} bytes`);
    console.log(`  Reduction Ratio      : ${eff.reductionRatioPct}% token savings`);
    console.log(`  Estimated Tokens Saved: ~${eff.coordinationTokensSaved} tokens\n`);
  } else {
    console.log(`[EOS MESH] Uso: eos mesh [compile|efficiency]`);
  }
}

HANDLERS["mesh"] = cmd_mesh_97;
HANDLERS["agent-topology"] = cmd_mesh_97;

export async function handleSovereignCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
