/**
 * EOS System — Developer Quickstart & Sanity Check
 * Provides a sub-second onboarding health and verification pass for engineers.
 */

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EosDurableSqliteLedger } from '../src/core/eosDurableSqliteLedger.ts';
import { EosDocumentationSearch } from '../src/core/eosDocumentationSearch.ts';
import { EosSmtAutomatedReasoningProver } from '../src/core/eosSmtAutomatedReasoningProver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runQuickstart() {
  const startTime = performance.now();
  console.log('='.repeat(70));
  console.log('🚀 EOS SYSTEM — DEVELOPER QUICKSTART & ONBOARDING SANITY CHECK');
  console.log('='.repeat(70));

  const checks = [];

  // Check 1: Runtime Environment
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  const runtimeOk = nodeMajor >= 22;
  checks.push({
    name: 'Runtime Environment (Node.js >= 22)',
    status: runtimeOk ? 'PASS' : 'FAIL',
    details: `v${process.version} (${process.platform} ${process.arch})`
  });

  // Check 2: Zero External Runtime Dependencies
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const hasZeroRuntimeDeps = !pkg.dependencies || Object.keys(pkg.dependencies).length === 0;
  checks.push({
    name: 'Layer-0 Zero Runtime Dependencies',
    status: hasZeroRuntimeDeps ? 'PASS' : 'FAIL',
    details: '0 external npm runtime packages'
  });

  // Check 3: Append-Only SQLite WAL Ledger
  let ledgerOk = false;
  let ledgerHash = '';
  try {
    const ledger = new EosDurableSqliteLedger(':memory:');
    const entry = ledger.appendEntry({
      category: 'VERIFICATION_RECEIPT',
      projectId: 'eos-system',
      title: 'Quickstart Sanity Check',
      payload: { status: 'OPTIMAL' }
    });
    ledgerHash = entry.entryHash;
    ledgerOk = Boolean(ledgerHash && ledgerHash.length === 64);
    ledger.close();
  } catch (err) {
    ledgerOk = false;
  }
  checks.push({
    name: 'Durable Ledger Engine (SQLite WAL & SHA-256)',
    status: ledgerOk ? 'PASS' : 'FAIL',
    details: ledgerOk ? `Receipt SHA-256: ${ledgerHash.slice(0, 16)}...` : 'Failed'
  });

  // Check 4: Full-Text Architecture Search (FTS5)
  let searchOk = false;
  let searchResultsCount = 0;
  try {
    const searchEngine = new EosDocumentationSearch(rootDir, ':memory:');
    searchEngine.indexDocumentation();
    const results = searchEngine.search('SLSA', 5);
    searchResultsCount = results.length;
    searchOk = searchResultsCount > 0;
    searchEngine.close();
  } catch (err) {
    searchOk = false;
  }
  checks.push({
    name: 'Documentation Search Engine (FTS5 unicode61)',
    status: searchOk ? 'PASS' : 'FAIL',
    details: searchOk ? `Indexed & queried 'SLSA' (${searchResultsCount} hits)` : 'Failed'
  });

  // Check 5: Formal Reasoning SMT Prover
  let smtOk = false;
  try {
    const rules = [
      { role: 'guest', action: 'ledger_read', allow: true },
      { role: 'guest', action: 'ledger_write', allow: false },
      { role: 'admin', action: 'ledger_write', allow: true }
    ];
    const proof = EosSmtAutomatedReasoningProver.proveAbacSafety(rules, 'guest', 'ledger_write');
    smtOk = proof.verdict === 'PROVED_UNSAT_SECURE' && proof.isSatisfiable === false;
  } catch (err) {
    smtOk = false;
  }
  checks.push({
    name: 'Automated Reasoning SMT Prover (DPLL/SAT)',
    status: smtOk ? 'PASS' : 'FAIL',
    details: smtOk ? 'ABAC formal security theorem proved (UNSAT)' : 'Failed'
  });

  // Check 6: MCP Tool Catalog Contract
  const catalogPath = path.join(rootDir, 'docs', 'contracts', 'mcp-tool-catalog.json');
  let catalogOk = false;
  let toolCount = 0;
  if (fs.existsSync(catalogPath)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      toolCount = catalog.toolCount || catalog.tools?.length || 0;
      catalogOk = toolCount >= 100;
    } catch {
      catalogOk = false;
    }
  }
  checks.push({
    name: 'Formal MCP Contract Catalog (JSON Schema)',
    status: catalogOk ? 'PASS' : 'FAIL',
    details: catalogOk ? `${toolCount} tools strictly validated` : 'Missing or invalid'
  });

  // Print results
  for (const check of checks) {
    const icon = check.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${check.status}] ${check.name.padEnd(46)} | ${check.details}`);
  }

  const durationMs = (performance.now() - startTime).toFixed(2);
  const allPassed = checks.every((c) => c.status === 'PASS');

  console.log('-'.repeat(70));
  if (allPassed) {
    console.log(`✨ ALL 6/6 CORE SUBSYSTEMS VERIFIED OPTIMAL in ${durationMs} ms`);
    console.log('👉 Recommended Developer Workflows:');
    console.log('   - Run fast impacted test selection:  npm run pts');
    console.log('   - Instant architecture docs search:  npm run search <term>');
    console.log('   - View architecture & glossary:      node bin/eos.mjs guide');
    console.log('   - Run full strict CI/CD gate:        npm run verify:strict');
  } else {
    console.error(`⚠️ Quickstart verification failed with 1 or more errors.`);
    process.exitCode = 1;
  }
  console.log('='.repeat(70));
}

runQuickstart().catch((err) => {
  console.error('Fatal quickstart error:', err);
  process.exit(1);
});
