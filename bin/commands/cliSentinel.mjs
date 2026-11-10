import path from "node:path";

const HANDLERS = {};

async function cmd_invariant_98(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const { EosInvariantVerificationEngine } = await import("../src/core/eosInvariantVerificationEngine.ts");

  const sampleModel = {
    name: "TransferLedger",
    initialState: { a: 100, b: 100, c: 100, total: 300 },
    actions: [
      {
        name: "transfer_a_b",
        apply: (s, prng) => {
          const amt = prng.nextInt(1, 10);
          if (s.a < amt) return s;
          return { ...s, a: s.a - amt, b: s.b + amt };
        },
      },
      {
        name: "transfer_b_c",
        apply: (s, prng) => {
          const amt = prng.nextInt(1, 10);
          if (s.b < amt) return s;
          return { ...s, b: s.b - amt, c: s.c + amt };
        },
      },
      {
        name: "transfer_c_a",
        apply: (s, prng) => {
          const amt = prng.nextInt(1, 10);
          if (s.c < amt) return s;
          return { ...s, c: s.c - amt, a: s.a + amt };
        },
      },
    ],
    invariants: [
      { name: "conservation_of_money", check: (s) => s.a + s.b + s.c === s.total },
      { name: "no_negative_balances", check: (s) => s.a >= 0 && s.b >= 0 && s.c >= 0 },
    ],
  };

  const steps = Number(args[2]) || 1000;
  const seed = Number(args[3]) || 42;
  const res = EosInvariantVerificationEngine.verifyModel(sampleModel, {
    maxSteps: steps,
    seed,
    enableShrinking: true,
  });

  console.log("[EOS INVARIANT VERIFICATION ENGINE — TLA+ / ANTITHESIS DST]\n");
  console.log(`  Model Name           : ${res.modelName}`);
  console.log(`  Engine Status        : ${res.status}`);
  console.log(`  Exploration Seed     : ${res.seed}`);
  console.log(`  Explored States      : ${res.exploredStates}`);
  console.log(`  Invariants Evaluated : ${res.invariantsEvaluated}`);
  console.log(`  Faults Injected      : ${res.faultsInjected}`);
  console.log(`  State Hash Chain     : sha256:${res.stateHashChain}`);
  if (res.failingInvariant) {
    console.log(`  Failing Invariant    : ${res.failingInvariant}`);
    console.log(`  Original Trace Steps : ${res.originalTraceLength}`);
    console.log(`  Shrunk Trace Steps   : ${res.shrunkTrace?.length || 0}`);
  }
  console.log("");
}

HANDLERS["invariant"] = cmd_invariant_98;

async function cmd_contract_99(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "diff").toLowerCase();
  const { EosContractEvolutionGovernor } = await import("../src/core/eosContractEvolutionGovernor.ts");

  if (subAction === "lint" || subAction === "sql") {
    const sqlSnippet = args[2] || "ALTER TABLE users ADD COLUMN age INT NOT NULL; DROP COLUMN legacy_id;";
    const hazards = EosContractEvolutionGovernor.scanSqlMigrationHazards(sqlSnippet);
    console.log("[EOS CONTRACT EVOLUTION — SQL MIGRATION HAZARD LINTER]\n");
    console.log(`  Total Hazards Detected: ${hazards.length}`);
    for (const h of hazards) {
      console.log(`    ! [${h.ruleId}] Line ${h.lineNumber}: ${h.statement}`);
      console.log(`      ↳ Risk: ${h.riskExplanation}`);
      console.log(`      ↳ Fix : ${h.remediation}`);
    }
    console.log("");
  } else {
    const baseSnippet = `
        export interface UserV1 {
          id: string;
          username: string;
          email?: string;
        }
      `;
    const candSnippet = `
        export interface UserV2 {
          id: string;
          username: string;
          email?: string;
          avatarUrl?: string;
        }
      `;
    const base = EosContractEvolutionGovernor.parseTypeScriptContract(baseSnippet, "UserV1");
    const cand = EosContractEvolutionGovernor.parseTypeScriptContract(candSnippet, "UserV2");
    const report = EosContractEvolutionGovernor.compareContracts(base, cand);

    console.log("[EOS CONTRACT EVOLUTION GOVERNOR — NUBANK SACHEM / BUF]\n");
    console.log(`  Base Contract        : ${report.baseContractId}`);
    console.log(`  Candidate Contract   : ${report.candidateContractId}`);
    console.log(`  Gate Verdict         : ${report.gateVerdict}`);
    console.log(`  Compatible Expansions: ${report.compatibleExpansionsCount}`);
    console.log(`  Breaking Contractions: ${report.breakingContractionsCount}`);
    console.log(`  Receipt SHA-256      : sha256:${report.sha256Receipt}\n`);
  }
}

