/**
 * SPEC-250 / CHANGE-125 — Layer-0 CLI Catalog Parity & Module Headroom Governor.
 * Verifies 1:1 parity between registered CLI handlers and interactive help catalogs,
 * and enforces line-count headroom across src/, bin/, and scripts/.
 */

import fs from "node:fs";
import path from "node:path";
import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  CliCatalogHygieneAuditInput,
  CliCatalogHygieneAuditReport,
  CliCatalogHygieneVerdict,
  ModuleHeadroomRecord,
  ModuleLineCountInput,
} from "./eosCliCatalogAndHygieneGovernorCore.types.ts";

const INTERNAL_HELP_ALIASES = new Set(["help", "--help", "-h", "__default__"]);
const DEFAULT_HARD_LIMIT_LINES = 800;
const DEFAULT_MIN_HEADROOM_LINES = 12;
const DEFAULT_SCAN_DIRS = ["src", "bin", "scripts"] as const;

function resolveConfinedPath(projectRoot: string, relPath: string): string {
  const resolvedRoot = path.resolve(projectRoot);
  if (path.isAbsolute(relPath)) {
    throw new Error(`Path traversal outside projectRoot is forbidden: ${relPath}`);
  }
  const candidate = path.resolve(resolvedRoot, relPath);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path traversal outside projectRoot is forbidden: ${relPath}`);
  }
  return candidate;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCommandTokenPresent(text: string, command: string): boolean {
  if (!text || !command) return false;
  const escaped = escapeRegexLiteral(command);
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9_:-])${escaped}(?=$|[^A-Za-z0-9_:-])`);
  return pattern.test(text);
}

function extractCommandsFromDirectory(commandsDir: string): readonly string[] {
  if (!fs.existsSync(commandsDir)) return [];
  const entries = fs.readdirSync(commandsDir, { withFileTypes: true });
  const commands = new Set<string>();
  const handlerRegex = /HANDLERS\["([^"]+)"\]/g;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
    const raw = fs.readFileSync(path.join(commandsDir, entry.name), "utf8");
    let match = handlerRegex.exec(raw);
    while (match !== null) {
      const cmd = match[1];
      if (!INTERNAL_HELP_ALIASES.has(cmd)) {
        commands.add(cmd);
      }
      match = handlerRegex.exec(raw);
    }
    handlerRegex.lastIndex = 0;
  }
  return [...commands].sort();
}

function walkModuleFiles(dirPath: string, rootDir: string, out: ModuleLineCountInput[]): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkModuleFiles(fullPath, rootDir, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".mjs")) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    const lineCount = content.split(/\r?\n/).length;
    out.push({
      filePath: path.relative(rootDir, fullPath).replace(/\\/g, "/"),
      lineCount,
    });
  }
}

function classifyModuleHeadroom(
  entries: readonly ModuleLineCountInput[],
  hardLimitLines: number,
  minRequiredHeadroomLines: number,
): {
  readonly records: readonly ModuleHeadroomRecord[];
  readonly nearCeilingModules: readonly ModuleHeadroomRecord[];
  readonly breachedModules: readonly ModuleHeadroomRecord[];
  readonly maxLinesObserved: number;
  readonly minHeadroomLines: number;
} {
  const records: ModuleHeadroomRecord[] = [];
  const nearCeilingModules: ModuleHeadroomRecord[] = [];
  const breachedModules: ModuleHeadroomRecord[] = [];
  let maxLinesObserved = 0;

  for (const item of entries) {
    const headroomLines = hardLimitLines - item.lineCount;
    if (item.lineCount > maxLinesObserved) maxLinesObserved = item.lineCount;
    const status: ModuleHeadroomRecord["status"] =
      item.lineCount > hardLimitLines
        ? "CEILING_BREACH"
        : headroomLines < minRequiredHeadroomLines
          ? "NEAR_CEILING_WARNING"
          : "HEALTHY";
    const record: ModuleHeadroomRecord = {
      filePath: item.filePath,
      lineCount: item.lineCount,
      headroomLines,
      status,
    };
    records.push(record);
    if (status === "CEILING_BREACH") breachedModules.push(record);
    if (status === "NEAR_CEILING_WARNING") nearCeilingModules.push(record);
  }

  const sortedDesc = [...records].sort((a, b) => b.lineCount - a.lineCount || a.filePath.localeCompare(b.filePath));
  const minHeadroomLines = hardLimitLines - maxLinesObserved;
  return {
    records: sortedDesc,
    nearCeilingModules,
    breachedModules,
    maxLinesObserved,
    minHeadroomLines,
  };
}

