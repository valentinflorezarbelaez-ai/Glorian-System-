import { getDefaultPrometheusExporter } from "../src/core/eosOtelPrometheusExporter.ts";

// Rate limiting — 50 burst, 20/sec steady with graceful fallback
let _rateLimited = (fn) => fn;
try {
  const { withRateLimit } = await import("../src/core/eosApiRateLimit.ts");
  _rateLimited = withRateLimit({ capacity: 50, refillPerSecond: 20 });
} catch {
  // Pass-through when rate limiter module is unavailable
}

/**
 * GLORIAN SYSTEM — CANONICAL PROMETHEUS METRICS EXPOSITION ENDPOINT (/api/metrics)
 * Conforms to OpenMetrics RFC & Prometheus Text Exposition Format (version 0.0.4).
 *
 * Exposes Google SRE Golden Signals (RED metrics: Rate, Errors, Duration quantiles P50/P90/P99)
 * and Node.js process memory gauges for enterprise scrapers (Prometheus, Datadog, Grafana Agent).
 *
 * Zero external runtime dependencies.
 */
function handler(req, res) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    if (typeof res.status === "function") {
      return res.status(405).json({ error: "Method Not Allowed", allowedMethods: ["GET", "HEAD"] });
    }
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  const exporter = getDefaultPrometheusExporter();
  const metricsText = exporter.exportPrometheusText();

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (typeof res.status === "function") {
    res.status(200);
    if (typeof res.send === "function") {
      return res.send(metricsText);
    }
  } else {
    res.statusCode = 200;
  }

  return res.end(metricsText);
}

export default _rateLimited(handler);
