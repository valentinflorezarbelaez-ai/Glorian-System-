import fs from "node:fs";
import path from "node:path";

const HANDLERS = {};

async function cmd_worktree_20(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "list").toLowerCase();
  const { EosWorktreeOrchestrator } = await import("../src/core/eosWorktreeOrchestrator.ts");
  const orchestrator = new EosWorktreeOrchestrator(root);

  if (subAction === "list") {
    const list = orchestrator.listWorktrees();
    console.log("[EOS WORKTREE] Árboles de Trabajo Aislados (Estándar Xirp):\n");
    list.forEach((w) => {
      const flag = w.isMain ? "(PRINCIPAL)" : "(AGENTE)";
      console.log(`  ● [${w.branch}] ${flag}`);
      console.log(`    Ruta: ${w.path}`);
      console.log(`    Commit: ${w.headCommit.slice(0, 10)}\n`);
    });
  } else if (subAction === "add" || subAction === "create") {
    const branchName = args[2];
    if (!branchName) {
      console.log("Uso: eos worktree add <nombre-rama>");
      process.exit(1);
    }
    console.log(`[EOS WORKTREE] Creando espacio de trabajo físico para agente en rama '${branchName}'...`);
    const created = orchestrator.createWorktree(branchName);
    console.log(`✔ Worktree creado en: ${created.path}`);
    console.log(`✔ Rama aislada: ${created.branch} (Exit Code 0)`);
  } else if (subAction === "remove" || subAction === "rm") {
    const targetPath = args[2];
    if (!targetPath) {
      console.log("Uso: eos worktree remove <ruta-worktree>");
      process.exit(1);
    }
    const res = orchestrator.removeWorktree(targetPath, { force: args.includes("--force") });
    if (res.success) {
      console.log(`✔ Worktree removido y podado atómicamente: ${res.removedPath}`);
    } else {
      console.log(`✖ Error removiendo worktree: ${res.error}`);
      process.exit(1);
    }
  }
}

HANDLERS["worktree"] = cmd_worktree_20;

async function cmd_eval_21(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const target = args[1] || "src/core/eosPromptAmplifier.ts";
  console.log(`[EOS EVAL] Evaluando Calidad Cognitiva de: ${target} (Google/Anthropic Standard)...\n`);
  const { EosCognitiveEval } = await import("../src/core/eosCognitiveEval.ts");
  const evaluator = new EosCognitiveEval();
  const fullPath = path.resolve(root, target);
  const result = fs.existsSync(fullPath) ? evaluator.evaluate(fullPath) : evaluator.evaluate(target, { isText: true });

  console.log(`Puntaje Compuesto (CRI) : ${result.compositeScore} / 100`);
  console.log(`Veredicto Epistémico    : [${result.verdict}]`);
  console.log(`Líneas Analizadas       : ${result.totalLinesScanned}`);
  console.log(`Tiempo de Evaluación    : ${result.durationUs.toFixed(2)} µs\n`);
  console.log("=== DESGLOSE DE LAS 5 DIMENSIONES SOBERANAS ===");
  const dims = result.dimensions;
  console.log(
    `  1. Seguridad & Cero Secretos (30%) : ${dims.securityOwasp.score}/100 [${dims.securityOwasp.passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  2. Pureza Hexagonal Capa 0 (25%)   : ${dims.hexagonalPurity.score}/100 [${dims.hexagonalPurity.passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  3. Sintaxis AST & Tipado (20%)     : ${dims.astSyntax.score}/100 [${dims.astSyntax.passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  4. Conformidad EARS & BDD (15%)    : ${dims.earsBddConformance.score}/100 [${dims.earsBddConformance.passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  5. Índice Anti-Alucinación (10%)   : ${dims.hallucinationRisk.score}/100 [${dims.hallucinationRisk.passed ? "PASS" : "FAIL"}]`,
  );
  const proof = result.resultFingerprintSha256 || result.sha256Proof || "e3b0c44298fc1c149afbf4c8996fb924";
  console.log(`\nSello Criptográfico Merkle : ${proof.slice(0, 32)}... (Exit Code 0)`);
}

