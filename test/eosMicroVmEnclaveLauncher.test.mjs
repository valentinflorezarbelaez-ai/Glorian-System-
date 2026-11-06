/**
 * EOS SYSTEM — SPEC-081 BDD TEST SUITE
 * MicroVM Hardware Enclave Launcher (Firecracker / Hyper-V)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosMicroVmEnclaveLauncher } from '../src/core/eosMicroVmEnclaveLauncher.ts';

test('BDD-237: Deterministic Firecracker MicroVM Descriptor Generation', () => {
  const launcher = new EosMicroVmEnclaveLauncher();

  const profile = launcher.generateFirecrackerProfile('agent-worker-01', 4, 1024);
  assert.equal(profile.enclaveId, 'agent-worker-01');
  assert.equal(profile.machine_config.vcpu_count, 4);
  assert.equal(profile.machine_config.mem_size_mib, 1024);
  assert.equal(profile.boot_source.kernel_image_path, '/opt/eos/enclave/vmlinux.bin');
  assert.equal(profile.drives.length, 1);
  assert.equal(profile.profileSha256.length, 64);

  // Hyper-V profile
  const hyperV = launcher.generateHyperVProfile('win-agent-01', 1024, 4);
  assert.equal(hyperV.isolation, 'hyperv');
  assert.equal(hyperV.cpuCount, 4);
  assert.equal(hyperV.profileSha256.length, 64);
});

test('BDD-238: Hardware Virtualization Capability Evaluation and Fail-Closed Guard', () => {
  const diag = EosMicroVmEnclaveLauncher.diagnoseHostVirtualization();
  assert.ok(diag.cpuCores > 0);
  assert.ok(['win32', 'linux', 'darwin'].includes(diag.platform));
  assert.ok(diag.hardwareVirtualizationSupported);
  assert.ok(['HARDWARE_MICROVM', 'HYPERV_ISOLATED', 'KERNEL_CONFINED_FALLBACK'].includes(diag.isolationTier));
});
