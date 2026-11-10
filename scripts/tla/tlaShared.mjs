import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");
export const formalDir = path.join(root, "docs/formal");

const INVARIANT_NAME_KEYWORDS = ["Invariant", "Overrun", "Bounds", "Monotonic", "NoDeadlock", "Isolation"];

function isInvariantDeclarationName(name) {
  return INVARIANT_NAME_KEYWORDS.some((kw) => name.includes(kw));
}

export function parseTlaModule(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`TLA+ specification file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const moduleMatch = raw.match(/MODULE\s+([A-Za-z0-9_]+)/);
  const moduleName = moduleMatch ? moduleMatch[1] : path.basename(filePath, ".tla");

  const varMatch = raw.match(/VARIABLES([\s\S]*?)(?=\r?\n[a-zA-Z_]+\s*==|----------------)/);
  const variables = varMatch
    ? varMatch[1]
        .split("\n")
        .map((line) => line.replace(/\\\*.*$/, "").trim())
        .filter(Boolean)
        .flatMap((line) => line.split(","))
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  const invariants = [];
  const invRegex = /([A-Za-z0-9_]+)\s*==\s*[\r\n]+([\s\S]*?)(?=\r?\n[A-Za-z0-9_]+\s*==|====)/g;
  let match;
  while ((match = invRegex.exec(raw)) !== null) {
    const name = match[1];
    if (isInvariantDeclarationName(name)) {
      invariants.push(name);
    }
  }

  return { moduleName, raw, variables, invariants };
}
