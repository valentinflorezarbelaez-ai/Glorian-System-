/**
 * Big-Tech style landing gate contract (AWS Well-Architected + Spotify Soundcheck lite).
 * Used by satellite verify-*.mjs scripts: presence + package integrity + deploy surface + secret hygiene.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function assertFleetLandingGate(root, options = {}) {
  const requiredFiles = options.requiredFiles || [];
  const requiredPkgScripts = options.requiredPkgScripts || [];
  const errors = [];

  for (const rel of requiredFiles) {
    if (!existsSync(join(root, rel))) errors.push(`MISSING_FILE:${rel}`);
  }

  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      errors.push("PACKAGE_JSON_INVALID");
      pkg = null;
    }
    if (pkg) {
      if (!pkg.name || typeof pkg.name !== "string") errors.push("PACKAGE_NAME_MISSING");
      const scripts = pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
      for (const s of requiredPkgScripts) {
        if (typeof scripts[s] !== "string" || scripts[s].trim() === "") {
          errors.push(`PACKAGE_SCRIPT_MISSING:${s}`);
        }
      }
    }
  } else if (options.requirePackageJson !== false) {
    errors.push("MISSING_FILE:package.json");
  }

  const vercelPath = join(root, "vercel.json");
  if (options.requireVercelJson !== false && !existsSync(vercelPath)) {
    errors.push("MISSING_FILE:vercel.json");
  }

  // Secret hygiene: refuse committed dotenv credential files in the gate root.
  for (const name of [".env", ".env.local", ".env.production"]) {
    if (existsSync(join(root, name))) {
      errors.push(`COMMITTED_OR_PRESENT_DOTENV:${name}`);
    }
  }

  // Shallow anti-placeholder: no obvious TODO SECURITY in vercel.json when present.
  if (existsSync(vercelPath)) {
    const vercelRaw = readFileSync(vercelPath, "utf8");
    if (/BEGIN PRIVATE KEY|AKIA[0-9A-Z]{16}|sk_live_/i.test(vercelRaw)) {
      errors.push("VERCEL_JSON_SECRET_PATTERN");
    }
  }

  if (options.requireGitignoreEnv !== false) {
    const gi = join(root, ".gitignore");
    if (!existsSync(gi)) errors.push("MISSING_FILE:.gitignore");
    else {
      const text = readFileSync(gi, "utf8");
      if (!/\.env/i.test(text)) errors.push("GITIGNORE_MISSING_ENV_RULE");
    }
  }

  // Bound directory walk noise: ensure scripts/ exists when declared.
  if (options.requireScriptsDir && !existsSync(join(root, "scripts"))) {
    errors.push("MISSING_DIR:scripts");
  }

  // Optional: ensure repo is not empty of source-ish files.
  if (options.minRootEntries) {
    const entries = readdirSync(root).filter((e) => !e.startsWith("."));
    if (entries.length < options.minRootEntries) {
      errors.push(`ROOT_TOO_SPARSE:${entries.length}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