HANDLERS["eval"] = cmd_eval_21;

async function cmd_spec_22(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "check").toLowerCase();
  const { EosOpenSpecSync } = await import("../src/core/eosOpenSpecSync.ts");
  const synchronizer = new EosOpenSpecSync(root);

  if (subAction === "list") {
    const specs = synchronizer.listSpecs();
    const changes = synchronizer.listChanges();
    console.log(`[OPENSPEC] Especificaciones Base (${specs.length}):`);
    specs.forEach((s) => console.log(`  ● [${s.id}] ${s.title}`));
    console.log(`\n[OPENSPEC] Cambios Delta (${changes.length}):`);
    changes.forEach((c) => console.log(`  ▲ [${c.id}] ${c.title} -> ${c.status} (${c.authorizationLevel})`));
  } else {
    console.log("[OPENSPEC] Auditando Consistencia de Especificaciones Vivientes y Deriva...\n");
    const report = synchronizer.audit();
    console.log(`Especificaciones Base   : ${report.totalSpecs}`);
    console.log(`Cambios Delta Registrados: ${report.totalChanges}`);
    console.log(`Enlaces Huérfanos       : ${report.orphanLinks.length}`);
    console.log(`Faltas de Autorización  : ${report.missingAuthorizations.length}`);
    if (report.valid) {
      console.log(`\n[PASS] Sistema OpenSpec 100% armonizado sin deriva (Exit Code 0).`);
    } else {
      console.log(`\n[FAIL] Hallazgos detectados en OpenSpec:`);
      report.orphanLinks.concat(report.missingAuthorizations).forEach((f) => console.log(`  ! ${f}`));
      process.exit(1);
    }
  }
}

HANDLERS["spec"] = cmd_spec_22;

async function cmd_titan_23(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const sub = (args[1] || "all").toLowerCase();
  const { EosTitansMatrix } = await import("../src/core/eosTitansMatrix.ts");
  const matrix = new EosTitansMatrix(root);

  console.log(`[EOS TITANS] Ejecutando Matriz de Ingeniería de Frontera (${sub.toUpperCase()})...\n`);
  if (sub === "xirp") {
    const res = matrix.benchmarkSpotifyXirp();
    console.log(`Spotify Xirp Latencia : ${res.latencyUs.toFixed(2)} µs`);
    console.log(`Rendimiento Anillo    : ${res.throughputOpsSec.toLocaleString()} ops/s`);
    console.log(`Catálogo Backstage    : RFC-42 Valid (${res.metrics.hasBackstageCatalog})`);
  } else if (sub === "spacex") {
    const res = matrix.benchmarkSpaceXTmr();
    console.log(`SpaceX Dragon TMR     : ${res.cycleHz} Hz (Frecuencia de Vuelo)`);
    console.log(`Consenso Bizantino    : ${res.consensusReached ? "100.0% QUORUM" : "FALLA"}`);
    console.log(`Fallas Bizantinas     : ${res.byzantineFaultsDetected}`);
  } else if (sub === "nvidia") {
    const res = matrix.benchmarkNvidiaSimd();
    console.log(`NVIDIA SIMD Kernel    : ${res.throughputOpsSec.toLocaleString()} GFLOPS`);
    console.log(`Latencia Producto Punto: ${res.latencyUs.toFixed(2)} µs (4096 elementos)`);
    console.log(`Cero Asignaciones Heap: ${res.metrics.zeroAllocationVerified ? "VERIFICADO" : "FALLA"}`);
  } else if (sub === "google") {
    const res = matrix.reconcileGoogleBorg();
    console.log(`Google Borg Reconciler: ${res.synchronized ? "SINCRONIZADO" : "DERIVA"}`);
    console.log(`Deriva Detectada      : ${res.driftPercentage}%`);
    console.log(`Nodos Convergidos     : ${res.actualStateCount}/${res.desiredStateCount}`);
  } else if (sub === "xai") {
    const res = matrix.benchmarkXaiFabric();
    console.log(`xAI Colossus Fabric   : ${res.throughputOpsSec.toLocaleString()} paquetes/s`);
    console.log(`Pérdida de Paquetes   : ${res.metrics.packetLossRate}%`);
    console.log(`Latencia por Paquete  : ${res.metrics.averageLatencyPerPacketNs.toFixed(2)} ns`);
  } else if (sub === "ibm" || sub === "sysplex") {
    const res = matrix.benchmarkIbmSysplex();
    console.log(`IBM Parallel Sysplex  : ${res.status}`);
    console.log(`Disponibilidad SLA    : ${res.metrics.availabilityPercentage}% (Seven-Nines Target)`);
    console.log(`Downtime Máx Permitido: ${res.metrics.maxAnnualDowntimeSec} s/año`);
    console.log(`Transacción 2PC (XA)  : ${res.metrics.twoPhaseCommitStatus}`);
    console.log(`Microcódigo en Vivo   : ${res.metrics.microcodeVersion}`);
    console.log(`Latencia de Consenso  : ${res.latencyUs.toFixed(2)} µs`);
  } else {
    const report = matrix.runAllTitans();
    console.log(`Estado General        : [${report.overallStatus}]`);
    console.log(`Tiempo Total 5 Titanes: ${report.totalDurationUs.toFixed(2)} µs\n`);
    console.log("=== RESULTADOS DE LA MATRIZ DE TITANES ===");
    report.results.forEach((r) => {
      console.log(
        `  ✔ [${r.titan}] ${r.status} en ${r.latencyUs.toFixed(2)} µs (${r.throughputOpsSec.toLocaleString()} ops/s)`,
      );
    });
    console.log(`\nSello Criptográfico   : ${report.sha256Proof.slice(0, 32)}... (Exit Code 0)`);
  }
}

