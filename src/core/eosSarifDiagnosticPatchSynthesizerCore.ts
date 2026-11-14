/**
 * SPEC-242 / CHANGE-122 — Layer-0 SARIF 2.1.0 & Unified Patch Synthesizer Core.
 * Emits standards-compliant OASIS SARIF 2.1.0 diagnostics, unified diff patch hunks,
 * and path-confined disk exports under projectRoot with zero external dependencies.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  DiagnosticFindingInput,
  SarifDocument210,
  SarifFixDescriptor,
  SarifResultEntry,
  SarifSynthesisReport,
  SynthesizeSarifOptions,
} from "./eosSarifDiagnosticPatchSynthesizerCore.types.ts";

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const rootAbs = path.resolve(projectRoot);
  const targetAbs = path.resolve(rootAbs, relPath);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal outside projectRoot is forbidden");
  }
  return targetAbs;
}

function normalizePosixUri(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function buildResultAndHunk(finding: DiagnosticFindingInput): { result: SarifResultEntry; hunk?: string } {
  const uri = normalizePosixUri(finding.filePath);
  const startLine = Math.max(1, Math.trunc(finding.startLine ?? 1));
  const startColumn = Math.max(1, Math.trunc(finding.startColumn ?? 1));
  const hasPatch = typeof finding.originalLine === "string" && typeof finding.replacementLine === "string";

  const fixes: SarifFixDescriptor[] | undefined = hasPatch
    ? [
        {
          description: { text: `Apply automated fix for ${finding.ruleId}` },
          artifactChanges: [
            {
              artifactLocation: { uri },
              replacements: [
                {
                  deletedRegion: { startLine, startColumn: 1 },
                  insertedContent: { text: finding.replacementLine as string },
                },
              ],
            },
          ],
        },
      ]
    : undefined;

  const result: SarifResultEntry = {
    ruleId: finding.ruleId,
    level: finding.level,
    message: { text: finding.message },
    locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine, startColumn } } }],
    ...(fixes ? { fixes } : {}),
  };

  const hunk = hasPatch
    ? `--- a/${uri}\n+++ b/${uri}\n@@ -${startLine},1 +${startLine},1 @@\n-${finding.originalLine}\n+${finding.replacementLine}`
    : undefined;

  return { result, hunk };
}

export class EosSarifDiagnosticPatchSynthesizerCore {
  static synthesizeSarifAndPatches(options: SynthesizeSarifOptions): SarifSynthesisReport {
    const rootAbs = path.resolve(options.projectRoot ?? process.cwd());
    const outputRelPath = options.outputRelPath ?? ".eos/glorian-ship.sarif.json";
    const resolvedOutput = options.writeSarifToDisk ? resolveConfinedPath(rootAbs, outputRelPath) : undefined;

    const runTitle = (options.runTitle ?? "Glorian System SARIF 2.1.0 Inspection").trim();
    const rulesMap = new Map<string, { readonly id: string; readonly shortDescription: { readonly text: string } }>();
    const results: SarifResultEntry[] = [];
    const hunks: string[] = [];

    for (const f of options.findings) {
      if (!rulesMap.has(f.ruleId)) {
        rulesMap.set(f.ruleId, { id: f.ruleId, shortDescription: { text: f.message } });
      }
      const built = buildResultAndHunk(f);
      results.push(built.result);
      if (built.hunk) hunks.push(built.hunk);
    }

    const sarifDocument: SarifDocument210 = {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Glorian-System",
              version: "75.0.0",
              rules: [...rulesMap.values()],
            },
          },
          results,
        },
      ],
    };

    const synthesizedUnifiedDiff = hunks.join("\n");
    if (resolvedOutput) {
      fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
      fs.writeFileSync(resolvedOutput, JSON.stringify(sarifDocument, null, 2) + "\n", "utf8");
    }

    const errorCount = results.filter((r) => r.level === "error").length;
    const warningCount = results.filter((r) => r.level === "warning").length;
    const digestPayload = {
      runTitle,
      totalResults: results.length,
      errorCount,
      warningCount,
      sarifDocument,
      synthesizedUnifiedDiff,
    };
    const sarifDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(digestPayload)).digest("hex");

    return deepFreeze({
      ...digestPayload,
      ...(resolvedOutput ? { writtenSarifPath: resolvedOutput } : {}),
      sarifDigestSha256,
    });
  }
}
