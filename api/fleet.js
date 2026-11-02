import crypto from "node:crypto";
import registry from "../docs/projects/registry.json" with { type: "json" };

/**
 * EOS SYSTEM — FLEET REGISTRY & MISSION CONTROL SERVERLESS ENDPOINT (/api/fleet)
 * Governed by SPEC-124 and SPEC-125.
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

  const shouldProbe = Boolean(req.query && (req.query.probe === "true" || req.query.probe === "1"));
  const projects = [];

  for (const project of registry.projects) {
    const item = {
      id: project.id,
      name: project.name,
      remote: project.remoteUrl,
      url: project.productionUrl,
      resolvedLocalDir: project.resolvedLocalDir,
      type: project.type,
      authorization: project.authorization,
      registryStatus: project.status || "UNKNOWN",
      productionProbe: "NOT_PROBED",
      cicdGateStatus: project.cicdGateScript || "NOT_PROBED",
      localHooksStatus: "INSTALLED"
    };

    if (shouldProbe && project.productionUrl) {
      try {
        const start = Date.now();
        const probeRes = await fetch(project.productionUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(3000)
        });
        item.productionProbe = probeRes.status >= 200 && probeRes.status < 400 ? "HEALTHY" : `HTTP_${probeRes.status}`;
        item.latencyMs = Date.now() - start;
      } catch {
        item.productionProbe = "UNREACHABLE";
      }
    }

    projects.push(item);
  }

  const digest = crypto
    .createHash("sha256")
    .update(JSON.stringify(projects))
    .digest("hex");

  return res.status(200).json({
    status: "FLEET_REGISTRY_AVAILABLE",
    version: registry.version,
    updatedAt: registry.updatedAt,
    masterOrchestrator: registry.masterOrchestrator,
    registrySource: "docs/projects/registry.json",
    fleetSize: projects.length,
    healthProbesRun: shouldProbe,
    dispatchExecuted: false,
    commands: {
      fleetShip: "npm run fleet:ship",
      fleetVerify: "npm run fleet:verify",
      fleetInjectHooks: "npm run fleet:hooks"
    },
    projects,
    registryFingerprintSha256: `sha256:${digest}`
  });
}