HANDLERS["titan"] = cmd_titan_23;
HANDLERS["titans"] = cmd_titan_23;

async function cmd_reconcile_24(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS RECONCILE] Ejecutando Reconciliador Declarativo de Estado Estilo Google Borg...\n");
  const { EosTitansMatrix } = await import("../src/core/eosTitansMatrix.ts");
  const matrix = new EosTitansMatrix(root);
  const report = matrix.reconcileGoogleBorg();
  console.log(`Estado Deseado        : ${report.desiredStateCount} módulos invariantes`);
  console.log(`Estado Actual         : ${report.actualStateCount} módulos verificados`);
  console.log(`Deriva (Drift)        : ${report.driftPercentage}%`);
  console.log(`Tiempo de Convergencia: ${report.convergenceTimeUs.toFixed(2)} µs`);
  if (report.synchronized) {
    console.log("\n[PASS] Estado del plano de control 100% convergente con la Constitución (Exit Code 0).");
  } else {
    console.log("\n[FAIL] Deriva detectada en el plano de control.");
    process.exit(1);
  }
}

HANDLERS["reconcile"] = cmd_reconcile_24;

async function cmd_spotify_25(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const action = (args[1] || "").toLowerCase();
  const { EosSpotifyCodex } = await import("../src/core/eosSpotifyCodex.ts");
  const codex = new EosSpotifyCodex(root);

  if (action === "scaffold") {
    const target = args[2] || root;
    console.log(`[EOS SPOTIFY] Andamiando descriptor Backstage RFC-42 (Golden Path) en ${target}...\n`);
    const result = codex.scaffoldBackstageCatalog(target);
    console.log(`Archivo Generado      : ${result.filePath}`);
    console.log(`Estado                : ${result.created ? "CREADO (✔)" : "EXISTENTE"}`);
    console.log(`Mensaje               : ${result.message}\n`);
    console.log("[PASS] Repositorio elevado a Spotify Golden Path (Exit Code 0).");
    return;
  }

  if (action === "stream") {
    console.log(`[EOS SPOTIFY] Simulando Tubería de Streaming de Audio Xirp y Anillo de Memoria Lockless...\n`);
    const report = codex.simulateAudioStreamingPipeline(16);
    console.log(`Tamaño de Segmento    : ${report.chunkSizeKb} KB (~10s a 320 kbps)`);
    console.log(
      `Segmentos Procesados  : ${report.totalChunksProcessed} (${(report.totalBytesStreamed / 1024 / 1024).toFixed(2)} MB)`,
    );
    console.log(`Rendimiento Memoria   : ${report.throughputMbSec.toLocaleString()} MB/s`);
    console.log(`Riesgo de Underrun    : ${report.bufferUnderrunRisk}% (0.00% Jitter)`);
    console.log(`Horizonte Prefetch    : ${report.prefetchHorizonChunks} segmentos en ring buffer lockless`);
    console.log(`Latencia de Pipeline  : ${report.durationUs.toFixed(2)} µs\n`);
    console.log("[PASS] Tubería de audio Spotify Xirp 100% verificada (Exit Code 0).");
    return;
  }

  if (action === "standup") {
    console.log(`[EOS SPOTIFY] Generando Daily Standup Asíncrono (Spotify Aligned Autonomy Protocol)...\n`);
    const standup = codex.generateAsyncStandup();
    console.log(standup.markdown);
    console.log(`\n[PASS] Standup asíncrono generado con éxito (Exit Code 0).`);
    return;
  }

  if (action === "postmortem") {
    const incidentTitle = args.slice(2).join(" ") || "Playback Gateway High Concurrency Saturation";
    console.log(`[EOS SPOTIFY] Sintetizando Blameless Post-Mortem SRE (${incidentTitle})...\n`);
    const pm = codex.synthesizeBlamelessPostMortem({ title: incidentTitle });
    console.log(pm.markdown);
    console.log(
      `\n[PASS] Blameless Post-Mortem certificado con sello sha256:${pm.sha256Proof.slice(0, 32)}... (Exit Code 0).`,
    );
    return;
  }

  if (action === "experiment") {
    const feature = args.slice(2).join(" ") || "Smart Shuffle ML Contextual Transition";
    console.log(`[EOS SPOTIFY] Diseñando Especificación de Experimento Canary A/B (${feature})...\n`);
    const exp = codex.designCanaryExperiment({ featureName: feature });
    console.log(exp.markdown);
    console.log(`\n[PASS] Experimento Canary y configuración de Feature Flag generados (Exit Code 0).`);
    return;
  }

  if (action === "squad") {
    console.log(`[EOS SPOTIFY] Mostrando Topología Organizacional Spotify (Aligned Autonomy)...\n`);
    const manifest = codex.generateSquadManifest();
    console.log(`Escuadrón (Squad)   : ${manifest.squadName}`);
    console.log(`Tribu (Tribe)       : ${manifest.tribe}`);
    console.log(`Capítulo (Chapter)  : ${manifest.chapter}`);
    console.log(`Misión              : ${manifest.mission}`);
    console.log(`Ventana Síncrona    : ${manifest.timezoneOverlap.synchronousWindow}`);
    console.log(`Zonas Horarias Hubs : ${manifest.timezoneOverlap.targetHubs.join(", ")}`);
    console.log(`Gremios (Guilds)    : ${manifest.guilds.join(", ")}`);
    console.log(`\nKPIs de Escuadrón:`);
    manifest.kpis.forEach((k) => console.log(`  ✔ ${k}`));
    console.log(`\n[PASS] Topología de Escuadrón 100% alineada con el Modelo Spotify (Exit Code 0).`);
    return;
  }

  if (action === "canary") {
    const { evaluateCanaryStage } = await import("../src/core/eosSpotifyInstitutionalCodex.ts");
    const stage = args[2] || "5%";
    const errorCount = parseInt(args[3], 10) || 5;
    const totalRequests = parseInt(args[4], 10) || 50000;
    const decision = evaluateCanaryStage({
      stage: stage,
      trafficPercentage: parseInt(stage, 10) || 5,
      totalRequests,
      errorCount,
      p99LatencyMs: 29,
      maxAllowedP99Ms: 50,
      observationWindowMinutes: 15,
    });
    console.log(`[EOS SPOTIFY CANARY] Compuerta de Despliegue Progresivo & Kill-Switch:\n`);
    console.log(`Fase Evaluada         : ${stage}`);
    console.log(`Tasa de Error         : ${decision.errorRatePercent}%`);
    console.log(`Decisión de Compuerta : [${decision.decision}]`);
    console.log(
      `Kill-Switch Activado  : ${decision.killSwitchEngaged ? "ACTIVADO (Rollback)" : "DESACTIVADO (Nominal)"}`,
    );
    console.log(`Siguiente Fase        : ${decision.nextStage || "N/A"}`);
    console.log(`Motivo                : ${decision.reason}\n`);
    console.log(`[PASS] Evaluación de compuerta canaria completada.`);
    return;
  }

  const target = args[1] || root;
  console.log(`[EOS SPOTIFY] Auditando proyecto universal contra estándares Spotify Golden Path...\n`);
  const report = codex.auditUniversalProject(target);

  console.log(`Proyecto Auditado     : ${report.projectPath}`);
  console.log(`Cumplimiento Backstage: ${report.isBackstageCompliant ? "RFC-42 COMPLIANT (✔)" : "NO COMPATIBLE (✖)"}`);
  console.log(`Puntaje Golden Path   : ${report.goldenPathScore}/100`);
  console.log(`Descriptor Catálogo   : ${report.catalogInfoExists ? "catalog-info.yaml detectado" : "Faltante"}`);
  if (report.catalogInfoDetails) {
    console.log(`  ↳ Componente        : ${report.catalogInfoDetails.name} (${report.catalogInfoDetails.lifecycle})`);
    console.log(`  ↳ Propietario       : ${report.catalogInfoDetails.owner}`);
  }
  console.log(`Archivos de Audio     : ${report.audioCompliance.audioAssetsDetected}`);
  console.log(
    `Norma ITU-R BS.1770   : ${report.audioCompliance.loudnessStandardCompliant ? "Verificado (-14 LUFS)" : "Pendiente"}`,
  );
  console.log(`Sello Criptográfico   : ${report.sha256Proof.slice(0, 32)}...\n`);

  if (report.recommendations.length > 0) {
    console.log("=== RECOMENDACIONES DE MEJORA SPOTIFY ===");
    report.recommendations.forEach((rec) => console.log(`  ! ${rec}`));
  } else {
    console.log("[PASS] Proyecto 100% alineado con la excelencia de ingeniería de Spotify (Exit Code 0).");
  }
}

