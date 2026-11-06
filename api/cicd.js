import crypto from "node:crypto";

/**
 * EOS SYSTEM — BOUNDED CI/CD STATE-MACHINE DEMONSTRATION (/api/cicd)
 * Simulates seven illustrative stages and scans only the caller-supplied sample text.
 * It does not execute the repository pipeline, produce an SBOM, or deploy code.
 * Zero external dependencies.
 */

const SEVEN_CICD_GATES = [
  {
    stage: 1,
    id: "sast-zero-secrets",
    name: "Simulation: credential-pattern scan on the supplied sample only",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 2,
    id: "sdd-constitutional-gate",
    name: "Simulation: specification review stage (not executed)",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 3,
    id: "source-inventory-simulation",
    name: "Simulation: dependency and source-inventory stage (not executed)",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 4,
    id: "syntax-architecture-simulation",
    name: "Simulation: syntax and architecture stage (not executed)",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 5,
    id: "accessibility-performance-simulation",
    name: "Simulation: accessibility and performance stage (not executed)",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 6,
    id: "serverless-api-smoke",
    name: "Simulation: API smoke-check stage (not executed)",
    status: "PASSED",
    findings: 0,
  },
  {
    stage: 7,
    id: "deployment-not-run",
    name: "Simulation: deployment stage (no deployment or live probe)",
    status: "PASSED",
    findings: 0,
  }
];

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ status: "METHOD_NOT_ALLOWED" });
  }

  const modeValue = req.query && req.query.mode;
  const payloadSample = req.query && req.query.payload;
  if (modeValue !== undefined && (typeof modeValue !== "string" || modeValue.length > 64)) {
    return res.status(400).json({ status: "INVALID_MODE" });
  }
  if (payloadSample !== undefined && typeof payloadSample !== "string") {
    return res.status(400).json({ status: "INVALID_PAYLOAD" });
  }
  if (typeof payloadSample === "string" && Buffer.byteLength(payloadSample, "utf8") > 8192) {
    return res.status(413).json({ status: "PAYLOAD_TOO_LARGE", maxBytes: 8192 });
  }
  const mode = modeValue || "full-pipeline";

  // Narrow pattern-based simulation on caller-supplied sample text only.
  const secretRegex = /(sk-live-[0-9a-zA-Z]+|ghp_[0-9a-zA-Z]+|AKIA[0-9A-Z]{16}|-----BEGIN (RSA )?PRIVATE KEY-----|\beval\s*\()/;
  const blockedBySast = secretRegex.test(payloadSample || "");

  const simulatedGates = SEVEN_CICD_GATES.map((gate) => {
    if (!blockedBySast) return { ...gate, status: "SIMULATED_PASS" };
    if (gate.stage === 1) return { ...gate, status: "BLOCKED", findings: 1 };
    return { ...gate, status: "NOT_RUN", findings: 0 };
  });

  const simulationFingerprint = crypto
    .createHash("sha256")
    .update(`EOS_CICD_SIMULATION_V9:${mode}:${blockedBySast ? "BLOCKED" : "CLEAN"}`)
    .digest("hex");

  return res.status(200).json({
    status: blockedBySast ? "SIMULATION_BLOCKED_BY_STAGE_1_SAST" : "SIMULATION_ONLY",
    version: "9.0.0-sovereign-cicd-secdevops",
    simulation: true,
    scope: "bounded pattern simulation over the supplied sample only",
    repositoryScanned: false,
    testsRun: false,
    sbomGenerated: false,
    externalCommandsRun: false,
    deploymentPerformed: false,
    productionProbeRun: false,
    sampleBytesScanned: Buffer.byteLength(payloadSample || "", "utf8"),
    deploymentEligible: false,
    failClosedSimulation: blockedBySast,
    blockedBySast,
    referencedHookArtifacts: [".githooks/pre-commit", ".githooks/pre-push", ".github/workflows/eos-sovereign-cicd.yml"],
    localHookStatus: "NOT_PROBED",
    commands: {
      verifyGate: "npm run cicd:gate",
      autoShip: "npm run ship:sovereign"
    },
    gates: simulatedGates,
    simulationFingerprintSha256: `sha256:${simulationFingerprint}`
  });
}
