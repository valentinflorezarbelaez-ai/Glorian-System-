import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { EosFirecrackerDaemonSupervisor } from "../src/core/eosFirecrackerDaemonSupervisor.ts";

test("BDD-247: Configuración declarativa e inicialización de microVM vía Socket IPC (SPEC-086)", async () => {
  const supervisor = new EosFirecrackerDaemonSupervisor("enclave-test-alpha");
  assert.equal(supervisor.getState(), "UNINITIALIZED");

  await supervisor.initialize();
  assert.equal(supervisor.getState(), "CONFIGURING");

  // 1. Configure Machine (vCPUs, RAM)
  const cfgRes = await supervisor.configureMachine(4, 1024, false);
  assert.equal(cfgRes.statusCode, 204);
  assert.equal(cfgRes.body.configured, true);
  assert.equal(cfgRes.body.vcpu_count, 4);
  assert.equal(cfgRes.body.mem_size_mib, 1024);

  // 2. Set Boot Source
  const bootRes = await supervisor.setBootSource(
    "/vmlinux-6.6-eos.bin",
    "console=ttyS0 reboot=k panic=1 pci=off init=/init"
  );
  assert.equal(bootRes.statusCode, 204);
  assert.equal(bootRes.body.boot_source_set, true);

  // 3. Attach Root Drive
  const driveRes = await supervisor.attachDrive("rootfs", "/images/distroless.ext4", true, true);
  assert.equal(driveRes.statusCode, 204);
  assert.equal(driveRes.body.drive_attached, true);

  // 4. Start Instance
  const startRes = await supervisor.startInstance();
  assert.equal(startRes.statusCode, 204);
  assert.equal(startRes.body.state, "RUNNING");
  assert.equal(supervisor.getState(), "RUNNING");

  // 5. Pause and Resume
  const pauseRes = await supervisor.pauseInstance();
  assert.equal(pauseRes.statusCode, 204);
  assert.equal(supervisor.getState(), "PAUSED");

  const resumeRes = await supervisor.resumeInstance();
  assert.equal(resumeRes.statusCode, 204);
  assert.equal(supervisor.getState(), "RUNNING");

  // 6. Graceful CtrlAltDel
  const cadRes = await supervisor.sendCtrlAltDel();
  assert.equal(cadRes.statusCode, 204);
  assert.equal(cadRes.body.action, "SendCtrlAltDel");

  await supervisor.terminate();
  assert.equal(supervisor.getState(), "TERMINATED");
});

test("BDD-248: Terminación ordenada y eliminación de sockets Unix (SPEC-086)", async () => {
  const supervisor = new EosFirecrackerDaemonSupervisor("enclave-teardown-omega");
  await supervisor.initialize();
  const socketPath = supervisor.getSocketPath();

  // Create a placeholder socket file to test cleanup
  fs.writeFileSync(socketPath, "mock-socket-inode");
  assert.ok(fs.existsSync(socketPath), "Socket file must exist before teardown");

  await supervisor.terminate();
  assert.equal(supervisor.getState(), "TERMINATED");
  assert.equal(fs.existsSync(socketPath), false, "Socket file must be unlinked on teardown");
});