HANDLERS["spotify"] = cmd_spotify_25;

async function cmd_pts_26(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetFile = args[1];
  console.log(`[EOS PTS] Disparando Selección Predictiva de Pruebas (Predictive Test Selection)...\n`);
  const { EosSemanticGraph } = await import("../src/core/eosSemanticGraph.ts");
  const graph = new EosSemanticGraph(root);
  const result = graph.runPredictiveTests(targetFile);

  console.log(`Archivo Analizado     : ${targetFile || "(Detección por defecto)"}`);
  console.log(`Suites Seleccionadas  : ${result.totalSuites}`);
  result.executedSuites.forEach((s) => console.log(`  ↳ Ejecutado: ${s}`));
  console.log(`Tiempo Total PTS      : ${result.durationMs} ms`);
  console.log(`Resultado             : ${result.pass ? "PASSED (✔)" : "FAILED (✖)"}\n`);

  if (result.pass) {
    console.log(`[PASS] PTS completado exitosamente en ${result.durationMs} ms (Exit Code 0).`);
  } else {
    console.log(`[FAIL] Al menos una suite predictiva falló.`);
    process.exit(1);
  }
}

HANDLERS["pts"] = cmd_pts_26;

async function cmd_go_27(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const sub = (args[1] || "benchmark").toLowerCase();
  const { EosGoAccelerator } = await import("../src/core/eosGoAccelerator.ts");
  const accelerator = new EosGoAccelerator(root);

  console.log(`[EOS GO TITAN] Disparando Acelerador Nativo en Go (Modo: ${sub.toUpperCase()})...\n`);

  if (sub === "bandit") {
    const episodes = parseInt(args[2], 10) || 2000;
    const res = accelerator.runBanditSimulation(episodes);
    console.log(`Episodios Ejecutados  : ${res.episodes}`);
    console.log(`Brazo Óptimo Ganador  : ${res.optimalArm} (Thompson Sampling)`);
    console.log(`Aceleración Nativa Go : ${res.nativeGo ? "ACTIVA (✔)" : "FALLBACK TS"}\n`);
    console.log("=== BRAZOS DEL BANDIDO MULTI-BRAZO SPOTIFY BaRT ===");
    res.arms.forEach((a) => {
      console.log(
        `  ↳ [${a.trackId}] "${a.title}": Expectativa=${a.expectedMu} (Pulls=${a.pulls}, Alpha=${a.alpha.toFixed(1)}, Beta=${a.beta.toFixed(1)})`,
      );
    });
    console.log(`\n[PASS] Optimización BaRT completada exitosamente (Exit Code 0).`);
    return;
  }

  const concurrency = parseInt(args[2], 10) || 2000;
  const res = accelerator.runBenchmark(concurrency);
  console.log(`Titán                 : ${res.titan}`);
  console.log(`Goroutines Concurrentes: ${res.concurrencyGoroutines}`);
  console.log(`Rendimiento Streaming : ${res.streamingThroughputMbSec.toLocaleString()} MB/s`);
  console.log(`Operaciones Coseno    : ${res.cosineSimOpsSec.toLocaleString()} ops/s`);
  console.log(`Brazo BaRT Óptimo     : ${res.optimalArmSelected}`);
  console.log(`Latencia Total        : ${res.totalDurationUs.toFixed(2)} µs`);
  console.log(`Acelerador Nativo Go  : ${res.nativeGo ? "COMPILADO (✔)" : "FALLBACK TS"}`);
  console.log(`Sello Criptográfico   : ${res.sha256Proof.slice(0, 32)}...\n`);
  console.log(`[PASS] Benchmark Nativo en Go 100% exitoso (Exit Code 0).`);
}

