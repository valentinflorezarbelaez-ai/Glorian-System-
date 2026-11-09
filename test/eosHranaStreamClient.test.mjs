/**
 * BDD Test Suite — EOS Hrana Stream Client (SPEC-141)
 * Tests protocol encoding, circuit breaker, and deterministic receipts.
 * Uses mock HTTP server to simulate libSQL/Turso endpoints (no external network).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EosHranaStreamClient } from "../src/core/eosHranaStreamClient.ts";

describe("SPEC-141: EosHranaStreamClient — Hrana v2 Native Protocol", () => {
  let mockServer;
  let mockPort;
  let requestLog;

  before(async () => {
    requestLog = [];
    mockServer = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        requestLog.push({ url: req.url, body: JSON.parse(body || "{}"), headers: req.headers });

        if (req.url === "/v1/hello") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ type: "hello", version: "libsql-0.24" }));
        } else if (req.url === "/v1/stream") {
          const parsed = JSON.parse(body);
          const reqType = parsed.request?.type;

          if (reqType === "execute") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                type: "ok",
                result: {
                  cols: [{ name: "id" }, { name: "name" }],
                  rows: [
                    [
                      { type: "int", value: "1" },
                      { type: "string", value: "alice" },
                    ],
                    [
                      { type: "int", value: "2" },
                      { type: "string", value: "bob" },
                    ],
                  ],
                  rowCount: 2,
                  affectedRowIds: [],
                },
              }),
            );
          } else if (reqType === "batch") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                type: "ok",
                result: [
                  { cols: [{ name: "ok" }], rows: [[{ type: "string", value: "1" }]], rowCount: 1, affectedRowIds: [] },
                  { cols: [{ name: "ok" }], rows: [[{ type: "string", value: "2" }]], rowCount: 1, affectedRowIds: [] },
                ],
              }),
            );
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ type: "ok" }));
          }
        } else if (req.url === "/v1/error") {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "disk full", code: "SQLITE_FULL" } }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    await new Promise((resolve) => {
      mockServer.listen(0, "127.0.0.1", () => {
        mockPort = mockServer.address().port;
        resolve();
      });
    });
  });

  after(() => {
    mockServer.close();
  });

  it("BDD-401: connects and performs hello handshake successfully", async () => {
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    const pong = await client.ping();
    assert.equal(pong.ok, true);
  });

  it("BDD-402: executes a single SQL statement and parses the result set", async () => {
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    const result = await client.execute("SELECT id, name FROM users");
    assert.deepEqual(result.cols, ["id", "name"]);
    assert.equal(result.rowCount, 2);
    assert.equal(result.rows[0][1], "alice");
    assert.equal(result.rows[1][1], "bob");
  });

  it("BDD-403: encodes typed arguments for parameterized queries", async () => {
    requestLog.length = 0;
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    await client.execute("INSERT INTO t VALUES (?)", [42]);
    const sent = requestLog[requestLog.length - 1];
    assert.ok(sent.body.request.stmt.args[0].type === "float64");
    assert.equal(sent.body.request.stmt.args[0].value, 42);
  });

  it("BDD-404: sends Bearer token in Authorization header when configured", async () => {
    requestLog.length = 0;
    const client = new EosHranaStreamClient({
      url: `http://127.0.0.1:${mockPort}`,
      authToken: "eyJhbGciOi.test.token",
    });
    await client.execute("SELECT 1");
    const sent = requestLog[requestLog.length - 1];
    assert.equal(sent.headers.authorization, "Bearer eyJhbGciOi.test.token");
  });

  it("BDD-405: executes a batch of statements atomically", async () => {
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    const results = await client.batch([
      { sql: "INSERT INTO log VALUES ('a')" },
      { sql: "INSERT INTO log VALUES ('b')" },
    ]);
    assert.equal(results.length, 2);
    assert.equal(results[0].rows[0][0], "1");
    assert.equal(results[1].rows[0][0], "2");
  });

  it("BDD-406: generates deterministic SHA-256 client receipt", async () => {
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    await client.execute("SELECT 1");
    const report = client.getReport();
    assert.equal(report.protocol, "hrana-v2");
    assert.equal(report.totalQueries, 1);
    assert.equal(report.failedQueries, 0);
    assert.equal(report.circuitStatus, "CLOSED");
    assert.equal(report.sha256ClientReceipt.length, 64);
  });

  it("BDD-407: circuit breaker opens after consecutive failures", async () => {
    const client = new EosHranaStreamClient({
      url: "http://127.0.0.1:1", // Unreachable port
      timeoutMs: 500,
      maxRetries: 1,
      circuitBreakerThreshold: 3,
    });
    for (let i = 0; i < 3; i++) {
      try {
        await client.execute("SELECT 1");
      } catch {
        /* expected */
      }
    }
    const report = client.getReport();
    assert.equal(report.circuitStatus, "OPEN");

    // Next call should fail fast without network attempt
    await assert.rejects(() => client.execute("SELECT 2"), /circuit breaker is OPEN/);
  });

  it("BDD-408: rejects invalid constructor parameters (fail-closed)", () => {
    assert.throws(() => new EosHranaStreamClient({ url: "not-a-url" }), /must be a valid http/);
  });

  it("BDD-409: rejects empty SQL execution", async () => {
    const client = new EosHranaStreamClient({ url: `http://127.0.0.1:${mockPort}` });
    await assert.rejects(() => client.execute("   "), /non-empty/);
  });
});
