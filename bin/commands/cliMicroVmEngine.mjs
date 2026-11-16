/**
 * CLI MicroVM Hardware Sandboxing Handlers
 *
 * Implements toolchain:microvm:* subcommands for Firecracker & gVisor isolation,
 * configuration generation, virtualization diagnostics, and security audit receipts.
 *
 * Conforms to SPEC-295 / CHANGE-157.
 */

import {
  FirecrackerConfigGenerator,
  GvisorConfigGenerator,
  HardwareVirtualizationProber,
  HermeticMicroVmOrchestrator,
  auditMicroVmPipeline,
} from "../../src/core/eosFirecrackerMicroVmEngine.ts";

const HANDLERS = {};

async function cmd_microvm_diag(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const diag = HardwareVirtualizationProber.probeHost();

  if (isJson) {
    console.log(JSON.stringify(diag, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔬  EOS HARDWARE VIRTUALIZATION & MICROVM DIAGNOSTIC (SPEC-295)");
  console.log("===============================================================");
  console.log(`  Active Virtualization Tier: ${diag.tier}`);
  console.log(`  KVM Device Present (/dev) : ${diag.kvmPresent}`);
  console.log(`  Firecracker Binary in PATH: ${diag.firecrackerInstalled}`);
  console.log(`  Google gVisor (runsc) in PATH: ${diag.gvisorInstalled}`);
  console.log(`  CPU Virtualization Flags  : ${diag.cpuExtensions.join(", ") || "None detected / Emulated"}`);
  console.log("---------------------------------------------------------------");
  console.log(`  Recommendation            : ${diag.recommendation}`);
  console.log("===============================================================\n");
}

async function cmd_microvm_config(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const isGvisor = args.includes("--gvisor") || args.includes("gvisor");

  if (isGvisor) {
    const ociConfig = GvisorConfigGenerator.generateOciConfig();
    if (isJson) {
      console.log(JSON.stringify(ociConfig, null, 2));
      return;
    }
    console.log("\n===============================================================");
    console.log(" 🛡️  GOOGLE GVISOR (runsc) OCI CONFIGURATION SPEC (SPEC-295)   ");
    console.log("===============================================================");
    console.log(`  OCI Version         : ${ociConfig.ociVersion}`);
    console.log(`  Runtime Sandbox     : runsc (Application Kernel)`);
    console.log(`  Network Isolation   : NONE (Empty Network Namespace)`);
    console.log(`  Root Filesystem     : Read-Only (${ociConfig.root.path})`);
    console.log(`  Memory Limit        : ${ociConfig.linux.resources.memory.limit / (1024 * 1024)} MiB`);
    console.log("===============================================================\n");
  } else {
    const fcConfig = FirecrackerConfigGenerator.generateConfig();
    if (isJson) {
      console.log(JSON.stringify(fcConfig, null, 2));
      return;
    }
    console.log("\n===============================================================");
    console.log(" 🔥  AWS FIRECRACKER MICROVM CONFIGURATION SPEC (SPEC-295)     ");
    console.log("===============================================================");
    console.log(`  Kernel Image Path   : ${fcConfig.bootSource.kernel_image_path}`);
    console.log(`  Kernel Boot Args    : ${fcConfig.bootSource.boot_args}`);
    console.log(`  vCPU Count          : ${fcConfig.machineConfig.vcpu_count}`);
    console.log(`  Memory Size         : ${fcConfig.machineConfig.mem_size_mib} MiB`);
    console.log(`  Root Disk Image     : ${fcConfig.drives[0].path_on_host} (ro)`);
    console.log(`  VirtIO VSOCK Path   : ${fcConfig.vsock?.uds_path}`);
    console.log("===============================================================\n");
  }
}

async function cmd_microvm_launch(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const codeArg = args.slice(1).find((a) => !a.startsWith("--"));
  const code = codeArg || "console.log('Hello from isolated MicroVM jail!');";

  const timeoutArg = args.find((a) => a.startsWith("--timeout="));
  const timeoutMs = timeoutArg ? Number(timeoutArg.split("=")[1]) : 2000;

  const result = await HermeticMicroVmOrchestrator.execute({
    codeOrCommand: code,
    timeoutMs,
  });

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🚀  EOS MICROVM SANDBOX EXECUTION DISPATCH (SPEC-295)         ");
  console.log("===============================================================");
  console.log(`  Execution ID        : ${result.executionId}`);
  console.log(`  Virtualization Tier : ${result.tierUsed}`);
  console.log(`  Execution Status    : ${result.status}`);
  console.log(`  Process Exit Code   : ${result.exitCode}`);
  console.log(`  Duration Elapsed    : ${result.durationMs} ms`);
  if (result.stdout) {
    console.log("----------------------- STDOUT OUTPUT -------------------------");
    console.log(result.stdout.trimEnd());
  }
  if (result.stderr) {
    console.log("----------------------- STDERR OUTPUT -------------------------");
    console.log(result.stderr.trimEnd());
  }
  console.log("===============================================================\n");
}

async function cmd_microvm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = await auditMicroVmPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS MICROVM SANDBOX SECURITY AUDIT RECEIPT (SPEC-295)     ");
  console.log("===============================================================");
  console.log(`  Specification       : ${receipt.specRef}`);
  console.log(`  Hardware Virt Tier  : ${receipt.hardwareVirtTier}`);
  console.log(`  Isolation Enforced  : ${receipt.isolationEnforced}`);
  console.log(`  Network Escape Block: ${receipt.networkEscapeBlocked}`);
  console.log(`  Timeout Contained   : ${receipt.timeoutContained}`);
  console.log(`  SHA-256 Receipt Seal: ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:microvm:diag"] = cmd_microvm_diag;
HANDLERS["toolchain:microvm:config"] = cmd_microvm_config;
HANDLERS["toolchain:microvm:launch"] = cmd_microvm_launch;
HANDLERS["toolchain:microvm:audit"] = cmd_microvm_audit;

export async function handleMicroVmCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