HANDLERS["contract"] = cmd_contract_99;

async function cmd_heal_surgical_100(commandContext) {
  const { args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "diagnose").toLowerCase();
  const { EosSurgicalSelfHealingKernel } = await import("../src/core/eosSurgicalSelfHealingKernel.ts");

  if (subAction === "diagnose") {
    const sampleTrace =
      args[2] ||
      `TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatUser (src/users.ts:4:18)
    at Object.process (src/app.ts:12:5)`;
    const sampleCode = `export function formatUser(user?: { name: string }) {\n  return user.name.toUpperCase();\n}`;
    const fault = EosSurgicalSelfHealingKernel.diagnoseFault(sampleTrace, sampleCode);
    console.log("[EOS SURGICAL SELF-HEALING KERNEL — FDIR FAULT DIAGNOSIS]\n");
    console.log(`  Fault ID        : ${fault.faultId}`);
    console.log(`  File Path       : ${fault.filePath}`);
    console.log(`  Line Number     : ${fault.lineNumber}`);
    console.log(`  Symbol Name     : ${fault.symbolName}`);
    console.log(`  Exception Type  : ${fault.exceptionType}`);
    console.log(`  Context Snippet :\n${fault.codeContextSnippet}\n`);
  } else if (subAction === "patch") {
    const sampleCode = `export function formatUser(user?: { name: string }) {\n  return user.name.toUpperCase();\n}`;
    const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n    at formatUser (src/users.ts:2:10)`;
    const fault = EosSurgicalSelfHealingKernel.diagnoseFault(sampleTrace, sampleCode);
    const patch = EosSurgicalSelfHealingKernel.synthesizeSurgicalPatch(fault, sampleCode);
    console.log("[EOS SURGICAL SELF-HEALING KERNEL — MINIMAL AST SURGICAL PATCH]\n");
    console.log(`  Patch ID        : ${patch.patchId}`);
    console.log(`  Target Line     : ${patch.targetLineNumber}`);
    console.log(`  Strategy        : ${patch.strategy}`);
    console.log(`  Lines Changed   : ${patch.linesChanged}`);
    console.log(`  AST Mutation Diff:\n${patch.astMutationDiff}\n`);
  } else {
    const sampleCode = `export function formatUser(user) {\n  return user.name.toUpperCase();\n}`;
    const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n    at formatUser (src/users.ts:2:10)`;
    const receipt = EosSurgicalSelfHealingKernel.executeHealingCycle({
      stackTrace: sampleTrace,
      sourceCode: sampleCode,
      regressionTestCode: `assert.strictEqual(typeof formatUser, 'function');`,
      reason: "CLI demonstration of NASA FDIR + Meta SapFix closed-loop healing",
    });
    console.log("[EOS SURGICAL SELF-HEALING KERNEL — CLOSED-LOOP CYCLE RESULT]\n");
    console.log(`  Receipt ID      : ${receipt.receiptId}`);
    console.log(`  Verdict         : ${receipt.verdict}`);
    console.log(`  Patch ID        : ${receipt.patch.patchId}`);
    console.log(`  Zero-Regression : ${receipt.verification.zeroRegressionPreserved}`);
    console.log(`  Receipt SHA-256 : sha256:${receipt.sha256Receipt}\n`);
  }
}

HANDLERS["heal:surgical"] = cmd_heal_surgical_100;

