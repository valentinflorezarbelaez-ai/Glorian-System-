import { createHash } from "node:crypto";

/**
 * ============================================================================
 * Local engineering concept demonstrations (/api/bigtech)
 * ============================================================================
 * The route provides toy vector and Monte Carlo examples, a local hash-chain
 * illustration, and a static scenario catalog. It does not query vendors,
 * run a TLA+ model checker, inject faults, or perform remediation.
 * ============================================================================
 */

function computeSha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

const SCENARIOS = {
  "secret-leak-attempt": {
    scenarioId: "secret-leak-attempt",
    scenarioTitle: "Intento de Inyección de Secreto en Claro (Violación Ley VI)",
    example: "Un actor intenta guardar una credencial en un archivo.",
    formulaReference: "□ (∀ commit ∈ Repo : PlainSecrets(commit) = ∅) ∧ ◇ QuarantineActive"
  },
  "orphan-ontology-link": {
    scenarioId: "orphan-ontology-link",
    scenarioTitle: "Enlace Huérfano en el Grafo de Especificaciones (ORPHAN_LINK_DETECTED)",
    example: "Una tarea referencia un requisito que no existe en la especificación.",
    formulaReference: "□ (∀ t ∈ Tasks : ∃ s ∈ Specs : Linked(t, s)) ∧ ◇ GraphHarmonized"
  },
  "spec-drift-mutation": {
    scenarioId: "spec-drift-mutation",
    scenarioTitle: "Mutación Ilegal sin Especificación EARS (Vibe Coding Drift)",
    example: "Un cambio de código no cuenta con un requisito aprobado asociado.",
    formulaReference: "□ (CodeChange ⇒ (SpecApproved ∧ AuthLevel ≥ 2)) ∧ ◇ DriftZero"
  },
  "heap-entropy-spike": {
    scenarioId: "heap-entropy-spike",
    scenarioTitle: "Pico de Entropía y Objetos Efímeros en RAM (GC Pressure)",
    example: "Una carga sintética puede aumentar las asignaciones de memoria.",
    formulaReference: "□ (HeapAllocInHotLoop = 0 ∧ L1ArenaBytes ≤ 65536) ∧ ◇ FrameTimeSub8ms"
  },
  "race-condition-concurrent": {
    scenarioId: "race-condition-concurrent",
    scenarioTitle: "Condición de Carrera Multi-Agente sobre el Mismo Archivo",
    example: "Dos trabajadores intentan modificar el mismo archivo al mismo tiempo.",
    formulaReference: "□ (∀ a1, a2 ∈ Agents : a1 ≠ a2 ⇒ Worktree(a1) ∩ Worktree(a2) = ∅) ∧ ◇ LockFreeCAS"
  }
};


// ============================================================================
// SPEC-038: PALANTIR HNSW, ALADDIN RISK LEDGER & SPACEX MONOTONIC MERKLE ENGINE
// ============================================================================

function projectTextToVectorJs(text, dimensions = 64) {
  const vector = new Float32Array(dimensions);
  if (!text) return vector;
  const normalized = text.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const c1 = normalized.charCodeAt(i);
    vector[(c1 * 31 + i) % dimensions] += 1.0;
    if (i + 1 < normalized.length) {
      const c2 = normalized.charCodeAt(i + 1);
      vector[((c1 * 31 + c2 * 17 + i) >>> 0) % dimensions] += 1.5;
    }
  }
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) normSq += vector[i] * vector[i];
  if (normSq > 0) {
    const inv = 1.0 / Math.sqrt(normSq);
    for (let i = 0; i < dimensions; i++) vector[i] *= inv;
  }
  return vector;
}

function cosineDistJs(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, 1.0 - dot);
}

