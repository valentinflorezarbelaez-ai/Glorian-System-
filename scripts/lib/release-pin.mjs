import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RELEASE_PIN_RELATIVE_PATH = "docs/evidence/RELEASE-PIN.json";
export const RELEASE_PIN_SCHEMA_VERSION = 1;

// Excluded from the digest because the gate rewrites them on every run, and the
// pin itself would make the digest self-referential.
const VOLATILE_EVIDENCE = new Set([
  "docs/evidence/LOCAL-CHECKS-RECEIPT.json",
  "docs/evidence/local-checks.sarif",
  RELEASE_PIN_RELATIVE_PATH
]);

function isVolatileEvidence(relativePath) {
  return (
    VOLATILE_EVIDENCE.has(relativePath) || /^docs\/evidence\/HEAL-.*\.json$/.test(relativePath)
  );
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function listTrackedFiles(root) {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
  return output
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/\\/g, "/"))
    .sort();
}

export function computeInventoryDigest(root) {
  const hasher = crypto.createHash("sha256");
  let fileCount = 0;

  for (const relativePath of listTrackedFiles(root)) {
    if (isVolatileEvidence(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const bytes = fs.readFileSync(absolutePath);
    const digest = sha256Hex(bytes);
    hasher.update(`${relativePath}:${digest}\n`);
    fileCount += 1;
  }

  return { inventoryDigest: `sha256:${hasher.digest("hex")}`, fileCount };
}

export function buildReleasePin({ root, name, version, headCommit, branch, generatedAt }) {
  const { inventoryDigest, fileCount } = computeInventoryDigest(root);
  const payload = {
    schemaVersion: RELEASE_PIN_SCHEMA_VERSION,
    tool: "scripts/release-pin.mjs",
    name,
    version,
    headCommit,
    branch,
    generatedAt,
    inventoryDigest,
    inventoryFileCount: fileCount
  };
  return { ...payload, seal: `sha256:${sha256Hex(canonicalJson(payload))}` };
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

export function verifyReleasePin(
  pin,
  { expectedVersion, expectedCommit, expectedInventoryDigest } = {}
) {
  const errors = [];

  if (!pin || typeof pin !== "object" || Array.isArray(pin)) {
    return { ok: false, errors: ["Release pin must be a JSON object."] };
  }

  if (pin.schemaVersion !== RELEASE_PIN_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion ${String(pin.schemaVersion)}; expected ${RELEASE_PIN_SCHEMA_VERSION}.`
    );
  }

  const { seal, ...payload } = pin;
  if (!isSha256(seal)) {
    errors.push("Missing or malformed 'seal' (expected sha256:<64 hex>).");
  } else if (seal !== `sha256:${sha256Hex(canonicalJson(payload))}`) {
    errors.push("Seal mismatch: the pin payload was modified after sealing.");
  }

  if (typeof pin.name !== "string" || pin.name.trim().length === 0) {
    errors.push("Missing 'name'.");
  }
  if (typeof pin.version !== "string" || pin.version.trim().length === 0) {
    errors.push("Missing 'version'.");
  }
  if (!isSha256(pin.inventoryDigest)) {
    errors.push("Missing or malformed 'inventoryDigest' (expected sha256:<64 hex>).");
  }

  if (expectedVersion !== undefined && pin.version !== expectedVersion) {
    errors.push(`Version drift: pin=${String(pin.version)} package.json=${expectedVersion}.`);
  }

  if (expectedCommit !== undefined && pin.headCommit !== expectedCommit) {
    errors.push(
      `Commit drift: pin=${String(pin.headCommit)} expected=${expectedCommit}. Regenerate with npm run release:pin.`
    );
  }

  if (
    expectedInventoryDigest !== undefined &&
    pin.inventoryDigest !== expectedInventoryDigest
  ) {
    errors.push(
      `Inventory drift: tracked tree changed since the pin was sealed (pin=${String(pin.inventoryDigest)}, current=${expectedInventoryDigest}). Regenerate with npm run release:pin.`
    );
  }

  return { ok: errors.length === 0, errors };
}
