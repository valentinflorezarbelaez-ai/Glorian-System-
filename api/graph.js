/**
 * Local static-import graph endpoint.
 * It reports repository source relationships and recommended test files; it does
 * not execute tests, resolve every JavaScript/TypeScript import form, or model
 * runtime behavior.
 */

import { withRateLimit } from "../src/core/eosApiRateLimit.ts";
import { getQueryObject } from "./_safeQuery.js";

async function _handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const query = getQueryObject(req);
  const action = query.action === undefined ? "blast" : query.action;
  if (typeof action !== "string" || !["blast", "summary"].includes(action)) {
    return res.status(400).json({ status: "INVALID_ACTION", allowedActions: ["blast", "summary"] });
  }

  const rawTarget = query.file === undefined ? "src/core/eosPromptAmplifier.ts" : query.file;
  if (action === "blast" && (typeof rawTarget !== "string" || rawTarget.length === 0 || rawTarget.length > 256)) {
    return res.status(400).json({ status: "INVALID_FILE", maxLength: 256 });
  }

  let normalizedTarget = null;
  if (action === "blast") {
    const slashPath = rawTarget.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
    if (slashPath.startsWith("/") || /^[A-Za-z]:/.test(slashPath) || slashPath.split("/").includes("..")) {
      return res.status(400).json({ status: "INVALID_FILE", error: "Use a project-relative source path." });
    }
    normalizedTarget = slashPath;
  }

  const start = process.hrtime.bigint();
  try {
    const { EosSemanticGraph } = await import("../src/core/eosSemanticGraph.ts");
    const graph = new EosSemanticGraph(process.cwd());
    let blastRadius = null;

    if (action === "blast") {
      if (!graph.nodes.has(normalizedTarget)) {
        return res.status(404).json({ status: "SOURCE_FILE_NOT_IN_GRAPH", file: normalizedTarget });
      }
      blastRadius = graph.calculateBlastRadius(normalizedTarget);
    }

    const summary = graph.getSummary();
    const durationMicroseconds = Number(process.hrtime.bigint() - start) / 1000;
    return res.status(200).json({
      status: "LOCAL_GRAPH_ANALYSIS_COMPLETED",
      action,
      analysisScope:
        "static relative-import graph; dynamic imports, aliases, runtime calls, and test execution are not analyzed",
      predictiveTestSuitesAreRecommendations: true,
      durationMicroseconds,
      blastRadius,
      summary,
    });
  } catch (err) {
    // The TypeScript engine is unavailable in this runtime. Report the degraded
    // mode explicitly instead of returning fabricated graph data.
    return res.status(200).json({
      status: "FALLBACK_MODE",
      action,
      dataSource: "STATIC_FALLBACK",
      fallbackReason: "TypeScript runtime import unavailable in this environment",
      fallbackError: process.env.NODE_ENV !== "production" ? err.message : "TypeScript runtime unavailable",
      warning: "Graph data is unavailable. Run in Node.js 22+ with native TypeScript stripping for live analysis.",
      blastRadius: null,
      summary: null,
      ...(process.env.NODE_ENV !== "production" && {
        _debug: {
          errorName: err.name,
          errorStack: err.stack,
        },
      }),
    });
  }
}

// Rate limiting — 20 req/min burst per IP
export default withRateLimit({ capacity: 20, refillPerSecond: 0.33 })(_handler);
