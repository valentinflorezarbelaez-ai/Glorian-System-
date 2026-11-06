/**
 * ============================================================================
 * EOS LOCAL AUDIO AND DATA DEMONSTRATIONS (/api/spotify)
 * ============================================================================
 * Runs repository-local audio/math examples. It does not call Spotify or
 * inspect production systems. Results are not standards certification.
 *
 * Zero external runtime dependencies (dependencies: {}).
 * ============================================================================
 */

export default async function handler(req, res) {
  const startTime = process.hrtime.bigint();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const query = req.query || {};
  const action = query.action === undefined ? "status" : query.action;
  const allowedActions = new Set(["status", "dsp", "camelot", "mesh", "mix", "features"]);
  if (typeof action !== "string" || action.length > 32 || !allowedActions.has(action)) {
    return res.status(400).json({ status: "INVALID_ACTION", allowedActions: [...allowedActions] });
  }

  const parseNumber = (name, fallback, min, max) => {
    if (query[name] === undefined) return fallback;
    if (typeof query[name] !== "string" || query[name].length > 32) return null;
    const value = Number(query[name]);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
  const validCamelotKey = (value) => typeof value === "string" && /^(1[0-2]|[1-9])[AB]$/.test(value);
  for (const name of ["key", "keyA", "keyB"]) {
    if (query[name] !== undefined && !validCamelotKey(query[name])) {
      return res.status(400).json({ status: "INVALID_CAMELOT_KEY", field: name });
    }
  }
  if (query.userId !== undefined && (typeof query.userId !== "string" || query.userId.length > 80)) {
    return res.status(400).json({ status: "INVALID_USER_ID" });
  }

  const bpmA = parseNumber("bpmA", 126, 30, 300);
  const bpmB = parseNumber("bpmB", 128, 30, 300);
  const duration = parseNumber("duration", 5, 0.1, 60);
  if ([bpmA, bpmB, duration].includes(null)) {
    return res.status(400).json({ status: "INVALID_MIX_PARAMETERS" });
  }

  let result = null;

  try {
    const root = process.cwd();
    if (action === "status") {
      result = { availableLocalActions: [...allowedActions].filter((item) => item !== "status") };
    } else if (action === "dsp") {
      const { EosAudioDspKernel } = await import("../src/core/eosAudioDspKernel.ts");
      const kernel = new EosAudioDspKernel();
      const { sha256Proof, ...metrics } = kernel.benchmarkDsp(16384, 5);
      result = {
        ...metrics,
        resultFingerprintSha256: `sha256:${sha256Proof}`,
        fingerprintIsSignature: false,
        benchmarkScope: "local synthetic Float32Array buffer; not a Spotify or standards certification"
      };
    } else if (action === "camelot") {
      const { EosSpotifyCodex } = await import("../src/core/eosSpotifyCodex.ts");
      const codex = new EosSpotifyCodex(root);
      const key = query.key || "8A";
      result = codex.getCamelotTransitions(key);
    } else if (action === "mesh") {
      const { EosApolloHermesMesh } = await import("../src/core/eosApolloHermesMesh.ts");
      const mesh = new EosApolloHermesMesh();
      result = { ...mesh.getMeshReport(), scope: "new in-process instance; not a live service mesh" };
    } else if (action === "mix") {
      const { EosGaplessMixEngine } = await import("../src/core/eosGaplessMixEngine.ts");
      const engine = new EosGaplessMixEngine();
      const keyA = query.keyA || "8A";
      const keyB = query.keyB || "9A";
      result = engine.planTransition(
        { trackId: "sampleA", title: `Sample A (${keyA})`, bpm: bpmA, camelotKey: keyA, sampleRateHz: 44100 },
        { trackId: "sampleB", title: `Sample B (${keyB})`, bpm: bpmB, camelotKey: keyB, sampleRateHz: 44100 },
        duration
      );
      result = { ...result, scope: "transition plan for synthetic sample metadata; no audio is played or mixed" };
    } else if (action === "features") {
      const { EosAcousticFeatureStore } = await import("../src/core/eosAcousticFeatureStore.ts");
      const store = new EosAcousticFeatureStore();
      const userId = query.userId || "user-default";
      store.recordListen(userId, "sample-track", { tempo: 0.7, energy: 0.85, danceability: 0.8, valence: 0.7, acousticness: 0.1, instrumentalness: 0.2, liveness: 0.15, speechiness: 0.08 }, 200, 200);
      result = { ...store.computeTasteCentroid(userId), scope: "one synthetic in-memory sample; no Spotify account or catalog access" };
    }
  } catch (error) {
    return res.status(503).json({
      status: "LOCAL_ENGINE_UNAVAILABLE",
      action,
      error: error instanceof Error ? error.message : "A local module could not be loaded.",
      externalServicesCalled: false
    });
  }

  const endTime = process.hrtime.bigint();
  const durationUs = Number(endTime - startTime) / 1000;

  return res.status(200).json({
    status: "LOCAL_DEMO_EXECUTED",
    action,
    durationUs: Number(durationUs.toFixed(2)),
    externalServicesCalled: false,
    data: result
  });
}
