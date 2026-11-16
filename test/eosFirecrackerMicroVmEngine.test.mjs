/**
 * BDD Test Suite for SPEC-295 / CHANGE-157:
 * MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)
 *
 * Verifies BDD-1545..BDD-1550.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  HardwareVirtualizationProber,
  FirecrackerConfigGenerator,
  GvisorConfigGenerator,
  HermeticMicroVmOrchestrator,
  auditMicroVmPipeline,
} from "../src/core/eosFirecrackerMicroVmEngine.ts";

describe("SPEC-295: MicroVM Hardware Sandboxing via Firecracker & gVisor", () => {
  // BDD-1545
  test("BDD-1545: Hardware Virtualization Probing and Tier Selection", () => {
    const diag = HardwareVirtualizationProber.probeHost();

    assert.ok(["FIRECRACKER", "GVISOR_RUNSC", "ISOLATED_PROCESS_JAIL"].includes(diag.tier));
    assert.equal(typeof diag.kvmPresent, "boolean");
    assert.equal(typeof diag.firecrackerInstalled, "boolean");
    assert.equal(typeof diag.gvisorInstalled, "boolean");
    assert.ok(Array.isArray(diag.cpuExtensions));
    assert.ok(diag.recommendation.length > 0);
  });

  // BDD-1546
  test("BDD-1546: Firecracker Declarative MicroVM Configuration Generation", () => {
    const config = FirecrackerConfigGenerator.generateConfig({
      vcpuCount: 4,
      memSizeMib: 512,
      kernelPath: "/opt/firecracker/vmlinux-6.1",
      rootfsPath: "/opt/firecracker/alpine-rootfs.ext4",
      bootArgs: "console=ttyS0 reboot=k panic=1 pci=off",
      vsockPath: "/var/run/fc.vsock",
    });

    assert.equal(config.bootSource.kernel_image_path, "/opt/firecracker/vmlinux-6.1");
    assert.equal(config.bootSource.boot_args, "console=ttyS0 reboot=k panic=1 pci=off");
    assert.equal(config.machineConfig.vcpu_count, 4);
    assert.equal(config.machineConfig.mem_size_mib, 512);
    assert.equal(config.machineConfig.smt, false);
    assert.equal(config.drives.length, 1);
    assert.equal(config.drives[0].is_root_device, true);
    assert.equal(config.drives[0].is_read_only, true);
    assert.equal(config.vsock?.guest_cid, 3);
    assert.equal(config.vsock?.uds_path, "/var/run/fc.vsock");
  });

  // BDD-1547
  test("BDD-1547: Google gVisor OCI Application Kernel Specification Synthesis", () => {
    const oci = GvisorConfigGenerator.generateOciConfig({
      args: ["node", "app.js"],
      rootPath: "/sandbox/rootfs",
      memoryLimitMb: 128,
    });

    assert.equal(oci.ociVersion, "1.0.2");
    assert.deepEqual(oci.process.args, ["node", "app.js"]);
    assert.equal(oci.root.readonly, true);
    assert.equal(oci.root.path, "/sandbox/rootfs");
    assert.equal(oci.linux.resources.memory.limit, 128 * 1024 * 1024);

    const hasNetNs = oci.linux.namespaces.some((ns) => ns.type === "network");
    assert.equal(hasNetNs, true); // Zero-network namespace verified
  });

  // BDD-1548
  test("BDD-1548: Outbound Network Escape Detection and Hard Block", async () => {
    const evilCodeVariants = [
      "fetch('https://api.github.com');",
      "const http = require('node:http'); http.get('http://evil.com');",
      "const net = require('net'); const s = new net.Socket();",
    ];

    for (const code of evilCodeVariants) {
      const result = await HermeticMicroVmOrchestrator.execute({
        codeOrCommand: code,
        timeoutMs: 1000,
      });

      assert.equal(result.status, "NETWORK_VIOLATION_BLOCKED");
      assert.equal(result.exitCode, 111);
      assert.ok(result.stderr.includes("Zero-Network policy"));
      assert.equal(result.stdout, "");
    }
  });

  // BDD-1549
  test("BDD-1549: Hermetic Sandbox Resource Quota & Timeout Enforcement", async () => {
    // 1. Nominal fast script
    const fastRes = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "console.log('Nominal Execution');",
      timeoutMs: 1000,
    });
    assert.equal(fastRes.status, "COMPLETED");
    assert.equal(fastRes.exitCode, 0);
    assert.ok(fastRes.stdout.includes("Nominal Execution"));

    // 2. Infinite loop hard killed by watchdog
    const timeoutRes = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "while (true) { /* infinite loop */ }",
      timeoutMs: 100,
    });
    assert.equal(timeoutRes.status, "TIMEOUT_KILLED");
    assert.equal(timeoutRes.exitCode, 124);
    assert.ok(timeoutRes.stderr.includes("killed by watchdog"));
  });

  // BDD-1550
  test("BDD-1550: Cryptographic MicroVM Sandbox Audit Receipt Generation", async () => {
    const receipt = await auditMicroVmPipeline(process.cwd());

    assert.equal(receipt.specRef, "SPEC-295");
    assert.ok(receipt.hardwareVirtTier);
    assert.equal(receipt.isolationEnforced, true);
    assert.equal(receipt.networkEscapeBlocked, true);
    assert.equal(receipt.timeoutContained, true);
    assert.equal(receipt.sha256Signature.length, 64);

    const receiptFilePath = path.join(process.cwd(), "docs", "evidence", "MICROVM_SANDBOX_RECEIPT.json");
    assert.ok(fs.existsSync(receiptFilePath));
    const saved = JSON.parse(fs.readFileSync(receiptFilePath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });
});