function runMonteCarloJs(tasks, iterations = 5000, deadlineHours = 18.0) {
  let seed = 1337;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const runDurations = new Float64Array(iterations);
  let sum = 0;
  let withinDeadline = 0;

  for (let i = 0; i < iterations; i++) {
    let dur = 0;
    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[j];
      const range = t.pessimistic - t.optimistic;
      const mode = (t.nominal - t.optimistic) / range;
      const uSum = (rand() + rand() + rand() + rand()) / 4;
      const pert = Math.max(0, Math.min(1, uSum * 0.5 + mode * 0.5));
      dur += t.optimistic + pert * range;
    }
    runDurations[i] = dur;
    sum += dur;
    if (dur <= deadlineHours) withinDeadline++;
  }

  runDurations.sort();
  const getP = (p) => Math.round(runDurations[Math.floor((p / 100) * iterations)] * 100) / 100;

  return {
    iterations,
    mean: Math.round((sum / iterations) * 100) / 100,
    deadlineProbability: Math.round((withinDeadline / iterations) * 1000) / 10,
    percentiles: {
      p10: getP(10),
      p50: getP(50),
      p80: getP(80),
      p90: getP(90),
      p95: getP(95),
      p99: getP(99)
    }
  };
}

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const queryParams = req.query && typeof req.query === "object" ? req.query : {};
  const action = typeof queryParams.action === "string" ? queryParams.action.trim().toLowerCase() : "";
  const allowedActions = new Set(["vector", "hnsw", "risk", "aladdin", "chain", "ledger", "scenario", ""]);
  if (action.length > 32 || !allowedActions.has(action)) {
    return res.status(400).json({ status: "INVALID_ACTION", allowedActions: [...allowedActions].filter(Boolean) });
  }

  if (action === "vector" || action === "hnsw") {
    const query = queryParams.query === undefined ? "semantic risk graph" : queryParams.query;
    if (typeof query !== "string" || Buffer.byteLength(query, "utf8") > 4096) {
      return res.status(400).json({ status: "INVALID_QUERY", maximumBytes: 4096 });
    }
    const docs = [
      { id: "doc-palantir", text: "Palantir Foundry and Gotham semantic knowledge graph reasoning with HNSW index" },
      { id: "doc-aladdin", text: "BlackRock Aladdin institutional risk simulation with Monte Carlo Beta-PERT" },
      { id: "doc-spacex", text: "SpaceX Starship telemetry streaming with nanosecond monotonic cryptographic ledgers" },
      { id: "doc-nsa", text: "NSA CNSA 2.0 post-quantum encryption and zero-trust compartmentalization" },
      { id: "doc-netflix", text: "Netflix Chaos Monkey automated failure injection and resilience engineering" }
    ];

    const qVec = projectTextToVectorJs(query, 64);
    const scored = docs.map(d => {
      const dVec = projectTextToVectorJs(d.text, 64);
      const dist = cosineDistJs(qVec, dVec);
      return {
        id: d.id,
        distance: Math.round(dist * 10000) / 10000,
        similarity: Math.round(Math.max(0, 1.0 - dist) * 10000) / 10000,
        text: d.text
      };
    });
    scored.sort((a, b) => a.distance - b.distance);

    return res.status(200).json({
      status: "LOCAL_VECTOR_DEMO",
      scope: "Toy in-memory vector projection over five embedded sample texts; no HNSW index or external data source is used.",
      engine: "Local cosine-distance demonstration",
      externalSystemsQueried: false,
      query,
      dimensions: 64,
      metric: "cosine",
      results: scored
    });
  }

  if (action === "risk" || action === "aladdin") {
    const rawIterations = queryParams.iterations === undefined ? "5000" : queryParams.iterations;
    const rawDeadline = queryParams.deadline === undefined ? "18" : queryParams.deadline;
    if (typeof rawIterations !== "string" || !/^\d{1,6}$/.test(rawIterations)) {
      return res.status(400).json({ status: "INVALID_ITERATIONS" });
    }
    if (typeof rawDeadline !== "string" || rawDeadline.length > 32 || !Number.isFinite(Number(rawDeadline))) {
      return res.status(400).json({ status: "INVALID_DEADLINE" });
    }
    const iters = Number(rawIterations);
    const deadline = Number(rawDeadline);
    if (iters < 1 || iters > 100000 || deadline < 0 || deadline > 100000) {
      return res.status(400).json({ status: "PARAMETER_OUT_OF_RANGE" });
    }
    const tasks = [
      { id: "T1", name: "HNSW Vector Engine Implementation", optimistic: 3, nominal: 6, pessimistic: 12 },
      { id: "T2", name: "Monte Carlo Stochastic Risk Port", optimistic: 2, nominal: 4, pessimistic: 8 },
      { id: "T3", name: "Monotonic Hash Chain Ledger Port", optimistic: 2, nominal: 3, pessimistic: 6 },
      { id: "T4", name: "CI/CD Gate & Edge Verification", optimistic: 1, nominal: 2, pessimistic: 4 }
    ];
    const riskReport = runMonteCarloJs(tasks, iters, deadline);
    return res.status(200).json({
      status: "LOCAL_MONTE_CARLO_DEMO",
      scope: "Synthetic task estimates and local random sampling; not financial advice or a BlackRock service.",
      engine: "Local PERT-style demonstration",
      iterations: iters,
      externalSystemsQueried: false,
      summary: riskReport
    });
  }

  if (action === "chain" || action === "ledger") {
    const genesisPrev = "0".repeat(64);
    const b0Hash = computeSha256(`0:${genesisPrev}:AUTH_SPEC038:1793022000000000000`);
    const b1Hash = computeSha256(`1:${b0Hash}:VERIFY_GATE_PASS:1793022100000000000`);
    const b2Hash = computeSha256(`2:${b1Hash}:VERCEL_PROD_DEPLOY:1793022200000000000`);

    return res.status(200).json({
      status: "LOCAL_HASH_CHAIN_DEMO",
      scope: "Three locally constructed example records; not a deployment record, trusted timestamp, or external attestation.",
      engine: "Local SHA-256 hash-chain example",
      valid: true,
      externalSystemsQueried: false,
      externalAttestation: false,
      deploymentVerified: false,
      totalBlocks: 3,
      blocks: [
        { index: 0, type: "SPEC_APPROVAL", hash: b0Hash, prevHash: genesisPrev, monotonicNs: "1793022000000000000" },
        { index: 1, type: "VERIFY_GATE", hash: b1Hash, prevHash: b0Hash, monotonicNs: "1793022100000000000" },
        { index: 2, type: "DEPLOY_PROD", hash: b2Hash, prevHash: b1Hash, monotonicNs: "1793022200000000000" }
      ]
    });
  }




  const scenarioKey = queryParams.scenario === undefined ? "secret-leak-attempt" : queryParams.scenario;
  if (typeof scenarioKey !== "string" || scenarioKey.length > 64 || !Object.hasOwn(SCENARIOS, scenarioKey)) {
    return res.status(400).json({ status: "INVALID_SCENARIO", availableScenarios: Object.keys(SCENARIOS) });
  }

  const drill = SCENARIOS[scenarioKey];
  const sha256Seal = computeSha256(JSON.stringify(drill));

  return res.status(200).json({
    status: "LOCAL_SCENARIO_DESCRIPTION",
    scope: "Static scenario description only; no TLA+ model checker, fault injection, remediation, or external service was run.",
    engine: "Local scenario catalog",
    formalModelChecked: false,
    chaosRun: false,
    resultFingerprintSha256: `sha256:${sha256Seal}`,
    fingerprintIsSignature: false,
    drill
  });
}
