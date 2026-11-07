import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosAcousticFeatureStore } from "../src/core/eosAcousticFeatureStore.ts";

describe("EOS Sovereign Acoustic Feature Store Suite (SPEC-018)", () => {
  it("initializes and handles empty user history gracefully", () => {
    const store = new EosAcousticFeatureStore();
    const profile = store.computeTasteCentroid("user-new");
    assert.equal(profile.userId, "user-new");
    assert.equal(profile.totalListens, 0);
    assert.equal(profile.skipRate, 0.0);
    assert.equal(profile.centroid.energy, 0.5);
  });

  it("adapts taste centroid towards repeatedly listened acoustic features", () => {
    const store = new EosAcousticFeatureStore();
    const energeticTrack = {
      tempo: 0.8,
      energy: 0.9,
      danceability: 0.85,
      valence: 0.75,
      acousticness: 0.1,
      instrumentalness: 0.05,
      liveness: 0.2,
      speechiness: 0.1,
    };

    // User listens to 3 high-energy tracks fully
    store.recordListen("user-dance", "track-edm-1", energeticTrack, 210, 210);
    store.recordListen("user-dance", "track-edm-2", energeticTrack, 195, 200);
    store.recordListen("user-dance", "track-edm-3", energeticTrack, 220, 220);

    const profile = store.computeTasteCentroid("user-dance");
    assert.equal(profile.totalListens, 3);
    assert.equal(profile.totalSkips, 0);
    assert.equal(profile.skipRate, 0.0);
    assert.ok(profile.centroid.energy > 0.85);
    assert.ok(profile.centroid.danceability > 0.8);
  });

  it("penalizes skipped tracks and increases skip rate", () => {
    const store = new EosAcousticFeatureStore();
    const acousticTrack = {
      tempo: 0.4,
      energy: 0.2,
      danceability: 0.3,
      valence: 0.3,
      acousticness: 0.9,
      instrumentalness: 0.8,
      liveness: 0.1,
      speechiness: 0.05,
    };

    // User skips track after 8 seconds
    store.recordListen("user-rocker", "track-acoustic-1", acousticTrack, 8, 240);
    const profile = store.computeTasteCentroid("user-rocker");

    assert.equal(profile.totalListens, 1);
    assert.equal(profile.totalSkips, 1);
    assert.equal(profile.skipRate, 1.0);
  });

  it("enforces strict Point-in-Time correctness for historical queries", () => {
    const store = new EosAcousticFeatureStore();
    const t0 = 1000000;
    const t1 = 2000000;
    const t2 = 3000000;

    const vecA = {
      tempo: 0.5,
      energy: 0.5,
      danceability: 0.5,
      valence: 0.5,
      acousticness: 0.5,
      instrumentalness: 0.5,
      liveness: 0.5,
      speechiness: 0.5,
    };
    const vecB = {
      tempo: 0.9,
      energy: 0.9,
      danceability: 0.9,
      valence: 0.9,
      acousticness: 0.1,
      instrumentalness: 0.1,
      liveness: 0.1,
      speechiness: 0.1,
    };

    store.recordListen("user-time", "t1", vecA, 200, 200, t1);
    store.recordListen("user-time", "t2", vecB, 200, 200, t2);

    // Query at t0: 0 events
    const profileT0 = store.computeTasteCentroid("user-time", t0);
    assert.equal(profileT0.totalListens, 0);

    // Query at t1: exactly 1 event (t2 is in future)
    const profileT1 = store.computeTasteCentroid("user-time", t1);
    assert.equal(profileT1.totalListens, 1);

    // Query at t2: both events visible
    const profileT2 = store.computeTasteCentroid("user-time", t2);
    assert.equal(profileT2.totalListens, 2);
  });

  it("computes 8D cosine similarity affinity score accurately", () => {
    const store = new EosAcousticFeatureStore();
    const vecA = {
      tempo: 0.8,
      energy: 0.8,
      danceability: 0.8,
      valence: 0.8,
      acousticness: 0.2,
      instrumentalness: 0.1,
      liveness: 0.2,
      speechiness: 0.1,
    };
    const vecB = {
      tempo: 0.8,
      energy: 0.8,
      danceability: 0.8,
      valence: 0.8,
      acousticness: 0.2,
      instrumentalness: 0.1,
      liveness: 0.2,
      speechiness: 0.1,
    };
    const vecC = {
      tempo: 0.1,
      energy: 0.1,
      danceability: 0.1,
      valence: 0.1,
      acousticness: 0.9,
      instrumentalness: 0.9,
      liveness: 0.1,
      speechiness: 0.05,
    };

    const scoreMatch = store.computeAffinityScore(vecA, vecB);
    const scoreDiff = store.computeAffinityScore(vecA, vecC);

    assert.equal(scoreMatch, 1.0);
    assert.ok(scoreDiff < 0.6);
  });
});
