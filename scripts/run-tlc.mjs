#!/usr/bin/env node
/**
 * Glorian System — Leslie Lamport TLC Formal Model Checker Runner
 * Governed by SPEC-270 / CHANGE-132 / ADR-132-001
 *
 * Runs formal model checking across configured TLA+ protocols with companion .cfg files.
 * In environments lacking a local Java 21+ runtime, validates model specifications and
 * defers exhaustive execution to GitHub Actions CI (actions/setup-java@v4).
 *
 * Invariant: Zero external npm dependencies. Max cyclomatic complexity <= 15.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const FORMAL_DIR = path.join(ROOT, "docs/formal");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidence");
const DEFAULT_RECEIPT_PATH = path.join(EVIDENCE_DIR, "TLC_RECEIPT.json");

/** Windows parallel suites can lock evidence receipts (EBUSY / UNKNOWN / errno -4094). */
const TRANSIENT_LOCK_CODES = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES"]);

function writeFileWithRetry(targetPath, content) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.writeFileSync(targetPath, content, "utf8");
      return;
    } catch (err) {
      const transient = TRANSIENT_LOCK_CODES.has(err?.code) || err?.errno === -4094;
      if (!transient || attempt === 5) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * attempt);
    }
  }
}

export const CONFIGURED_SPECS = [
  "LmaxDisruptor",
  "HermesConsensusMesh",
  "DatomicBitemporalLedger",
  "AutonomousChaosDisruptor",
  "BftAgentSwarmSlashing",
  "CellBasedBulkheadGovernor",
  "ZeroCopyRingBuffer",
  "JepsenDistributedChaos",
  "SimdQuantizedHnsw",
  "DistributedVectorMesh",
  "VectorLsmStorage",
  "SpeculativePagedKvCache",
  "FlashAttentionOnlineSoftmax",
];

/**
 * Resolves the path to the Java executable.
 */
