/**
 * Glorian System — Extracted Sentinel Domain Handlers (smt, chaos:live, swarm, search)
 * Extracted from bin/commands/cliSentinel.mjs for SPEC-250 headroom compliance.
 * Keeps handler registrations discoverable by EosCliCatalogAndHygieneGovernorCore.
 */

export function registerSentinelExtraHandlers(HANDLERS) {
  HANDLERS["smt"] = async function cmd_smt_110(commandContext) {
    const { root, printBanner } = commandContext;
    printBanner();
    const { EosSmtAutomatedReasoningProver } = await import("../../src/core/eosSmtAutomatedReasoningProver.ts");
    console.log("[EOS AWS-GRADE SMT AUTOMATED REASONING PROVER — SPEC-063 v66.0.0]\n");

    const rules = [
      { role: "guest", action: "ledger_read", allow: true },
      { role: "guest", action: "ledger_write", allow: false },
      { role: "admin", action: "ledger_write", allow: true },
    ];

    const proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, "guest", "ledger_write");
    console.log(`  Theorem Name    : ${proof.theoremName}`);
    console.log(`  SMT Verdict     : ${proof.verdict}`);
    console.log(
      `  Satisfiable     : ${proof.isSatisfiable ? "YES (BREACH MODEL FOUND)" : "NO (MATHEMATICALLY SECURE)"}`,
    );
    console.log(`  Clauses Checked : ${proof.evaluatedClausesCount}`);
    console.log(`  Duration        : ${proof.durationUs} µs`);
    console.log(`  Receipt SHA-256 : sha256:${proof.sha256Receipt}\n`);

    EosSmtAutomatedReasoningProver.recordReceiptInLedger(proof, root);
    console.log(`✔ Demostración formal SMT registrada en SQLite WAL Ledger.\n`);
  };

  HANDLERS["chaos:live"] = async function cmd_chaos_live_111(commandContext) {
    const { root, args, printBanner } = commandContext;
    printBanner();
    const { EosProductionChaosMonkey } = await import("../../src/core/eosProductionChaosMonkey.ts");
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
  };

  HANDLERS["swarm"] = async function cmd_swarm_112(commandContext) {
    const { root, args, printBanner } = commandContext;
    printBanner();
    const { EosBftAgentSwarmSlashing } = await import("../../src/core/eosBftAgentSwarmSlashing.ts");
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
  };

  HANDLERS["search"] = async function cmd_search_113(commandContext) {
    const { root, args, printBanner } = commandContext;
    printBanner();
    const { EosDocumentationSearch } = await import("../../src/core/eosDocumentationSearch.ts");
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
  };
}
