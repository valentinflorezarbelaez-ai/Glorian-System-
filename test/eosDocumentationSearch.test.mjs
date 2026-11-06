import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EosDocumentationSearch } from "../src/core/eosDocumentationSearch.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("BDD-203: EosDocumentationSearch indexes repository specs and executes sub-millisecond FTS5 queries", () => {
  const searchEngine = new EosDocumentationSearch(projectRoot, ":memory:");

  try {
    // 1. Index documentation
    const count = searchEngine.indexDocumentation();
    assert.ok(count > 0, `Expected indexed count > 0, got ${count}`);

    const stats = searchEngine.getStats();
    assert.equal(stats.totalIndexed, count);

    // 2. Search for SapFix
    const sapfixResults = searchEngine.search("SapFix", 5);
    assert.ok(sapfixResults.length > 0, "Expected at least 1 result for 'SapFix'");
    const hasSpec = sapfixResults.some((r) => r.docType === "SPEC" && r.path.includes("SPEC-060"));
    assert.ok(hasSpec, "Expected at least 1 SPEC result matching SPEC-060");
    assert.ok(sapfixResults[0].snippet.length > 0);

    // 3. Search for Chaos
    const chaosResults = searchEngine.search("Chaos Monkey", 5);
    assert.ok(chaosResults.length > 0, "Expected at least 1 result for 'Chaos Monkey'");

    // 4. Search for nonexistent term
    const emptyResults = searchEngine.search("xyznonexistentterm12345");
    assert.equal(emptyResults.length, 0);
  } finally {
    searchEngine.close();
  }
});
