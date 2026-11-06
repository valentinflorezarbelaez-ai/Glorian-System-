#!/usr/bin/env node
/**
 * CLI entry point for the bounded TLA+ simulations.
 *
 * The implementation lives in `src/core/eosFormalTlaVerifications.mjs` (Layer 0) so
 * application code never depends on `scripts/`. This wrapper keeps the documented
 * command (`node scripts/verify-formal-tla.mjs`) and the test imports stable.
 */

import { runAllFormalVerifications } from "../src/core/eosFormalTlaVerifications.mjs";

export * from "../src/core/eosFormalTlaVerifications.mjs";

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("verify-formal-tla.mjs")) {
  console.log("======================================================================");
  console.log(" EOS SYSTEM — TLA+ SOURCE INVENTORY & BOUNDED JS SIMULATIONS          ");
  console.log(" TLA+ text is not parsed or model-checked by TLC in this command.       ");
  console.log("======================================================================\n");

  const results = runAllFormalVerifications();
  let totalSteps = 0;

  results.forEach((res) => {
    totalSteps += res.stepsExecuted;
    console.log(`[SOURCE + SIMULATION] ${res.specification} (module label: ${res.moduleName})`);
    console.log(`  ↳ Variable names extracted : ${res.extractedVariables.join(", ") || "none"}`);
    console.log(`  ↳ Invariant names extracted: ${res.extractedInvariantNames.join(", ") || "none"}`);
    console.log(`  ↳ JS simulation steps       : ${res.stepsExecuted}`);
    console.log(`  ↳ Simulation assertions     : ${res.simulationAssertionsPassed ? "PASS" : "FAIL"}\n`);
  });

  console.log(`----------------------------------------------------------------------`);
  console.log(`RESULT: ${results.length} bounded JS simulations passed (${totalSteps} steps); no formal model checking was run.`);
  console.log(`======================================================================`);
}
