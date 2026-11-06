import crypto from "node:crypto";

/**
 * ============================================================================
 * EOS UNIVERSAL TECHNICAL TRANSLATOR & PROMPT AMPLIFIER (/api/compile & /api/amplify)
 * ============================================================================
 * Dual-engine Serverless Endpoint:
 * 1. Local typed-array arithmetic benchmark (/api/compile)
 * 2. Local EARS/BDD draft generator (/api/amplify)
 *
 * Zero external runtime dependencies.
 * ============================================================================
 */

// Reused typed-array storage. This does not guarantee CPU cache residency and
// this endpoint does not measure request-time heap allocations.
const ARRAY_BUFFER_BYTES = 65536;
const VECTOR_CAPACITY = 2048;
const MAX_PROMPT_BYTES = 8192;
const MAX_REQUEST_BYTES = 16384;
const ARRAY_BUFFER = new ArrayBuffer(ARRAY_BUFFER_BYTES);
const SOA_PRICES = new Float64Array(ARRAY_BUFFER, 0, VECTOR_CAPACITY);
const SOA_VOLUMES = new Float64Array(ARRAY_BUFFER, 16384, VECTOR_CAPACITY);
const SOA_OUT = new Float64Array(ARRAY_BUFFER, 32768, VECTOR_CAPACITY);

for (let i = 0; i < VECTOR_CAPACITY; i++) {
  SOA_PRICES[i] = 349.23 + (i & 255) * 0.5;
  SOA_VOLUMES[i] = 0.85 + (i & 15) * 0.01;
}

function runTypedArrayBenchmark(iterations = 500) {
  const startNs = process.hrtime.bigint();
  for (let iter = 0; iter < iterations; iter++) {
    const gain = 1.0001 + (iter & 7) * 0.0001;
    for (let i = 0; i < VECTOR_CAPACITY; i += 8) {
      SOA_OUT[i]     = SOA_PRICES[i]     * SOA_VOLUMES[i]     * gain;
      SOA_OUT[i + 1] = SOA_PRICES[i + 1] * SOA_VOLUMES[i + 1] * gain;
      SOA_OUT[i + 2] = SOA_PRICES[i + 2] * SOA_VOLUMES[i + 2] * gain;
      SOA_OUT[i + 3] = SOA_PRICES[i + 3] * SOA_VOLUMES[i + 3] * gain;
      SOA_OUT[i + 4] = SOA_PRICES[i + 4] * SOA_VOLUMES[i + 4] * gain;
      SOA_OUT[i + 5] = SOA_PRICES[i + 5] * SOA_VOLUMES[i + 5] * gain;
      SOA_OUT[i + 6] = SOA_PRICES[i + 6] * SOA_VOLUMES[i + 6] * gain;
      SOA_OUT[i + 7] = SOA_PRICES[i + 7] * SOA_VOLUMES[i + 7] * gain;
    }
  }
  const elapsedNs = Number(process.hrtime.bigint() - startNs);
  const elementsProcessed = iterations * VECTOR_CAPACITY;
  const millionElementsPerSecond = (elementsProcessed / Math.max(1, elapsedNs)) * 1000;

  return {
    elementsProcessed,
    elapsedNanoseconds: elapsedNs,
    throughputMillionElementsPerSecond: Number(millionElementsPerSecond.toFixed(2)),
    typedArrayBufferBytes: ARRAY_BUFFER_BYTES,
    heapAllocationMeasurement: "NOT_MEASURED",
    benchmarkScope: "single-process Float64Array arithmetic loop; no hardware cache or vendor claims"
  };
}

async function handleAmplify(req, res, body = {}) {
  const startTime = process.hrtime.bigint();
  const query = req.query || {};
  const rawPrompt = query.prompt ?? body.prompt ?? "Diseñar módulo de autenticación biométrica y rate-limiting";
  const targetModel = query.model ?? body.model ?? "claude";
  const strictLevel = query.strict ?? body.strict ?? "sovereign";
  if (typeof rawPrompt !== "string" || Buffer.byteLength(rawPrompt, "utf8") > MAX_PROMPT_BYTES) {
    return res.status(400).json({ status: "INVALID_PROMPT", maxBytes: MAX_PROMPT_BYTES });
  }
  const allowedModels = new Set(["claude", "openai", "gemini", "deepseek", "llama", "universal"]);
  const allowedStrictLevels = new Set(["standard", "hardened", "sovereign"]);
  if (!allowedModels.has(targetModel) || !allowedStrictLevels.has(strictLevel)) {
    return res.status(400).json({ status: "INVALID_OPTIONS" });
  }

  let amplified = null;

  try {
    const { amplifyPrompt } = await import("../src/core/eosPromptAmplifier.ts");
    amplified = amplifyPrompt({
      rawPrompt,
      targetModel,
      strictLevel
    });
  } catch (_err) {
    return res.status(503).json({
      status: "AMPLIFIER_UNAVAILABLE",
      error: "The local prompt scaffolder could not be loaded. No draft was produced.",
      retryable: true
    });
  }

  const endTime = process.hrtime.bigint();
  const latencyMicros = Number(endTime - startTime) / 1000;

  return res.status(200).json({
    status: "LOCAL_DRAFT_GENERATED",
    version: "17.0.0",
    engine: "EOS local prompt scaffolder",
    targetModel,
    latencyMicroseconds: latencyMicros,
    remoteModelCalled: false,
    amplification: amplified,
    note: "The requested model name is metadata only. This route does not call an external language model or verify the generated draft."
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const query = req.query || {};
  let body = {};
  if (req.method === "POST" && req.body !== undefined) {
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    } catch {
      return res.status(400).json({ status: "INVALID_JSON" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ status: "INVALID_BODY" });
    }
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_REQUEST_BYTES) {
      return res.status(413).json({ status: "REQUEST_TOO_LARGE", maxBytes: MAX_REQUEST_BYTES });
    }
  }
  const url = req.url || "";

  if (
    url.includes("/api/amplify") ||
    query.mode === "amplify" ||
    query.prompt ||
    body.mode === "amplify" ||
    body.prompt
  ) {
    return handleAmplify(req, res, body);
  }

  const rawInstruction = body.instruction ?? query.instruction ?? "Array processing demo";
  const rawProfile = body.profile ?? query.profile ?? "default";
  if (typeof rawInstruction !== "string" || Buffer.byteLength(rawInstruction, "utf8") > MAX_PROMPT_BYTES) {
    return res.status(400).json({ status: "INVALID_INSTRUCTION", maxBytes: MAX_PROMPT_BYTES });
  }
  if (typeof rawProfile !== "string" || rawProfile.length > 80) {
    return res.status(400).json({ status: "INVALID_PROFILE" });
  }
  const instruction = rawInstruction.trim();
  const profile = rawProfile.trim();

  const benchmark = runTypedArrayBenchmark(500);
  const resultFingerprintSha256 = crypto
    .createHash("sha256")
    .update(`${instruction}|${profile}|${benchmark.elapsedNanoseconds}`)
    .digest("hex");

  return res.status(200).json({
    status: "LOCAL_BENCHMARK_EXECUTED",
    instruction,
    profile,
    benchmark,
    resultFingerprintSha256: `sha256:${resultFingerprintSha256}`,
    execution: { nativeCompilerInvoked: false, gpuUsed: false, cacheBehaviorMeasured: false, testsRun: false },
    note: "This measures the local typed-array arithmetic loop only. The fingerprint is not a signature, proof, or hardware-performance claim."
  });
}
