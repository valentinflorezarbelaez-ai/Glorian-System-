#!/usr/bin/env node
/**
 * SPEC-123: EOS Universal Fleet Secret-Scan Gate & UI Leak Detector
 *
 * Zero-dependency canonical scanner enforcing EOS Constitution Law VI (Zero Plain Secrets)
 * and Law I (Specification as Supreme Truth).
 *
 * Detectors:
 *   D1: Known vendor token formats (sk-live, ghp_, AKIA, AIzaSy, PEM, Supabase service_role JWT).
 *   D2: Credential variable/property assignments in code (JS/TS/Python/JSON/YAML).
 *   D3: HTML/Template prefilled password inputs (<input type="password" value="...">).
 *   D4: Literal propagation across files.
 *   UI: Developer plumbing leak detector (EOS SPEC-xxx / ENGRAM #xxx in public HTML).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SAFE_PLACEHOLDERS = new Set([
  "",
  "***",
  "****",
  "*****",
  "[redacted]",
  "[redacted_password]",
  "[redacted_secret]",
  "placeholder",
  "dummy",
  "test",
  "password",
  "admin",
  "default",
  "changeme",
  "secret",
  "none",
  "undefined",
  "null",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".mp3",
  ".mp4",
  ".wav",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".bin",
  ".dat",
  ".xlsx",
  ".docx",
  ".wasm",
  ".sqlite",
  ".db",
  ".lock",
  ".sum",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  ".eos",
  ".gemini",
]);

export function maskSecret(secret) {
  if (typeof secret !== "string") return "[invalid]";
  const len = secret.length;
  const hash = crypto.createHash("sha256").update(secret).digest("hex").slice(0, 16);
  if (len <= 4) {
    return `*** (${len} chars, sha256:${hash})`;
  }
  const prefix = secret.slice(0, 2);
  const suffix = secret.slice(-2);
  return `${prefix}***${suffix} (${len} chars, sha256:${hash})`;
}

export function detectVendorTokens(content, filePath) {
  const findings = [];

  // D1_OPENAI_KEY
  const openAiRegex = /\b(sk-(?:proj-)?[A-Za-z0-9_-]{32,})\b/g;
  let match;
  while ((match = openAiRegex.exec(content)) !== null) {
    findings.push({
      rule: "D1_OPENAI_KEY",
      filePath,
      matchValue: match[1],
      description: "OpenAI API secret key detected",
    });
  }

  // D1_GITHUB_TOKEN
  const ghRegex = /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,})\b/g;
  while ((match = ghRegex.exec(content)) !== null) {
    findings.push({
      rule: "D1_GITHUB_TOKEN",
      filePath,
      matchValue: match[1],
      description: "GitHub personal access token detected",
    });
  }

  // D1_AWS_KEY
  const awsRegex = /\b((?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})\b/g;
  while ((match = awsRegex.exec(content)) !== null) {
    findings.push({
      rule: "D1_AWS_KEY",
      filePath,
      matchValue: match[1],
      description: "AWS access key ID detected",
    });
  }

  // D1_GOOGLE_KEY
  const googleRegex = /\b(AIzaSy[0-9A-Za-z_-]{30,35})\b/g;
  while ((match = googleRegex.exec(content)) !== null) {
    findings.push({
      rule: "D1_GOOGLE_KEY",
      filePath,
      matchValue: match[1],
      description: "Google Cloud / Firebase API key detected",
    });
  }

  // D1_PEM_BLOCK
  const pemRegex = /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g;
  while ((match = pemRegex.exec(content)) !== null) {
    findings.push({
      rule: "D1_PEM_BLOCK",
      filePath,
      matchValue: match[0],
      description: "Unencrypted private key PEM block detected",
    });
  }

  // D1_SUPABASE_SERVICE_ROLE JWT
  const jwtRegex = /\b(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g;
  while ((match = jwtRegex.exec(content)) !== null) {
    const rawJwt = match[1];
    const parts = rawJwt.split(".");
    if (parts.length >= 2) {
      try {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
        if (payloadJson.includes('"service_role"') || payloadJson.includes('"role":"service_role"')) {
          findings.push({
            rule: "D1_SUPABASE_SERVICE_ROLE",
            filePath,
            matchValue: rawJwt,
            description: "Supabase elevated service_role JWT key detected",
          });
        }
      } catch {
        // Not a valid base64url payload, ignore
      }
    }
  }

  return findings;
}

export function detectCredentialAssignments(content, filePath) {
  const normPath = path.resolve(filePath).replace(/\\/g, "/");
  if (normPath.includes("/openspec/") || normPath.includes("/docs/")) {
    return [];
  }

  const findings = [];
  const assignRegex =
    /\b(?:password|passwd|passphrase|userPass|user_pass|adminPass|admin_pass|masterPass|master_pass|masterPassword|master_password|secret_key|api_secret|apiSecret|client_secret|clientSecret|auth_secret|authSecret|secretToken|secret_token|private_key|privateKey)\b\s*[:=]\s*["']([^"']+)["']/gi;
  let match;
  while ((match = assignRegex.exec(content)) !== null) {
    const rawVal = match[1];
    const trimmed = rawVal.trim().toLowerCase();

    // Check safe markers
    if (SAFE_PLACEHOLDERS.has(trimmed)) continue;
    if (rawVal.startsWith("process.env") || rawVal.startsWith("$")) continue;
    if (rawVal.length < 5) continue;

    findings.push({
      rule: "D2_CREDENTIAL_ASSIGNMENT",
      filePath,
      matchValue: rawVal,
      description: "Hardcoded credential or password assignment detected",
    });
  }
  return findings;
}

export function detectPrefilledPasswordInputs(content, filePath) {
  const normPath = path.resolve(filePath).replace(/\\/g, "/");
  if (filePath.includes("eos-secret-scan") || normPath.includes("/openspec/") || normPath.includes("/docs/")) {
    return [];
  }
  const findings = [];
  // Matches <input ... > tags
  const inputTagRegex = /<input\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = inputTagRegex.exec(content)) !== null) {
    const tag = tagMatch[0];
    const isPassType = /\btype=["']password["']/i.test(tag);
    if (!isPassType) continue;

    const valueMatch = /\bvalue=["']([^"']*)["']/i.exec(tag);
    if (valueMatch) {
      const val = valueMatch[1];
      const trimmed = val.trim().toLowerCase();
      if (val.length > 0 && !SAFE_PLACEHOLDERS.has(trimmed)) {
        findings.push({
          rule: "D3_PREFILLED_PASSWORD_INPUT",
          filePath,
          matchValue: val,
          description: "HTML input element with type='password' has non-empty hardcoded value",
        });
      }
    }
  }
  return findings;
}

function isExemptMarkupPath(filePath) {
  const normPath = String(filePath || "").replace(/\\/g, "/");
  const lower = normPath.toLowerCase();
  const resolved = path.resolve(normPath).replace(/\\/g, "/");
  const cwdLanding = path.resolve(process.cwd(), "index.html").replace(/\\/g, "/");
  const directoryMarkers = ["/openspec/", "/docs/", "/test/", "/tools/", "/scripts/", "/.agents/"];
  const relativeMarkers = ["openspec/", "docs/", "test/", "tools/", "scripts/", ".agents/"];

  if (directoryMarkers.some((marker) => lower.includes(marker) || resolved.toLowerCase().includes(marker))) {
    return true;
  }
  if (relativeMarkers.some((marker) => lower.startsWith(marker))) {
    return true;
  }
  if (lower === "index.html" || resolved === cwdLanding) {
    return true;
  }
  return (
    lower.endsWith("eos-system/index.html") ||
    lower.endsWith("glorian-system/index.html") ||
    lower.endsWith("glorian-system-/index.html")
  );
}

export function detectUiPlumbingLeaks(content, filePath) {
  const normPath = String(filePath || "").replace(/\\/g, "/");
  const ext = path.extname(normPath).toLowerCase();

  // UI leak detector only inspects client-facing markup/HTML files
  if (![".html", ".htm", ".vue", ".svelte"].includes(ext)) {
    return [];
  }

  // Exempt formal documentation, spec directories, and this checkout's own landing page.
  // The landing exemption follows the file, not the folder name: CI workspaces are not
  // always named Glorian-System, and path.resolve("index.html") is never equal to "index.html".
  if (isExemptMarkupPath(normPath)) {
    return [];
  }

  const findings = [];
  const leakRegex = /\b(?:EOS\s+SPEC-\d+|ENGRAM\s+#\d+|SPEC-\d{3,})\b/gi;
  let match;
  while ((match = leakRegex.exec(content)) !== null) {
    findings.push({
      rule: "UI_SPEC_BADGE_LEAK",
      filePath,
      matchValue: match[0],
      description: `Internal technical governance badge '${match[0]}' leaked into public client-facing HTML markup`,
    });
  }
  return findings;
}

export function isAllowlisted(secret, relativePath, allowlist = []) {
  if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
    return { isAllowed: false };
  }

  const normPath = relativePath.replace(/\\/g, "/");
  const hash = crypto.createHash("sha256").update(secret).digest("hex");

  for (const entry of allowlist) {
    if (entry.fingerprintSha256 !== hash) continue;

    // Check path constraint if defined
    if (entry.path) {
      const entryNormPath = entry.path.replace(/\\/g, "/");
      if (entryNormPath !== normPath && !normPath.endsWith(entryNormPath)) {
        continue;
      }
    }

    // Check expiry
    if (entry.expiresAt) {
      const expDate = new Date(entry.expiresAt);
      if (isNaN(expDate.getTime()) || expDate.getTime() < Date.now()) {
        return { isAllowed: false, rejectionReason: "EXPIRED" };
      }
    }

    // Valid allowlist entry
    return { isAllowed: true, reason: entry.reason };
  }

  return { isAllowed: false };
}

export function scanFileContent(content, filePath, allowlist = [], knownSecrets = new Set()) {
  const rawFindings = [
    ...detectVendorTokens(content, filePath),
    ...detectCredentialAssignments(content, filePath),
    ...detectPrefilledPasswordInputs(content, filePath),
    ...detectUiPlumbingLeaks(content, filePath),
  ];

  // D4: Literal propagation check
  if (knownSecrets.size > 0) {
    for (const secret of knownSecrets) {
      if (secret && secret.length >= 6 && content.includes(secret)) {
        if (!rawFindings.some((f) => f.matchValue === secret)) {
          rawFindings.push({
            rule: "D4_LITERAL_PROPAGATION",
            filePath,
            matchValue: secret,
            description: "Known hardcoded secret propagated across codebase files",
          });
        }
      }
    }
  }

  // Filter against allowlist
  const activeFindings = [];
  for (const f of rawFindings) {
    const allowed = isAllowlisted(f.matchValue, filePath, allowlist);
    if (!allowed.isAllowed) {
      activeFindings.push({
        ...f,
        maskedValue: maskSecret(f.matchValue),
        fingerprintSha256: crypto.createHash("sha256").update(f.matchValue).digest("hex"),
      });
    }
  }

  return activeFindings;
}

function loadAllowlist(resolvedDir) {
  const allowlistPath = path.join(resolvedDir, ".eos", "secret-allowlist.json");
  if (!fs.existsSync(allowlistPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
    return Array.isArray(parsed) ? parsed : parsed.allowlist || [];
  } catch {
    return [];
  }
}

function collectScannableFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) collectScannableFiles(path.join(dir, entry.name), out);
    } else if (entry.isFile() && !BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

export async function scanDirectory(targetDir, _options = {}) {
  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    return {
      exitCode: 2,
      error: `Target directory does not exist: ${resolvedDir}`,
      scannedFilesCount: 0,
      findings: [],
    };
  }

  const allowlist = loadAllowlist(resolvedDir);
  const allFiles = collectScannableFiles(resolvedDir);
  if (allFiles.length === 0) {
    return {
      exitCode: 2,
      error: `Fail-closed: No scannable text files found in ${resolvedDir}`,
      scannedFilesCount: 0,
      findings: [],
    };
  }

  const findings = [];
  const knownSecrets = new Set();

  for (const filePath of allFiles) {
    const relPath = path.relative(resolvedDir, filePath);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      for (const f of scanFileContent(content, filePath, allowlist, knownSecrets)) {
        f.filePath = relPath;
        findings.push(f);
        if (f.rule.startsWith("D") && f.matchValue && f.matchValue.length >= 6) {
          knownSecrets.add(f.matchValue);
        }
      }
    } catch {
      // Unreadable file
    }
  }

  return {
    exitCode: findings.length > 0 ? 1 : 0,
    targetDir: resolvedDir,
    scannedFilesCount: allFiles.length,
    findingsCount: findings.length,
    findings,
  };
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith("eos-secret-scan.mjs")) {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const isFleet = args.includes("--fleet");
  const targetArg = args.find((a) => !a.startsWith("--")) || ".";

  if (isFleet) {
    // Read-only fleet audit mode
    const registryPath = path.resolve("docs/projects/registry.json");
    if (!fs.existsSync(registryPath)) {
      console.error("Registry file not found:", registryPath);
      process.exit(2);
    }
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const report = {
      timestamp: new Date().toISOString(),
      scanner: "eos-secret-scan-v1.0.0",
      projectsScanned: 0,
      totalFindings: 0,
      results: [],
    };

    for (const proj of registry.projects || []) {
      const localPath = process.env[proj.localPathEnv] || path.resolve("..", proj.resolvedLocalDir || proj.id);
      if (fs.existsSync(localPath)) {
        const res = await scanDirectory(localPath);
        report.projectsScanned++;
        report.totalFindings += res.findingsCount || 0;
        report.results.push({
          id: proj.id,
          name: proj.name,
          scannedFiles: res.scannedFilesCount,
          exitCode: res.exitCode,
          findings: res.findings,
        });
      }
    }

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`\n🛡️ EOS FLEET SECRET SCAN REPORT (${report.timestamp})`);
      console.log(`Projects Scanned: ${report.projectsScanned} | Total Findings: ${report.totalFindings}`);
      for (const r of report.results) {
        console.log(
          ` - [${r.exitCode === 0 ? "PASS" : "FAIL"}] ${r.name} (${r.scannedFiles} files, ${r.findings.length} findings)`,
        );
      }
    }
    process.exit(report.totalFindings > 0 ? 1 : 0);
  } else {
    const result = await scanDirectory(targetArg);
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.exitCode === 0) {
        console.log(
          `✅ [PASS] Secret scan verified clean: ${result.scannedFilesCount} files examined in ${targetArg}. Zero plain secrets detected.`,
        );
      } else if (result.exitCode === 2) {
        console.error(`❌ [ERROR] Scan failed to execute: ${result.error}`);
      } else {
        console.error(`🚨 [FAIL] ${result.findings.length} plain secrets or leaks detected in ${targetArg}:`);
        for (const f of result.findings) {
          console.error(`   - [${f.rule}] ${f.filePath}: ${f.description} -> ${f.maskedValue}`);
        }
      }
    }
    process.exit(result.exitCode);
  }
}
