/**
 * EOS SYSTEM — Deterministic generated-artifact writer (Layer-0 pure).
 *
 * Big Tech playbook (Bazel/Pants "content-based scheduling"): committed
 * generated artifacts must be byte-stable. A run that produces the same
 * logical content must NOT dirty the working tree. Volatile timestamps are
 * therefore reused from the committed artifact (or derived from its content
 * digest on first creation), and files are only rewritten when the bytes
 * actually change.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface DeterministicArtifactOptions {
  /** Volatile key inside the artifact (e.g. "generatedAt"); found at any depth. */
  readonly stampField?: string;
  /** Deterministic stamp factory used only when the artifact does not exist yet. */
  readonly stampFor?: (contentSha256: string) => string;
}

export interface DeterministicArtifactResult {
  readonly filePath: string;
  readonly changed: boolean;
  readonly bytes: string;
}

/** Depth-first search for the first non-empty string value under `stampField`. */
function findStamp(parsed: unknown, stampField: string): string | null {
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findStamp(item, stampField);
      if (found !== null) return found;
    }
    return null;
  }
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === stampField && typeof record[key] === "string" && record[key].length > 0) {
        return record[key] as string;
      }
      const found = findStamp(record[key], stampField);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Extract the current volatile stamp field from an existing artifact file. */
function readExistingStamp(filePath: string, stampField: string): string | null {
  try {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return findStamp(existing, stampField);
  } catch {
    return null;
  }
}

/**
 * Replace every occurrence of `stampField` in the parsed artifact with `stamp`,
 * preserving the original key order. Supports nested volatile stamps.
 */
function retargetStamps(parsed: unknown, stampField: string, stamp: string): void {
  if (Array.isArray(parsed)) {
    for (const item of parsed) retargetStamps(item, stampField, stamp);
    return;
  }
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === stampField && typeof record[key] === "string") record[key] = stamp;
      else retargetStamps(record[key], stampField, stamp);
    }
  }
}

/**
 * Write a generated JSON artifact deterministically: identical logical content
 * yields byte-identical output and leaves the file untouched.
 */
export function writeDeterministicArtifact(
  filePath: string,
  payload: Record<string, unknown>,
  options: DeterministicArtifactOptions = {}
): DeterministicArtifactResult {
  const { stampField, stampFor } = options;

  let bytes: string;
  if (stampField) {
    const previousStamp = readExistingStamp(filePath, stampField);
    if (previousStamp !== null) {
      // Reuse the committed volatile stamp, but honor the CURRENT payload so a
      // changed logical content is written while an unchanged one stays
      // byte-identical (same payload order + same reused stamp => same bytes).
      const finalized = structuredClone(payload);
      retargetStamps(finalized, stampField, previousStamp);
      bytes = JSON.stringify(finalized, null, 2) + "\n";
    } else {
      const seedSha = crypto.createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
      const stamp = stampFor ? stampFor(seedSha) : new Date().toISOString();
      const finalized = structuredClone(payload);
      retargetStamps(finalized, stampField, stamp);
      bytes = JSON.stringify(finalized, null, 2) + "\n";
    }
  } else {
    bytes = JSON.stringify(payload, null, 2) + "\n";
  }

  let current: string | null = null;
  try {
    current = fs.readFileSync(filePath, "utf8");
  } catch {}

  if (current === bytes) {
    return { filePath, changed: false, bytes };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, bytes, "utf8");
  return { filePath, changed: true, bytes };
}

/**
 * Derive a stable ISO-8601 timestamp from a content digest (a pseudo-random
 * offset over a fixed epoch). Reproducible, with no wall-clock input.
 */
export function contentDerivedIso(contentSha256: string, baseEpochMs: number = 1760000000000): string {
  const offsetMs = Number.parseInt(contentSha256.slice(0, 12), 16) % 86_400_000;
  return new Date(baseEpochMs + offsetMs).toISOString();
}
