import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectVendorTokens,
  detectCredentialAssignments,
  detectPrefilledPasswordInputs,
  detectUiPlumbingLeaks,
  maskSecret,
  isAllowlisted,
  scanFileContent,
  scanDirectory
} from "../scripts/eos-secret-scan.mjs";

describe("SPEC-123: Fleet Secret-Scan Gate & UI Leak Detector", () => {
  describe("FR-367 / BDD-353: D1 Vendor Token Detector", () => {
    it("flags OpenAI, GitHub, AWS, Google API keys, and PEM blocks", () => {
      const sample = [
        'const openai = "' + 'sk-' + 'proj-abc123456789012345678901234567890";',
        'const ghToken = "' + 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz";',
        'const awsKey = "' + 'AKIA' + 'IOSFODNN7EXAMPLE";',
        'const gKey = "' + 'AIzaSy' + 'D-1234567890abcdefghijklmnopqr123";',
        'const pem = "-----BEGIN ' + 'RSA PRIVATE KEY-----";'
      ].join("\n");
      const findings = detectVendorTokens(sample, "src/config.js");
      assert.equal(findings.length, 5);
      assert.ok(findings.some((f) => f.rule === "D1_OPENAI_KEY"));
      assert.ok(findings.some((f) => f.rule === "D1_GITHUB_TOKEN"));
      assert.ok(findings.some((f) => f.rule === "D1_AWS_KEY"));
      assert.ok(findings.some((f) => f.rule === "D1_GOOGLE_KEY"));
      assert.ok(findings.some((f) => f.rule === "D1_PEM_BLOCK"));
    });

    it("flags Supabase service_role JWT", () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ role: "service_role", sub: "123" })).toString("base64url");
      const jwt = `${header}.${payload}.signature12345678901234567890`;
      const findings = detectVendorTokens(`const secret = "${jwt}";`, "app.js");
      assert.ok(findings.some((f) => f.rule === "D1_SUPABASE_SERVICE_ROLE"));
    });
  });

  describe("FR-368 / BDD-354: D2 Credential Assignment Detector", () => {
    it("flags hardcoded passwords and secrets in JS/TS/JSON/Python", () => {
      const sample = `
        const masterPassword = "Avopak2026*.@";
        const userPass = 'UltraSecret99!';
        const apiSecret = "super_classified_token_xyz";
      `;
      const findings = detectCredentialAssignments(sample, "src/auth.js");
      assert.ok(findings.length >= 3);
      assert.ok(findings.some((f) => f.matchValue === "Avopak2026*.@"));
    });

    it("ignores safe markers, empty strings, env lookups, and placeholders", () => {
      const safeSample = `
        const pass1 = "";
        const pass2 = process.env.PASSWORD || "";
        const pass3 = "***";
        const pass4 = "[REDACTED]";
        const pass5 = "placeholder";
      `;
      const findings = detectCredentialAssignments(safeSample, "src/auth.js");
      assert.equal(findings.length, 0);
    });
  });

  describe("FR-369 / BDD-355: D3 Prefilled Password Input Detector", () => {
    it("flags prefilled HTML password inputs", () => {
      const html = `
        <input type="password" id="gate-pass" value="Avopak2026*.@" class="input" />
        <input class="input" value="Secret123" type="password" />
      `;
      const findings = detectPrefilledPasswordInputs(html, "index.html");
      assert.equal(findings.length, 2);
      assert.ok(findings.some((f) => f.matchValue === "Avopak2026*.@"));
    });

    it("ignores empty password inputs", () => {
      const cleanHtml = `
        <input type="password" id="gate-pass" value="" placeholder="Digite clave" />
        <input type="password" placeholder="Clave" />
      `;
      const findings = detectPrefilledPasswordInputs(cleanHtml, "index.html");
      assert.equal(findings.length, 0);
    });
  });

  describe("UI Technical Leak Detector (Badge & Spec Leak Guard)", () => {
    it("flags technical EOS badges and spec tags leaked into client-facing HTML/UI", () => {
      const leakedHtml = `
        <div class="topbar">
          <span class="badge">🛡️ EOS SPEC-122 + ENGRAM</span>
        </div>
      `;
      const findings = detectUiPlumbingLeaks(leakedHtml, "public/index.html");
      assert.ok(findings.length > 0);
      assert.ok(findings.some((f) => f.rule === "UI_SPEC_BADGE_LEAK"));
    });

    it("does not flag specs in openspec/ or docs/ directories", () => {
      const specDoc = `This document specifies EOS SPEC-122 and ENGRAM #1144.`;
      const findings = detectUiPlumbingLeaks(specDoc, "openspec/specs/SPEC-122.md");
      assert.equal(findings.length, 0);
    });
  });

  describe("FR-371 / BDD-356: Secret Masking Engine", () => {
    it("masks secrets preserving length and sha256 fingerprint without plaintext leak", () => {
      const raw = "Avopak2026*.@";
      const masked = maskSecret(raw);
      assert.ok(!masked.includes(raw), "Masked string must not contain plain secret");
      assert.ok(masked.startsWith("Av***"));
      assert.ok(masked.includes("13 chars"));
      const expectedHash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
      assert.ok(masked.includes(expectedHash));
    });
  });

  describe("FR-374 / BDD-357: Fingerprint Allowlist Engine", () => {
    it("honors valid non-expired allowlist entry with relative path match", () => {
      const secret = "known_fixture_token_12345";
      const hash = crypto.createHash("sha256").update(secret).digest("hex");
      const futureDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
      const allowlist = [
        {
          fingerprintSha256: hash,
          path: "test/fixtures/mock.json",
          reason: "Synthetic test fixture for unit tests",
          expiresAt: futureDate
        }
      ];

      const allowed = isAllowlisted(secret, "test/fixtures/mock.json", allowlist);
      assert.equal(allowed.isAllowed, true);
    });

    it("rejects expired allowlist entries", () => {
      const secret = "expired_secret_token";
      const hash = crypto.createHash("sha256").update(secret).digest("hex");
      const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
      const allowlist = [
        {
          fingerprintSha256: hash,
          path: "src/old.js",
          reason: "Legacy exception",
          expiresAt: pastDate
        }
      ];

      const allowed = isAllowlisted(secret, "src/old.js", allowlist);
      assert.equal(allowed.isAllowed, false);
      assert.equal(allowed.rejectionReason, "EXPIRED");
    });

    it("ships the synthetic fixture ledger in a path CI can see", () => {
      const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
      const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
      assert.match(gitignore, /^!\.eos\/secret-allowlist\.json$/m);

      const allowlist = JSON.parse(fs.readFileSync(path.join(root, ".eos", "secret-allowlist.json"), "utf8"));
      const fixtures = [
        ["Avopak2026*.@", "test/eos-secret-scan.test.mjs"],
        ["UltraSecret99!", "test/eos-secret-scan.test.mjs"],
        ["super_classified_token_xyz", "test/eos-secret-scan.test.mjs"],
        ["SOVEREIGN_AUTHORIZATION_RESET_TOKEN_NSA_41", "test/eosNsaZeroTrustDefense.test.mjs"]
      ];
      for (const [literal, fixturePath] of fixtures) {
        const fingerprintSha256 = crypto.createHash("sha256").update(literal).digest("hex");
        const entry = allowlist.find((item) => item.fingerprintSha256 === fingerprintSha256 && item.path === fixturePath);
        assert.ok(entry, `missing allowlist entry for ${fixturePath}`);
        assert.ok(entry.reason && entry.reason.length > 0);
        assert.ok(entry.expiresAt > new Date().toISOString().slice(0, 10));
      }

      const corpus = fs.readFileSync(path.join(root, "test", "eos-secret-scan.test.mjs"), "utf8");
      const findings = scanFileContent(corpus, path.join(root, "test", "eos-secret-scan.test.mjs"), allowlist);
      assert.equal(findings.length, 0);
    });
  });

  describe("FR-372 / FR-373 / BDD-358: Fail-Closed CLI Scan Engine", () => {
    it("returns exit code 2 when target directory does not exist or has 0 files scanned", async () => {
      const result = await scanDirectory("non_existent_dir_998877");
      assert.equal(result.exitCode, 2);
    });

    it("returns exit code 0 when codebase is completely clean", async () => {
      const result = await scanDirectory("openspec/changes");
      assert.equal(result.exitCode, 0);
      assert.equal(result.findings.length, 0);
    });
  });
});
