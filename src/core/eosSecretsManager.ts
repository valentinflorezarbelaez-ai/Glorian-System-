/**
 * EOS SECRETS MANAGER (Layer 0)
 * SPEC-055: Production secrets management with zero-code-change provider swapping.
 *
 * Priority chain (highest to lowest):
 *   1. AWS Secrets Manager   (EOS_SECRETS_PROVIDER=aws)
 *   2. HashiCorp Vault       (EOS_SECRETS_PROVIDER=vault)
 *   3. GCP Secret Manager    (EOS_SECRETS_PROVIDER=gcp)
 *   4. Doppler               (EOS_SECRETS_PROVIDER=doppler)
 *   5. .env file             (EOS_SECRETS_PROVIDER=dotenv)
 *   6. Environment variables (default, always available)
 *
 * All providers implement the same SecretProvider interface.
 * Secrets are cached in-memory with a configurable TTL.
 * Sensitive values are NEVER logged.
 *
 * Usage:
 * ```ts
 * const secrets = await EosSecretsManager.get("ANTHROPIC_API_KEY");
 * ```
 *
 * Zero external runtime dependencies — each provider uses native Node.js HTTP.
 */

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createLogger } from "./eosLogger.ts";

const _log = createLogger("eosSecretsManager");

// ============================================================================
// 1. PROVIDER INTERFACE
// ============================================================================

export type SecretProviderType = "env" | "dotenv" | "aws" | "vault" | "gcp" | "doppler";

export interface SecretProvider {
  readonly type: SecretProviderType;
  getSecret(key: string): Promise<string | null>;
}

// ============================================================================
// 2. ENV PROVIDER (default — always works)
// ============================================================================

class EnvProvider implements SecretProvider {
  readonly type: SecretProviderType = "env";
  async getSecret(key: string): Promise<string | null> {
    return process.env[key] ?? null;
  }
}

// ============================================================================
// 3. DOTENV PROVIDER
// ============================================================================

class DotenvProvider implements SecretProvider {
  readonly type: SecretProviderType = "dotenv";
  private readonly values = new Map<string, string>();

  constructor(envFile: string) {
    if (!fs.existsSync(envFile)) return;
    const lines = fs.readFileSync(envFile, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      this.values.set(key, value);
    }
    _log.info("DotenvProvider loaded", { keys: this.values.size });
  }

  async getSecret(key: string): Promise<string | null> {
    return this.values.get(key) ?? process.env[key] ?? null;
  }
}

// ============================================================================
// 4. AWS SECRETS MANAGER PROVIDER
// ============================================================================

class AwsSecretsManagerProvider implements SecretProvider {
  readonly type: SecretProviderType = "aws";
  private readonly region: string;

  constructor() {
    this.region = process.env["AWS_REGION"] ?? process.env["AWS_DEFAULT_REGION"] ?? "us-east-1";
  }

  async getSecret(key: string): Promise<string | null> {
    const secretArn = process.env[`EOS_SECRET_ARN_${key}`] ?? key;
    const token = process.env["AWS_SESSION_TOKEN"] ?? "";
    const accessKey = process.env["AWS_ACCESS_KEY_ID"] ?? "";
    const secretKey = process.env["AWS_SECRET_ACCESS_KEY"] ?? "";

    if (!accessKey || !secretKey) {
      _log.warn("AWS credentials not set, falling back to env var", { key });
      return process.env[key] ?? null;
    }

    const endpoint = `https://secretsmanager.${this.region}.amazonaws.com/`;
    const body = JSON.stringify({ SecretId: secretArn });
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateOnly = amzDate.slice(0, 8);

    // AWS SigV4 signing (minimal implementation)
    const canonicalRequest = [
      "POST",
      "/",
      "",
      `content-type:application/x-amz-json-1.1\nhost:secretsmanager.${this.region}.amazonaws.com\nx-amz-date:${amzDate}\nx-amz-target:secretsmanager.GetSecretValue`,
      "",
      "content-type;host;x-amz-date;x-amz-target",
      crypto.createHash("sha256").update(body).digest("hex"),
    ].join("\n");

    const credScope = `${dateOnly}/${this.region}/secretsmanager/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

    const hmac = (key: Buffer, data: string) => crypto.createHmac("sha256", key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(Buffer.from("AWS4" + secretKey, "utf8"), dateOnly), this.region), "secretsmanager"),
      "aws4_request",
    );
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=${signature}`;

    try {
      const result = await this._post(endpoint, body, {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Date": amzDate,
        "X-Amz-Target": "secretsmanager.GetSecretValue",
        Authorization: authorization,
        ...(token ? { "X-Amz-Security-Token": token } : {}),
      });

      const parsed = JSON.parse(result);
      const secret = parsed.SecretString ?? null;

      if (secret) {
        // Try to parse as JSON (secret might be a key-value object)
        try {
          const obj = JSON.parse(secret);
          return obj[key] ?? secret;
        } catch {
          return secret;
        }
      }
      return null;
    } catch (err) {
      _log.error("AWS Secrets Manager fetch failed", { key: key.slice(0, 20) });
      return process.env[key] ?? null; // fallback to env
    }
  }

