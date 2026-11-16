#!/usr/bin/env node
/**
 * Fleet RUM/CWV field-ish probe via Navigation Timing + Paint Timing.
 *
 * Uses undici/fetch + PerformanceResourceTiming is NOT available in Node for
 * remote pages. This script instead:
 *  1) Fetches each production URL (TTFB / transfer).
 *  2) Optionally accepts browser CDP payloads via --from-json=<file>.
 *  3) Seals docs/evidence/FLEET_RUM_CWV_RECEIPT.json with honest epistemic label.
 *
 * Epistemic: NAVIGATION_TIMING_PROXY_WITHIN_TESTED_SCOPE
 * Not CrUX, not multi-device lab Lighthouse fleet, not Level-5.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8"));
const projects = (registry.projects || []).filter((p) => String(p.productionUrl || "").startsWith("https://"));

const LCP_BUDGET_MS = 2500;
const TTFB_BUDGET_MS = 800;
const CLS_BUDGET = 0.1; // only when browser payload provided

const fromJson = process.argv.find((a) => a.startsWith("--from-json="));
const browserPayload = fromJson
  ? JSON.parse(fs.readFileSync(path.resolve(root, fromJson.slice("--from-json=".length)), "utf8"))
  : null;

async function edgeProbe(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "eos-fleet-rum-cwv/1.0" },
    });
    const buf = await res.arrayBuffer();
    const ttfbMs = Date.now() - t0;
    return {
      ok: res.status >= 200 && res.status < 400,
      statusCode: res.status,
      ttfbMs,
      transferBytes: buf.byteLength,
      lcpMs: null,
      cls: null,
      inpMs: null,
      source: "EDGE_FETCH",
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      ttfbMs: Date.now() - t0,
      transferBytes: 0,
      lcpMs: null,
      cls: null,
      inpMs: null,
      source: "EDGE_FETCH",
      error: String(err?.message || err),
    };
  }
}

const services = [];
for (const project of projects) {
  const browser = browserPayload?.services?.find((s) => s.serviceId === project.id) || null;
  const edge = await edgeProbe(project.productionUrl);
  const merged = {
    serviceId: project.id,
    host: new URL(project.productionUrl).host,
    ...edge,
    ...(browser
      ? {
          lcpMs: browser.lcpMs ?? null,
          cls: browser.cls ?? null,
          inpMs: browser.inpMs ?? null,
          source: browser.lcpMs != null ? "BROWSER_CDP+EDGE" : edge.source,
        }
      : {}),
  };
  const budgets = {
    ttfbOk: merged.ttfbMs <= TTFB_BUDGET_MS,
    lcpOk: merged.lcpMs == null ? null : merged.lcpMs <= LCP_BUDGET_MS,
    clsOk: merged.cls == null ? null : merged.cls <= CLS_BUDGET,
  };
  const healthState = !merged.ok
    ? "UNREACHABLE"
    : budgets.lcpOk === false || budgets.clsOk === false || !budgets.ttfbOk
      ? "DEGRADED"
      : "NOMINAL_HEALTHY";
  services.push({ ...merged, budgets, healthState });
}

const receipt = {
  epistemicState: "NAVIGATION_TIMING_PROXY_WITHIN_TESTED_SCOPE",
  claimsDenied: ["CrUX field data", "multi-device Lighthouse lab", "Level-5", "FEDERAL_ATO"],
  measuredAt: new Date().toISOString(),
  budgets: { ttfbMs: TTFB_BUDGET_MS, lcpMs: LCP_BUDGET_MS, cls: CLS_BUDGET },
  browserPayloadAttached: Boolean(browserPayload),
  services,
  metrics: {
    targets: services.length,
    nominal: services.filter((s) => s.healthState === "NOMINAL_HEALTHY").length,
    degraded: services.filter((s) => s.healthState === "DEGRADED").length,
    unreachable: services.filter((s) => s.healthState === "UNREACHABLE").length,
    withBrowserLcp: services.filter((s) => s.lcpMs != null).length,
  },
};
receipt.sha256 = crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex");

const out = path.join(root, "docs/evidence/FLEET_RUM_CWV_RECEIPT.json");
fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n", "utf8");
console.log(
  JSON.stringify(
    {
      receipt: "docs/evidence/FLEET_RUM_CWV_RECEIPT.json",
      metrics: receipt.metrics,
      sha256: receipt.sha256,
      note: receipt.browserPayloadAttached
        ? "Browser CDP metrics merged"
        : "Edge-only proxy — pass --from-json=browser-cwv.json for LCP/CLS/INP",
    },
    null,
    2,
  ),
);
process.exit(receipt.metrics.unreachable > 0 ? 2 : 0);