async function cmd_tlc_101(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "status").toLowerCase();
  const { EosTlcFormalChecker } = await import("../src/core/eosTlcFormalChecker.ts");

  if (subAction === "status" || subAction === "detect") {
    const diag = EosTlcFormalChecker.detectRuntime(root);
    console.log("[EOS LESLIE LAMPORT TLC FORMAL MODEL CHECKER — ENVIRONMENT DIAGNOSTIC]\n");
    console.log(
      `  Java Installed       : ${diag.javaInstalled ? "YES" : "NO"} ${diag.javaVersion ? `(${diag.javaVersion})` : ""}`,
    );
    console.log(
      `  tla2tools.jar Present: ${diag.tlaJarPresent ? "YES" : "NO"} ${diag.tlaJarPath ? `(${diag.tlaJarPath})` : ""}`,
    );
    console.log(`  Execution Mode       : ${diag.executionMode}`);
    console.log(`  Recommendation       : ${diag.recommendation}\n`);
  } else if (subAction === "install") {
    console.log("[EOS TLC] Descargando versión oficial de tla2tools.jar desde GitHub...");
    try {
      const dl = await EosTlcFormalChecker.downloadTlaJar(path.join(root, "tools"));
      console.log(
        `✔ Archivo descargado exitosamente: ${dl.jarPath} (${(dl.bytesDownloaded / 1024 / 1024).toFixed(2)} MB)\n`,
      );
    } catch (err) {
      console.log(`✖ Error descargando tla2tools.jar: ${err.message}\n`);
    }
  } else {
    const spec = args[1] || "TlcFormalModelChecker.tla";
    console.log(`[EOS TLC] Verificando modelo formal: ${spec}...\n`);
    const res = EosTlcFormalChecker.verifyModel(spec, { projectRoot: root, steps: 200 });
    console.log(`  Specification  : ${res.specification}`);
    console.log(`  Status         : ${res.status}`);
    console.log(`  Execution Mode : ${res.executionMode}`);
    console.log(`  Explored States: ${res.exploredStates} (Distinct: ${res.distinctStates})`);
    console.log(`  Duration       : ${res.durationMs} ms`);
    console.log(`  Receipt SHA-256: sha256:${res.sha256Receipt}\n`);
    if (args.includes("--record")) {
      EosTlcFormalChecker.recordReceiptInLedger(res, root);
      console.log(`✔ Recibo registrado en SQLite WAL Ledger.`);
    }
  }
}

HANDLERS["tlc"] = cmd_tlc_101;

async function cmd_pr_check_102(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  const { EosGithubPrGate } = await import("../src/core/eosGithubPrGate.ts");
  const evalResult = EosGithubPrGate.evaluatePr({ projectRoot: root });

  console.log("[EOS NATIVE GITHUB ACTIONS PR GATE & ATTESTATION BOT]\n");
  console.log(`  Repository Scope     : ${evalResult.context.owner}/${evalResult.context.repo}`);
  console.log(`  Commit SHA           : ${evalResult.context.commitSha.slice(0, 10)}`);
  console.log(`  Target Branches      : ${evalResult.context.baseRef} ⟵ ${evalResult.context.headRef}`);
  console.log(`  Gate Conclusion      : [${evalResult.conclusion.toUpperCase()}]`);
  console.log(`  7-Stage Pipeline     : ${evalResult.allStagesPassed ? "7/7 PASSED" : "FAILED"}`);
  console.log(`  Contract Evolution   : ${evalResult.contractEvolutionVerdict}`);
  console.log(`  Receipt SHA-256      : sha256:${evalResult.sha256Receipt}\n`);

  EosGithubPrGate.recordReceiptInLedger(evalResult, root);
  console.log(`✔ Atestación de PR Gate registrada en SQLite WAL Ledger.`);

  if (process.env.GITHUB_TOKEN && evalResult.context.commitSha !== "0000000000000000000000000000000000000000") {
    const payload = EosGithubPrGate.formatCheckRunPayload(evalResult);
    console.log(`[INFO] Publicando Check-Run a GitHub REST API...`);
    const pub = await EosGithubPrGate.publishCheckRun(process.env.GITHUB_TOKEN, payload, evalResult.context);
    if (pub.success) {
      console.log(`✔ Check-Run publicado exitosamente en GitHub.`);
    } else {
      console.log(`[WARN] No se pudo publicar Check-Run: ${pub.error}`);
    }
  }

  if (evalResult.conclusion === "failure") {
    console.error(`\n[FAIL-CLOSED] PR Gate detectó violaciones de calidad o de contrato. Integración bloqueada.`);
    process.exit(1);
  } else {
    console.log(`\n[PASS] PR Gate aprobado con éxito (Exit Code 0).`);
  }
}