function resolveAuditInputs(input: CliCatalogHygieneAuditInput, projectRoot: string) {
  const commandsDir = resolveConfinedPath(projectRoot, input.cliCommandsDirRelPath ?? "bin/commands");
  const helpCatalogPath = resolveConfinedPath(
    projectRoot,
    input.helpCatalogRelPath ?? "bin/commands/cliHelpCatalog.mjs",
  );
  const devGuidePath = resolveConfinedPath(projectRoot, input.developerGuideRelPath ?? "docs/DEVELOPER_GUIDE.md");

  const registeredCommands = input.registeredCommands
    ? [...new Set(input.registeredCommands)].filter((c) => !INTERNAL_HELP_ALIASES.has(c)).sort()
    : extractCommandsFromDirectory(commandsDir);
  const helpCatalogText =
    input.helpCatalogText ?? (fs.existsSync(helpCatalogPath) ? fs.readFileSync(helpCatalogPath, "utf8") : "");
  const developerGuideText =
    input.developerGuideText ?? (fs.existsSync(devGuidePath) ? fs.readFileSync(devGuidePath, "utf8") : "");

  const moduleEntries: ModuleLineCountInput[] = input.moduleLineCounts ? [...input.moduleLineCounts] : [];
  if (!input.moduleLineCounts) {
    const dirs = input.scanDirectories ?? DEFAULT_SCAN_DIRS;
    for (const relDir of dirs) {
      walkModuleFiles(resolveConfinedPath(projectRoot, relDir), projectRoot, moduleEntries);
    }
  }
  return { registeredCommands, helpCatalogText, developerGuideText, moduleEntries };
}

export class EosCliCatalogAndHygieneGovernorCore {
  static auditCliCatalogAndModuleHeadroom(input: CliCatalogHygieneAuditInput = {}): CliCatalogHygieneAuditReport {
    const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
    const hardLimitLines = input.hardLimitLines ?? DEFAULT_HARD_LIMIT_LINES;
    const minRequiredHeadroomLines = input.minRequiredHeadroomLines ?? DEFAULT_MIN_HEADROOM_LINES;

    const { registeredCommands, helpCatalogText, developerGuideText, moduleEntries } = resolveAuditInputs(
      input,
      projectRoot,
    );

    const missingFromHelpCatalog: string[] = [];
    let developerGuideDocumentedCount = 0;
    for (const cmd of registeredCommands) {
      if (!isCommandTokenPresent(helpCatalogText, cmd)) missingFromHelpCatalog.push(cmd);
      if (isCommandTokenPresent(developerGuideText, cmd)) developerGuideDocumentedCount += 1;
    }

    const totalCommandsRegistered = registeredCommands.length;
    const catalogedCommandsCount = totalCommandsRegistered - missingFromHelpCatalog.length;
    const catalogCoverageRatio =
      totalCommandsRegistered === 0 ? 1 : Number((catalogedCommandsCount / totalCommandsRegistered).toFixed(4));

    const headroom = classifyModuleHeadroom(moduleEntries, hardLimitLines, minRequiredHeadroomLines);
    const verdict: CliCatalogHygieneVerdict =
      headroom.breachedModules.length > 0
        ? "HYGIENE_BREACH"
        : headroom.nearCeilingModules.length > 0 || missingFromHelpCatalog.length > 0
          ? "HYGIENE_WARNING"
          : "HYGIENE_GOVERNED";

    const digestPayload = {
      verdict,
      hardLimitLines,
      minRequiredHeadroomLines,
      totalCommandsRegistered,
      catalogedCommandsCount,
      missingFromHelpCatalog,
      totalModulesScanned: headroom.records.length,
      maxLinesObserved: headroom.maxLinesObserved,
      minHeadroomLines: headroom.minHeadroomLines,
    };

    return deepFreeze({
      verdict,
      hardLimitLines,
      minRequiredHeadroomLines,
      totalCommandsRegistered,
      catalogedCommandsCount,
      catalogCoverageRatio,
      missingFromHelpCatalog,
      developerGuideDocumentedCount,
      totalModulesScanned: headroom.records.length,
      maxLinesObserved: headroom.maxLinesObserved,
      minHeadroomLines: headroom.minHeadroomLines,
      nearCeilingModules: headroom.nearCeilingModules,
      breachedModules: headroom.breachedModules,
      topLargestModules: headroom.records.slice(0, 10),
      sha256Receipt: pureSha256(JSON.stringify(digestPayload)),
    });
  }
}
