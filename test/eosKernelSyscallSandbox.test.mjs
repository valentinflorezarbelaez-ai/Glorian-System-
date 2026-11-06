/**
 * EOS SYSTEM — SPEC-073 BDD TEST SUITE
 * Kernel-Grade Seccomp-BPF & Syscall Sandbox Generator
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosKernelSyscallSandbox } from '../src/core/eosKernelSyscallSandbox.ts';

test('BDD-221: OCI Seccomp Filter Generation with Fail-Closed Default Action', () => {
  const profile = EosKernelSyscallSandbox.generateSandboxProfile('agent-hermetic-cage');

  assert.equal(profile.profileName, 'agent-hermetic-cage');
  assert.equal(profile.linuxSeccomp.defaultAction, 'SCMP_ACT_ERRNO');
  assert.equal(profile.linuxSeccomp.defaultErrnoRet, 1);
  assert.ok(profile.linuxSeccomp.architectures.includes('SCMP_ARCH_X86_64'));
  assert.ok(profile.linuxSeccomp.architectures.includes('SCMP_ARCH_AARCH64'));

  // Whitelist purity check (no dangerous syscalls allowed)
  const isPure = EosKernelSyscallSandbox.validateWhitelistPurity(profile);
  assert.equal(isPure, true);

  const whitelisted = profile.linuxSeccomp.syscalls[0].names;
  assert.ok(whitelisted.includes('read'));
  assert.ok(whitelisted.includes('write'));
  assert.ok(!whitelisted.includes('ptrace'));
  assert.ok(!whitelisted.includes('mount'));
  assert.ok(!whitelisted.includes('reboot'));
});

test('BDD-222: Windows JobObject Containment Descriptor & SHA-256 Attestation', () => {
  const profile = EosKernelSyscallSandbox.generateSandboxProfile('win-job-enclave');

  assert.equal(profile.windowsJobObject.uiRestrictions, true);
  assert.equal(profile.windowsJobObject.dieOnUnhandledException, true);
  assert.equal(profile.windowsJobObject.activeProcessLimit, 8);
  assert.equal(profile.profileSha256.length, 64);

  // Verify persistence in SQLite WAL ledger
  const recordResult = EosKernelSyscallSandbox.recordProfileInLedger(profile, ':memory:');
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});