HANDLERS["pr:check"] = cmd_pr_check_102;

async function cmd_sandbox_vm_103(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "doctor").toLowerCase();
  const { EosMicroVmSandbox } = await import("../src/core/eosMicroVmSandbox.ts");

  if (subAction === "doctor" || subAction === "status") {
    const diag = EosMicroVmSandbox.diagnoseHost();
    console.log("[EOS HERMETIC MICROVM & HYPERVISOR SANDBOX — HOST DOCTOR]\n");
    console.log(`  Virtualization Tier  : ${diag.tier}`);
    console.log(`  Docker Daemon        : ${diag.dockerAvailable ? "ONLINE" : "OFFLINE"}`);
    console.log(`  Google gVisor (runsc): ${diag.gVisorAvailable ? "ACTIVE" : "NOT_DETECTED"}`);
    console.log(`  AWS Firecracker      : ${diag.firecrackerAvailable ? "ACTIVE" : "NOT_DETECTED"}`);
    console.log(`  Memory Limit Ceiling : ${diag.memoryLimitMb} MB`);
    console.log(`  Timeout Kill Barrier : ${diag.timeoutLimitMs} ms`);
    console.log(`  Zero-Network Policy  : ${diag.networkIsolated ? "ENFORCED (No Sockets)" : "OPEN"}`);
    console.log(`  Recommendation       : ${diag.recommendation}\n`);
  } else {
    const codeArgIdx = args.findIndex((a) => a === "--code");
    const snippet =
      codeArgIdx !== -1 && args[codeArgIdx + 1]
        ? args[codeArgIdx + 1]
        : args[2] || "console.log('EOS Isolated MicroVM Execution Complete');";
    console.log(`[EOS SANDBOX] Ejecutando código de forma aislada...\n`);
    const res = EosMicroVmSandbox.runIsolated({
      codeOrCommand: snippet,
      timeoutMs: 10000,
    });
    console.log(`  Execution ID    : ${res.executionId}`);
    console.log(`  Status          : ${res.status}`);
    console.log(`  Tier Used       : ${res.tierUsed}`);
    console.log(`  Exit Code       : ${res.exitCode}`);
    console.log(`  Duration        : ${res.durationMs} ms`);
    console.log(`  Memory Peak     : ${(res.memoryPeakBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Attestation SHA : sha256:${res.sha256Attestation}\n`);
    if (res.stdout) console.log(`[STDOUT]\n${res.stdout}\n`);
    if (res.stderr) console.log(`[STDERR]\n${res.stderr}\n`);

    EosMicroVmSandbox.recordReceiptInLedger(res, root);
    console.log(`✔ Recibo de ejecución en Sandbox registrado en SQLite WAL Ledger.`);
  }
}

HANDLERS["sandbox:vm"] = cmd_sandbox_vm_103;

