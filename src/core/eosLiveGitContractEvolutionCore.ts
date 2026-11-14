/**
 * SPEC-244 / CHANGE-123 — Layer-0 Live Git Contract Evolution Core.
 * Compares live modified TypeScript source files on disk against their baseline
 * revisions in Git (`git show <baseRef>:<path>`) to catch breaking API evolution.
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import { EosApiContractSemanticDiffCore } from "./eosApiContractSemanticDiffCore.ts";
import type { ApiContractDiffReport, SemverBumpLevel } from "./eosApiContractSemanticDiffCore.types.ts";
import type {
  AuditLiveGitContractsOptions,
  ContractFilePairOverride,
  LiveGitContractEvolutionReport,
} from "./eosLiveGitContractEvolutionCore.types.ts";

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

function runGitSafe(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [...args], {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function collectLiveFilePairs(repoAbs: string, baseRef: string): readonly ContractFilePairOverride[] {
  const changedRaw = runGitSafe(repoAbs, ["diff", "--name-only", baseRef]);
  const tsPaths = changedRaw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, "/"))
    .filter((p) => p.startsWith("src/") && p.endsWith(".ts") && !p.endsWith(".d.ts"));

  return tsPaths.map((relPath) => {
    const baselineSource = runGitSafe(repoAbs, ["show", `${baseRef}:${relPath}`]);
    const diskAbs = resolveConfinedPath(repoAbs, relPath);
    const candidateSource = fs.existsSync(diskAbs) ? fs.readFileSync(diskAbs, "utf8") : "";
    return { filePath: relPath, baselineSource, candidateSource };
  });
}

function aggregateSemverBump(reports: readonly ApiContractDiffReport[]): SemverBumpLevel {
  if (reports.some((r) => r.semverBumpRequired === "MAJOR")) return "MAJOR";
  if (reports.some((r) => r.semverBumpRequired === "MINOR")) return "MINOR";
  return "PATCH";
}

export class EosLiveGitContractEvolutionCore {
  static auditLiveGitContracts(options: AuditLiveGitContractsOptions = {}): LiveGitContractEvolutionReport {
    const rootAbs = path.resolve(options.projectRoot ?? process.cwd());
    const repoAbs = resolveConfinedPath(rootAbs, options.repoPath ?? ".");
    const baseRef = assertSafeGitRef(options.baseRef);

    const pairs = options.filePairsOverride ?? collectLiveFilePairs(repoAbs, baseRef);
    const fileReports = pairs.map((pair) =>
      EosApiContractSemanticDiffCore.compareContracts({
        contractId: pair.filePath,
        baselineSource: pair.baselineSource,
        candidateSource: pair.candidateSource,
      }),
    );

    const totalBreakingChanges = fileReports.reduce((sum, r) => sum + r.breakingChanges.length, 0);
    const totalAdditiveChanges = fileReports.reduce((sum, r) => sum + r.additiveChanges.length, 0);
    const backwardCompatible = totalBreakingChanges === 0;
    const overallSemverBump = aggregateSemverBump(fileReports);
    const adviceSet = new Set<string>();
    for (const report of fileReports) {
      for (const line of report.expandAndContractAdvice) adviceSet.add(line);
    }

    const payload = {
      baseRef,
      filesAuditedCount: fileReports.length,
      totalBreakingChanges,
      totalAdditiveChanges,
      backwardCompatible,
      overallSemverBump,
      fileReports,
      expandAndContractAdvice: [...adviceSet],
    };
    const evolutionDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return deepFreeze({ ...payload, evolutionDigestSha256 });
  }
}
