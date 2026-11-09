/**
 * WHATWG URL query parser for Vercel serverless handlers.
 * Avoids Node DEP0169 from legacy url.parse used by lazy req.query getters.
 * Plain own-property `query` objects (test mocks) are honored without getters.
 * Repeated keys are preserved as arrays so handlers keep fail-closed validation.
 */

/**
 * @param {unknown} req
 * @returns {Record<string, unknown> | null}
 */
function getInjectedPlainQuery(req) {
  if (!req || typeof req !== "object") return null;
  const desc = Object.getOwnPropertyDescriptor(req, "query");
  // Skip accessors — Vercel/Node may lazy-parse via url.parse (DEP0169).
  if (!desc || typeof desc.get === "function") return null;
  const value = desc.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {import('http').IncomingMessage & { url?: string, query?: Record<string, unknown> }} req
 * @returns {URLSearchParams}
 */
export function getSearchParams(req) {
  const raw = typeof req?.url === "string" && req.url.length > 0 ? req.url : "/";
  /** @type {URLSearchParams} */
  let params;
  try {
    params = new URL(raw, "https://glorian-system.vercel.app").searchParams;
  } catch {
    params = new URLSearchParams();
  }

  // Merge injected plain query (tests / adapters) without touching getters.
  const injected = getInjectedPlainQuery(req);
  if (injected) {
    for (const [key, value] of Object.entries(injected)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        if (!params.has(key)) params.set(key, String(value));
      }
    }
  }
  return params;
}

/**
 * First unique value only. Duplicate keys fail closed as null (never pick last).
 * @param {import('http').IncomingMessage & { url?: string }} req
 * @param {string} key
 * @returns {string | null}
 */
export function getQueryParam(req, key) {
  const all = getSearchParams(req).getAll(key);
  if (all.length !== 1) return null;
  return all[0];
}

/**
 * Flatten unique keys to strings; preserve duplicates as string[] so
 * `typeof value !== "string"` rejection paths stay fail-closed.
 * @param {import('http').IncomingMessage & { url?: string }} req
 * @returns {Record<string, string | string[]>}
 */
export function getQueryObject(req) {
  const params = getSearchParams(req);
  /** @type {Record<string, string | string[]>} */
  const out = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length === 1 ? all[0] : all;
  }
  return out;
}
