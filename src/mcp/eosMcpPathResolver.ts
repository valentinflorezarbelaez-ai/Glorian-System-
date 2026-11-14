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
export const MAX_MCP_REQUEST_BYTES = 1024 * 1024;
const MAX_MCP_STRING_BYTES = 256 * 1024;
const MAX_MCP_NESTING_DEPTH = 24;
const MAX_MCP_VALUE_COUNT = 20_000;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateBoundedJson(value: unknown): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let visited = 0;

  while (pending.length > 0) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > MAX_MCP_VALUE_COUNT) throw new RangeError("MCP arguments exceed the item-count limit.");
    if (current.depth > MAX_MCP_NESTING_DEPTH) throw new RangeError("MCP arguments exceed the nesting-depth limit.");

    if (typeof current.value === "string") {
      if (Buffer.byteLength(current.value, "utf8") > MAX_MCP_STRING_BYTES) {
        throw new RangeError("An MCP string argument exceeds the 256 KiB limit.");
      }
      continue;
    }
    if (current.value === null || typeof current.value === "boolean") continue;
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) throw new TypeError("MCP numeric arguments must be finite.");
      continue;
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_MCP_VALUE_COUNT)
        throw new RangeError("An MCP array exceeds the item-count limit.");
      for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (isPlainRecord(current.value)) {
      for (const [key, child] of Object.entries(current.value)) {
        if (Buffer.byteLength(key, "utf8") > 1024) throw new RangeError("An MCP object key exceeds the 1 KiB limit.");
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
          throw new TypeError("MCP arguments cannot contain prototype-control keys.");
        }
        pending.push({ value: child, depth: current.depth + 1 });
      }
      continue;
    }
    throw new TypeError("MCP arguments must contain JSON values only.");
  }
}

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
