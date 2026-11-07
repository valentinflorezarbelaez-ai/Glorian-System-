import handleBigTech from "./_bigtech.js";
import handleSpecs from "./_specs.js";
import { createHash } from "node:crypto";

const LINUX_CONCEPT_FIXTURES = Object.freeze({
  "/proc/eos/version":
    "Concepto: versión de kernel Linux. Fixture informativo; EOS no incluye un kernel Linux ni una ABI de usuario propia.",
  "/proc/eos/rcu_stats":
    "Concepto: Read-Copy-Update (RCU). Fixture informativo; no se mide concurrencia ni se ejecuta una implementación RCU.",
  "/proc/eos/eevdf_sched":
    "Concepto: Earliest Eligible Virtual Deadline First (EEVDF). Fixture informativo; no se programan tareas ni se ofrecen garantías de tiempo real.",
  "/sys/kernel/ebpf_verifier":
    "Concepto: verificador eBPF. Fixture informativo; no se analiza bytecode, prueba seguridad ni ejecuta JIT.",
  "/dev/anubis_law_gate":
    "Concepto: dispositivo de caracteres. Fixture informativo; /dev/anubis_law_gate no existe en este sistema.",
});

function respondWithOmegaDemo(req, res) {
  const input = req.query && req.query.statement;
  if (input !== undefined && (typeof input !== "string" || Buffer.byteLength(input, "utf8") > 4096)) {
    return res.status(400).json({ status: "INVALID_STATEMENT", maximumBytes: 4096 });
  }

  const digest = createHash("sha256")
    .update(typeof input === "string" ? input : "EOS_LOCAL_DEMO")
    .digest("hex");

  return res.status(200).json({
    status: "LOCAL_DEMONSTRATION",
    scope:
      "A text fingerprint and concept references only; no PQC, zero-knowledge proof, BFT consensus, deterministic replay, or external fleet was run.",
    displayedTopics: [
      "post-quantum cryptography",
      "zero-knowledge proofs",
      "BFT consensus",
      "deterministic simulation",
    ],
    statementFingerprintSha256: `sha256:${digest}`,
    fingerprintIsSignature: false,
    proofVerified: false,
    cryptographicOperationPerformed: false,
  });
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

  const query = req.query || {};
  const url = req.url || "";

  if (url.includes("/api/bigtech") || query.module === "bigtech" || query.mode === "bigtech") {
    return handleBigTech(req, res);
  }

  if (url.includes("/api/omega") || query.module === "omega" || query.mode === "omega" || query.action === "omega") {
    return respondWithOmegaDemo(req, res);
  }

  if (url.includes("/api/specs") || query.module === "specs" || query.mode === "specs") {
    return handleSpecs(req, res);
  }

  const vfsPath = query.path === undefined ? "/proc/eos/version" : query.path;
  if (typeof vfsPath !== "string" || vfsPath.length > 128 || !Object.hasOwn(LINUX_CONCEPT_FIXTURES, vfsPath)) {
    return res.status(404).json({ status: "FIXTURE_NOT_FOUND", availablePaths: Object.keys(LINUX_CONCEPT_FIXTURES) });
  }

  const content = LINUX_CONCEPT_FIXTURES[vfsPath];
  const outputFingerprintSha256 = createHash("sha256").update(`EOS_LOCAL_FIXTURE:${vfsPath}:${content}`).digest("hex");

  return res.status(200).json({
    status: "STATIC_FIXTURE",
    scope:
      "Static explanatory text only; no Linux kernel, VFS, eBPF verifier, real-time scheduler, ABI, or security control was queried or run.",
    vfsPath,
    content,
    outputFingerprintSha256: `sha256:${outputFingerprintSha256}`,
    fingerprintIsSignature: false,
    kernelOperationsPerformed: false,
  });
}