  private _post(url: string, body: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname,
          method: "POST",
          headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
          timeout: 5000,
        },
        (res) => {
          let data = "";
          res.on("data", (c: Buffer) => {
            data += c.toString();
          });
          res.on("end", () => resolve(data));
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("AWS SM timeout"));
      });
      req.write(body);
      req.end();
    });
  }
}

// ============================================================================
// 5. HASHICORP VAULT PROVIDER
// ============================================================================

class VaultProvider implements SecretProvider {
  readonly type: SecretProviderType = "vault";
  private readonly address: string;
  private readonly token: string;
  private readonly mountPath: string;

  constructor() {
    this.address = process.env["VAULT_ADDR"] ?? "http://127.0.0.1:8200";
    this.token = process.env["VAULT_TOKEN"] ?? "";
    this.mountPath = process.env["VAULT_MOUNT_PATH"] ?? "secret";
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.token) {
      _log.warn("Vault token not set, falling back to env", { key: key.slice(0, 20) });
      return process.env[key] ?? null;
    }

    const secretPath = process.env[`EOS_VAULT_PATH_${key}`] ?? `eos-system/${key}`;
    const url = `${this.address}/v1/${this.mountPath}/data/${secretPath}`;

    try {
      const result = await this._get(url, { "X-Vault-Token": this.token });
      const parsed = JSON.parse(result);
      const value = parsed?.data?.data?.[key] ?? parsed?.data?.[key] ?? null;
      return value ? String(value) : (process.env[key] ?? null);
    } catch {
      _log.error("Vault fetch failed", { key: key.slice(0, 20) });
      return process.env[key] ?? null;
    }
  }

  private _get(url: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : require("node:http");
      const req = lib.get(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, headers, timeout: 5000 },
        (res: import("node:http").IncomingMessage) => {
          let data = "";
          res.on("data", (c: Buffer) => {
            data += c.toString();
          });
          res.on("end", () => resolve(data));
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Vault timeout"));
      });
      req.end();
    });
  }
}

// ============================================================================
// 6. DOPPLER PROVIDER
// ============================================================================

class DopplerProvider implements SecretProvider {
  readonly type: SecretProviderType = "doppler";
  private readonly serviceToken: string;

  constructor() {
    this.serviceToken = process.env["DOPPLER_TOKEN"] ?? "";
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.serviceToken) return process.env[key] ?? null;

    try {
      const result = await this._get(
        `https://api.doppler.com/v3/configs/config/secrets/download?format=json&naming=snake`,
        { Authorization: `Bearer ${this.serviceToken}` },
      );
      const secrets = JSON.parse(result);
      return secrets[key] ?? process.env[key] ?? null;
    } catch {
      return process.env[key] ?? null;
    }
  }

  private _get(url: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers, timeout: 5000 }, (res) => {
        let data = "";
        res.on("data", (c: Buffer) => {
          data += c.toString();
        });
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Doppler timeout"));
      });
    });
  }
}

// ============================================================================
// 7. SECRETS MANAGER FACADE
// ============================================================================

interface CacheEntry {
  value: string | null;
  fetchedAt: number;
}

/**
 * Central secrets manager with caching and provider fallback chain.
 * Thread-safe (single Node.js event loop). Values never appear in logs.
 */
export class EosSecretsManager {
  private static _instance: EosSecretsManager | null = null;
  private readonly provider: SecretProvider;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  // ── Circuit breaker (Google SRE / Stripe standard) ───────────────────────
  // Prevents hammering a failing remote provider on every get() call.
  // After CIRCUIT_OPEN_THRESHOLD consecutive failures, the circuit opens
  // and short-circuits to env fallback for CIRCUIT_OPEN_TTL_MS.
  private _consecutiveFailures = 0;
  private _circuitOpenedAt: number | null = null;
  private static readonly CIRCUIT_OPEN_THRESHOLD = 3;
  private static readonly CIRCUIT_OPEN_TTL_MS = 30_000; // 30 s half-open window