async function cmd_dashboard_104(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const subAction = (args[1] || "status").toLowerCase();
  const portArgIdx = args.findIndex((a) => a === "--port");
  const port = portArgIdx !== -1 && args[portArgIdx + 1] ? Number.parseInt(args[portArgIdx + 1], 10) : 4321;
  const { EosTelemetryDashboard } = await import("../src/core/eosTelemetryDashboard.ts");
  const dashboard = new EosTelemetryDashboard(root, port);

  if (subAction === "start") {
    console.log(`[EOS REAL-TIME VISUAL TELEMETRY DASHBOARD — SPEC-055 v61.0.0]\n`);
    await dashboard.start();
    console.log(`  Dashboard UI   : http://localhost:${port}/`);
    console.log(`  Telemetry API  : http://localhost:${port}/api/telemetry`);
    console.log(`  Topology API   : http://localhost:${port}/api/topology`);
    console.log(`  Ledger API     : http://localhost:${port}/api/ledger`);
    console.log(`\n  Presiona Ctrl+C para detener el servidor de telemetría.\n`);
    // Keep process alive for CLI daemon mode unless interrupted
    await new Promise(() => {});
  } else {
    const snap = dashboard.getSnapshot();
    console.log(`[EOS REAL-TIME VISUAL TELEMETRY DASHBOARD — STATUS SNAPSHOT]\n`);
    console.log(`  Timestamp       : ${snap.timestamp}`);
    console.log(`  Active Agents   : ${snap.topology.activeAgents}`);
    console.log(`  Topology Edges  : ${snap.topology.totalEdges}`);
    console.log(`  Topology Cycle  : ${snap.topology.cycleDetected ? "CYCLE DETECTED" : "ACYCLIC (VALID)"}`);
    console.log(`  Zero-Copy Events: ${snap.topology.totalEvents}`);
    console.log(`  Tokens Saved    : ${snap.tokenEfficiency.totalSavedTokens.toLocaleString()}`);
    console.log(`  Efficiency Ratio: ${(snap.tokenEfficiency.savedRatio * 100).toFixed(1)}%`);
    console.log(`  Ledger Entries  : ${snap.ledger.totalEntries}`);
    console.log(`  Ledger Status   : ${snap.ledger.chainIntact ? "INTACT (SHA-256)" : "TAMPERED"}`);
    console.log(`  Health Status   : ${snap.health.status}`);
    console.log(`\n  Inicia el servidor interactivo con: eos dashboard start --port ${port}\n`);
  }
}

HANDLERS["dashboard"] = cmd_dashboard_104;

async function cmd_fleet_verify_105(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const targetArg = args[1] || "all";
  const { EosFleetProductionVerifier, REGISTERED_FLEET_TARGETS } =
    await import("../src/core/eosFleetProductionVerifier.ts");

  console.log("[EOS FLEET PRODUCTION LIVING VERIFICATION & BAUTISMO DE FUEGO — SPEC-056 v62.0.0]\n");

  const targets = targetArg === "all" ? REGISTERED_FLEET_TARGETS : [targetArg];

  for (const target of targets) {
    console.log(`[SONDA EN VIVO] Auditando objetivo: ${target}...`);
    const res = await EosFleetProductionVerifier.probeTarget(target);
    console.log(`  HTTP Status     : ${res.httpStatus} ${res.ok ? "OK" : "ERROR"}`);
    console.log(`  Latencia Total  : ${res.durationMs} ms (TTFB: ${res.ttfbMs} ms)`);
    console.log(`  Payload Recibido: ${(res.payloadBytes / 1024).toFixed(1)} KB`);
    console.log(
      `  Cabeceras TLS   : ${res.securityHeaders.passedCount}/${res.securityHeaders.totalCount} verificadas (HSTS: ${res.securityHeaders.strictTransportSecurity ? "SI" : "NO"}, nosniff: ${res.securityHeaders.xContentTypeOptions ? "SI" : "NO"})`,
    );
    console.log(
      `  Hitos WCAG 2.1  : ${res.semanticLandmarks.passedCount}/${res.semanticLandmarks.totalCount} presentes (main: ${res.semanticLandmarks.hasMain ? "SI" : "NO"}, header: ${res.semanticLandmarks.hasHeader ? "SI" : "NO"}, viewport: ${res.semanticLandmarks.hasResponsiveViewport ? "SI" : "NO"})`,
    );
    console.log(
      `  Metadatos SEO   : "${res.seoMetadata.title}" (OG: ${res.seoMetadata.hasOgTitle ? "SI" : "NO"}, Favicon: ${res.seoMetadata.hasFavicon ? "SI" : "NO"})`,
    );
    console.log(`  Puntaje Salud   : ${res.performanceScore}/100`);
    console.log(`  Estado Epistémico: ${res.epistemicStatus}`);
    console.log(`  Atestación SHA  : sha256:${res.sha256Attestation}\n`);

    EosFleetProductionVerifier.recordReceiptInLedger(res, root);
    console.log(`✔ Recibo criptográfico de auditoría en producción registrado en SQLite WAL Ledger.\n`);
  }
}

