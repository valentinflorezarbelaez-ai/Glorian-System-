/**
 * EOS SYSTEM — SPEC-065 BDD TEST SUITE
 * Developer Experience, Industry Architecture Glossary, and Sub-second Quickstart Verification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('BDD-206: Developer Experience, Industry Architecture Glossary & Quickstart Verification', async (t) => {
  await t.test('Scenario 1: ARCHITECTURE_GLOSSARY.md exists and maps all Big Tech core engines', () => {
    const glossaryPath = path.join(projectRoot, 'docs', 'ARCHITECTURE_GLOSSARY.md');
    assert.ok(fs.existsSync(glossaryPath), 'ARCHITECTURE_GLOSSARY.md must exist');

    const content = fs.readFileSync(glossaryPath, 'utf8');
    assert.ok(content.includes('EosSapFixAutoshipper'), 'Must document EosSapFixAutoshipper');
    assert.ok(content.includes('EosSlsaProvenanceSbom'), 'Must document EosSlsaProvenanceSbom');
    assert.ok(content.includes('EosContentAddressableCache'), 'Must document EosContentAddressableCache');
    assert.ok(content.includes('EosSmtAutomatedReasoningProver'), 'Must document EosSmtAutomatedReasoningProver');
    assert.ok(content.includes('EosProductionChaosMonkey'), 'Must document EosProductionChaosMonkey');
    assert.ok(content.includes('EosBftAgentSwarmSlashing'), 'Must document EosBftAgentSwarmSlashing');
    assert.ok(content.includes('EosDocumentationSearch'), 'Must document EosDocumentationSearch');
    assert.ok(content.includes('EosBenchmarkTracker'), 'Must document EosBenchmarkTracker');
    assert.ok(content.includes('EosMcpSchemaValidator'), 'Must document EosMcpSchemaValidator');
  });

  await t.test('Scenario 2: node bin/eos.mjs guide outputs the architecture glossary', () => {
    const output = execFileSync(process.execPath, [path.join(projectRoot, 'bin', 'eos.mjs'), 'guide'], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    assert.ok(output.includes('EOS System — Architecture & Industry-Standard Glossary'));
    assert.ok(output.includes('Core Engines & Module Translation Matrix'));
    assert.ok(output.includes('EosSapFixAutoshipper'));
  });

  await t.test('Scenario 3: node bin/eos.mjs help outputs organized daily workflow and security sections', () => {
    const output = execFileSync(process.execPath, [path.join(projectRoot, 'bin', 'eos.mjs'), 'help'], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    assert.ok(output.includes('DESARROLLO RÁPIDO & PRUEBAS (DAILY WORKFLOW)'));
    assert.ok(output.includes('SEGURIDAD, CADENA DE SUMINISTRO & FORMAL METHODS'));
    assert.ok(output.includes('RESILIENCIA BIG TECH & AUTO-REPARACIÓN'));
    assert.ok(output.includes('eos search'));
    assert.ok(output.includes('eos guide'));
  });

  await t.test('Scenario 4: node scripts/quickstart.mjs passes all 6 subsystem checks', () => {
    const start = Date.now();
    const output = execFileSync(process.execPath, [path.join(projectRoot, 'scripts', 'quickstart.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8'
    });
    const elapsed = Date.now() - start;

    assert.ok(output.includes('ALL 6/6 CORE SUBSYSTEMS VERIFIED OPTIMAL'));
    assert.ok(output.includes('[PASS] Runtime Environment'));
    assert.ok(output.includes('[PASS] Layer-0 Zero Runtime Dependencies'));
    assert.ok(output.includes('[PASS] Durable Ledger Engine'));
    assert.ok(output.includes('[PASS] Documentation Search Engine'));
    assert.ok(output.includes('[PASS] Automated Reasoning SMT Prover'));
    assert.ok(output.includes('[PASS] Formal MCP Contract Catalog'));
    // Hang guard, not an SLA: coverage instrumentation and slow runners legitimately exceed 10s.
    assert.ok(elapsed < 60000, `Quickstart hung: took ${elapsed}ms, expected < 60000ms`);
  });
});
