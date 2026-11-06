import { createHash } from "node:crypto";

/**
 * ============================================================================
 * EOS AKASHIC MEMORY DEMONSTRATION API (/api/memory)
 * ============================================================================
 * Serves static seed records and previews actions. This stateless endpoint
 * does not persist data, run FTS5, or execute a tribunal.
 * ============================================================================
 */

function computeSha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

function suggestTopicKey(type = "architecture", title = "core-decision") {
  const cleanType = String(type || "architecture")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "architecture";
  const slug = String(title || "core-decision")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 44) || "core-decision";
  return `${cleanType}/${slug}`;
}

const GENESIS_AKASHIC_OBSERVATIONS = [
  {
    id: 1,
    project: "eos-system",
    scope: "global",
    type: "architecture",
    title: "Ejemplo: propuesta de almacenamiento de observaciones",
    topic_key: "architecture/eos-akashic-memory-l0",
    samaelianFactor: "NACER",
    sephirah: "Daath (Gnosis / Conocimiento Akáshico)",
    pinned: true,
    version_count: 1,
    what: "Idea de guardar observaciones con un identificador estable y campos de contexto.",
    why: "Explorar cómo conservar decisiones útiles entre sesiones.",
    where: "Fixture de demostración en /api/memory.",
    learned: "Este registro es un ejemplo estático; la API no implementa persistencia ni revisión de conflictos.",
    created_at: "2026-10-25T02:35:00Z"
  },
  {
    id: 2,
    project: "eos-system",
    scope: "project",
    type: "pattern",
    title: "Ejemplo: propuesta de medición de estructuras de datos",
    topic_key: "pattern/five-nanosecond-secrets-soa",
    samaelianFactor: "NACER",
    sephirah: "Netzach (Mente Solar · Arquitectura)",
    pinned: true,
    version_count: 2,
    what: "Idea de comparar arreglos de estructuras y estructuras de arreglos con una carga de trabajo declarada.",
    why: "Separar hipótesis de optimización de resultados medidos.",
    where: "Fixture de demostración en /api/memory.",
    learned: "No se adjuntan mediciones, hardware ni una reproducción del benchmark.",
    created_at: "2026-10-25T02:15:00Z"
  },
  {
    id: 3,
    project: "aberamentho-pleroma",
    scope: "project",
    type: "bugfix",
    title: "Ejemplo: observación de una corrección de interfaz",
    topic_key: "bugfix/aberamentho-v8-inapp-full-track-player",
    samaelianFactor: "MORIR",
    sephirah: "Geburah (Rigor de la Ley · Tribunal de Anubis)",
    pinned: true,
    version_count: 3,
    what: "Ejemplo de registro de un cambio de interfaz y una observación asociada.",
    why: "Ilustrar la forma de un registro local.",
    where: "Fixture de demostración en /api/memory.",
    learned: "No se verificó un producto externo ni se realizó una reproducción de audio.",
    created_at: "2026-10-25T02:05:00Z"
  },
  {
    id: 4,
    project: "eos-system",
    scope: "global",
    type: "decision",
    title: "Ejemplo: propuesta de revisión de cambios",
    topic_key: "decision/odd-proportional-and-rdd-4r-review",
    samaelianFactor: "SACRIFICIO",
    sephirah: "Tiphereth (Alma Humana · Voluntad Thelema)",
    pinned: false,
    version_count: 1,
    what: "Idea de revisar un cambio desde riesgo, resiliencia, legibilidad y confiabilidad.",
    why: "Hacer visibles varios criterios antes de una revisión técnica.",
    where: "Fixture de demostración en /api/memory.",
    learned: "El registro no demuestra que se ejecutó una revisión ni que se delegó trabajo.",
    created_at: "2026-10-25T02:36:00Z"
  }
].map((observation) => ({
  ...observation,
  sha256Fingerprint: `sha256:${computeSha256(JSON.stringify(observation))}`
}));

