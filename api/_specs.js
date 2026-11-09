import catalog from "../docs/specs/openspec-catalog-index.json" with { type: "json" };
import { getQueryParam } from "./_safeQuery.js";

/**
 * EOS SYSTEM — OPENSPECS CATALOG SERVERLESS ENDPOINT (/api/specs)
 * Governed by SPEC-129.
 * Zero external dependencies.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const qRaw = getQueryParam(req, "q");
  const statusRaw = getQueryParam(req, "status");
  const query = typeof qRaw === "string" ? qRaw.toLowerCase() : "";
  const status = typeof statusRaw === "string" ? statusRaw.toUpperCase() : "";

  let filtered = catalog.specs;
  if (status && status !== "ALL") {
    filtered = filtered.filter((s) => s.status.toUpperCase() === status);
  }
  if (query) {
    filtered = filtered.filter((s) => s.id.toLowerCase().includes(query) || s.title.toLowerCase().includes(query));
  }

  return res.status(200).json({
    status: "OK",
    totalSpecs: catalog.totalSpecs,
    matchedSpecs: filtered.length,
    catalogSha256: catalog.catalogSha256,
    specs: filtered,
  });
}
