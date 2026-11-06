import fs from "node:fs";
import path from "node:path";

const MAX_EVALUATION_INPUT_BYTES = 100 * 1024;
const MAX_TARGET_PATH_BYTES = 1024;
const TITAN_ACTIONS = new Set([
  "all", "xirp", "spacex", "nvidia", "google", "reconcile", "xai",
  "nubank", "datomic", "shuffle", "smart_shuffle", "ibm", "sysplex"
]);

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function handleTitans(action, res) {
  if (typeof action !== "string" || action.length > 32 || !TITAN_ACTIONS.has(action)) {
    return res.status(400).json({ status: "INVALID_ACTION", allowedActions: [...TITAN_ACTIONS] });
  }

  try {
    const { EosTitansMatrix } = await import("../src/core/eosTitansMatrix.ts");
    const matrix = new EosTitansMatrix(process.cwd());
    const results = {
      xirp: () => matrix.benchmarkSpotifyXirp(),
      spacex: () => matrix.benchmarkSpaceXTmr(),
      nvidia: () => matrix.benchmarkNvidiaSimd(),
      google: () => matrix.reconcileGoogleBorg(),
      reconcile: () => matrix.reconcileGoogleBorg(),
      xai: () => matrix.benchmarkXaiFabric(),
      nubank: () => matrix.benchmarkNubankDatomic(1000),
      datomic: () => matrix.benchmarkNubankDatomic(1000),
      shuffle: () => matrix.benchmarkSpotifySmartShuffle(60),
      smart_shuffle: () => matrix.benchmarkSpotifySmartShuffle(60),
      ibm: () => matrix.benchmarkIbmSysplex(),
      sysplex: () => matrix.benchmarkIbmSysplex(),
      all: () => matrix.runAllTitans()
    };
    return res.status(200).json({
      status: "LOCAL_SIMULATION_EXECUTED",
      action,
      externalSystemsQueried: false,
      certificationIssued: false,
      data: results[action]()
    });
  } catch {
    return res.status(503).json({
      status: "LOCAL_ENGINE_UNAVAILABLE",
      action,
      externalSystemsQueried: false
    });
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const query = req.query && typeof req.query === "object" ? req.query : {};
  const action = query.titan ?? query.action ?? (query.mode === "titans" ? "all" : null);
  if (action !== null) return handleTitans(action, res);

  const code = query.code;
  const target = query.target === undefined ? "src/core/eosPromptAmplifier.ts" : query.target;
  if (code !== undefined && (typeof code !== "string" || Buffer.byteLength(code, "utf8") > MAX_EVALUATION_INPUT_BYTES)) {
    return res.status(413).json({ status: "INPUT_TOO_LARGE", maximumBytes: MAX_EVALUATION_INPUT_BYTES });
  }
  if (typeof target !== "string" || Buffer.byteLength(target, "utf8") > MAX_TARGET_PATH_BYTES) {
    return res.status(400).json({ status: "INVALID_TARGET_PATH" });
  }

  try {
    const { EosCognitiveEval } = await import("../src/core/eosCognitiveEval.ts");
    const evaluator = new EosCognitiveEval();
    let evaluation;

    if (typeof code === "string") {
      evaluation = evaluator.evaluate(code, { isText: true });
    } else {
      const root = fs.realpathSync(process.cwd());
      const requestedPath = path.resolve(root, target);
      if (!isPathWithin(root, requestedPath)) return res.status(400).json({ status: "TARGET_OUTSIDE_PROJECT" });
      const realPath = fs.realpathSync(requestedPath);
      if (!isPathWithin(root, realPath)) return res.status(400).json({ status: "TARGET_OUTSIDE_PROJECT" });
      const stat = fs.lstatSync(requestedPath);
      if (!stat.isFile() || stat.isSymbolicLink()) return res.status(400).json({ status: "TARGET_NOT_REGULAR_FILE" });
      if (stat.size > MAX_EVALUATION_INPUT_BYTES) {
        return res.status(413).json({ status: "INPUT_TOO_LARGE", maximumBytes: MAX_EVALUATION_INPUT_BYTES });
      }
      evaluation = evaluator.evaluate(realPath);
    }

    return res.status(200).json({
      status: "LOCAL_HEURISTIC_EVALUATION",
      scope: "Static local analysis; no external model, production system, or certification is involved.",
      evaluation
    });
  } catch {
    return res.status(503).json({
      status: "LOCAL_EVALUATOR_UNAVAILABLE",
      externalSystemsQueried: false
    });
  }
}
