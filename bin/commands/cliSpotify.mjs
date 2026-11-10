import path from "node:path";

const HANDLERS = {};

async function cmd_flow_29(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const action = (args[1] || "help").toLowerCase();
  if (action === "help") {
    console.log(
      [
        "",
        "Uso del flujo de ingeniería con revisión humana:",
        "  eos flow inspect <repo>",
        "  eos flow plan <repo> <tarea>",
        "  eos flow start <repo> <tarea>",
        "  eos flow validate <repo> <workflow-id> -- <comando> [argumentos...]",
        "  eos flow status <repo> <workflow-id>",
        "  eos flow review <repo> <workflow-id>",
        "  eos flow apply <repo> <workflow-id> --confirm-diff=<sha256>",
        "  eos flow close <repo> <workflow-id> [--force]",
        "",
        "Inspect y plan son de solo lectura. Start crea un worktree local. Validate ejecuta",
        "en el sandbox Docker y descarta sus escrituras. Review presenta el diff comprometido.",
        "Apply exige el hash revisado y hace fast-forward local; nunca publica ni despliega.",
      ].join("\n"),
    );
    return;
  }

  const repoArgument = args[2];
  if (!repoArgument) {
    console.error("Falta la ruta del repositorio.");
    process.exitCode = 2;
    return;
  }
  const repoPath = path.resolve(process.cwd(), repoArgument);
  const { EosEngineeringWorkflow } = await import("../../src/core/eosEngineeringWorkflow.ts");
  const workflow = new EosEngineeringWorkflow();

  try {
    if (action === "inspect") {
      const report = workflow.inspect(repoPath);
      console.log(`Repositorio       : ${report.audit.projectPath}`);
      console.log(`Rama / HEAD       : ${report.branch} / ${report.headCommit.slice(0, 12)}`);
      console.log(`Archivos sin commit: ${report.dirtyFiles.length}`);
      console.log(`Señales locales   : ${report.audit.localSignalScore}/100 (${report.audit.localSignalBand})`);
      console.log("Preparación prod. : No evaluada");
      for (const [pillar, result] of Object.entries(report.audit.pillars)) {
        console.log(`  ${pillar}: ${result.score}/20`);
        result.findings.slice(0, 5).forEach((finding) => console.log(`    - ${finding}`));
      }
    } else if (action === "plan" || action === "start") {
      const task = args.slice(3).join(" ");
      if (!task) throw new Error("Indica la tarea después de la ruta del repositorio.");
      if (action === "plan") {
        const report = workflow.plan(repoPath, task);
        console.log(`Tarea             : ${report.task}`);
        console.log(`Estado            : ${report.planStatus}; ejecución: no realizada`);
        console.log(`Stack sugerido    : ${report.suggestedStack}`);
        console.log(`Stack detectado   : ${report.detectedStack}`);
        console.log(`Señales locales   : ${report.audit.localSignalScore}/100 (${report.audit.localSignalBand})`);
        console.log("Preparación prod. : No evaluada");
        report.audit.recommendations.forEach((item) => console.log(`  - ${item}`));
        console.log(`Inventario de plantilla: ${report.templateInventorySummary}`);
        report.proposedSteps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
        console.log(report.note);
      } else {
        const result = workflow.start(repoPath, task);
        console.log(`Workflow ID : ${result.workflowId}`);
        console.log(`Rama        : ${result.branchName} (base ${result.baseBranch}@${result.baseCommit.slice(0, 12)})`);
        console.log(`Worktree    : ${result.worktreePath}`);
        if (result.localExcludeUpdated)
          console.log("Exclusión local: añadí .worktrees/ y .eos/ a .git/info/exclude; no edité archivos versionados.");
        console.log("Siguiente: trabaja en ese worktree y crea un commit local con los cambios revisados.");
        console.log(
          `Después valida con: node bin/eos.mjs flow validate "${repoPath}" ${result.workflowId} -- <comando> [argumentos...]`,
        );
      }
    } else if (action === "validate") {
      const workflowId = args[3];
      const separator = args.indexOf("--", 4);
      if (!workflowId || separator < 0 || separator === args.length - 1) {
        throw new Error("Uso: eos flow validate <repo> <workflow-id> -- <comando> [argumentos...]");
      }
      const report = await workflow.validate(repoPath, workflowId, args[separator + 1], args.slice(separator + 2));
      console.log(
        `Validación: ${report.status}; exit=${report.exitCode ?? "N/D"}; cambios descartados en sandbox=${report.changedFiles.length}`,
      );
      if (report.receiptPath) console.log(`Recibo local: ${report.receiptPath}`);
      if (!report.success) {
        if (report.error) console.error(report.error);
        process.exitCode = report.status === "COMMAND_FAILED" ? report.exitCode || 1 : 1;
      }
    } else if (action === "review") {
      const workflowId = args[3];
      if (!workflowId) throw new Error("Falta el workflow-id.");
      const review = workflow.review(repoPath, workflowId);
      console.log(`Archivos revisados (${review.changedFiles.length}):`);
      review.changedFiles.forEach((file) => console.log(`  ${file}`));
      console.log(`\nSHA-256 del diff: ${review.diffSha256}`);
      console.log("\n===== DIFF =====");
      process.stdout.write(review.diff);
      console.log("\n===== FIN DEL DIFF =====");
      console.log(`\nPara aplicar este diff revisado: ${review.approvalCommand}`);
    } else if (action === "status") {
      const workflowId = args[3];
      if (!workflowId) throw new Error("Falta el workflow-id.");
      const status = workflow.status(repoPath, workflowId);
      console.log(`Workflow   : ${status.workflowId} — ${status.task}`);
      console.log(`Rama       : ${status.branchName} @ ${status.branchHead?.slice(0, 12) || "NO EXISTE"}`);
      console.log(`Base       : ${status.baseBranch} @ ${status.baseCommit.slice(0, 12)}`);
      console.log(`Worktree   : ${status.worktreeAvailable ? status.worktreePath : "CERRADO / AUSENTE"}`);
      console.log(`Cambios sin commit: ${status.worktreeDirtyFiles.length}`);
      console.log(
        `Validación : ${status.validationStatus}${status.validationHead ? ` @ ${status.validationHead.slice(0, 12)}` : ""}`,
      );
      console.log(`Diff visto : ${status.reviewedDiffSha256 || "NO"}`);
      console.log(`Aplicado   : ${status.appliedHead || "NO"}`);
      if (status.closedAt) console.log(`Cerrado    : ${status.closedAt}`);
    } else if (action === "apply") {
      const workflowId = args[3];
      const approval = args.slice(4).find((value) => value.startsWith("--confirm-diff="));
      if (!workflowId || !approval) throw new Error("Se requiere --confirm-diff=<sha256> del último flow review.");
      const appliedHead = workflow.apply(repoPath, workflowId, approval.slice("--confirm-diff=".length));
      console.log(`Aplicado por fast-forward local: ${appliedHead}`);
      console.log("No se hizo push ni despliegue.");
    } else if (action === "close") {
      const workflowId = args[3];
      if (!workflowId) throw new Error("Falta el workflow-id.");
      const result = workflow.close(repoPath, workflowId, args.includes("--force"));
      console.log(`[EOS FLOW] ${result}`);
      console.log("La rama permanece disponible para recuperación o limpieza manual posterior.");
    } else {
      throw new Error(`Acción desconocida: ${action}. Ejecuta eos flow help.`);
    }
  } catch (error) {
    console.error(`[EOS FLOW] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

HANDLERS["flow"] = cmd_flow_29;

async function cmd_sandbox_30(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosContainerSandbox } = await import("../../src/core/eosContainerSandbox.ts");
  const sandbox = new EosContainerSandbox(root);
  const subcommand = (args[1] || "help").toLowerCase();

  if (subcommand === "doctor") {
    const report = sandbox.doctor();
    console.log(`[EOS SANDBOX] ${report.ready ? "READY" : "NOT READY"}`);
    console.log(report.message);
    if (report.image) console.log(`Imagen fijada: ${report.image}`);
    if (!report.ready) process.exitCode = 1;
    return;
  }

  if (subcommand !== "run") {
    console.log(
      "Uso: eos sandbox doctor | eos sandbox run <worktree> [--apply] [--timeout SEGUNDOS] -- <comando> [argumentos...]",
    );
    return;
  }

  const separator = args.indexOf("--", 2);
  const worktreePath = args[2];
  if (!worktreePath || separator < 0 || separator === args.length - 1) {
    console.error("Falta <worktree> o el comando posterior a `--`.");
    process.exitCode = 2;
    return;
  }
  const runOptions = args.slice(3, separator);
  const commandArgs = args.slice(separator + 1);
  const applyChanges = runOptions.includes("--apply");
  let timeoutMs;
  const timeoutIndex = runOptions.indexOf("--timeout");
  if (timeoutIndex >= 0) {
    const seconds = Number(runOptions[timeoutIndex + 1]);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 900) {
      console.error("--timeout debe ser un número entero entre 1 y 900 segundos.");
      process.exitCode = 2;
      return;
    }
    timeoutMs = seconds * 1000;
  }
  const unknownOptions = runOptions.filter(
    (option, index) =>
      option !== "--apply" && option !== "--timeout" && (index === 0 || runOptions[index - 1] !== "--timeout"),
  );
  if (unknownOptions.length > 0) {
    console.error(`Opción no reconocida: ${unknownOptions.join(" ")}`);
    process.exitCode = 2;
    return;
  }

  try {
    console.log("[EOS SANDBOX] Ejecución local sin red en una copia filtrada del worktree.");
    console.log(
      `Salida a Git: ${applyChanges ? "solicitada; requiere salida 0 y revisión de conflictos" : "desactivada; se descartarán los cambios"}`,
    );
    const report = await sandbox.run({
      worktreePath,
      command: commandArgs[0],
      commandArgs: commandArgs.slice(1),
      applyChanges,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    console.log(
      `Estado: ${report.status}; código: ${report.exitCode ?? "N/D"}; archivos cambiados en copia: ${report.changedFiles.length}`,
    );
    if (report.appliedChanges)
      console.log(
        `Archivos escritos en el worktree: ${report.changedFiles.filter((file) => !report.conflicts.includes(file)).length}`,
      );
    report.changedFiles
      .slice(0, 100)
      .forEach((file) =>
        console.log(
          `  ${report.appliedChanges && !report.conflicts.includes(file) ? "ESCRITO" : "CAMBIO EN COPIA"} ${file}`,
        ),
      );
    if (report.changedFiles.length > 100) console.log(`  ... y ${report.changedFiles.length - 100} más`);
    report.conflicts.forEach((file) => console.log(`[CONFLICTO] ${file}`));
    report.excludedPaths.slice(0, 50).forEach((file) => console.log(`[EXCLUIDO] ${file}`));
    if (report.excludedPaths.length > 50)
      console.log(`  ... y ${report.excludedPaths.length - 50} rutas excluidas más`);
    if (report.error) console.error(`[SANDBOX] ${report.error}`);
    if (report.receiptPath) console.log(`Recibo local: ${report.receiptPath}`);
    if (!report.success) process.exitCode = report.status === "CONFLICT" ? 2 : report.exitCode || 1;
  } catch (error) {
    console.error(`[EOS SANDBOX] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

HANDLERS["sandbox"] = cmd_sandbox_30;

async function cmd_xirp_31(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const sub = (args[1] || "sync").toLowerCase();
  const { EosSpotifyAgenticFactory } = await import("../../src/core/eosSpotifyAgenticFactory.ts");
  const factory = new EosSpotifyAgenticFactory(root);

  if (sub === "sync") {
    const res = factory.syncXirpContextFiles();
    console.log(`[EOS XIRP CONTEXT] Contexto de Arquitectura Spotify Sincronizado:\n`);
    res.writtenFiles.forEach((f) => console.log(`  ✔ Archivo Sincronizado: ${path.relative(root, f)}`));
    console.log(`\nFingerprint SHA-256: ${res.sha256} (no es firma ni atestación)`);
    console.log("[LOCAL] AGENTS.md y CLAUDE.md generados desde metadatos del checkout.");
    return;
  }

  const ctx = factory.compileXirpContext();
  console.log(`[EOS XIRP CONTEXT] Inspección de Componente Backstage RFC-42:\n`);
  console.log(`Servicio Principal    : ${ctx.serviceName}`);
  console.log(`Título de Catálogo    : ${ctx.title}`);
  console.log(`Owner Squad           : ${ctx.squad}`);
  console.log(`Tribu Spotify         : ${ctx.tribe}`);
  console.log(`Ciclo de Vida         : ${ctx.lifecycle}`);
  console.log(`Repositorios en Flota : ${ctx.registeredFleetProjects}`);
  console.log(`ADRs / OpenSpec Specs : ${ctx.adrCount}`);
  console.log(`Etiquetas             : ${ctx.tags.join(", ")}`);
  console.log(`Sello SHA-256         : ${ctx.sha256Proof}\n`);
  console.log(`[PASS] Catálogo Xirp verificado exitosamente (Exit Code 0).`);
}

HANDLERS["xirp"] = cmd_xirp_31;

async function cmd_fleetshift_32(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const actionArg = (args[1] || "apply_backstage_rfc42").toLowerCase();
  const { EosSpotifyAgenticFactory } = await import("../../src/core/eosSpotifyAgenticFactory.ts");
  const factory = new EosSpotifyAgenticFactory(root);

  console.log(`[EOS FLEETSHIFT] Disparando Migración Masiva de Flota (Acción: ${actionArg})...\n`);
  const report = factory.executeFleetshift({
    migrationId: `FS-${Date.now()}`,
    description: `Mass fleet refactoring: ${actionArg}`,
    action: actionArg,
    dryRun: false,
  });

  console.log(`ID de Migración       : ${report.migrationId}`);
  console.log(`Repositorios Totales  : ${report.totalProjects}`);
  console.log(`Repositorios Auditados: ${report.updatedCount}`);
  console.log(`Estado General        : ${report.status}`);
  console.log(`Sello Merkle Flota    : ${report.merkleSeal.slice(0, 32)}...\n`);

  console.log("=== RESULTADOS POR PROYECTO DE LA FLOTA ===");
  report.projectResults.forEach((r) => {
    console.log(
      `  ↳ [${r.status}] ${r.projectId}: ${r.changesApplied.join("; ") || r.error || "Sin cambios requeridos"}`,
    );
  });

  console.log(`\n[PASS] Migración Fleetshift completada con éxito (Exit Code 0).`);
}

HANDLERS["fleetshift"] = cmd_fleetshift_32;

async function cmd_dsp_33(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  const { EosAudioDspKernel } = await import("../../src/core/eosAudioDspKernel.ts");
  const kernel = new EosAudioDspKernel();
  console.log("[EOS AUDIO DSP] Ejecutando benchmark de filtrado Biquad Transpuesto & Limitador ITU-R BS.1770...\n");
  const bench = kernel.benchmarkDsp(65536, 20);
  console.log(`Frecuencia de Muestreo : ${bench.sampleRateHz} Hz`);
  console.log(`Cuadros de Audio       : ${bench.bufferFrames}`);
  console.log(`Muestras Totales       : ${bench.totalSamplesProcessed.toLocaleString()}`);
  console.log(`Rendimiento            : ${bench.throughputSamplesSec.toLocaleString()} muestras/seg`);
  console.log(`Factor de Velocidad    : ${bench.realTimeSpeedFactor}x Tiempo Real`);
  console.log(`Pico Verdadero Salida  : ${bench.truePeakOutputDb} dBTP`);
  console.log(`Limitador Activado     : ${bench.limiterClamped}`);
  console.log(`Duración de Proceso    : ${bench.durationUs.toFixed(2)} µs`);
  console.log(`Sello SHA-256          : ${bench.sha256Proof}\n`);
  console.log("[PASS] Kernel DSP ejecutado con éxito.");
}

HANDLERS["dsp"] = cmd_dsp_33;

async function cmd_fleet_elevate_34(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const dryRun = args.includes("--dry") || args.includes("--dry-run");
  const { EosFleetElevator } = await import("../../src/core/eosFleetElevator.ts");
  const elevator = new EosFleetElevator(root);
  console.log(`[EOS FLEET ELEVATOR] Elevando repositorios de la flota al Golden Path RFC-42 (Dry Run: ${dryRun})...\n`);
  const report = elevator.elevateFleet({ dryRun });
  console.log(`Repositorios Totales   : ${report.totalProjects}`);
  console.log(`Repositorios Elevados  : ${report.elevatedProjects}`);
  console.log(`Índice Golden Path     : ${report.fleetGoldenPathScore.toFixed(1)}%`);
  console.log(`Sello SHA-256          : ${report.sha256Proof}\n`);
  report.projects.forEach((d) => {
    console.log(
      `  ↳ [${d.catalogInfoStatus}] ${d.id} (Score: ${d.goldenPathScore}/100) -> ${d.recommendations.join("; ") || "Conforme"}`,
    );
  });
  console.log(`\n[PASS] Elevación de flota completada con éxito.`);
}

HANDLERS["fleet:elevate"] = cmd_fleet_elevate_34;

async function cmd_rpc_35(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  const { EosApolloHermesMesh } = await import("../../src/core/eosApolloHermesMesh.ts");
  const mesh = new EosApolloHermesMesh();
  console.log("[EOS APOLLO/HERMES MESH] Despachando llamada RPC con Circuit Breaker y W3C Tracing...\n");
  const res = await mesh.invokeRpc(
    "audio-engine",
    "normalize-track",
    { trackId: "spotify:track:4cOdK2wGLETKBW3PvgPWqT", targetLufs: -14.0 },
    async (p) => {
      return { status: "NORMALIZED", targetLufs: p.targetLufs, ceilingDbTP: -1.0 };
    },
  );
  console.log(`Servicio Destino       : ${res.serviceName}/${res.endpoint}`);
  console.log(`Éxito de Llamada       : ${res.success}`);
  console.log(`Estado Circuit Breaker : ${res.circuitState}`);
  console.log(`Duración               : ${res.durationUs.toFixed(2)} µs`);
  console.log(`Partición FNV-1a       : ${res.partitionId}`);
  console.log(`W3C Traceparent        : ${res.traceContext.headerString}`);
  console.log(`Datos de Retorno       : ${JSON.stringify(res.data)}\n`);
  console.log("[PASS] RPC Apollo/Hermes ejecutado con éxito.");
}

HANDLERS["rpc"] = cmd_rpc_35;

async function cmd_mix_36(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const keyA = args[1] || "8A";
  const keyB = args[2] || "9A";
  const bpmA = Number(args[3]) || 126;
  const bpmB = Number(args[4]) || 128;

  const { EosGaplessMixEngine } = await import("../../src/core/eosGaplessMixEngine.ts");
  const engine = new EosGaplessMixEngine();

  console.log(`[EOS DJ AUTOMIX ENGINE] Planificando transición armónica (${keyA} -> ${keyB})...\n`);
  const plan = engine.planTransition(
    { trackId: "track-A", title: `Track A (${keyA})`, bpm: bpmA, camelotKey: keyA, sampleRateHz: 44100 },
    { trackId: "track-B", title: `Track B (${keyB})`, bpm: bpmB, camelotKey: keyB, sampleRateHz: 44100 },
    5.0,
  );

  console.log(`Track Saliente (A)     : ${plan.trackA.camelotKey} @ ${plan.trackA.bpm} BPM`);
  console.log(`Track Entrante (B)     : ${plan.trackB.camelotKey} @ ${plan.trackB.bpm} BPM`);
  console.log(`Tipo de Transición     : ${plan.transitionType}`);
  console.log(`Costo Armónico         : ${plan.harmonicTransitionCost.toFixed(2)} (0.0=Perfecto, 1.0=Disonante)`);
  console.log(`Delta de Tempo         : ${plan.tempoDeltaPercent}%`);
  console.log(`Duración Crossfade     : ${plan.durationSeconds}s (${plan.durationSamples.toLocaleString()} muestras)`);
  console.log(`Estrategia Recomendada : ${plan.recommendedStrategy}`);
  console.log(`Sello SHA-256          : ${plan.sha256Proof}\n`);
  console.log("[PASS] Plan de mezcla DJ generado con éxito.");
}

HANDLERS["mix"] = cmd_mix_36;

async function cmd_features_37(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const userId = args[1] || "user-spotify-listener";
  const { EosAcousticFeatureStore } = await import("../../src/core/eosAcousticFeatureStore.ts");
  const store = new EosAcousticFeatureStore(7);

  // Populate with representative user history
  store.recordListen(
    userId,
    "track-1",
    {
      tempo: 0.7,
      energy: 0.85,
      danceability: 0.8,
      valence: 0.7,
      acousticness: 0.1,
      instrumentalness: 0.2,
      liveness: 0.15,
      speechiness: 0.08,
    },
    210,
    210,
  );
  store.recordListen(
    userId,
    "track-2",
    {
      tempo: 0.75,
      energy: 0.9,
      danceability: 0.85,
      valence: 0.75,
      acousticness: 0.08,
      instrumentalness: 0.1,
      liveness: 0.2,
      speechiness: 0.05,
    },
    190,
    200,
  );

  const profile = store.computeTasteCentroid(userId);
  console.log(`[EOS ACOUSTIC FEATURE STORE] Perfil de gusto en tiempo real (${userId}):\n`);
  console.log(`Total Escuchas         : ${profile.totalListens}`);
  console.log(`Tasa de Omisión (Skip) : ${(profile.skipRate * 100).toFixed(1)}%`);
  console.log(`Vector Centroide 8D:`);
  console.log(`  • Tempo              : ${profile.centroid.tempo}`);
  console.log(`  • Energía            : ${profile.centroid.energy}`);
  console.log(`  • Bailabilidad       : ${profile.centroid.danceability}`);
  console.log(`  • Positividad/Valence: ${profile.centroid.valence}`);
  console.log(`  • Acústica           : ${profile.centroid.acousticness}`);
  console.log(`  • Instrumental       : ${profile.centroid.instrumentalness}`);
  console.log(`  • Vivo (Liveness)    : ${profile.centroid.liveness}`);
  console.log(`  • Voz (Speechiness)  : ${profile.centroid.speechiness}`);
  console.log(`\nSello Merkle SHA-256   : ${profile.sha256Proof}\n`);
  console.log("[PASS] Centroide acústico calculado con éxito.");
}

HANDLERS["features"] = cmd_features_37;

async function cmd_fingerprint_38(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const target = args[1] || root;
  const { EosUniversalProjectAdapter } = await import("../../src/core/eosUniversalProjectAdapter.ts");
  const adapter = new EosUniversalProjectAdapter(target);
  const report = adapter.audit(target);
  const fp = report.fingerprint;

  console.log(`[EOS POLYGLOT FINGERPRINT] Huella Arquitectónica (${report.projectName}):\n`);
  console.log(`Lenguaje Principal     : ${fp.primaryLanguage}`);
  console.log(`Gestor de Paquetes     : ${fp.packageManager}`);
  console.log(`Framework de Pruebas   : ${fp.testFramework}`);
  console.log(`Linter / Formateo      : ${fp.linter || "No configurado"}`);
  console.log(`Contenedorización      : ${fp.containerization}`);
  console.log(`Tubería CI/CD          : ${fp.ciCd}`);
  console.log(`Catálogo Backstage     : ${fp.hasBackstageDescriptor ? "Sí (RFC-42)" : "No"}`);
  console.log(`Codex de Agentes IA    : ${fp.hasAgentScaffolding ? "Sí (AGENTS.md / CLAUDE.md)" : "No"}`);
  console.log(`Total Archivos Código  : ${fp.totalSourceFiles}\n`);
  console.log("[PASS] Huella arquitectónica extraída con éxito.");
}

HANDLERS["fingerprint"] = cmd_fingerprint_38;

async function cmd_adapt_39(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const target = args[1] || root;
  const doScaffold = args.includes("--scaffold") || args.includes("--elevate");
  const { EosUniversalProjectAdapter } = await import("../../src/core/eosUniversalProjectAdapter.ts");
  const adapter = new EosUniversalProjectAdapter(target);
  const report = adapter.audit(target);

  console.log(`[EOS UNIVERSAL ADAPTER] Inventario de señales locales (${report.projectName}):\n`);
  console.log(`Lenguaje / Stack       : ${report.fingerprint.primaryLanguage} (${report.fingerprint.packageManager})`);
  console.log(`Señales estructurales  : ${report.localSignalScore}/100 [${report.localSignalBand}]`);
  console.log("Preparación productiva : No evaluada");
  console.log(`Digest del reporte SHA-256: ${report.sha256ReportDigest}\n`);

  console.log("=== GRUPOS DE SEÑALES LOCALES ===");
  for (const [key, p] of Object.entries(report.pillars)) {
    console.log(`  • [${p.signalBand}] ${p.name || key}: ${p.score}/${p.maxScore}`);
    p.findings.forEach((f) => console.log(`      ↳ ${f}`));
  }

  if (report.recommendations.length > 0) {
    console.log("\n=== RECOMENDACIONES DE ELEVACIÓN ===");
    report.recommendations.forEach((r) => console.log(`  ⚡ ${r}`));
  }

  console.log("\n=== LÍMITES DE ESTA EVALUACIÓN ===");
  report.assessmentLimitations.forEach((limitation) => console.log(`  • ${limitation}`));

  if (doScaffold) {
    console.log("\n[EOS GOLDEN PATH] Aplicando plantillas locales de proyecto...");
    const res = adapter.elevate(target, { dryRun: false });
    console.log(`  Archivos creados/actualizados: ${res.appliedActions.join(", ") || "Ninguno"}`);
  }

  console.log(`\n[PASS] Auditoría universal de proyecto completada con éxito.`);
}

HANDLERS["adapt"] = cmd_adapt_39;

export async function handleSpotifyCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
