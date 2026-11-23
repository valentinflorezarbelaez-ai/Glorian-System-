import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSearchParams } from "./_safeQuery.js";

/**
 * EOS SYSTEM — READ-ONLY SOUNDCHECK / SCORECARD RECEIPT BRIDGE (/api/scorecard)
 *
 * Serves committed EOS Soundcheck / fleet / L0-consumer receipts for a future
 * Backstage host. Does NOT rescore; envelope metadata (singleWriter / MCP /
 * npmScripts) is kind-specific. Fail-closed Host + Origin allowlists —
 * never Access-Control-Allow-Origin: *.
 *
 * Zero external npm dependencies.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const RECEIPT_KINDS = Object.freeze({
  soundcheck: {
    path: "docs/evidence/SOUNDCHECK_SCORECARD_RECEIPT.json",
    postureDefault: "CONTROL_PLANE_ONLY",
    singleWriter: "src/core/eosBackstageSoundcheckScorecard.ts",
    mcpTier0Tools: Object.freeze(["eos_fleet_soundcheck", "eos_audit_fleet"]),
    npmScripts: Object.freeze(["fleet:scorecards", "fleet:audit"]),
  },
  "fleet-products": {
    path: "docs/evidence/FLEET_PRODUCT_SCORECARDS_RECEIPT.json",
    postureDefault: "CONTROL_PLANE_ONLY",
    singleWriter: "scripts/eos-fleet-product-scorecards.mjs",
    mcpTier0Tools: Object.freeze(["eos_audit_fleet"]),
    npmScripts: Object.freeze(["fleet:scorecards"]),
  },
  "l0-consumer": {
    path: "docs/evidence/MODULE_CONSUMER_GRAPH.json",
    postureDefault: "CONTROL_PLANE_ONLY",
    singleWriter: "scripts/verify-module-consumers.mjs",
    mcpTier0Tools: Object.freeze([]),
    npmScripts: Object.freeze(["boundary:check", "consumers:audit"]),
  },
});

const STATIC_ALLOWED_ORIGINS = new Set([
  "https://glorian-system.vercel.app",
  "https://eos-system.vercel.app",
  "https://eos-system-ten.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:7007",
  "http://127.0.0.1:7007",
]);

const STATIC_ALLOWED_HOSTS = new Set([
  "glorian-system.vercel.app",
  "eos-system.vercel.app",
  "eos-system-ten.vercel.app",
  "localhost",
  "127.0.0.1",
]);

function splitEnvList(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "*");
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : "";
  return typeof raw === "string" ? raw : "";
}

function isAllowedOrigin(origin) {
  if (typeof origin !== "string" || !origin || /[\r\n]/.test(origin)) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return splitEnvList(process.env.EOS_ALLOWED_ORIGINS).includes(origin);
}

function normalizeHost(rawHost) {
  if (typeof rawHost !== "string" || !rawHost || /[\r\n\s/]/.test(rawHost)) return null;
  const host = rawHost.trim().toLowerCase();
  // Strip port for localhost comparisons (Host: localhost:3000).
  const bare = host.includes(":") ? host.split(":")[0] : host;
  if (!bare || bare === "*" || bare.includes("..")) return null;
  return { host, bare };
}

function isAllowedHost(rawHost) {
  const parsed = normalizeHost(rawHost);
  if (!parsed) return false;
  if (STATIC_ALLOWED_HOSTS.has(parsed.bare) || STATIC_ALLOWED_HOSTS.has(parsed.host)) return true;
  const custom = splitEnvList(process.env.EOS_ALLOWED_HOSTS).map((h) => h.toLowerCase());
  return custom.includes(parsed.bare) || custom.includes(parsed.host);
}

function resolveKind(req) {
  // Absent kind → default soundcheck. Duplicate/ambiguous kind → fail closed (null).
  const all = getSearchParams(req).getAll("kind");
  if (all.length === 0) return "soundcheck";
  if (all.length !== 1) return null;
  const kind = all[0];
  if (typeof kind !== "string" || !Object.hasOwn(RECEIPT_KINDS, kind)) return null;
  return kind;
}

function loadReceipt(relPath) {
  const absolute = join(REPO_ROOT, relPath);
  const text = readFileSync(absolute, "utf8");
  const json = JSON.parse(text);
  const digest = crypto.createHash("sha256").update(text).digest("hex");
  return { json, digest, bytes: Buffer.byteLength(text, "utf8") };
}

export function __testOnly_isAllowedOrigin(origin) {
  return isAllowedOrigin(origin);
}

export function __testOnly_isAllowedHost(host) {
  return isAllowedHost(host);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin, Host");

  const origin = headerValue(req.headers, "origin");
  const host = headerValue(req.headers, "host") || headerValue(req.headers, "x-forwarded-host");

  if (!isAllowedHost(host)) {
    return res.status(403).json({
      status: "FORBIDDEN",
      reason: "Host is not allowlisted for the scorecard bridge.",
    });
  }

  const originPresent = origin.length > 0;
  const originAllowed = originPresent ? isAllowedOrigin(origin) : true;
  if (originPresent && !originAllowed) {
    return res.status(403).json({
      status: "FORBIDDEN",
      reason: "Origin is not allowlisted for the scorecard bridge.",
    });
  }

  if (originPresent && originAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  }

  if (req.method === "OPTIONS") {
    return res.status(originPresent ? 204 : 200).end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const kind = resolveKind(req);
  if (!kind) {
    return res.status(400).json({
      status: "BAD_REQUEST",
      reason: "kind must be one of: soundcheck, fleet-products, l0-consumer",
      allowedKinds: Object.keys(RECEIPT_KINDS),
    });
  }

  const meta = RECEIPT_KINDS[kind];
  let receipt;
  try {
    receipt = loadReceipt(meta.path);
  } catch {
    return res.status(503).json({
      status: "RECEIPT_UNAVAILABLE",
      kind,
      receiptPath: meta.path,
    });
  }

  const body = {
    status: "SCORECARD_RECEIPT_AVAILABLE",
    kind,
    readOnly: true,
    portalMustNotRescore: true,
    fleetPostureDefault: meta.postureDefault,
    receiptPath: meta.path,
    receiptSha256: `sha256:${receipt.digest}`,
    receiptBytes: receipt.bytes,
    singleWriter: meta.singleWriter,
    mcpTier0Tools: [...meta.mcpTier0Tools],
    npmScripts: [...meta.npmScripts],
    rawGithubUrl: `https://raw.githubusercontent.com/valentinflorezarbelaez-ai/Glorian-System-/main/${meta.path}`,
    receipt: receipt.json,
  };

  if (req.method === "HEAD") {
    res.setHeader("X-EOS-Receipt-Sha256", body.receiptSha256);
    return res.status(200).end();
  }

  return res.status(200).json(body);
}
