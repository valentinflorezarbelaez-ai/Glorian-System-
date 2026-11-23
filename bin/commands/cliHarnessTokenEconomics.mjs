/**
 * @file cliHarnessTokenEconomics.mjs
 * @description CLI handler for SPEC-377 / CHANGE-239: Harness Boundaries,
 * Structured Token Economics & Deterministic Decision Router Engine.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosHarnessTokenEconomicsCore } from "../../src/core/eosHarnessTokenEconomicsCore.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function parseFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const idx = arg.indexOf("=");
  return idx >= 0 ? arg.slice(idx + 1) : defaultValue;
}

async function cmdBoundary(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const filesRaw = parseFlag(args, "--files=", "src/core/sample.ts");
  const forbiddenRaw = parseFlag(args, "--forbidden=", "src/auth/**,package-lock.json");
  const allowedRaw = parseFlag(args, "--allowed=", "src/core/**");
  const maxFiles = Number(parseFlag(args, "--max-files=", "5"));
  const maxLines = Number(parseFlag(args, "--max-lines=", "400"));
  const linesAdded = Number(parseFlag(args, "--lines-added=", "40"));
  const linesDeleted = Number(parseFlag(args, "--lines-deleted=", "10"));
  const allowTests = parseFlag(args, "--allow-tests=", "false") === "true";

  const report = EosHarnessTokenEconomicsCore.evaluateBoundary(
    {
      missionId: "CLI-BOUNDARY-CHECK",
      allowedPaths: allowedRaw ? allowedRaw.split(",").filter(Boolean) : [],
      forbiddenPaths: forbiddenRaw ? forbiddenRaw.split(",").filter(Boolean) : [],
      maxFilesTouched: maxFiles,
      maxDiffLines: maxLines,
      allowTestMutation: allowTests,
    },
    {
      changedFiles: filesRaw.split(",").filter(Boolean),
      totalLinesAdded: linesAdded,
      totalLinesDeleted: linesDeleted,
    },
  );

  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:boundary", ...report }, null, 2));
    return;
  }
  console.log("=== Harness Boundary Enforcer (SPEC-377) ===");
  console.log(`Verdict     : ${report.verdict}`);
  console.log(`Files       : ${report.filesEvaluated} | Diff Lines: ${report.totalDiffLines}`);
  console.log(`Violations  : ${report.violations.length}`);
  console.log(`Attestation : ${report.attestationHash.slice(0, 16)}...`);
}

async function cmdCompress(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const count = Number(parseFlag(args, "--items=", "40"));
  const maxItems = Number(parseFlag(args, "--max-items=", "8"));

  const sample = {
    status: "ok",
    records: Array.from({ length: count }, (_, idx) => ({
      id: idx + 1,
      repo: "glorian-system",
      tier: "layer-0",
      digest: "f".repeat(64),
      optionalNote: null,
      emptyMeta: "",
    })),
  };

  const report = EosHarnessTokenEconomicsCore.compressPayload(sample, { maxArrayItems: maxItems });
  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:compress", ...report }, null, 2));
    return;
  }
  console.log("=== Structured MCP/JSON Payload Compressor (Headroom Pattern / SPEC-377) ===");
  console.log(`Tokens Before : ${report.tokensBefore}`);
  console.log(`Tokens After  : ${report.tokensAfter}`);
  console.log(`Savings       : ${report.savingsPercent}% (${report.columnarTablesFolded} columnar tables)`);
}

async function cmdRoute(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const prompt = parseFlag(args, "--prompt=", "Run unit test fix and lint verification");
  const phase = parseFlag(args, "--phase=", "EXECUTION");
  const prevPhase = parseFlag(args, "--prev-phase=", "EXECUTION");
  const activeTier = parseFlag(args, "--active-tier=", "BALANCED_SONNET");

  const report = EosHarnessTokenEconomicsCore.classifyAndRoute({
    queryId: "CLI-ROUTE",
    prompt,
    labels: [
      { label: "TEST_FIX", keywords: ["test", "lint", "fix", "unit", "verify"] },
      { label: "ARCHITECTURE", keywords: ["architecture", "design", "spec", "adr", "plan"] },
      { label: "RELEASE_DEPLOY", keywords: ["deploy", "release", "ship", "canary"] },
    ],
    currentPhase: phase,
    previousPhase: prevPhase,
    activeModelTier: activeTier,
  });

  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:route", ...report }, null, 2));
    return;
  }
  console.log("=== Deterministic Closed-Set Router (JEV Pattern / SPEC-377) ===");
  console.log(`Label       : ${report.selectedLabel} (confidence=${report.confidence})`);
  console.log(`Tier        : ${report.effectiveTier} | Escalated: ${report.escalatedToFrontier}`);
  console.log(`Cache Safe  : ${report.promptCachePreserved}`);
}

async function cmdCache(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const turns = Number(parseFlag(args, "--turns=", "12"));
  const withBreaker = args.includes("--with-breaker");

  const prefix = [
    withBreaker
      ? "EOS Constitution v75.0.0 ts=2026-11-22T19:45:00Z id=550e8400-e29b-41d4-a716-446655440000"
      : "EOS Constitution v75.0.0 immutable static prefix",
    "Architecture contract ".repeat(200),
  ];

  const report = EosHarnessTokenEconomicsCore.auditCacheAndEconomics({
    sessionId: "CLI-CACHE-AUDIT",
    staticPrefixSegments: prefix,
    dynamicSuffixSegments: ["Current turn git diff summary ".repeat(40)],
    turns,
    contextWindowTokens: 128000,
  });

  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:cache", ...report }, null, 2));
    return;
  }
  console.log("=== Prompt Cache & Session Token Economics Auditor (SPEC-377) ===");
  console.log(`Prefix Stable : ${report.cachePrefixStable} (breakers=${report.cacheBreakers.length})`);
  console.log(`Context Fill  : ${(report.contextFillRatio * 100).toFixed(1)}% | Rot Alert: ${report.contextRotAlert}`);
  console.log(`Cost Savings  : $${report.savingsUsd} (${report.savingsPercent}%)`);
}

async function cmdMinimal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const linesAdded = Number(parseFlag(args, "--lines=", "45"));
  const reqs = Number(parseFlag(args, "--reqs=", "2"));

  const report = EosHarnessTokenEconomicsCore.evaluateMinimalDiff({
    patchId: "CLI-MINIMAL-CHECK",
    sourceSnippet: "export function add(a, b) { return a + b; }",
    linesAdded,
    requirementsCount: reqs,
  });
  const ipc = EosHarnessTokenEconomicsCore.encodeCompactIpc({
    agentFrom: "planner",
    agentTo: "implementer",
    phase: "EXECUTION",
    status: "OK",
    summary: "Please implement the minimal verified core change successfully",
    changedFiles: ["src/core/eosHarnessTokenEconomicsCore.ts"],
  });

  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:minimal", minimalism: report, ipc }, null, 2));
    return;
  }
  console.log("=== Minimal-Diff Gate & Compact Agent IPC (SPEC-377) ===");
  console.log(`Verdict     : ${report.minimalismVerdict} (${report.linesPerRequirement} lines/req)`);
  console.log(`Compact IPC : ${ipc.compactFrame} (${ipc.savingsPercent}% saved)`);
}

function parseDiffNumstat(rawNumstat) {
  const changedFiles = [];
  let totalLinesAdded = 0;
  let totalLinesDeleted = 0;
  for (const line of rawNumstat.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const added = parts[0] === "-" ? 0 : Number(parts[0]) || 0;
    const deleted = parts[1] === "-" ? 0 : Number(parts[1]) || 0;
    changedFiles.push(parts[2].trim());
    totalLinesAdded += added;
    totalLinesDeleted += deleted;
  }
  return { changedFiles, totalLinesAdded, totalLinesDeleted };
}

function loadBoundaryContract() {
  const customPath = path.join(ROOT, ".eos", "harness-boundary.json");
  if (fs.existsSync(customPath)) {
    try {
      return JSON.parse(fs.readFileSync(customPath, "utf8"));
    } catch {
      // Fallback to default contract on parse failure
    }
  }
  return {
    missionId: "LIVE-GIT-DIFF-SPEC-377",
    allowedPaths: [],
    forbiddenPaths: ["package-lock.json", ".env", ".env.*"],
    maxFilesTouched: 25,
    maxDiffLines: 1500,
    allowTestMutation: true,
  };
}

function collectGitDiffSnapshot(preferUnstaged) {
  const cachedStat = preferUnstaged
    ? ""
    : execFileSync("git", ["diff", "--cached", "--numstat"], { cwd: ROOT, encoding: "utf8" });
  const useStaged = Boolean(cachedStat.trim()) && !preferUnstaged;
  const numstatArgs = useStaged ? ["diff", "--cached", "--numstat"] : ["diff", "--numstat"];
  const patchArgs = useStaged
    ? ["diff", "--cached", "-U0", "--", "*.ts", "*.mjs", "*.js"]
    : ["diff", "-U0", "--", "*.ts", "*.mjs", "*.js"];
  const rawNumstat = useStaged ? cachedStat : execFileSync("git", numstatArgs, { cwd: ROOT, encoding: "utf8" });
  const rawPatch = execFileSync("git", patchArgs, { cwd: ROOT, encoding: "utf8" });
  const addedCodeLines = rawPatch
    .split(/\r?\n/)
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n");
  return {
    diffMode: useStaged ? "staged" : "working-tree",
    changeSet: parseDiffNumstat(rawNumstat),
    addedCodeLines,
  };
}

async function cmdDiff(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const isStrict = args.includes("--strict") && !args.includes("--advisory");
  const preferUnstaged = args.includes("--unstaged");

  const contract = loadBoundaryContract();
  const snapshot = collectGitDiffSnapshot(preferUnstaged);
  const boundary = EosHarnessTokenEconomicsCore.evaluateBoundary(contract, snapshot.changeSet);
  const minimalism = EosHarnessTokenEconomicsCore.evaluateMinimalDiff({
    patchId: `LIVE-DIFF-${snapshot.diffMode.toUpperCase()}`,
    sourceSnippet: snapshot.addedCodeLines,
    linesAdded: snapshot.changeSet.totalLinesAdded,
    requirementsCount: Math.max(1, snapshot.changeSet.changedFiles.length),
  });
  const staticPaths = ["AGENTS.md", ".agents/skills/eos-sdd-pipeline/SKILL.md"]
    .map((rel) => path.join(ROOT, rel))
    .filter((p) => fs.existsSync(p));
  const staticSegments = staticPaths.map((p) => fs.readFileSync(p, "utf8"));
  const promptCache = EosHarnessTokenEconomicsCore.auditCacheAndEconomics({
    sessionId: "LIVE-STATIC-PREFIX-AUDIT",
    staticPrefixSegments: staticSegments.length > 0 ? staticSegments : ["empty"],
    dynamicSuffixSegments: [snapshot.addedCodeLines.slice(0, 2000)],
    turns: 10,
    contextWindowTokens: 128000,
  });

  if (isStrict && boundary.verdict === "HARD_BLOCK") {
    process.exitCode = 1;
  }

  const payload = {
    command: "toolchain:token-econ:diff",
    diffMode: snapshot.diffMode,
    boundary,
    minimalism,
    promptCache,
  };
  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log("=== Live Git-Diff Harness & Token Economics Check (SPEC-377) ===");
  console.log(`Diff Mode    : ${snapshot.diffMode} (${snapshot.changeSet.changedFiles.length} file(s))`);
  console.log(`Boundary     : ${boundary.verdict} (${boundary.violations.length} violation(s))`);
  console.log(`Minimal-Diff : ${minimalism.minimalismVerdict} (${minimalism.findings.length} finding(s))`);
  console.log(`Cache Prefix : ${promptCache.cachePrefixStable ? "STABLE" : "BREAKER_DETECTED"}`);
}

async function cmdAudit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosHarnessTokenEconomicsCore.audit(ROOT);

  if (isJson) {
    console.log(JSON.stringify({ command: "toolchain:token-econ:audit", ...receipt }, null, 2));
    return;
  }
  console.log("=== Formal Audit: Harness Boundaries & Token Economics (SPEC-377) ===");
  console.log(`Status       : ${receipt.status}`);
  console.log(`JSON Savings : ${receipt.sampleMetrics.jsonSavingsPercent}%`);
  console.log(`IPC Savings  : ${receipt.sampleMetrics.ipcSavingsPercent}%`);
  console.log(`Cost Savings : ${receipt.sampleMetrics.sessionCostSavingsPercent}%`);
  console.log(`Receipt Hash : ${receipt.receiptHash}`);
}

const HANDLERS = {
  "toolchain:token-econ:boundary": cmdBoundary,
  "toolchain:token-econ:compress": cmdCompress,
  "toolchain:token-econ:route": cmdRoute,
  "toolchain:token-econ:cache": cmdCache,
  "toolchain:token-econ:minimal": cmdMinimal,
  "toolchain:token-econ:diff": cmdDiff,
  "toolchain:token-econ:audit": cmdAudit,
};

export async function handleHarnessTokenEconomicsCommand(commandContext) {
  const fn = HANDLERS[commandContext.command];
  if (!fn) return false;
  await fn(commandContext);
  return true;
}
