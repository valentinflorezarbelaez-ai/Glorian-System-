/**
 * Path containment helpers shared by MCP tool handlers.
 *
 * Every caller-supplied path is resolved against the project root and checked
 * with a relative-path test (not `startsWith`, which accepts sibling prefixes).
 */

import fs from "node:fs";
import path from "node:path";

import { EosDurableSqliteLedger } from "../core/eosDurableSqliteLedger.ts";

export const MAX_MCP_READ_FILE_BYTES = 1024 * 1024;

export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function resolveConfinedLedgerPath(projectRoot: string, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return EosDurableSqliteLedger.defaultLedgerPath(projectRoot);
  }
  if (value === ":memory:") {
    return ":memory:";
  }
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 4096) {
    throw new TypeError("databasePath must be a string no longer than 4096 UTF-8 bytes.");
  }
  const root = fs.realpathSync(projectRoot);
  const candidate = path.resolve(root, value);
  if (!isPathWithin(root, candidate)) {
    throw new Error("Requested ledger databasePath is outside the configured project root.");
  }
  return candidate;
}

export function resolveProjectPath(
  projectRoot: string,
  value: unknown,
  kind: "file" | "directory",
  defaultPath?: string,
): string {
  const requested = value === undefined || value === null || value === "" ? defaultPath : value;
  if (typeof requested !== "string" || Buffer.byteLength(requested, "utf8") > 4096) {
    throw new TypeError("A local path must be a string no longer than 4096 UTF-8 bytes.");
  }
  const root = fs.realpathSync(projectRoot);
  const candidate = path.resolve(root, requested);
  if (!isPathWithin(root, candidate)) throw new Error("Requested path is outside the configured project root.");
  const realPath = fs.realpathSync(candidate);
  if (!isPathWithin(root, realPath)) throw new Error("Requested path resolves outside the configured project root.");
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error("Symbolic-link targets are not accepted by this MCP operation.");
  if (kind === "file" && !stat.isFile()) throw new Error("Requested path is not a regular file.");
  if (kind === "directory" && !stat.isDirectory()) throw new Error("Requested path is not a directory.");
  if (kind === "file" && stat.size > MAX_MCP_READ_FILE_BYTES) {
    throw new RangeError("MCP file reads are limited to 1 MiB.");
  }
  return realPath;
}
