/**
 * @file cliHarnessTokenEconomics.mjs
 * @description CLI handler for SPEC-377 / CHANGE-239: Harness Boundaries,
 * Structured Token Economics & Deterministic Decision Router Engine.
 */

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
  "toolchain:token-econ:audit": cmdAudit,
};

export async function handleHarnessTokenEconomicsCommand(commandContext) {
  const fn = HANDLERS[commandContext.command];
  if (!fn) return false;
  await fn(commandContext);
  return true;
}