HANDLERS["fleet:verify"] = cmd_fleet_verify_105;

async function cmd_sapfix_106(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const faultId = args[1] || `FAULT-${Date.now().toString(36).toUpperCase()}`;
  const targetFile = args[2] || "src/core/eosKernelPrimitives.ts";
  const line = Number.parseInt(args[3] || "10", 10);
  const msg = args[4] || "Cannot read properties of undefined";

  console.log(`[EOS META-GRADE AUTONOMOUS SAPFIX ENGINE — SPEC-060 v66.0.0]\n`);
  const { EosSapFixAutoshipper } = await import("../src/core/eosSapFixAutoshipper.ts");

  const report = await EosSapFixAutoshipper.executeCycle(
    {
      faultId,
      targetFilePath: targetFile,
      failingLine: line,
      errorMessage: msg,
    },
    root,
  );

  console.log(`  Fault ID        : ${report.faultId}`);
  console.log(`  Status          : ${report.status}`);
  console.log(`  Target File     : ${report.targetFile}`);
  console.log(`  Branch Prepared : ${report.branchName}`);
  console.log(`  Zero-Regression : ${report.verificationPassed ? "VERIFIED (100% PASS)" : "FAILED"}`);
  console.log(`  PR Title        : ${report.prTitle}`);
  console.log(`  Receipt SHA-256 : sha256:${report.sha256Receipt}\n`);

  EosSapFixAutoshipper.recordReceiptInLedger(report, root);
  console.log(`✔ Manifiesto de PR generado y registrado en SQLite WAL Ledger.\n`);
}

HANDLERS["sapfix"] = cmd_sapfix_106;

async function cmd_sbom_107(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  const { EosSlsaProvenanceSbom } = await import("../src/core/eosSlsaProvenanceSbom.ts");
  console.log("[EOS CYCLONEDX v1.5 SOFTWARE BILL OF MATERIALS — SPEC-061 v66.0.0]\n");

  const sbom = EosSlsaProvenanceSbom.generateCycloneDxSbom(root);
  console.log(`  BOM Format      : ${sbom.bomFormat} (v${sbom.specVersion})`);
  console.log(`  Serial Number   : ${sbom.serialNumber}`);
  console.log(`  Main Component  : ${sbom.metadata.component.name} v${sbom.metadata.component.version}`);
  console.log(`  Core Modules    : ${sbom.components.length} pure Layer-0 modules cataloged`);
  console.log(`  Runtime Deps    : ${sbom.metadata.runtimeDependenciesCount} (Strict Layer-0 Pure)`);
  console.log(`  Receipt SHA-256 : sha256:${sbom.sha256Receipt}\n`);

  EosSlsaProvenanceSbom.recordReceiptInLedger(sbom, root);
  console.log(`✔ Atestación de SBOM CycloneDX registrada en SQLite WAL Ledger.\n`);
}

HANDLERS["sbom"] = cmd_sbom_107;

