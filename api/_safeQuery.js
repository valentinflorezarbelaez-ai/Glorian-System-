/**
 * WHATWG URL query parser for Vercel serverless handlers.
 * Avoids Node DEP0169 from legacy url.parse used by lazy req.query getters.
 * Plain own-property `query` objects (test mocks) are honored without getters.
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
 * @param {import('http').IncomingMessage & { url?: string }} req
 * @param {string} key
 * @returns {string | null}
 */
export function getQueryParam(req, key) {
  const value = getSearchParams(req).get(key);
  return value === null ? null : value;
}

/**
 * @param {import('http').IncomingMessage & { url?: string }} req
 * @returns {Record<string, string>}
 */
export function getQueryObject(req) {
  const out = {};
  for (const [key, value] of getSearchParams(req).entries()) {
    out[key] = value;
  }
  return out;
}
