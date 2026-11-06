/**
 * EOS SYSTEM — SPEC-069 BDD TEST SUITE
 * Dynamic Constitutional Runtime Interceptor & Agent Proxy
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosConstitutionalRuntimeInterceptor } from '../src/core/eosConstitutionalRuntimeInterceptor.ts';

test('BDD-213: Pre-Execution Interception of Unauthorized External Path Mutation (Law IV)', () => {
  const interceptor = new EosConstitutionalRuntimeInterceptor('C:/Users/valen/Eos-System');

  // Attempting write to restricted external target
  const externalArgs = {
    destination: 'C:/Users/valen/Documents/Fundacion/forbidden.txt',
    content: 'unauthorized patch'
  };

  let executed = false;
  const result = interceptor.executeWithConstitutionalGuardrail(
    'eos_write_file',
    externalArgs,
    () => {
      executed = true;
      return { status: 'OK' };
    }
  );

  assert.equal(result.success, false);
  assert.equal(executed, false, 'Target tool must NEVER be executed when guardrail trips');
  assert.ok(result.blockedReason?.includes('Law IV'));
  assert.equal(result.receipt.approved, false);
  assert.equal(result.receipt.sha256Receipt.length, 64);
});

test('BDD-214: Post-Execution Secret Sanitization and Redaction', () => {
  const interceptor = new EosConstitutionalRuntimeInterceptor('C:/Users/valen/Eos-System');

  const safeArgs = { query: 'fetch_api_keys' };

  // Tool generates output containing accidental plain secrets
  const result = interceptor.executeWithConstitutionalGuardrail(
    'eos_fetch_config',
    safeArgs,
    () => {
      return {
        service: 'stripe',
        apiKey: 'sk-' + 'live-' + '0123456789abcdef12345678',
        nested: {
          pat: 'ghp_' + 'abcdef0123456789abcdef012345'
        }
      };
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.receipt.secretsRedactedCount, 2);

  const sanitized = result.result;
  assert.equal(sanitized.apiKey, '[REDACTED_BY_EOS_CONSTITUTION]');
  assert.equal(sanitized.nested.pat, '[REDACTED_BY_EOS_CONSTITUTION]');
});
