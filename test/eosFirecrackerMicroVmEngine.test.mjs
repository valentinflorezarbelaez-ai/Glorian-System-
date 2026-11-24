/**
 * BDD Test Suite for SPEC-295 / CHANGE-157:
 * MicroVM Hardware Sandboxing via Firecracker & gVisor (runsc)
 *
 * Verifies BDD-1545..BDD-1550.
 */

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { resolveEvidencePath } from "./lib/testEvidence.mjs";
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

    const receiptFilePath = resolveEvidencePath("MICROVM_SANDBOX_RECEIPT.json");
    assert.ok(fs.existsSync(receiptFilePath));
    const saved = JSON.parse(fs.readFileSync(receiptFilePath, "utf8"));
    assert.equal(saved.sha256Signature, receipt.sha256Signature);
  });

  test("Default config generators and sandbox runtime failure/logging branches", async () => {
    const defaultFc = FirecrackerConfigGenerator.generateConfig();
    assert.equal(defaultFc.machineConfig.vcpu_count, 2);
    assert.equal(defaultFc.machineConfig.mem_size_mib, 256);
    assert.equal(defaultFc.bootSource.kernel_image_path, "/var/lib/firecracker/vmlinux");

    const defaultOci = GvisorConfigGenerator.generateOciConfig();
    assert.deepEqual(defaultOci.process.args, ["/bin/sh"]);
    assert.equal(defaultOci.root.path, "rootfs");
    assert.equal(defaultOci.linux.resources.memory.limit, 256 * 1024 * 1024);

    const logRes = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: [
        "console.warn('warn-msg');",
        "console.error('err-msg');",
        "assert.strictEqual(42, 42);",
        "assert.ok(true);",
      ].join("\n"),
      forceTier: "GVISOR_RUNSC",
      memoryLimitMb: 512,
    });
    assert.equal(logRes.status, "COMPLETED");
    assert.equal(logRes.tierUsed, "GVISOR_RUNSC");
    assert.equal(logRes.memoryPeakBytes, 512 * 1024 * 1024);
    assert.ok(logRes.stdout.includes("[WARN] warn-msg"));
    assert.ok(logRes.stderr.includes("err-msg"));

    const strictFail = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "assert.strictEqual(1, 2);",
    });
    assert.equal(strictFail.status, "FAILED");
    assert.equal(strictFail.exitCode, 1);
    assert.ok(strictFail.stderr.includes("AssertionError: 1 !== 2"));

    const okFail = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "assert.ok(false);",
    });
    assert.equal(okFail.status, "FAILED");
    assert.equal(okFail.exitCode, 1);
    assert.ok(okFail.stderr.includes("value is falsy"));

    const nonErrThrow = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "throw 'raw-string-failure';",
    });
    assert.equal(nonErrThrow.status, "FAILED");
    assert.equal(nonErrThrow.stderr, "raw-string-failure");

    const timeoutMsgThrow = await HermeticMicroVmOrchestrator.execute({
      codeOrCommand: "throw new Error('Operation timed out after 50ms');",
      timeoutMs: 50,
    });
    assert.equal(timeoutMsgThrow.status, "TIMEOUT_KILLED");
    assert.equal(timeoutMsgThrow.exitCode, 124);
  });

  test("HardwareVirtualizationProber covers FIRECRACKER, GVISOR_RUNSC, and probe error branches", async () => {
    const req = createRequire(import.meta.url);
    const cjsFs = req("node:fs");
    const cjsCp = req("node:child_process");
    const origExistsSync = cjsFs.existsSync;
    const origReadFileSync = cjsFs.readFileSync;
    const origExecFileSync = cjsCp.execFileSync;

    try {
      // 1. Firecracker + KVM + both VT-x and AMD-V flags
      cjsFs.existsSync = (target) =>
        target === "/dev/kvm" || target === "/proc/cpuinfo" ? true : origExistsSync(target);
      cjsFs.readFileSync = (target, enc) =>
        target === "/proc/cpuinfo" ? "flags : vmx svm\n" : origReadFileSync(target, enc);
      cjsCp.execFileSync = (bin, args, opts) => {
        if (bin === "firecracker") return "firecracker v1.7.0";
        if (bin === "runsc") throw new Error("missing runsc");
        return origExecFileSync(bin, args, opts);
      };
      syncBuiltinESMExports();

      const fcDiag = HardwareVirtualizationProber.probeHost();
      assert.equal(fcDiag.tier, "FIRECRACKER");
      assert.equal(fcDiag.kvmPresent, true);
      assert.equal(fcDiag.firecrackerInstalled, true);
      assert.equal(fcDiag.gvisorInstalled, false);
      assert.deepEqual(fcDiag.cpuExtensions, ["Intel VT-x (vmx)", "AMD-V (svm)"]);

      // 2. gVisor fallback without KVM/Firecracker
      cjsFs.existsSync = (target) =>
        target === "/dev/kvm" || target === "/proc/cpuinfo" ? false : origExistsSync(target);
      cjsCp.execFileSync = (bin) => {
        if (bin === "runsc") return "runsc release-2026";
        throw new Error("missing firecracker");
      };
      syncBuiltinESMExports();

      const gvDiag = HardwareVirtualizationProber.probeHost();
      assert.equal(gvDiag.tier, "GVISOR_RUNSC");
      assert.equal(gvDiag.gvisorInstalled, true);
      assert.equal(gvDiag.firecrackerInstalled, false);

      // 3. Firecracker without /dev/kvm falls back to ISOLATED_PROCESS_JAIL; probe throws handled cleanly
      cjsFs.existsSync = (target) => {
        if (target === "/dev/kvm" || target === "/proc/cpuinfo") {
          throw new Error("restricted procfs");
        }
        return origExistsSync(target);
      };
      cjsCp.execFileSync = (bin) => {
        if (bin === "firecracker") return "firecracker v1.7.0";
        throw new Error("missing runsc");
      };
      syncBuiltinESMExports();

      const errDiag = HardwareVirtualizationProber.probeHost();
      assert.equal(errDiag.tier, "ISOLATED_PROCESS_JAIL");
      assert.equal(errDiag.kvmPresent, false);
      assert.equal(errDiag.firecrackerInstalled, true);
    } finally {
      cjsFs.existsSync = origExistsSync;
      cjsFs.readFileSync = origReadFileSync;
      cjsCp.execFileSync = origExecFileSync;
      syncBuiltinESMExports();
    }

    // 4. auditMicroVmPipeline default arg & fresh evidence dir creation in temp directory
    const defaultReceipt = await auditMicroVmPipeline();
    assert.equal(defaultReceipt.specRef, "SPEC-295");

    const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "eos-microvm-test-"));
    const prevEvidenceDir = process.env.EOS_EVIDENCE_DIR;
    try {
      delete process.env.EOS_EVIDENCE_DIR;
      const freshReceipt = await auditMicroVmPipeline(tempWorkspace);
      assert.equal(freshReceipt.isolationEnforced, true);
      assert.ok(fs.existsSync(path.join(tempWorkspace, "docs", "evidence", "MICROVM_SANDBOX_RECEIPT.json")));
    } finally {
      if (prevEvidenceDir !== undefined) {
        process.env.EOS_EVIDENCE_DIR = prevEvidenceDir;
      }
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });
});
