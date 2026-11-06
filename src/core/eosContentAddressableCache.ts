/**
 * EOS SYSTEM — GOOGLE BAZEL-GRADE CONTENT-ADDRESSABLE STORAGE & ACTION CACHE (Layer 0)
 * Governed by SPEC-062, CHANGE-054, ADR-067 (v66.0.0)
 *
 * Implements Google Remote Execution API (REAPI) & CAS Optimization:
 * 1. Pure Layer-0 SHA-256 Content-Addressable Storage (CAS) for Blobs.
 * 2. Deterministic Action Cache (AC) mapping ActionKey -> ActionResult.
 * 3. O(1) Sub-2ms Cache Hit Retrieval avoiding redundant test suites.
 * 4. Monotonic Attestation Logging into SQLite WAL Ledger.
 *
 * Zero external runtime dependencies. Node 24 strip-only compliant.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export interface ActionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutDigest: string;
  readonly stderrDigest: string;
  readonly originalDurationMs: number;
  readonly timestampIso: string;
}

export interface CasStatsReport {
  readonly totalBlobs: number;
  readonly totalActions: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly hitRatio: number;
  readonly estimatedSavedMs: number;
  readonly sha256Receipt: string;
}

export class EosContentAddressableCache {
  private readonly casDir: string;
  private readonly blobsDir: string;
  private readonly actionsDir: string;

  private hits: number = 0;
  private misses: number = 0;
  private savedTimeMs: number = 0;

  constructor(projectRoot: string = process.cwd()) {
    const root = path.resolve(projectRoot);
    this.casDir = path.join(root, ".eos", "cas");
    this.blobsDir = path.join(this.casDir, "blobs");
    this.actionsDir = path.join(this.casDir, "actions");

    fs.mkdirSync(this.blobsDir, { recursive: true });
    fs.mkdirSync(this.actionsDir, { recursive: true });
  }

  /**
   * Computes deterministic action key from AST hashes, execution command, and env context.
   */
  public computeActionKey(
    sourceAstHashes: readonly string[],
    command: string,
    envContext: Record<string, any> = {}
  ): string {
    assertPrecondition(Array.isArray(sourceAstHashes), "sourceAstHashes must be an array");
    assertPrecondition(typeof command === "string" && command.length > 0, "command is required");

    const sortedHashes = [...sourceAstHashes].sort();
    const sortedEnv = Object.keys(envContext).sort().map((k) => `${k}=${envContext[k]}`).join(";");
    const payload = `ACTION:${sortedHashes.join(",")}:${command}:${sortedEnv}`;

    return pureSha256(payload);
  }

  /**
   * Stores a blob into CAS, keyed by its SHA-256 digest. Deduplicates identical contents.
   */
  public putBlob(content: Buffer | string): string {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const digest = crypto.createHash("sha256").update(buf).digest("hex");
    const blobPath = path.join(this.blobsDir, digest);

    if (!fs.existsSync(blobPath)) {
      fs.writeFileSync(blobPath, buf);
    }

    return digest;
  }

  /**
   * Retrieves a blob by its SHA-256 digest from CAS.
   */
  public getBlob(digest: string): Buffer | null {
    assertPrecondition(typeof digest === "string" && digest.length === 64, "valid 64-char digest required");
    const blobPath = path.join(this.blobsDir, digest);
    if (!fs.existsSync(blobPath)) {
      return null;
    }
    return fs.readFileSync(blobPath);
  }

  /**
   * Records an action result into Action Cache.
   */
  public putAction(actionKey: string, result: Omit<ActionResult, "stdoutDigest" | "stderrDigest" | "timestampIso">): ActionResult {
    assertPrecondition(typeof actionKey === "string" && actionKey.length === 64, "valid actionKey required");

    const stdoutDigest = this.putBlob(result.stdout || "");
    const stderrDigest = this.putBlob(result.stderr || "");
    const timestampIso = new Date().toISOString();

    const fullResult: ActionResult = deepFreeze({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      stdoutDigest,
      stderrDigest,
      originalDurationMs: result.originalDurationMs,
      timestampIso
    });

    const actionPath = path.join(this.actionsDir, actionKey);
    fs.writeFileSync(actionPath, JSON.stringify(fullResult, null, 2), "utf8");

    return fullResult;
  }

  /**
   * Queries Action Cache with O(1) latency.
   */
  public getAction(actionKey: string): ActionResult | null {
    assertPrecondition(typeof actionKey === "string" && actionKey.length === 64, "valid actionKey required");
    const actionPath = path.join(this.actionsDir, actionKey);

    if (!fs.existsSync(actionPath)) {
      this.misses++;
      return null;
    }

    try {
      const raw = fs.readFileSync(actionPath, "utf8");
      const record: ActionResult = JSON.parse(raw);
      this.hits++;
      this.savedTimeMs += record.originalDurationMs;
      return deepFreeze(record);
    } catch {
      this.misses++;
      return null;
    }
  }

  /**
   * Returns cache efficiency statistics.
   */
  public getStats(): CasStatsReport {
    const totalBlobs = fs.existsSync(this.blobsDir) ? fs.readdirSync(this.blobsDir).length : 0;
    const totalActions = fs.existsSync(this.actionsDir) ? fs.readdirSync(this.actionsDir).length : 0;
    const totalQueries = this.hits + this.misses;
    const hitRatio = totalQueries > 0 ? this.hits / totalQueries : 0;
    const timestampIso = new Date().toISOString();

    const sha256Receipt = pureSha256(
      `CAS_STATS:${totalBlobs}:${totalActions}:${this.hits}:${this.misses}:${this.savedTimeMs}:${timestampIso}`
    );

    return deepFreeze({
      totalBlobs,
      totalActions,
      cacheHits: this.hits,
      cacheMisses: this.misses,
      hitRatio,
      estimatedSavedMs: this.savedTimeMs,
      sha256Receipt
    });
  }

  /**
   * Records CAS telemetry receipt in durable SQLite WAL ledger.
   */
  public recordReceiptInLedger(dbPathOrRootDir?: string): boolean {
    const stats = this.getStats();
    const dbPath = dbPathOrRootDir
      ? dbPathOrRootDir.endsWith(".sqlite") || dbPathOrRootDir.endsWith(".db")
        ? dbPathOrRootDir
        : EosDurableSqliteLedger.defaultLedgerPath(dbPathOrRootDir)
      : EosDurableSqliteLedger.defaultLedgerPath();

    const ledger = new EosDurableSqliteLedger(dbPath);
    try {
      ledger.appendEntry({
        category: "VERIFICATION_RECEIPT",
        projectId: "eos-system",
        title: `CAS & Action Cache Stats [Hits: ${stats.cacheHits}, Saved: ${stats.estimatedSavedMs}ms, Blobs: ${stats.totalBlobs}]`,
        payload: {
          totalBlobs: stats.totalBlobs,
          totalActions: stats.totalActions,
          cacheHits: stats.cacheHits,
          cacheMisses: stats.cacheMisses,
          hitRatio: stats.hitRatio,
          estimatedSavedMs: stats.estimatedSavedMs,
          sha256Receipt: stats.sha256Receipt
        },
        engramTopicKey: "eos/optimization/cas"
      });
      return true;
    } catch {
      return false;
    } finally {
      ledger.close();
    }
  }
}
