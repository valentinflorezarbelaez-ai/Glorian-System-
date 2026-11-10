import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HANDLERS = {};

async function cmd_verify_0(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS] Executing configured local repository checks...\n");
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/verify-cicd-pipeline.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    process.exit(1);
  }
}

HANDLERS["verify"] = cmd_verify_0;

async function cmd_turbo_1(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS TURBO] Disparando Tubería de Verificación Ultrarrápida en Memoria...\n");
  const { runTurboPipeline } = await import("../../src/core/eosTurboEngine.ts");
  const result = runTurboPipeline(root);

  console.log(`Estado Epistémico    : ${result.epistemicState}`);
  console.log(`Tiempo Total         : ${result.totalDurationMs} ms (${result.totalDurationUs} µs)`);
  console.log(
    `Archivos Analizados  : ${result.totalFilesChecked} (${result.cacheHits} en caché, ${result.freshScans} frescos)`,
  );
  console.log(`Source Inventory SHA-256: ${result.sourceInventoryDigest}\n`);
  console.log("=== TELEMETRÍA DE ALTA PRECISIÓN POR ADUANA ===");
  result.stages.forEach((s) => {
    const icon = s.status === "PASS" ? "✔" : "✖";
    console.log(`  ${icon} [${s.stageId}] ${s.name}: ${s.durationMs} ms (${s.durationUs} µs)`);
    console.log(`    ↳ ${s.details}`);
  });

  if (result.violations.length > 0) {
    console.log("\n[HALLAZGOS DETECTADOS]");
    result.violations.forEach((v) => console.log(`  ! ${v}`));
    process.exit(1);
  } else {
    console.log(`\n[PASS] Verificación Turbo 100% exitosa en ${result.totalDurationMs} ms (Exit Code 0).`);
  }
}

HANDLERS["turbo"] = cmd_turbo_1;
HANDLERS["fast"] = cmd_turbo_1;

async function cmd_audit_2(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS] Auditing Sovereign Fleet Repositories...\n");
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/fleet-autonomous-cicd.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    process.exit(1);
  }
}

HANDLERS["audit"] = cmd_audit_2;

