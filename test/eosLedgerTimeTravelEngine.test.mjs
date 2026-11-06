/**
 * EOS SYSTEM — SPEC-068 BDD TEST SUITE
 * Bitemporal Time-Travel State Replay & Counterfactual Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosDurableSqliteLedger } from '../src/core/eosDurableSqliteLedger.ts';
import { EosLedgerTimeTravelEngine } from '../src/core/eosLedgerTimeTravelEngine.ts';

test('BDD-211: Deterministic Historical State Replay at Sequence K', () => {
  const ledger = new EosDurableSqliteLedger(':memory:');

  try {
    ledger.appendEntry({
      category: 'ARCHITECTURE_DECISION',
      projectId: 'project-alpha',
      title: 'Initialize System',
      payload: { step: 1 }
    });
    ledger.appendEntry({
      category: 'SECURITY_AUDIT',
      projectId: 'project-alpha',
      title: 'Run Security Gate',
      payload: { step: 2 }
    });
    ledger.appendEntry({
      category: 'MISSION_DIRECTION',
      projectId: 'project-beta',
      title: 'Direct Mission Beta',
      payload: { step: 3 }
    });

    const timeTravel = new EosLedgerTimeTravelEngine(ledger);

    // Replay state as of sequence 2
    const replay2 = timeTravel.replayStateUpTo(2);

    assert.equal(replay2.targetSequence, 2);
    assert.equal(replay2.projection.totalEntriesReplayed, 2);
    assert.equal(replay2.projection.isChainIntact, true);
    assert.deepEqual(Array.from(replay2.projection.activeProjects), ['project-alpha']);
    assert.equal(replay2.projection.categoryCounts['ARCHITECTURE_DECISION'], 1);
    assert.equal(replay2.projection.categoryCounts['SECURITY_AUDIT'], 1);
    assert.equal(replay2.projection.categoryCounts['MISSION_DIRECTION'] || 0, 0);

    // Replay state as of sequence 3
    const replay3 = timeTravel.replayStateUpTo(3);
    assert.equal(replay3.projection.totalEntriesReplayed, 3);
    assert.deepEqual(Array.from(replay3.projection.activeProjects), ['project-alpha', 'project-beta']);
  } finally {
    ledger.close();
  }
});

test('BDD-212: Counterfactual Speculative Ledger Branching', () => {
  const ledger = new EosDurableSqliteLedger(':memory:');

  try {
    ledger.appendEntry({
      category: 'ARCHITECTURE_DECISION',
      projectId: 'project-alpha',
      title: 'Original Event 1',
      payload: { commit: 'a1' }
    });
    ledger.appendEntry({
      category: 'ARCHITECTURE_DECISION',
      projectId: 'project-alpha',
      title: 'Original Event 2',
      payload: { commit: 'a2' }
    });

    const timeTravel = new EosLedgerTimeTravelEngine(ledger);
    const branch = timeTravel.createCounterfactualBranch(1);

    // Inject speculative alternative in branch
    const specRecord = branch.injectSpeculativeEvent(
      'ARCHITECTURE_DECISION',
      'project-alpha',
      'Alternative Patch Simulation',
      { commit: 'alt-99' }
    );

    assert.equal(specRecord.seq, 2);
    assert.ok(specRecord.title.includes('[COUNTERFACTUAL]'));

    // Verify main ledger was untouched (still has 2 original entries)
    const mainEntries = ledger.listRecent(10);
    assert.equal(mainEntries.length, 2);
    assert.equal(mainEntries[0].title, 'Original Event 2');

    branch.close();
  } finally {
    ledger.close();
  }
});
