/**
 * Fleet RAG Golden Path — hermetic hybrid retrieval BDD
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  runFleetRagGoldenPath,
  EosFleetRagGoldenPath,
  DEFAULT_FLEET_RAG_CORPUS
} from "../src/core/eosFleetRagGoldenPath.ts";

test("BDD-RAG-001: Biblioteca-shaped query retrieves sacred-text fixture", () => {
  const result = runFleetRagGoldenPath("Pistis Sophia light repentance Biblioteca");
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.epistemicState, "FLEET_RAG_GOLDEN_PATH_WITHIN_TESTED_SCOPE");
  assert.match(result.sha256Receipt, /^[a-f0-9]{64}$/);
  assert.ok(result.hits.length >= 1);
  assert.ok(result.hits.some((h) => h.id.includes("pistis") || /sophia|light/i.test(h.snippet)));
  assert.ok(result.corpusSize >= DEFAULT_FLEET_RAG_CORPUS.length);
});

test("BDD-RAG-002: Spotify Golden Path query retrieves platform fixture", () => {
  const result = EosFleetRagGoldenPath.run("Backstage Golden Paths Soundcheck fleet templates");
  assert.equal(result.status, "SUCCESS");
  assert.ok(result.hits.some((h) => /golden|backstage|soundcheck/i.test(h.snippet + h.title)));
});

test("BDD-RAG-003: Empty query fail-closed", () => {
  const result = runFleetRagGoldenPath("   ");
  assert.equal(result.status, "FAILED");
  assert.equal(result.epistemicState, "BLOCKED");
  assert.equal(result.failingReason, "EMPTY_QUERY");
  assert.equal(result.hits.length, 0);
});

test("BDD-RAG-004: Unknown topic with empty custom corpus fails closed", () => {
  const result = runFleetRagGoldenPath("zzzz-no-match-token-xyz", {
    corpus: [{ id: "only", title: "Only", text: "alpha beta gamma", source: "t" }],
    topK: 3
  });
  assert.equal(result.status, "FAILED");
  assert.equal(result.failingReason, "NO_RETRIEVAL_HITS");
});
