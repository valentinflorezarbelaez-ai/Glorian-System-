/**
 * src/core/eosBenchmarkTracker.ts
 * Continuous Performance Telemetry & Historical Benchmark Regression Tracker.
 * Tracks p50, p95, p99 nanosecond latencies and ops/sec trends across commits.
 *
 * SPEC-067: Historical Benchmark Telemetry & Regression Sentinel
 * Zero runtime NPM dependencies (Strict Layer-0 Pure).
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  assertPrecondition,
  deepFreeze,
  pureSha256
} from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";

export type BenchmarkVerdict = "NOMINAL" | "OPTIMIZED" | "REGRESSION_DETECTED";

export interface BenchmarkMetricInput {
  readonly benchmarkName: string;
  readonly commitSha?: string;
  readonly p50Ns: number;
  readonly p95Ns: number;
  readonly p99Ns: number;
  readonly opsPerSec: number;
}

export interface BenchmarkComparisonReport {
  readonly benchmarkName: string;
  readonly commitSha: string;
  readonly currentP95Ns: number;
  readonly baselineP95Ns: number;
  readonly percentChange: number;
  readonly opsPerSec: number;
  readonly verdict: BenchmarkVerdict;
  readonly isRegression: boolean;
  readonly sha256Receipt: string;
  readonly timestampIso: string;
}

export class EosBenchmarkTracker {
  private readonly dbPath: string;
  private readonly db: DatabaseSync;

  constructor(dbPathOrProjectRoot: string = process.cwd()) {
    if (dbPathOrProjectRoot === ":memory:") {
      this.dbPath = ":memory:";
    } else if (dbPathOrProjectRoot.endsWith(".sqlite") || dbPathOrProjectRoot.endsWith(".db")) {
      this.dbPath = path.resolve(dbPathOrProjectRoot);
    } else {
      this.dbPath = path.join(path.resolve(dbPathOrProjectRoot), ".eos", "state", "eos_benchmarks.sqlite");
    }

    if (this.dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS eos_benchmark_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        benchmark_name TEXT NOT NULL,
        commit_sha TEXT NOT NULL,
        p50_ns REAL NOT NULL,
        p95_ns REAL NOT NULL,
        p99_ns REAL NOT NULL,
        ops_per_sec REAL NOT NULL,
        verdict TEXT NOT NULL,
        recorded_at_iso TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bench_lookup
        ON eos_benchmark_metrics(benchmark_name, id DESC);
    `);
  }

  /**
   * Records a benchmark run, evaluates regression against baseline, and saves to database.
   */
  public recordBenchmark(input: BenchmarkMetricInput): BenchmarkComparisonReport {
    assertPrecondition(Boolean(input && input.benchmarkName), "benchmarkName is required");
    assertPrecondition(typeof input.p95Ns === "number" && input.p95Ns >= 0, "p95Ns must be non-negative");

    const commitSha = input.commitSha || "LOCAL";
    const timestampIso = new Date().toISOString();

    // Query previous baseline for this benchmark
    const baselineRow = this.db.prepare(`
      SELECT p95_ns, ops_per_sec 
      FROM eos_benchmark_metrics 
      WHERE benchmark_name = ? 
      ORDER BY id DESC 
      LIMIT 1
    `).get(input.benchmarkName) as { p95_ns: number; ops_per_sec: number } | undefined;

    const baselineP95Ns = baselineRow ? baselineRow.p95_ns : input.p95Ns;
    let percentChange = 0;
    if (baselineP95Ns > 0) {
      percentChange = parseFloat((((input.p95Ns - baselineP95Ns) / baselineP95Ns) * 100).toFixed(2));
    }

    let verdict: BenchmarkVerdict = "NOMINAL";
    let isRegression = false;

    // +15% latency increase is flagged as regression
    if (percentChange > 15 && baselineRow !== undefined) {
      verdict = "REGRESSION_DETECTED";
      isRegression = true;
    } else if (percentChange < -15 && baselineRow !== undefined) {
      verdict = "OPTIMIZED";
    }

    const sha256Receipt = pureSha256(
      `BENCH:${input.benchmarkName}:${commitSha}:${input.p95Ns}:${baselineP95Ns}:${percentChange}:${verdict}:${timestampIso}`
    );

    this.db.prepare(`
      INSERT INTO eos_benchmark_metrics (
        benchmark_name, commit_sha, p50_ns, p95_ns, p99_ns, ops_per_sec, verdict, recorded_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.benchmarkName,
      commitSha,
      input.p50Ns,
      input.p95Ns,
      input.p99Ns,
      input.opsPerSec,
      verdict,
      timestampIso
    );

    return deepFreeze({
      benchmarkName: input.benchmarkName,
      commitSha,
      currentP95Ns: input.p95Ns,
      baselineP95Ns,
      percentChange,
      opsPerSec: input.opsPerSec,
      verdict,
      isRegression,
      sha256Receipt,
      timestampIso
    });
  }

  /**
   * Retrieves the latest historical metrics for a given benchmark.
   */
  public getHistory(benchmarkName: string, limit: number = 10): readonly any[] {
    const rows = this.db.prepare(`
      SELECT * FROM eos_benchmark_metrics 
      WHERE benchmark_name = ? 
      ORDER BY id DESC 
      LIMIT ?
    `).all(benchmarkName, limit);
    return deepFreeze(rows);
  }

  /**
   * Persists benchmark attestation into durable SQLite WAL ledger.
   */
  public recordReceiptInLedger(
    report: BenchmarkComparisonReport,
    dbPathOrRootDir?: string
  ): boolean {
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
        title: `Benchmark Trend [${report.verdict}]: ${report.benchmarkName} (${report.currentP95Ns}ns, Δ${report.percentChange}%)`,
        payload: {
          benchmarkName: report.benchmarkName,
          commitSha: report.commitSha,
          currentP95Ns: report.currentP95Ns,
          baselineP95Ns: report.baselineP95Ns,
          percentChange: report.percentChange,
          opsPerSec: report.opsPerSec,
          verdict: report.verdict,
          sha256Receipt: report.sha256Receipt
        },
        engramTopicKey: "eos/telemetry/benchmarks"
      });
      return true;
    } catch {
      return false;
    } finally {
      ledger.close();
    }
  }

  public close(): void {
    this.db.close();
  }
}