async function cmd_slsa_108(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosSlsaProvenanceSbom } = await import("../src/core/eosSlsaProvenanceSbom.ts");
  console.log("[EOS IN-TOTO SLSA LEVEL 4 PROVENANCE STATEMENT — SPEC-061 v66.0.0]\n");

  const commitSha = args[1] || "HEAD";
  const slsa = EosSlsaProvenanceSbom.generateSlsaProvenance(root, commitSha);
  console.log(`  Statement Type  : ${slsa._type}`);
  console.log(`  Predicate Type  : ${slsa.predicateType}`);
  console.log(`  Build Type      : ${slsa.predicate.buildDefinition.buildType}`);
  console.log(`  Builder ID      : ${slsa.predicate.runDetails.builder.id}`);
  console.log(`  Artifacts Signed: ${slsa.subject.length} binary subjects`);
  console.log(`  Receipt SHA-256 : sha256:${slsa.sha256Receipt}\n`);

  EosSlsaProvenanceSbom.recordReceiptInLedger(slsa, root);
  console.log(`✔ Atestación de procedencia SLSA v1.0 registrada en SQLite WAL Ledger.\n`);
}

HANDLERS["slsa"] = cmd_slsa_108;

async function cmd_cas_109(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  const { EosContentAddressableCache } = await import("../src/core/eosContentAddressableCache.ts");
  console.log("[EOS GOOGLE BAZEL-GRADE CAS & ACTION CACHE — SPEC-062 v66.0.0]\n");

  const cas = new EosContentAddressableCache(root);
  const stats = cas.getStats();
  console.log(`  Total Blobs CAS : ${stats.totalBlobs}`);
  console.log(`  Total Actions AC: ${stats.totalActions}`);
  console.log(`  Cache Hits      : ${stats.cacheHits}`);
  console.log(`  Cache Misses    : ${stats.cacheMisses}`);
  console.log(`  Hit Ratio       : ${(stats.hitRatio * 100).toFixed(1)}%`);
  console.log(`  Saved CPU Time  : ${stats.estimatedSavedMs} ms`);
  console.log(`  Receipt SHA-256 : sha256:${stats.sha256Receipt}\n`);

  cas.recordReceiptInLedger(root);
  console.log(`✔ Estadísticas de CAS registradas en SQLite WAL Ledger.\n`);
}

HANDLERS["cas"] = cmd_cas_109;

async function cmd_smt_110(commandContext) {
  const { root, printBanner } = commandContext;
  printBanner();
  const { EosSmtAutomatedReasoningProver } = await import("../src/core/eosSmtAutomatedReasoningProver.ts");
  console.log("[EOS AWS-GRADE SMT AUTOMATED REASONING PROVER — SPEC-063 v66.0.0]\n");

  const rules = [
    { role: "guest", action: "ledger_read", allow: true },
    { role: "guest", action: "ledger_write", allow: false },
    { role: "admin", action: "ledger_write", allow: true },
  ];

  const proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, "guest", "ledger_write");
  console.log(`  Theorem Name    : ${proof.theoremName}`);
  console.log(`  SMT Verdict     : ${proof.verdict}`);
  console.log(`  Satisfiable     : ${proof.isSatisfiable ? "YES (BREACH MODEL FOUND)" : "NO (MATHEMATICALLY SECURE)"}`);
  console.log(`  Clauses Checked : ${proof.evaluatedClausesCount}`);
  console.log(`  Duration        : ${proof.durationUs} µs`);
  console.log(`  Receipt SHA-256 : sha256:${proof.sha256Receipt}\n`);

  EosSmtAutomatedReasoningProver.recordReceiptInLedger(proof, root);
  console.log(`✔ Demostración formal SMT registrada en SQLite WAL Ledger.\n`);
}

HANDLERS["smt"] = cmd_smt_110;

async function cmd_chaos_live_111(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosProductionChaosMonkey } = await import("../src/core/eosProductionChaosMonkey.ts");
  const target = args[1] || "https://portafolio-valentin.vercel.app";
  console.log(`[EOS NETFLIX-GRADE PRODUCTION CHAOS MONKEY — SPEC-064 v66.0.0]\n`);
  console.log(`Inyectando batería de caos controlado en: ${target}...`);

  const report = await EosProductionChaosMonkey.executeExperiment(target, {
    burstCount: 5,
    jitterMs: 50,
  });

  console.log(`  Target URL      : ${report.targetUrl}`);
  console.log(`  Probes Sent     : ${report.probesSent}`);
  console.log(`  Success Count   : ${report.probesSuccess}`);
  console.log(`  Error Count     : ${report.errorCount} (${report.errorRatePercent}%)`);
  console.log(`  Avg Latency     : ${report.avgLatencyMs} ms (P95: ${report.p95LatencyMs} ms)`);
  console.log(`  Emergency Abort : ${report.emergencyAbortTriggered ? "TRIPPED" : "NO"}`);
  console.log(`  Epistemic Status: ${report.epistemicVerdict}`);
  console.log(`  Receipt SHA-256 : sha256:${report.sha256Receipt}\n`);

  EosProductionChaosMonkey.recordReceiptInLedger(report, root);
  console.log(`✔ Atestación de experimento de caos registrada en SQLite WAL Ledger.\n`);
}