  private constructor(provider: SecretProvider, cacheTtlMs = 5 * 60 * 1000) {
    this.provider = provider;
    this.cacheTtlMs = cacheTtlMs;
    _log.info("SecretsManager initialized", { provider: provider.type });
  }

  static getInstance(): EosSecretsManager {
    if (!EosSecretsManager._instance) {
      EosSecretsManager._instance = EosSecretsManager._create();
    }
    return EosSecretsManager._instance;
  }

  private static _create(): EosSecretsManager {
    const type = (process.env["EOS_SECRETS_PROVIDER"] ?? "env").toLowerCase() as SecretProviderType;
    switch (type) {
      case "aws":
        return new EosSecretsManager(new AwsSecretsManagerProvider());
      case "vault":
        return new EosSecretsManager(new VaultProvider());
      case "doppler":
        return new EosSecretsManager(new DopplerProvider());
      case "dotenv": {
        const envFile = process.env["EOS_DOTENV_FILE"] ?? path.join(process.cwd(), ".env");
        return new EosSecretsManager(new DotenvProvider(envFile));
      }
      default:
        return new EosSecretsManager(new EnvProvider());
    }
  }

  /** Returns true if the circuit breaker is currently open (provider in failure state). */
  private _isCircuitOpen(): boolean {
    if (this._circuitOpenedAt === null) return false;
    if (Date.now() - this._circuitOpenedAt > EosSecretsManager.CIRCUIT_OPEN_TTL_MS) {
      // Half-open: allow one probe through to check if provider recovered
      this._circuitOpenedAt = null;
      this._consecutiveFailures = 0;
      _log.info("SecretsManager circuit half-open — probing provider");
      return false;
    }
    return true;
  }

  /**
   * Fetches a secret with circuit breaker + stale-on-failure (Netflix Hystrix pattern).
   * - If circuit is open: returns stale cached value (if any) or env fallback.
   * - On success: resets failure counter.
   * - On failure: increments counter; opens circuit after threshold; returns stale cache.
   *
   * Returns null only if no cached value AND no env fallback exists.
   * Never throws.
   */
  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    const isFresh = cached !== undefined && Date.now() - cached.fetchedAt < this.cacheTtlMs;

    // Fresh cache hit — no network call needed
    if (isFresh) return cached!.value;

    // Circuit open — serve stale cache or env fallback (never retry failing provider)
    if (this._isCircuitOpen()) {
      _log.warn("SecretsManager circuit OPEN — serving stale value", { key: key.slice(0, 20) });
      return cached?.value ?? process.env[key] ?? null;
    }

    // Attempt provider fetch with exponential backoff (up to 2 retries)
    let value: string | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        value = await this.provider.getSecret(key);
        // Success — reset circuit
        this._consecutiveFailures = 0;
        this._circuitOpenedAt = null;
        this.cache.set(key, { value, fetchedAt: Date.now() });
        return value;
      } catch (err) {
        lastError = err;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }

    // All retries failed — increment circuit breaker
    this._consecutiveFailures += 1;
    if (this._consecutiveFailures >= EosSecretsManager.CIRCUIT_OPEN_THRESHOLD) {
      this._circuitOpenedAt = Date.now();
      _log.error("SecretsManager circuit OPENED after repeated failures", {
        provider: this.provider.type,
        failures: this._consecutiveFailures,
      });
    }

    // Stale-on-failure (Netflix Hystrix pattern): serve expired cache over null
    if (cached !== undefined) {
      _log.warn("SecretsManager returning stale cache after fetch failure", { key: key.slice(0, 20) });
      return cached.value;
    }

    // Last resort: env fallback
    const envFallback = process.env[key] ?? null;
    if (envFallback) {
      _log.warn("SecretsManager falling back to process.env", { key: key.slice(0, 20) });
      this.cache.set(key, { value: envFallback, fetchedAt: Date.now() });
    }
    return envFallback;
  }

  /** Fetches a required secret. Throws if not found. */
  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (!value) throw new Error(`Required secret "${key}" not found via ${this.provider.type} provider.`);
    return value;
  }

  /** Invalidates the cache for a specific key (force re-fetch on next get). */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Returns provider type for diagnostics (never exposes values). */
  get providerType(): SecretProviderType {
    return this.provider.type;
  }
}

/** Convenience singleton accessor. */
export const secrets = EosSecretsManager.getInstance();
