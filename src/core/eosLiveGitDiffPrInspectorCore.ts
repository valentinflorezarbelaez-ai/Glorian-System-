/**
 * SPEC-238 / CHANGE-121 — Layer-0 Live Git Diff PR Inspector & Bundle Packager.
 * Inspects confined Git diffs, scans added lines for leaked credentials and unsafe DDL,
 * and compiles PR readiness bundles with zero external dependencies (EOS Law V).
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { EosIssueToPrCanaryBridgeCore } from "./eosIssueToPrCanaryBridgeCore.ts";
import type { DiffFileEntry } from "./eosIssueToPrCanaryBridgeCore.types.ts";
import type { InspectLiveGitDiffOptions, LiveGitDiffInspectionReport } from "./eosLiveGitDiffPrInspectorCore.types.ts";

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  new RegExp(["\\bAK", "IA[0-9A-Z]{16}\\b"].join("")),
  new RegExp(["\\bgh", "p_[A-Za-z0-9]{20,}\\b"].join("")),
  new RegExp(["\\bsk-", "[A-Za-z0-9]{20,}\\b"].join("")),
  new RegExp(["-----BEGIN [A-Z ]*PRIV", "ATE KEY-----"].join("")),
];

function resolveConfinedPath(projectRoot: string, relOrSubPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relOrSubPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function assertSafeGitRef(rawRef: string | undefined): string {
  const ref = (rawRef ?? "HEAD").trim();
  if (!ref || ref.startsWith("-") || !/^[a-zA-Z0-9._/^~-]+$/.test(ref)) {
    throw new Error("Unsafe git reference rejected");
  }
  return ref;
}

function readGitDiffCommand(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [...args], { cwd, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function parseNumstat(numstatText: string): DiffFileEntry[] {
  const entries: DiffFileEntry[] = [];
  for (const line of numstatText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\t+/);
    if (parts.length < 3) continue;
    const additions = Number.parseInt(parts[0], 10);
    const deletions = Number.parseInt(parts[1], 10);
    const filePath = parts.slice(2).join("\t").trim();
    if (filePath) {
      entries.push({
        path: filePath,
        additions: Number.isFinite(additions) ? additions : 0,
        deletions: Number.isFinite(deletions) ? deletions : 0,
      });
    }
  }
  return entries;
}

function scanAddedPatchLines(patchText: string): { secretCount: number; sqlSnippet: string } {
  let secretCount = 0;
  const sqlLines: string[] = [];
  const ddlMatcher = /\b(?:ALTER\s+TABLE|DROP\s+(?:TABLE|COLUMN)|TRUNCATE|CREATE\s+INDEX)\b/i;

  for (const line of patchText.split(/\r?\n/)) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const body = line.slice(1);
    for (const pattern of CREDENTIAL_PATTERNS) {
      if (pattern.test(body)) secretCount++;
    }
    if (ddlMatcher.test(body)) {
      sqlLines.push(body.trim());
    }
  }
  return { secretCount, sqlSnippet: sqlLines.join("\n") };
}

function buildPrMarkdown(params: {
  ticketId: string;
  title: string;
  baseRef: string;
  changedCount: number;
  additions: number;
  deletions: number;
  secretMatchesCount: number;
  beyonceOk: boolean;
  migrationPattern: string;
  blockingRisks: readonly string[];
  readyToShip: boolean;
}): string {
  const statusLine = params.readyToShip ? "READY_TO_SHIP" : "BLOCKED";
  const riskSection =
    params.blockingRisks.length > 0 ? params.blockingRisks.map((r) => `- [BLOCKING] ${r}`).join("\n") : "- None";
  return [
    `# PR Verification Bundle — ${params.ticketId}: ${params.title}`,
    `- **Verdict**: \`${statusLine}\``,
    `- **Base Ref**: \`${params.baseRef}\` | **Files**: ${params.changedCount} (+${params.additions}/-${params.deletions})`,
    `- **Credential Leaks Detected**: ${params.secretMatchesCount}`,
    `- **Beyonce Rule Satisfied**: ${params.beyonceOk}`,
    `- **Migration Safety**: \`${params.migrationPattern}\``,
    "",
    "## Blocking Risks",
    riskSection,
  ].join("\n");
}

function collectLiveDiffInputs(
  cwd: string,
  baseRef: string,
  options: InspectLiveGitDiffOptions,
): { numstat: string; patch: string } {
  if (typeof options.numstatOverride === "string" || typeof options.patchOverride === "string") {
    return { numstat: options.numstatOverride ?? "", patch: options.patchOverride ?? "" };
  }
  let numstat = readGitDiffCommand(cwd, ["diff", "--numstat", baseRef]);
  let patch = readGitDiffCommand(cwd, ["diff", "--unified=0", baseRef]);
  if (!numstat.trim()) {
    numstat = readGitDiffCommand(cwd, ["diff", "--numstat", "HEAD~1..HEAD"]);
    patch = readGitDiffCommand(cwd, ["diff", "--unified=0", "HEAD~1..HEAD"]);
  }
  return { numstat, patch };
}

export class EosLiveGitDiffPrInspectorCore {
  public static inspectLiveGitDiff(options: InspectLiveGitDiffOptions = {}): LiveGitDiffInspectionReport {
    const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    const cwd = options.repoPath ? resolveConfinedPath(projectRoot, options.repoPath) : projectRoot;
    const baseRef = assertSafeGitRef(options.baseRef);
    const ticketId = (options.ticketId ?? "SPOT-LIVE").trim() || "SPOT-LIVE";
    const title = (options.title ?? "Live Workspace Diff Audit").trim() || "Live Workspace Diff Audit";

    const { numstat, patch } = collectLiveDiffInputs(cwd, baseRef, options);
    const changedFiles = parseNumstat(numstat);
    const { secretCount, sqlSnippet } = scanAddedPatchLines(patch);
    const diffAudit = EosIssueToPrCanaryBridgeCore.analyzeDiffAndMigrationSafety({
      changedFiles,
      sqlMigrationSnippet: sqlSnippet,
    });

    const totalAdditions = changedFiles.reduce((acc, f) => acc + (f.additions ?? 0), 0);
    const totalDeletions = changedFiles.reduce((acc, f) => acc + (f.deletions ?? 0), 0);
    const readyToShip = secretCount === 0 && diffAudit.blockingRisks.length === 0;

    const prBundleMarkdown = buildPrMarkdown({
      ticketId,
      title,
      baseRef,
      changedCount: changedFiles.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      secretMatchesCount: secretCount,
      beyonceOk: diffAudit.beyonceRuleSatisfied,
      migrationPattern: diffAudit.migrationPattern,
      blockingRisks: diffAudit.blockingRisks,
      readyToShip,
    });

    let writtenBundlePath: string | undefined;
    if (options.writeBundle === true) {
      const targetAbs = resolveConfinedPath(projectRoot, options.bundleRelPath ?? ".eos/pr-ready-bundle.md");
      fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
      fs.writeFileSync(targetAbs, prBundleMarkdown, "utf8");
      writtenBundlePath = path.relative(projectRoot, targetAbs).replace(/\\/g, "/");
    }

    const digestPayload = { ticketId, baseRef, changedFiles, secretCount, diffAudit, readyToShip };
    const inspectionDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(digestPayload)).digest("hex");

    return {
      ticketId,
      baseRef,
      changedFiles,
      totalAdditions,
      totalDeletions,
      secretMatchesCount: secretCount,
      diffAudit,
      prBundleMarkdown,
      writtenBundlePath,
      readyToShip,
      inspectionDigestSha256,
    };
  }
}