HANDLERS["chaos:live"] = cmd_chaos_live_111;

async function cmd_swarm_112(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosBftAgentSwarmSlashing } = await import("../src/core/eosBftAgentSwarmSlashing.ts");
  console.log("[EOS DEEPMIND-GRADE BFT AGENT SWARM & SLASHING HYPERVISOR — SPEC-065 v66.0.0]\n");

  const swarm = EosBftAgentSwarmSlashing.createDefaultSwarm();
  const proposal = {
    proposalId: args[1] || `PROP-${Date.now().toString(36).toUpperCase()}`,
    patchHash: "sha256:44332211aabbccddeeff00112233445566778899aabbccddeeff001122334455",
    authorAgentId: "agent_architect",
    testsExitCode: 0,
    conformsToConstitution: true,
  };

  const report = EosBftAgentSwarmSlashing.evaluateConsensus(swarm, proposal);
  console.log(`  Proposal ID     : ${report.proposalId}`);
  console.log(`  BFT Verdict     : ${report.verdict}`);
  console.log(`  Votes For/Total : ${report.votesFor}/${report.totalAgents} (Threshold: ${report.quorumThreshold})`);
  console.log(`  Security Veto   : ${report.vetoTriggered ? "VETO TRIGGERED" : "NO"}`);
  console.log(
    `  Slashed Agents  : ${report.slashedAgents.length > 0 ? report.slashedAgents.join(", ") : "NONE (All Conforming)"}`,
  );
  console.log(`  Receipt SHA-256 : sha256:${report.sha256Receipt}\n`);

  console.log(`[REPUTATION STAKES]`);
  for (const [id, stake] of Object.entries(report.agentStakes)) {
    console.log(`  • ${id.padEnd(20)}: ${stake} tokens`);
  }

  EosBftAgentSwarmSlashing.recordReceiptInLedger(report, root);
  console.log(`\n✔ Acta de consenso BFT registrada en SQLite WAL Ledger.\n`);
}

HANDLERS["swarm"] = cmd_swarm_112;

async function cmd_search_113(commandContext) {
  const { root, args, printBanner } = commandContext;
  printBanner();
  const { EosDocumentationSearch } = await import("../src/core/eosDocumentationSearch.ts");
  const query = args.slice(1).join(" ") || "SPEC";
  console.log(`[EOS ARCHITECTURE & SPECIFICATION FULL-TEXT SEARCH (FTS5)]\n`);
  console.log(`Buscando: "${query}"...\n`);

  const searchEngine = new EosDocumentationSearch(root);
  try {
    const indexed = searchEngine.indexDocumentation();
    if (indexed > 0) {
      console.log(`[INDEX] ${indexed} documentos nuevos o actualizados indexados en SQLite FTS5.`);
    }

    const results = searchEngine.search(query, 10);
    if (results.length === 0) {
      console.log(`No se encontraron coincidencias para: "${query}".`);
    } else {
      console.log(`Encontrados ${results.length} resultados:\n`);
      for (const res of results) {
        console.log(`  • [${res.docType}] ${res.title}`);
        console.log(`    Ruta: ${res.path}`);
        console.log(`    Fragmento: ${res.snippet}\n`);
      }
    }
  } finally {
    searchEngine.close();
  }
}

HANDLERS["search"] = cmd_search_113;

export async function handleSentinelCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    await handler(commandContext);
    return true;
  }
  return false;
}
