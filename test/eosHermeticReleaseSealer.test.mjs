/**
 * EOS SYSTEM — SPEC-067 BDD TEST SUITE
 * Hermetic Multi-Architecture Release Sealer & SLSA Level 4 Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EosHermeticReleaseSealer } from '../src/core/eosHermeticReleaseSealer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('BDD-209: Deterministic Hermetic Release Packaging and SLSA In-Toto Manifest', () => {
  const sealer = new EosHermeticReleaseSealer(projectRoot);
  const manifest = sealer.generateReleaseSeal('test-commit-sha-abcdef');

  assert.ok(manifest.releaseTag.startsWith('v'));
  assert.equal(manifest.commitSha, 'test-commit-sha-abcdef');
  assert.equal(manifest.releaseSealDigest.length, 64);
  assert.ok(manifest.totalArtifactsScanned >= 5);
  assert.equal(manifest.slsaProvenance._type, 'https://in-toto.io/Statement/v1');
  assert.equal(manifest.slsaProvenance.predicateType, 'https://slsa.dev/provenance/v1');

  // Verify persistence
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-release-test-'));
  const ledgerPath = path.join(tmpDir, 'ledger.sqlite');

  const { savedPath, ledgerReceiptHash } = sealer.persistReleaseSeal(manifest, ledgerPath);
  assert.ok(fs.existsSync(savedPath));
  assert.equal(ledgerReceiptHash.length, 64);
});

test('BDD-210: Fail-Closed Barrier on Uncommitted Secret Injection', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-sealer-secret-test-'));
  const dirtySecretFile = path.join(tmpDir, 'leaked_key.txt');
  fs.writeFileSync(dirtySecretFile, 'OPENAI_KEY=' + 'sk-' + 'live-' + '0123456789abcdef12345678', 'utf8');

  const sealer = new EosHermeticReleaseSealer(tmpDir);

  assert.throws(
    () => {
      sealer.scanFile(dirtySecretFile);
    },
    /RELEASE_SEAL_REJECTED/
  );
});