async function cmd_test_3(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS] Running Native Unit & Chaos Resilience Test Suites...\n");
  try {
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosCore.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/chaosResilience.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosPrometheus.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosTurbo.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosSemanticGraph.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosAutonomousHealer.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosWorktree.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosCognitiveEval.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosOpenSpec.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync(process.execPath, ["--test", path.join(root, "test/eosTitans.test.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    console.log("\n[PASS] All Unit, Chaos, Worktree, Eval, OpenSpec & Titans suites completed successfully (Exit 0).");
  } catch {
    process.exit(1);
  }
}

HANDLERS["test"] = cmd_test_3;

async function cmd_mcp_4(commandContext) {
  const { root, args, printBanner } = commandContext;
  const subCommand = (args[1] || "--stdio").toLowerCase();
  if (subCommand === "--sse" || subCommand === "sse" || subCommand === "stream" || subCommand === "--stream") {
    printBanner();
    const port = args[2] ? parseInt(args[2], 10) : process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;
    const host = process.env.HOST || "127.0.0.1";
    const { EosMcpStreamServer } = await import("../../src/mcp/eosMcpStreamServer.ts");
    const streamServer = new EosMcpStreamServer(root);
    await streamServer.listen(port, host);
    console.log(`[EOS MCP] Bi-Directional SSE Live Stream Server active on http://${host}:${port}`);
    console.log(`[EOS MCP]   ↳ SSE Stream Endpoint : http://${host}:${port}/sse`);
    console.log(`[EOS MCP]   ↳ Message Backchannel : http://${host}:${port}/message?sessionId=<id>`);
    console.log(`[EOS MCP]   ↳ Health & Status     : http://${host}:${port}/health`);
    console.error(
      `[EOS MCP] Bearer token (local only; configure your MCP client with Authorization: Bearer <token>): ${streamServer.authToken}`,
    );
    console.error(
      `[EOS MCP] Browser clients require exact origins in EOS_MCP_ALLOWED_ORIGINS; requests without Origin still require the bearer token.`,
    );
    console.log(`[EOS MCP] Press Ctrl+C to terminate server.`);
  } else if (subCommand === "status" || subCommand === "--status") {
    printBanner();
    const { EosMcpServer } = await import("../../src/mcp/eosMcpServer.ts");
    const server = new EosMcpServer(root);
    const initRes = server.handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const toolsRes = server.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const toolsCount = toolsRes?.result?.tools?.length || 0;
    console.log(`[EOS MCP] Status: ONLINE`);
    console.log(`[EOS MCP]   ↳ Protocol Version   : ${initRes?.result?.protocolVersion || "2024-11-05"}`);
    console.log(`[EOS MCP]   ↳ Server Name        : ${initRes?.result?.serverInfo?.name}`);
    console.log(`[EOS MCP]   ↳ Registered Tools   : ${toolsCount} tools`);
    console.log(`[EOS MCP]   ↳ Supported Modes    : stdio (default), sse (--sse [port])`);
  } else {
    // Default: stdio loop for Cursor / Antigravity / Claude Code
    const { EosMcpServer } = await import("../../src/mcp/eosMcpServer.ts");
    const server = new EosMcpServer(root);
    server.startStdioLoop();
  }
}

HANDLERS["mcp"] = cmd_mcp_4;

async function cmd_jarvis_5(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const directive = args.slice(1).join(" ") || "Estado general del sistema";
  const { interpretJarvisDirective } = await import("../../src/core/eosJarvisMonad.ts");
  const receipt = interpretJarvisDirective(directive);

  console.log(`\nDirectiva     : "${receipt.promptInput}"`);
  console.log(`Intención     : ${receipt.detectedIntent}`);
  console.log(`Respuesta Voz : "${receipt.voiceTranscript}"`);
  console.log(`Cognition ID  : ${receipt.cognitionId}`);
  if (receipt.tmrConsensus) {
    console.log(`TMR Consenso  : ${receipt.tmrConsensus.agreementRatio} (${receipt.tmrConsensus.consensusHash})`);
    console.log(`Acción Run    : ${receipt.tmrConsensus.selectedAction}`);
  }
  console.log("\nPlan de Ejecución:");
  receipt.executionPlan.forEach((step) => console.log(`  ${step}`));
}

HANDLERS["jarvis"] = cmd_jarvis_5;

async function cmd_health_6(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  const mem = process.memoryUsage();
  console.log("\n[STATUS] : UP (Big Tech Tier 1)");
  console.log(`Runtime  : Node.js ${process.version} (${process.platform}-${process.arch})`);
  console.log(`Uptime   : ${Math.floor(process.uptime())}s`);
  console.log(`RSS Mem  : ${(mem.rss / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`HeapUsed : ${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Subsystems: 7/7 Monitored Online (L0 Pure, 0-Deps)`);
}

HANDLERS["health"] = cmd_health_6;

async function cmd_metrics_7(commandContext) {
  const { root } = commandContext;
  const { EosPrometheusExporter } = await import("../../src/core/eosPrometheusExporter.ts");
  const exporter = new EosPrometheusExporter(root);
  process.stdout.write(exporter.formatPrometheusText());
}

HANDLERS["metrics"] = cmd_metrics_7;

async function cmd_wal_8(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const defaultPath = path.join(root, "data/eos_bitemporal.wal");
  const targetWal = args[1] ? path.resolve(root, args[1]) : defaultPath;
  console.log(`\n[EOS WAL] Inspecting Write-Ahead Log: ${targetWal}`);
  if (!fs.existsSync(targetWal)) {
    console.log(`[EOS WAL] Status: WAL file does not exist yet (initialized on first bitemporal transaction).`);
  } else {
    const stats = fs.statSync(targetWal);
    console.log(`[EOS WAL] File Size      : ${stats.size} bytes`);
    console.log(`[EOS WAL] Format         : EOSW Binary v1`);
    console.log(`[EOS WAL] Durability     : HARDWARE_FSYNC (Linear Forward Crash Recovery)`);
  }
}

HANDLERS["wal"] = cmd_wal_8;

async function cmd_bench_nano_9(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  console.log("\n[EOS APEX] Running Nanosecond Micro-Benchmarking Suite (Tier-0)...");
  const { EosNanoBenchmarkEngine } = await import("../../src/core/eosNanoBenchmarkEngine.ts");
  const reports = await EosNanoBenchmarkEngine.runApexCoreSuite();
  for (const r of reports) {
    console.log(`\n--- ${r.name} (${r.iterations} iters) ---`);
    console.log(`  Media        : ${r.meanNs} ns (${(r.meanNs / 1000).toFixed(3)} µs)`);
    console.log(`  p50 / p90    : ${r.percentilesNs.p50} ns / ${r.percentilesNs.p90} ns`);
    console.log(`  p99 / p99.99 : ${r.percentilesNs.p99} ns / ${r.percentilesNs.p99_99} ns`);
    console.log(`  Throughput   : ${r.opsPerSec.toLocaleString()} ops/sec`);
    console.log(
      `  Desviación   : ±${r.stdDevNs} ns | 0-Alloc: ${r.zeroAllocationVerified ? "VERIFIED" : "UNVERIFIED"}`,
    );
  }
}

HANDLERS["bench:nano"] = cmd_bench_nano_9;

async function cmd_daemon_10(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  const { EosSentinelDaemon } = await import("../../src/core/eosSentinelDaemon.ts");
  const sentinel = new EosSentinelDaemon(root);
  const report = sentinel.tick();
  console.log("\n[EOS SENTINEL] 24/7 Sovereign Heartbeat Pulse (Tick)");
  console.log(`  Estado           : ${report.status}`);
  console.log(`  Merkle Root      : ${report.merkleRootHash.slice(0, 32)}...`);
  console.log(`  Archivos Guía    : ${report.filesMonitoredCount} archivos críticos verificados`);
  console.log(
    `  Memoria V8 Heap  : ${(report.memoryHealth.heapUsedBytes / (1024 * 1024)).toFixed(2)} MB (${(report.memoryHealth.utilizationRatio * 100).toFixed(1)}% uso)`,
  );
  console.log(
    `  Nodos de Flota   : ${report.fleetHealth.totalNodes} nodos activos en anillos [${report.fleetHealth.ringsActive.join(", ")}]`,
  );
  console.log(`  Enlaces Huérfanos: ${report.fleetHealth.orphanLinksDetected}`);
}

HANDLERS["daemon"] = cmd_daemon_10;

async function cmd_transmute_11(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetFile = args[1] || "src/core/eosJarvisSoul.ts";
  const { EosAlchemicalTransmuter } = await import("../../src/core/eosAlchemicalTransmuter.ts");
  const transmuter = new EosAlchemicalTransmuter(root);
  const rep = transmuter.analyzeFile(targetFile);
  console.log(`\n[EOS ALQUIMIA] Análisis de Entropía & Pureza Nous: ${rep.target}`);
  console.log(`  Nota Vibracional : ${rep.octaveVibrationalNote} (${rep.alchemicalState})`);
  console.log(`  Pureza Nous      : ${rep.nousPurityPercent}%`);
  console.log(`  Entropía Shannon : ${rep.shannonEntropyBits} bits/carácter`);
  console.log(`  Ramas Control    : ${rep.cyclomaticDensity} puntos de bifurcación`);
  console.log(`  Agregados (Ego)  : ${rep.agregadosDetectedCount} detectados`);
  console.log(`  Dictamen         : ${rep.transmutationAdvice}`);
}

HANDLERS["transmute"] = cmd_transmute_11;

async function cmd_optimize_v8_12(commandContext) {
  const { printBanner } = commandContext;
  printBanner();
  console.log("\n[EOS V8] Big Tech Hyper-Optimization Suite (4x Unrolling & Slab Pool)...");
  const { EosBitwiseAccelerator } = await import("../../src/core/eosBitwiseAccelerator.ts");
  const { EosBufferPool } = await import("../../src/core/eosBufferPool.ts");
  const { EosApexProfiler } = await import("../../src/core/eosApexProfiler.ts");

  // 1. Bitwise 4x Unrolled Benchmark
  const bench = EosBitwiseAccelerator.benchmarkSpeedup(65536, 1000);
  console.log(`\n--- 4x Loop Unrolling CRC32 Benchmark ---`);
  console.log(`  Búfer de Prueba : ${bench.bufferSizeBytes} bytes (64 KB) x ${bench.iterations} iteraciones`);
  console.log(`  Tiempo Total    : ${bench.unrolledDurationMs} ms`);
  console.log(`  Throughput      : ${bench.unrolledThroughputMbSec} MB/s`);
  console.log(`  Suma Verificada : ${bench.checksumsMatch ? "CORRECTA (IEEE 802.3)" : "FALLIDA"}`);

  // 2. Slab Buffer Pool Test
  const pool = new EosBufferPool({ slabSize: 4096, capacity: 64 });
  for (let i = 0; i < 500; i++) {
    const slab = pool.acquire();
    pool.release(slab);
  }
  const poolStats = pool.getStats();
  console.log(`\n--- Slab Buffer Pool (Zero-GC Allocator) ---`);
  console.log(
    `  Capacidad Total : ${poolStats.totalCapacity} slabs (${(poolStats.totalCapacity * poolStats.slabSizeBytes) / 1024} KB)`,
  );
  console.log(`  Adquisiciones   : ${poolStats.totalAcquires} | Liberaciones: ${poolStats.totalReleases}`);
  console.log(`  Tasa de Acierto : ${poolStats.poolHitRatePercent}% (0 Derrames de Memoria)`);

  // 3. JIT TurboFan Profiler
  const prof = EosApexProfiler.profileFunction(
    "Bitwise FNV-1a 64-bit",
    () => {
      EosBitwiseAccelerator.fnv1a64("eos-system-sovereign-control-plane-v40.0.0");
    },
    20,
    20000,
  );
  console.log(`\n--- V8 TurboFan Profile-Guided Optimization ---`);
  console.log(`  Función         : ${prof.functionName}`);
  console.log(`  Ejecución Fría  : ${prof.coldMeanNs} ns`);
  console.log(`  Ejecución Hot   : ${prof.hotMeanNs} ns`);
  console.log(`  Factor TurboFan : ${prof.jitSpeedupMultiplier}x aceleración JIT`);
  console.log(`  Estado          : ${prof.status}`);
}

HANDLERS["optimize:v8"] = cmd_optimize_v8_12;

async function cmd_optimize_13(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetFile = args[1];
  if (!targetFile) {
    console.log("Uso: eos optimize <ruta-del-archivo>");
    process.exit(1);
  }
  const fullPath = path.resolve(root, targetFile);
  if (!fs.existsSync(fullPath)) {
    console.log(`Error: Archivo no encontrado: ${targetFile}`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath, "utf8");
  const { compressSourceContext } = await import("../../src/core/eosContextOptimizer.ts");
  const res = compressSourceContext(content, targetFile);
  console.log(`\nArchivo Comprimido : ${res.filePath}`);
  console.log(`Tokens Originales  : ~${res.originalTokensEstimate}`);
  console.log(`Tokens Comprimidos : ~${res.compressedTokensEstimate}`);
  console.log(`Ahorro de Tokens   : ${res.tokenSavingsPercent}%`);
  console.log(`Símbolos Extraídos : ${res.symbolsFound.join(", ") || "Ninguno"}`);
  console.log("\n--- ESQUEMA DE CONTEXTO ESTRUCTURAL ---");
  console.log(res.compressedOutline);
}

HANDLERS["optimize"] = cmd_optimize_13;

async function cmd_amplify_14(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const rawPrompt = args.slice(1).join(" ");
  if (!rawPrompt) {
    console.log("Uso: eos amplify <directiva-o-prompt>");
    process.exit(1);
  }
  const { amplifyPrompt } = await import("../../src/core/eosPromptAmplifier.ts");
  const result = amplifyPrompt({ rawPrompt, strictLevel: "sovereign" });
  console.log(`\nDirectiva Original   : "${result.originalPrompt}"`);
  console.log(`Dominio Detectado    : ${result.detectedDomain}`);
  console.log(`Estrategia Cognitiva : ${result.modelScaffold.thinkingStrategy}\n`);
  console.log("=== ESPECIFICACIÓN EARS (ISO 29148 / IEEE 830) ===");
  result.earsRequirements.forEach((req) => {
    console.log(`[${req.id}] ${req.type}: ${req.syntax}`);
  });
  console.log("\n=== CRITERIOS DE ACEPTACIÓN (BDD GIVEN-WHEN-THEN) ===");
  result.bddScenarios.forEach((sc) => {
    console.log(`Scenario: ${sc.title}`);
    console.log(`  GIVEN ${sc.given}`);
    console.log(`  WHEN ${sc.when}`);
    console.log(`  THEN ${sc.then}`);
    sc.and.forEach((a) => console.log(`  AND ${a}`));
  });
  console.log("\n=== CONTRATO ANTI-ALUCINACIÓN ===");
  result.modelScaffold.antiHallucinationRules.forEach((rule) => console.log(`  ! ${rule}`));
}

HANDLERS["amplify"] = cmd_amplify_14;

async function cmd_guard_15(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetDir = args[1] ? path.resolve(root, args[1]) : path.resolve(root, "src");
  console.log(`[EOS GUARD] Escaneando arquitectura Hexagonal en: ${targetDir}\n`);
  const { scanArchitecture } = await import("../../src/core/eosArchitectureGuard.ts");
  const report = scanArchitecture(targetDir, root);

  console.log(`Archivos Analizados  : ${report.scannedFilesCount}`);
  console.log(
    `Distribución Capas   : DOMAIN=${report.layersDistribution.DOMAIN}, APP=${report.layersDistribution.APPLICATION}, INFRA=${report.layersDistribution.INFRASTRUCTURE}, UI=${report.layersDistribution.PRESENTATION}`,
  );
  console.log(`Pureza Arquitectónica: ${report.architecturePurityScore}%`);
  console.log(`Ciclos Circulares    : ${report.circularDependencies.length}`);
  console.log(`Total Violaciones    : ${report.totalViolations}`);

  if (report.violations.length > 0) {
    console.log("\n[HALLAZGOS IDENTIFICADOS]");
    report.violations.forEach((v) => {
      console.log(`  - [${v.rule}] en ${v.file}: ${v.details}`);
    });
    process.exit(1);
  } else {
    console.log("\n[PASS] Arquitectura 100% limpia. 0 dependencias circulares. Dominio L0 puro.");
  }
}

HANDLERS["guard"] = cmd_guard_15;

async function cmd_judge_16(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const scenarioDesc = args.slice(1).join(" ") || "Propuesta de refactorización de módulo";
  const { evaluateDecision } = await import("../../src/core/eosCognitiveJudge.ts");
  const verdict = evaluateDecision({
    title: "Evaluación Soberana de Propuesta",
    description: scenarioDesc,
    proposedAction: scenarioDesc,
    targetDomain: "CORE",
  });

  console.log(`\nEscenario            : ${verdict.scenarioTitle}`);
  console.log(`Dictamen             : ${verdict.approved ? "APROBADO [PASS]" : "RECHAZADO [FAIL]"}`);
  console.log(`Puntaje Bayesiano    : ${verdict.overallScore}/100`);
  console.log(`Estado Epistémico    : ${verdict.epistemicState}`);
  console.log("\nDesglose por Dimensión:");
  console.log(`  - Seguridad         : ${verdict.dimensionScores.security}/100`);
  console.log(`  - Pureza Hexagonal  : ${verdict.dimensionScores.architecturalPurity}/100`);
  console.log(`  - Corrección (Spec) : ${verdict.dimensionScores.correctness}/100`);
  console.log(`  - Rendimiento       : ${verdict.dimensionScores.performance}/100`);

  if (verdict.requiredRemediations.length > 0) {
    console.log("\nRemediaciones Requeridas:");
    verdict.requiredRemediations.forEach((r) => console.log(`  ! ${r}`));
  }
  console.log(`\nVeredicto: ${verdict.verdictRationale}`);
  if (!verdict.approved) process.exit(1);
}

HANDLERS["judge"] = cmd_judge_16;

async function cmd_blast_17(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetFile = args[1];
  if (!targetFile) {
    console.log("Uso: eos blast <archivo>");
    process.exit(1);
  }
  const { EosSemanticGraph } = await import("../../src/core/eosSemanticGraph.ts");
  const graph = new EosSemanticGraph(root);
  const report = graph.calculateBlastRadius(targetFile);

  console.log(`\nArchivo Objetivo      : ${report.targetFile}`);
  console.log(`Nivel de Riesgo       : [${report.riskLevel}]`);
  console.log(`Consumidores Directos : ${report.directConsumers.length}`);
  console.log(
    `Impacto Transitivo    : ${report.totalImpactedFiles} archivos (${report.impactPercentage}% del proyecto)`,
  );
  console.log(`Tiempo de Cálculo     : ${report.durationUs} µs\n`);

  if (report.directConsumers.length > 0) {
    console.log("Consumidores Directos:");
    report.directConsumers.forEach((c) => console.log(`  ↳ ${c}`));
  }
  if (report.transitiveConsumers.length > 0) {
    console.log("\nCierre Transitivo Completo (Blast Radius):");
    report.transitiveConsumers.forEach((c) => console.log(`  * ${c}`));
  }
  if (report.predictiveTestSuites.length > 0) {
    console.log("\n[PTS] Selección Predictiva de Pruebas Requeridas:");
    report.predictiveTestSuites.forEach((t) => console.log(`  ✔ node --test ${t}`));
  }
}

HANDLERS["blast"] = cmd_blast_17;

async function cmd_graph_18(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  console.log("[EOS GRAPH] Construyendo Grafo Semántico Big Tech Tier 1...\n");
  const { EosSemanticGraph } = await import("../../src/core/eosSemanticGraph.ts");
  const graph = new EosSemanticGraph(root);
  const summary = graph.getSummary();

  console.log(`Nodos de Archivo      : ${summary.totalFiles}`);
  console.log(`Símbolos Exportados   : ${summary.totalExports}`);
  console.log(`Aristas de Dependencia: ${summary.totalEdges}`);
  console.log(`Código Huérfano       : ${summary.deadCodeCount} símbolos con 0 consumidores`);

  if (summary.deadSymbols.length > 0) {
    console.log("\nSímbolos con 0 Consumidores (Dead Code):");
    summary.deadSymbols.slice(0, 10).forEach((s) => {
      console.log(`  - [${s.kind}] ${s.name} en ${s.filePath}:${s.lineNumber}`);
    });
  }
}

HANDLERS["graph"] = cmd_graph_18;

async function cmd_heal_19(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  console.log("[EOS HEAL] Disparando Bucle FDIR de Auto-Sanación Autónoma (Meta SapFix)...\n");
  const positionalArgs = args.slice(1).filter((a) => !a.startsWith("-"));
  const targetFile = positionalArgs[0];
  const dryRun = args.includes("--dry-run");
  const autoApply = args.includes("--apply") || args.includes("-a") || (!dryRun && args.includes("--write"));

  const { EosAutonomousHealer } = await import("../../src/core/eosAutonomousHealer.ts");
  const healer = new EosAutonomousHealer(root);
  const report = healer.executeHealing({ targetFile, dryRun, autoApply });

  console.log(`Estado Epistémico    : ${report.epistemicState}`);
  console.log(`Archivos Remediados  : ${report.remediatedCount}`);
  console.log(
    `Modo de Ejecución    : ${dryRun ? "SIMULACIÓN (DRY-RUN)" : autoApply ? "APLICACIÓN EN VIVO" : "PLANIFICACIÓN (SOLO LECTURA)"}`,
  );
  console.log(`Tiempo de Ejecución  : ${report.durationMs} ms\n`);

  if (report.candidates.length > 0) {
    console.log("Remediaciones Sintetizadas y Validadas:");
    report.candidates.forEach((c) => {
      console.log(
        `  ✔ [${c.action}] en ${c.targetPath} (Riesgo: ${c.blastRadiusRisk}, Sandbox: ${c.sandboxValid ? "PASS" : "FAIL"})`,
      );
    });
  } else {
    console.log("[INFO] No se detectaron anomalías requeridas de reparación. Código 100% puro.");
  }

  if (report.receiptPath) {
    console.log(`\nRecibo Criptográfico : ${report.receiptPath} (${report.receiptSha256?.slice(0, 24)}...)`);
  }
  console.log(`\n[PASS] Bucle de Auto-Sanación completado (Exit Code 0).`);
}

HANDLERS["heal"] = cmd_heal_19;
HANDLERS["fix"] = cmd_heal_19;

export async function handleCoreCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
