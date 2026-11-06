#!/usr/bin/env node
/**
 * Peak Assurance Wave C — bounded adversarial campaign against TCB predicates.
 * Chaos + property probes; fail-closed if any critical invariant breaks.
 * Zero npm runtime dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  evaluateMcpAdmission,
  evaluateExternalWrite,
  hashToken,
  MCP_MAX_PAYLOAD_BYTES
} from "../src/core/eosPeakAssuranceTcb.ts";
import { EosPropertyFuzzingHypervisor } from "../src/core/eosPropertyFuzzingHypervisor.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const criticalFindings = [];
const probes = [];

function probe(name, fn) {
  try {
    fn();
    probes.push({ name, status: "PASS" });
  } catch (err) {
    criticalFindings.push({ name, error: err?.message || String(err) });
    probes.push({ name, status: "FAIL", error: err?.message || String(err) });
  }
}

probe("chaos-origin-random", () => {
  const allow = ["https://glorian-system.vercel.app"];
  for (let i = 0; i < 500; i++) {
    const origin = i % 17 === 0 ? allow[0] : `https://x${i}.evil.test`;
    const res = evaluateMcpAdmission({
      origin,
      allowlist: allow,
      payloadBytes: 128,
      presentedToken: "t".repeat(32)
    });
    if (origin !== allow[0] && res.admitted) throw new Error("evil origin admitted");
    if (origin === allow[0] && !res.admitted && res.reason !== "MISSING_TOKEN") {
      // allowed origin without session hash should admit when token present
      if (res.reason === "ORIGIN_DENIED") throw new Error("allowlisted origin denied");
    }
  }
});

probe("chaos-payload-boundary", () => {
  const allow = ["https://glorian-system.vercel.app"];
  const over = evaluateMcpAdmission({
    origin: allow[0],
    allowlist: allow,
    payloadBytes: MCP_MAX_PAYLOAD_BYTES + 1,
    presentedToken: "u".repeat(32)
  });
  if (over.admitted || over.reason !== "PAYLOAD_TOO_LARGE") throw new Error("payload bound failed");
  const ok = evaluateMcpAdmission({
    origin: allow[0],
    allowlist: allow,
    payloadBytes: MCP_MAX_PAYLOAD_BYTES,
    presentedToken: "u".repeat(32)
  });
  if (!ok.admitted) throw new Error("exact 1MiB should admit");
});

probe("chaos-token-binding", () => {
  const a = "v".repeat(32);
  const b = "w".repeat(32);
  const h = hashToken(a);
  const res = evaluateMcpAdmission({
    origin: "https://glorian-system.vercel.app",
    allowlist: ["https://glorian-system.vercel.app"],
    payloadBytes: 10,
    sessionTokenHash: h,
    presentedToken: b
  });
  if (res.admitted) throw new Error("mismatched token admitted");
});

probe("chaos-law-iv", () => {
  const incomplete = evaluateExternalWrite({
    registered: true,
    intakeComplete: true,
    specificationApproved: false,
    auditComplete: true,
    ownerApproval: true,
    implementationAuthorized: true
  });
  if (incomplete.admitted) throw new Error("Law IV incomplete admitted");
});

probe("property-fuzz-hypervisor-smoke", () => {
  const fuzz = new EosPropertyFuzzingHypervisor(root);
  const report = fuzz.runFuzzCampaign({ seed: 0xc0ffee, iterations: 64 });
  if (!report || report.passed !== true) {
    throw new Error(`fuzz campaign failed: invariantsViolated=${report?.invariantsViolated}`);
  }
});

const receipt = {
  campaignId: "PEAK-ASSURANCE-WAVE-C",
  timestampIso: new Date().toISOString(),
  probes,
  criticalFindings,
  criticalUnfixed: criticalFindings.length,
  status: criticalFindings.length === 0 ? "PASS" : "FAIL",
  sha256: ""
};
receipt.sha256 = crypto.createHash("sha256").update(JSON.stringify({
  probes: receipt.probes,
  criticalFindings: receipt.criticalFindings
})).digest("hex");

const outDir = path.join(root, "docs", "evidence", "assurance-binder");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "adversarial-campaign-receipt.json");
fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");

console.log(JSON.stringify({ status: receipt.status, criticalUnfixed: receipt.criticalUnfixed, outPath }, null, 2));
process.exit(criticalFindings.length === 0 ? 0 : 1);