export default function handler(req, res) {
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

  let body = {};
  if (req.method === "POST" && req.body) {
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    } catch {
      return res.status(400).json({ status: "INVALID_JSON" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ status: "INVALID_BODY" });
    }
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > 16 * 1024) {
      return res.status(413).json({ status: "BODY_TOO_LARGE", maxBytes: 16 * 1024 });
    }
  }

  const actionValue = body.action || (req.query && req.query.action) || "mem_context";
  const queryValue = body.query || (req.query && req.query.q) || "";
  if (typeof actionValue !== "string" || actionValue.length > 40) {
    return res.status(400).json({ status: "INVALID_ACTION" });
  }
  if (typeof queryValue !== "string" || queryValue.length > 256) {
    return res.status(400).json({ status: "QUERY_TOO_LONG", maxLength: 256 });
  }
  const action = actionValue.trim();
  const query = queryValue.trim().toLowerCase();

  if (action === "mem_doctor") {
    const snapshotSha256 = computeSha256(JSON.stringify({ fixtureCount: GENESIS_AKASHIC_OBSERVATIONS.length }));
    return res.status(200).json({
      status: "CAPABILITY_SNAPSHOT",
      persistenceAvailable: false,
      checksRun: false,
      capabilities: {
        staticSeedData: true,
        serverSidePersistence: false,
        sqliteFts5: false,
        tribunalExecution: false
      },
      snapshotSha256: `sha256:${snapshotSha256}`
    });
  }

  if (action === "mem_save") {
    const fields = ["title", "type", "topic_key", "what", "content", "why", "where", "learned"];
    if (fields.some((field) => body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > 4096))) {
      return res.status(400).json({ status: "INVALID_OBSERVATION", error: "Observation fields must be strings up to 4096 characters." });
    }
    const title = (body.title || "").trim();
    const type = (body.type || "architecture").trim();
    const topic_key = (body.topic_key || suggestTopicKey(type, title || "preview")).trim();
    const what = (body.what || body.content || "").trim();
    const why = (body.why || "").trim();
    const where = (body.where || "").trim();
    const learned = (body.learned || "").trim();
    const previewSha256 = computeSha256(JSON.stringify({ type, topic_key, title, what, why, where, learned }));

    return res.status(200).json({
      status: "PREVIEW_ONLY",
      persisted: false,
      action: "mem_save",
      observation: {
        type,
        title,
        topic_key,
        what,
        why,
        where,
        learned
      },
      previewSha256: `sha256:${previewSha256}`,
      note: "Nothing was saved here. Browser-local records are stored only in this user's localStorage."
    });
  }

  if (action === "mem_judge" || action === "mem_compare") {
    const relation = typeof body.relation === "string" ? body.relation.slice(0, 100) : "supersedes";
    const reasoningValue = body.reasoning || body.reason || "";
    if (typeof reasoningValue !== "string" || reasoningValue.length > 4096) {
      return res.status(400).json({ status: "INVALID_REASONING" });
    }
    return res.status(200).json({
      status: "SIMULATION_ONLY",
      judgmentExecuted: false,
      relation,
      confidence: null,
      reasoningPreview: reasoningValue,
      note: "No tribunal or judge executed a review."
    });
  }

  if (!["mem_context", "mem_search", "mem_list", "mem_timeline", "mem_stats"].includes(action)) {
    return res.status(400).json({ status: "UNSUPPORTED_ACTION" });
  }

  const results = query
    ? GENESIS_AKASHIC_OBSERVATIONS.filter((o) =>
        `${o.title} ${o.topic_key} ${o.what} ${o.why} ${o.where} ${o.learned} ${o.samaelianFactor}`
          .toLowerCase()
          .includes(query)
      )
    : GENESIS_AKASHIC_OBSERVATIONS;

  const fixtureFingerprint = computeSha256(JSON.stringify(results.map((record) => record.sha256Fingerprint)));

  return res.status(200).json({
    status: "DEMO_FIXTURE",
    persistenceAvailable: false,
    action,
    totalObservations: results.length,
    fixtureSha256: `sha256:${fixtureFingerprint}`,
    note: "Static sample records only. Fingerprints cover fixture content and do not prove origin, history, or a Merkle chain. No persistence, FTS5, or Engram tools are provided.",
    observations: results
  });
}