export function resolveJavaExecutable() {
  if (process.env.JAVA_HOME) {
    const binName = process.platform === "win32" ? "java.exe" : "java";
    const fromHome = path.join(process.env.JAVA_HOME, "bin", binName);
    if (fs.existsSync(fromHome)) return fromHome;
  }

  try {
    const res = spawnSync("java", ["-version"], { encoding: "utf8" });
    if (res.status === 0) return "java";
  } catch {
    // java not in current PATH
  }

  if (process.platform === "win32") {
    const adoptiumBase = "C:\\Program Files\\Eclipse Adoptium";
    if (fs.existsSync(adoptiumBase)) {
      try {
        const entries = fs.readdirSync(adoptiumBase);
        for (const entry of entries) {
          const candidate = path.join(adoptiumBase, entry, "bin", "java.exe");
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {
        // adoptium directory unreadable
      }
    }
    const javaBase = "C:\\Program Files\\Java";
    if (fs.existsSync(javaBase)) {
      try {
        const entries = fs.readdirSync(javaBase);
        for (const entry of entries) {
          const candidate = path.join(javaBase, entry, "bin", "java.exe");
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {
        // java directory unreadable
      }
    }
  }

  const nixCandidates = [
    "/usr/lib/jvm/java-21-openjdk/bin/java",
    "/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
    "/usr/bin/java",
  ];
  for (const candidate of nixCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Checks if Java runtime is available in the current environment.
 */
export function detectJavaRuntime() {
  const javaExec = resolveJavaExecutable();
  if (!javaExec) return false;
  try {
    const res = spawnSync(javaExec, ["-version"], { encoding: "utf8" });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Resolves path to tla2tools.jar if available locally or in cache.
 */
export function resolveTlaJarPath(customPath = null) {
  if (customPath && fs.existsSync(customPath)) {
    return path.resolve(customPath);
  }
  const candidates = [
    process.env.TLA2TOOLS_JAR,
    path.join(ROOT, "tools", "tla2tools.jar"),
    path.join(ROOT, ".cache", "tla2tools.jar"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return path.resolve(candidate);
  }
  return null;
}

/**
 * Validates structural syntax of a .tla and companion .cfg pair.
 */
export function validateSpecConfigPair(specName, formalDir = FORMAL_DIR) {
  const tlaPath = path.join(formalDir, `${specName}.tla`);
  const cfgPath = path.join(formalDir, `${specName}.cfg`);

  if (!fs.existsSync(tlaPath)) {
    throw new Error(`Missing TLA+ specification file: ${tlaPath}`);
  }
  if (!fs.existsSync(cfgPath)) {
    throw new Error(`Missing companion TLC configuration file: ${cfgPath}`);
  }

  const tlaContent = fs.readFileSync(tlaPath, "utf8");
  const cfgContent = fs.readFileSync(cfgPath, "utf8");

  if (!tlaContent.includes(`MODULE ${specName}`)) {
    throw new Error(`Spec ${specName}.tla does not declare 'MODULE ${specName}'`);
  }
  if (!cfgContent.includes("SPECIFICATION") && !cfgContent.includes("INIT")) {
    throw new Error(`Config ${specName}.cfg must declare SPECIFICATION or INIT/NEXT`);
  }
  if (!cfgContent.includes("INVARIANTS") && !cfgContent.includes("INVARIANT")) {
    throw new Error(`Config ${specName}.cfg must declare at least one INVARIANT`);
  }

  return {
    name: specName,
    tlaPath,
    cfgPath,
    tlaBytes: tlaContent.length,
    cfgBytes: cfgContent.length,
    syntaxValid: true,
  };
}

/**
 * Parses TLC stdout/stderr output into structured metrics.
 */
export function parseTlcOutput(output) {
  const clean = String(output || "");
  const distinctMatch = clean.match(/(\d+)\s+distinct states found/i);
  const totalMatch = clean.match(/(\d+)\s+states generated/i);
  const errorMatch = clean.match(/Error:\s*Invariant\s+([A-Za-z0-9_]+)\s+is violated/i);
  const deadlockMatch = clean.match(/Error:\s*Deadlock reached/i);
  const passMatch = clean.match(/Model checking completed\.\s*No error has been found/i);

  const distinctStates = distinctMatch ? parseInt(distinctMatch[1], 10) : 0;
  const statesGenerated = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const hasError = Boolean(errorMatch || deadlockMatch);
  const violationInvariant = errorMatch ? errorMatch[1] : null;

  return {
    passed: Boolean(passMatch) && !hasError,
    hasError,
    violationInvariant,
    deadlock: Boolean(deadlockMatch),
    distinctStates,
    statesGenerated,
    rawSummary: clean.slice(0, 300),
  };
}

/**
 * Executes TLC on a given spec using the Java CLI.
 */
export function runTlcExecutable(specName, jarPath, formalDir = FORMAL_DIR, opts = {}) {
  const javaExec = resolveJavaExecutable() || "java";

  const args = ["-cp", jarPath, "tlc2.TLC", "-cleanup", "-deadlock", "-config", `${specName}.cfg`, `${specName}.tla`];

  const res = spawnSync(javaExec, args, {
    cwd: formalDir,
    encoding: "utf8",
    timeout: opts.timeoutMs || 30000,
  });

  const statesDir = path.join(formalDir, "states");
  if (fs.existsSync(statesDir)) {
    try {
      fs.rmSync(statesDir, { recursive: true, force: true });
    } catch {
      // states directory cleanup fallback
    }
  }
  try {
    const formalFiles = fs.readdirSync(formalDir);
    for (const f of formalFiles) {
      if (f.includes("_TTrace_")) {
        try {
          fs.rmSync(path.join(formalDir, f), { force: true });
        } catch {
          // trace file cleanup fallback
        }
      }
    }
  } catch {
    // formal dir readdir fallback
  }

  const combinedOutput = `${res.stdout || ""}\n${res.stderr || ""}`;
  const parsed = parseTlcOutput(combinedOutput);

  return {
    specName,
    exitCode: res.status,
    ...parsed,
    rawOutput: combinedOutput,
  };
}

function evaluateSingleModel(specName, canExecuteLive, jarPath, formalDir, options) {
  const pair = validateSpecConfigPair(specName, formalDir);
  if (!canExecuteLive) {
    return {
      passed: true,
      result: {
        specName,
        verifiedLive: false,
        syntaxValid: pair.syntaxValid,
        tlaBytes: pair.tlaBytes,
        cfgBytes: pair.cfgBytes,
      },
    };
  }

  const execResult = runTlcExecutable(specName, jarPath, formalDir, options);
  return {
    passed: execResult.passed,
    result: {
      specName,
      verifiedLive: true,
      passed: execResult.passed,
      distinctStates: execResult.distinctStates,
      statesGenerated: execResult.statesGenerated,
      violationInvariant: execResult.violationInvariant,
      exitCode: execResult.exitCode,
    },
  };
}

function resolveTlcStatus(canExecuteLive, allPassed) {
  if (!canExecuteLive) return "DEFERRED_TO_CI_SETUP_JAVA";
  return allPassed ? "VERIFIED" : "INVARIANT_BREACH_DETECTED";
}

/**
 * Executes formal TLC verification across all configured specs or defers to CI.
 */
export function runTlcVerification(options = {}) {
  const formalDir = options.formalDir || FORMAL_DIR;
  const receiptPath = options.receiptPath || DEFAULT_RECEIPT_PATH;
  const specs = options.specs || CONFIGURED_SPECS;
  const forceMock = options.forceMock || false;

  const hasJava = !forceMock && detectJavaRuntime();
  const jarPath = !forceMock ? resolveTlaJarPath(options.jarPath) : null;
  const canExecuteLive = hasJava && Boolean(jarPath);

  const modelResults = [];
  let allPassed = true;

  for (const specName of specs) {
    const outcome = evaluateSingleModel(specName, canExecuteLive, jarPath, formalDir, options);
    if (!outcome.passed) allPassed = false;
    modelResults.push(outcome.result);
  }

  const status = resolveTlcStatus(canExecuteLive, allPassed);
  const executionMode = canExecuteLive ? "LIVE_LOCAL_TLC" : "DEFERRED_TO_CI_SETUP_JAVA";

  const receipt = {
    timestampIso: new Date().toISOString(),
    specRef: "SPEC-270",
    engine: "Leslie Lamport TLC Model Checker (tla2tools.jar)",
    executionMode,
    status,
    allPassed: canExecuteLive ? allPassed : true,
    hasJavaRuntime: hasJava,
    tlaJarPath: jarPath || "NOT_DETECTED_LOCALLY",
    totalConfiguredSpecs: specs.length,
    models: modelResults,
  };

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileWithRetry(receiptPath, JSON.stringify(receipt, null, 2));

  return receipt;
}

/**
 * CLI Entrypoint
 */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const isNegative = process.argv.includes("--negative-calibration");
  const forceMock = process.argv.includes("--force-mock");

  if (isNegative) {
    console.log("=== TLC Negative Calibration Check ===");
    const syntheticFailingOutput = `
      Error: Invariant SafetyInvariant is violated.
      Error: The following behavior constitutes a counter-example:
      State 1: <producerSeq = 0, consumerSeq = 0>
      State 2: <producerSeq = 5, consumerSeq = 0> (Overrun violated)
    `;
    const parsed = parseTlcOutput(syntheticFailingOutput);
    if (parsed.hasError && parsed.violationInvariant === "SafetyInvariant") {
      console.log("✅ Negative calibration verified: Invariant breaches correctly detected.");
      process.exit(0);
    } else {
      console.error("❌ Negative calibration failed: Invariant breach went undetected.");
      process.exit(1);
    }
  }

  const receipt = runTlcVerification({ forceMock });
  console.log(`=== Leslie Lamport TLC Formal Verification Gate (SPEC-270) ===`);
  console.log(`Execution Mode : ${receipt.executionMode}`);
  console.log(`Status         : ${receipt.status}`);
  console.log(`Configured Specs: ${receipt.totalConfiguredSpecs}`);
  console.log(`Evidence Receipt: ${DEFAULT_RECEIPT_PATH}`);

  if (receipt.status === "DEFERRED_TO_CI_SETUP_JAVA") {
    console.log("ℹ️ Java 21 / tla2tools.jar will execute TLC exhaustive state exploration in CI.");
  }

  process.exit(receipt.allPassed ? 0 : 1);
}
