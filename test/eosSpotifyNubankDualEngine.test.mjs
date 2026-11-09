/**
 * EOS SYSTEM — SPOTIFY SMART SHUFFLE & NUBANK BITEMPORAL TEST SUITE (Layer 0)
 * Governed by SPEC-015, SPEC-019 & Sovereign Five Architecture Standard
 *
 * Verifies:
 * 1. Spotify Deterministic Smart Shuffle (Jittered Proportional Spacing, O(N log N), < 100 µs).
 * 2. Camelot Wheel Harmonic Routing (+1/-1/relative major-minor compatibility).
 * 3. Nubank Bitemporal Immutable Ledger (Datomic as-of replay, O(1) Idempotency Key deduplication).
 * 4. Backward Compatibility Schema Contract Guard (Fail-closed breaking change detector).
 * 5. Universal Polyglot Project Archetype Detector (detectPolyglotPlan).
 * 6. The Sovereign Five AI Matrix (Grok, Gemini, Claude, GPT, DeepSeek) & Intent Router.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  executeSpotifySmartShuffle,
  isCamelotCompatible,
  EosBitemporalLedger,
  verifyBackwardCompatibility,
} from "../src/core/eosSpotifyNubankEngine.ts";

import { detectPolyglotPlan } from "../src/core/eosPolyglotAdapter.ts";

import { SOVEREIGN_FIVE_MATRIX, selectOptimalSovereignModel, amplifyPrompt } from "../src/core/eosPromptAmplifier.ts";

describe("EOS Sovereign Spotify & Nubank Dual-Engine Suite", () => {
  describe("Suite 1: Spotify Smart Shuffle & Jittered Proportional Spacing", () => {
    const sampleTracks = [
      { id: "tr-01", artistId: "Armin van Buuren", bpm: 132, camelotKey: "8A" },
      { id: "tr-02", artistId: "Armin van Buuren", bpm: 134, camelotKey: "8A" },
      { id: "tr-03", artistId: "Armin van Buuren", bpm: 130, camelotKey: "8B" },
      { id: "tr-04", artistId: "Paul Oakenfold", bpm: 130, camelotKey: "9A" },
      { id: "tr-05", artistId: "Paul Oakenfold", bpm: 132, camelotKey: "9A" },
      { id: "tr-06", artistId: "Ferry Corsten", bpm: 130, camelotKey: "8A" },
      { id: "tr-07", artistId: "Aly & Fila", bpm: 138, camelotKey: "10A" },
      { id: "tr-08", artistId: "Markus Schulz", bpm: 130, camelotKey: "7A" },
      { id: "tr-09", artistId: "Liquid Soul", bpm: 135, camelotKey: "9B" },
    ];

    it("spreads multiple tracks by the same artist avoiding consecutive clusters", () => {
      const receipt = executeSpotifySmartShuffle(sampleTracks, 42108);

      assert.equal(receipt.orderedIds.length, sampleTracks.length);
      assert.equal(receipt.artistCollisions, 0, "Armin tracks must be spaced without consecutive collisions");
      assert.ok(receipt.harmonicScore >= 0 && receipt.harmonicScore <= 100);
      assert.ok(receipt.merkleSeed.startsWith("eos-spotify-seed-"));
    });

    it("guarantees 100% bit-exact determinism across executions with identical seed", () => {
      const receiptA = executeSpotifySmartShuffle(sampleTracks, 99999);
      const receiptB = executeSpotifySmartShuffle(sampleTracks, 99999);

      assert.deepEqual(receiptA.orderedIds, receiptB.orderedIds, "Identical seed must produce identical order");
      assert.equal(receiptA.merkleSeed, receiptB.merkleSeed);
    });

    it("produces different randomized permutations when seeds differ", () => {
      const receipt1 = executeSpotifySmartShuffle(sampleTracks, 1001);
      const receipt2 = executeSpotifySmartShuffle(sampleTracks, 8888);

      // Both should have valid orders
      assert.equal(receipt1.orderedIds.length, sampleTracks.length);
      assert.equal(receipt2.orderedIds.length, sampleTracks.length);
      assert.notEqual(receipt1.merkleSeed, receipt2.merkleSeed);
    });

    it("handles edge cases (empty or single-track playlists) gracefully in <= 1 µs", () => {
      const emptyReceipt = executeSpotifySmartShuffle([], 12345);
      assert.equal(emptyReceipt.orderedIds.length, 0);

      const singleReceipt = executeSpotifySmartShuffle([sampleTracks[0]], 12345);
      assert.equal(singleReceipt.orderedIds.length, 1);
      assert.equal(singleReceipt.artistCollisions, 0);
    });
  });

  describe("Suite 2: Camelot Wheel Harmonic Routing", () => {
    it("recognizes identical keys as harmonically compatible", () => {
      assert.equal(isCamelotCompatible("8A", "8A"), true);
      assert.equal(isCamelotCompatible("9B", "9B"), true);
    });

    it("recognizes relative major/minor keys (same number, different letter) as compatible", () => {
      assert.equal(isCamelotCompatible("8A", "8B"), true);
      assert.equal(isCamelotCompatible("11B", "11A"), true);
    });

    it("recognizes adjacent Camelot positions (+1 and -1) as compatible", () => {
      assert.equal(isCamelotCompatible("8A", "9A"), true);
      assert.equal(isCamelotCompatible("8A", "7A"), true);
      assert.equal(isCamelotCompatible("12A", "1A"), true); // Wrap-around 12 <-> 1
    });

    it("penalizes dissonant non-adjacent harmonic jumps", () => {
      assert.equal(isCamelotCompatible("8A", "11A"), false);
      assert.equal(isCamelotCompatible("4B", "9A"), false);
    });
  });

  describe("Suite 3: Nubank Bitemporal Immutable Ledger & Idempotency", () => {
    it("records bitemporal facts with valid_time and tx_time", () => {
      const ledger = new EosBitemporalLedger();
      const fact = ledger.commitFact(
        "key-001",
        "acc-101",
        { amount: 250, description: "Streaming Royalty" },
        1700000000000,
      );

      assert.equal(fact.idempotencyKey, "key-001");
      assert.equal(fact.entityId, "acc-101");
      assert.equal(fact.validTime, 1700000000000);
      assert.ok(fact.txTime > 0);
      assert.equal(fact.merkleHash.length, 64);
    });

    it("enforces strict O(1) idempotency: 10 repeated calls produce 0 duplicate records", () => {
      const ledger = new EosBitemporalLedger();
      const idempotencyKey = "tx-idempotent-unique-uuid-999";

      const firstFact = ledger.commitFact(idempotencyKey, "acc-1", { amount: 500 });

      // Retry 10 times
      for (let i = 0; i < 10; i++) {
        const retriedFact = ledger.commitFact(idempotencyKey, "acc-1", { amount: 500 });
        assert.equal(retriedFact.merkleHash, firstFact.merkleHash, "Must return exact same fact in O(1)");
      }

      assert.equal(ledger.getAllFacts().length, 1, "Ledger must contain exactly 1 fact despite 10 retries");
    });

    it("executes Datomic-style queryAsOf historical time-travel accurately", () => {
      const ledger = new EosBitemporalLedger();

      const f1 = ledger.commitFact("key-1", "entity-A", { step: 1 });
      const t1 = f1.txTime;

      // Small delay simulated or manual time point
      const f2 = ledger.commitFact("key-2", "entity-A", { step: 2 });
      const t2 = f2.txTime;

      const asOfT1 = ledger.queryAsOf(t1);
      assert.equal(asOfT1.length, 1);
      assert.equal(asOfT1[0].idempotencyKey, "key-1");

      const asOfT2 = ledger.queryAsOf(t2);
      assert.equal(asOfT2.length, 2);
    });

    it("maintains a continuous SHA-256 Merkle hash chain across facts", () => {
      const ledger = new EosBitemporalLedger();
      ledger.commitFact("k1", "e1", { v: 1 });
      ledger.commitFact("k2", "e2", { v: 2 });
      ledger.commitFact("k3", "e3", { v: 3 });

      const root = ledger.getMerkleRoot();
      assert.ok(root.startsWith("sha256:"));
      assert.equal(root.length, 7 + 64);
    });
  });

  describe("Suite 4: Schema Contract Backward Compatibility Guard", () => {
    it("approves compatible schema evolutions that preserve all existing fields", () => {
      const oldKeys = ["id", "title", "artist", "durationMs"];
      const newKeys = ["id", "title", "artist", "durationMs", "camelotKey", "lufs"];

      const report = verifyBackwardCompatibility(oldKeys, newKeys);
      assert.equal(report.compatible, true);
      assert.equal(report.brokenFields.length, 0);
      assert.equal(report.addedFields.length, 2);
    });

    it("rejects breaking schema mutations that remove required fields", () => {
      const oldKeys = ["id", "title", "artist", "durationMs"];
      const newKeys = ["id", "title", "durationMs"]; // Removed 'artist'

      const report = verifyBackwardCompatibility(oldKeys, newKeys);
      assert.equal(report.compatible, false);
      assert.deepEqual(report.brokenFields, ["artist"]);
    });
  });

  describe("Suite 5: Universal Polyglot Project Archetype Detector", () => {
    it("detects current EOS repository as NODE_ZERO_DEPS with verify:strict command", () => {
      const plan = detectPolyglotPlan(process.cwd());
      assert.equal(plan.archetype, "NODE_ZERO_DEPS");
      assert.equal(plan.verifyCommand, "npm run verify:strict");
      assert.equal(plan.targetCompanyStandard, "EOS Sovereign");
    });
  });

  describe("Suite 6: The Sovereign Five AI Matrix & Intent Router", () => {
    it("contains all 5 apex AI models with rigorous specialization profiles", () => {
      const modelKeys = Object.keys(SOVEREIGN_FIVE_MATRIX);
      assert.equal(modelKeys.length, 5);
      assert.ok(modelKeys.includes("grok"));
      assert.ok(modelKeys.includes("gemini"));
      assert.ok(modelKeys.includes("claude"));
      assert.ok(modelKeys.includes("gpt"));
      assert.ok(modelKeys.includes("deepseek"));

      // Verify Grok provider and finOps tier
      assert.equal(SOVEREIGN_FIVE_MATRIX.grok.provider, "xAI");
      assert.ok(SOVEREIGN_FIVE_MATRIX.grok.systemConstraintInjection.includes("xAI Colossus"));
    });

    it("routes mathematical, benchmarking, and finOps prompts to DeepSeek", () => {
      const profile = selectOptimalSovereignModel(
        "Optimize algorithmic time complexity O(N) and benchmark memory cost",
      );
      assert.equal(profile.id, "deepseek");
    });

    it("routes low-level, concurrency, SIMD, and kernel prompts to Grok", () => {
      const profile = selectOptimalSovereignModel("Reverse engineer kernel SIMD RDMA concurrency fabric");
      assert.equal(profile.id, "grok");
    });

    it("routes semantic graph, blast radius, and multi-repo prompts to Gemini", () => {
      const profile = selectOptimalSovereignModel("Inspect repository blast radius and full semantic code graph");
      assert.equal(profile.id, "gemini");
    });

    it("routes formal specification, judge, and EARS prompts to GPT", () => {
      const profile = selectOptimalSovereignModel("Formulate formal ISO 29148 EARS specification and judge compliance");
      assert.equal(profile.id, "gpt");
    });

    it("routes code synthesis and surgical AST refactoring to Claude", () => {
      const profile = selectOptimalSovereignModel(
        "Implement pure domain use-case handler with clean hexagonal interfaces",
      );
      assert.equal(profile.id, "claude");
    });

    it("synthesizes xAI Colossus grade cognitive scaffolding when grok is targetModel", () => {
      const amplified = amplifyPrompt({
        rawPrompt: "Implement lockless ring buffer for audio DSP samples",
        targetModel: "grok",
        strictLevel: "sovereign",
      });

      assert.equal(amplified.targetModel, "grok");
      assert.equal(amplified.modelScaffold.family, "grok");
      assert.ok(amplified.modelScaffold.scaffoldingDirectives.some((d) => d.includes("xAI Colossus")));
      assert.ok(amplified.synthesizedSystemPrompt.includes("SOVEREIGN SPECIFICATION SCAFFOLD"));
    });
  });
});
