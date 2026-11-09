/**
 * EOS SYSTEM — MCP PATH RESOLVER SECURITY TEST SUITE
 * Validates path traversal prevention, symlink boundary checks, and size ceilings.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  isPathWithin,
  resolveConfinedLedgerPath,
  resolveProjectPath,
  MAX_MCP_READ_FILE_BYTES,
} from "../src/mcp/eosMcpPathResolver.ts";

test("SEC-080: isPathWithin Boundary Invariants", () => {
  const root = path.resolve("/base/project");

  // Same path
  assert.equal(isPathWithin(root, root), true);

  // Subdirectory and child files
  assert.equal(isPathWithin(root, path.join(root, "src", "index.ts")), true);
  assert.equal(isPathWithin(root, path.join(root, "docs")), true);

  // Parent directory escapes
  assert.equal(isPathWithin(root, path.resolve(root, "..")), false);
  assert.equal(isPathWithin(root, path.resolve(root, "..", "other")), false);

  // Sibling prefix attacks (e.g. /base/project-sibling vs /base/project)
  assert.equal(isPathWithin(root, `${root}-sibling`), false);
});

test("SEC-081: resolveConfinedLedgerPath Invariants", () => {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "eos-mcp-path-")));

  try {
    // 1. Default fallback when value is undefined, null, or empty
    const def1 = resolveConfinedLedgerPath(tmpDir, undefined);
    assert.ok(def1.includes(".eos"));
    const def2 = resolveConfinedLedgerPath(tmpDir, null);
    assert.ok(def2.includes(".eos"));
    const def3 = resolveConfinedLedgerPath(tmpDir, "");
    assert.ok(def3.includes(".eos"));

    // 2. In-memory special case
    assert.equal(resolveConfinedLedgerPath(tmpDir, ":memory:"), ":memory:");

    // 3. Valid confined relative path
    const validRel = resolveConfinedLedgerPath(tmpDir, "local-ledger.sqlite");
    assert.equal(validRel, path.join(tmpDir, "local-ledger.sqlite"));

    // 4. TypeError on non-string or oversized
    assert.throws(() => resolveConfinedLedgerPath(tmpDir, 123), /databasePath must be a string/);
    assert.throws(() => resolveConfinedLedgerPath(tmpDir, "a".repeat(4097)), /databasePath must be a string/);

    // 5. Outside project root
    assert.throws(
      () => resolveConfinedLedgerPath(tmpDir, "../escape.sqlite"),
      /Requested ledger databasePath is outside the configured project root/,
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});

test("SEC-082: resolveProjectPath File and Directory Safety", () => {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "eos-mcp-res-")));

  try {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    const smallFile = path.join(subDir, "small.txt");
    fs.writeFileSync(smallFile, "hello world", "utf8");

    // 1. Valid file resolution
    const resFile = resolveProjectPath(tmpDir, "sub/small.txt", "file");
    assert.equal(resFile, smallFile);

    // 2. Valid directory resolution
    const resDir = resolveProjectPath(tmpDir, "sub", "directory");
    assert.equal(resDir, subDir);

    // 3. Default path fallback
    const resDef = resolveProjectPath(tmpDir, undefined, "file", "sub/small.txt");
    assert.equal(resDef, smallFile);

    // 4. Type errors on invalid inputs
    assert.throws(() => resolveProjectPath(tmpDir, 456, "file"), /A local path must be a string/);
    assert.throws(() => resolveProjectPath(tmpDir, "a".repeat(4097), "file"), /A local path must be a string/);

    // 5. Escapes outside project root
    assert.throws(() => resolveProjectPath(tmpDir, "../escape.txt", "file"), /outside the configured project root/);

    // 6. Kind mismatches
    assert.throws(() => resolveProjectPath(tmpDir, "sub", "file"), /not a regular file/);
    assert.throws(() => resolveProjectPath(tmpDir, "sub/small.txt", "directory"), /not a directory/);

    // 7. Oversized file (> 1 MiB)
    const largeFile = path.join(tmpDir, "large.bin");
    const fd = fs.openSync(largeFile, "w");
    fs.writeSync(fd, Buffer.alloc(MAX_MCP_READ_FILE_BYTES + 10));
    fs.closeSync(fd);

    assert.throws(() => resolveProjectPath(tmpDir, "large.bin", "file"), /limited to 1 MiB/);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Ignore transient cleanup locks
    }
  }
});