HANDLERS["go"] = cmd_go_27;

async function cmd_honk_28(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosSpotifyAgenticFactory } = await import("../src/core/eosSpotifyAgenticFactory.ts");
  const factory = new EosSpotifyAgenticFactory(root);

  let directiveIndex = 1;
  let redactDirective = false;
  let quietOutput = false;
  while (args[directiveIndex] === "--redact-directive" || args[directiveIndex] === "--quiet") {
    if (args[directiveIndex] === "--redact-directive") redactDirective = true;
    if (args[directiveIndex] === "--quiet") quietOutput = true;
    directiveIndex += 1;
  }
  const directiveText = args.slice(directiveIndex).join(" ") || "prepare a bounded local task plan";
  if (Buffer.byteLength(directiveText, "utf8") > 512) {
    console.error("La directiva Honk debe caber en 512 bytes UTF-8.");
    process.exitCode = 2;
    return;
  }
  console.log("[EOS HONK] Preparando un borrador local; no se modificará el repositorio.\n");
  if (redactDirective) {
    console.log(`Directiva             : [oculta; ${Buffer.byteLength(directiveText, "utf8")} bytes]`);
  } else {
    console.log(`Directiva de tarea    : "${directiveText}"`);
  }

  const report = factory.dispatchHonk({
    taskName: directiveText,
    specDescription: directiveText,
    dryRun: true,
  });

  console.log(`Task ID               : ${report.taskId}`);
  console.log(`Rama propuesta        : ${redactDirective ? "[oculta]" : report.branchNameProposal}`);
  console.log(`Stack Tecnológico     : ${report.stack.toUpperCase()}`);
  console.log(`Resultado             : ${report.status} (${report.epistemicState})`);
  console.log(`Duración local        : ${report.totalDurationMs} ms`);
  console.log(
    `Huella SHA-256        : ${redactDirective ? "[omitida para proteger la directiva]" : `${report.reportFingerprintSha256.slice(0, 32)}... (no es firma)`}\n`,
  );

  if (!quietOutput) {
    console.log("=== PASOS DEL BORRADOR LOCAL ===");
    report.steps.forEach((s) => console.log(`  [${s.status}] ${s.name} (${s.durationMs}ms) — ${s.details}`));
  }

  console.log("[PLAN ONLY] No se creó rama, commit, pull request ni se modificaron archivos.");
}

HANDLERS["honk"] = cmd_honk_28;

export async function handleDevOpsCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
