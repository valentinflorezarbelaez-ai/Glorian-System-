/**
 * EOS SYSTEM — WAL FRAME INTEGRITY REGRESSION SUITE (SPEC-030, BDD-070 follow-up)
 * v2 frames checksum len + txId + tsNs + payload, so header bit-rot can no
 * longer replay a valid payload under a corrupted transaction identity.
 * Legacy v1 files (payload-only CRC) must remain recoverable.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EosDurableWal, computeCrc32 } from "../src/core/eosDurableWal.ts";

function makeTempWal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-wal-integrity-"));
  return { dir, file: path.join(dir, "integrity.wal") };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function appendThree(file) {
  const wal = new EosDurableWal(file);
  for (let i = 1; i <= 3; i++) {
    wal.append({ seq: i, account: `nu:account:${i}`, amountCents: i * 100 });
  }
  wal.close();
}

// Frame layout: [len:4][txId:8][tsNs:8][crc:4][payload]; header is 6 bytes.
function secondFrameOffset(file) {
  const buf = fs.readFileSync(file);
  const firstLen = buf.readUInt32BE(6);
  return 6 + firstLen;
}

test("BDD-968: v2 recovery detects txId bit-rot and truncates the corrupted tail", () => {
  const { dir, file } = makeTempWal();
  try {
    appendThree(file);
    const offset = secondFrameOffset(file);
    const fd = fs.openSync(file, "r+");
    const byte = Buffer.alloc(1);
    fs.readSync(fd, byte, 0, 1, offset + 4);
    byte[0] ^= 0x01;
    fs.writeSync(fd, byte, 0, 1, offset + 4);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    const wal = new EosDurableWal(file);
    const report = wal.getRecoveryReport();
    assert.equal(report.status, "TORN_WRITE_RECOVERED");
    assert.equal(report.recoveredRecords, 1);
    assert.equal(report.lastTxId, 1n);
    assert.ok(report.tornTailBytesTruncated > 0);
    assert.equal(wal.replay().length, 1);
    wal.close();
  } finally {
    cleanup(dir);
  }
});

test("BDD-969: v2 recovery detects tsNs bit-rot that v1 checksums would miss", () => {
  const { dir, file } = makeTempWal();
  try {
    appendThree(file);
    const offset = secondFrameOffset(file);
    const fd = fs.openSync(file, "r+");
    const byte = Buffer.alloc(1);
    fs.readSync(fd, byte, 0, 1, offset + 12);
    byte[0] ^= 0x80;
    fs.writeSync(fd, byte, 0, 1, offset + 12);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    const wal = new EosDurableWal(file);
    const report = wal.getRecoveryReport();
    assert.equal(report.status, "TORN_WRITE_RECOVERED");
    assert.equal(report.recoveredRecords, 1);
    assert.equal(wal.replay().length, 1);
    wal.close();
  } finally {
    cleanup(dir);
  }
});

test("BDD-970: v2 recovery still detects payload bit-rot and preserves clean replay", () => {
  const { dir, file } = makeTempWal();
  try {
    appendThree(file);
    const clean = new EosDurableWal(file);
    assert.equal(clean.getRecoveryReport().status, "CLEAN_RECOVERY");
    assert.equal(clean.replay().length, 3);
    clean.close();

    const offset = secondFrameOffset(file);
    const buf = fs.readFileSync(file);
    const frameLen = buf.readUInt32BE(offset);
    const fd = fs.openSync(file, "r+");
    const byte = Buffer.alloc(1);
    const payloadPos = offset + 24 + Math.floor((frameLen - 24) / 2);
    fs.readSync(fd, byte, 0, 1, payloadPos);
    byte[0] ^= 0x40;
    fs.writeSync(fd, byte, 0, 1, payloadPos);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    const wal = new EosDurableWal(file);
    const report = wal.getRecoveryReport();
    assert.equal(report.status, "TORN_WRITE_RECOVERED");
    assert.equal(report.recoveredRecords, 1);
    wal.close();
  } finally {
    cleanup(dir);
  }
});

test("BDD-971: legacy v1 files recover cleanly and keep v1 framing on append", () => {
  const { dir, file } = makeTempWal();
  try {
    // Hand-craft a v1 log: header version 1, payload-only CRC frames.
    const payloads = [
      { seq: 1, legacy: true },
      { seq: 2, legacy: true },
    ].map((p) => Buffer.from(JSON.stringify(p), "utf8"));
    const header = Buffer.alloc(6);
    Buffer.from("EOSW").copy(header, 0);
    header.writeUInt16BE(1, 4);
    const frames = payloads.map((payload, i) => {
      const frame = Buffer.alloc(24 + payload.length);
      frame.writeUInt32BE(frame.length, 0);
      frame.writeBigUInt64BE(BigInt(i + 1), 4);
      frame.writeBigUInt64BE(BigInt(1000 + i), 12);
      frame.writeUInt32BE(computeCrc32(payload), 20);
      payload.copy(frame, 24);
      return frame;
    });
    fs.writeFileSync(file, Buffer.concat([header, ...frames]));

    const wal = new EosDurableWal(file);
    const report = wal.getRecoveryReport();
    assert.equal(report.status, "CLEAN_RECOVERY");
    assert.equal(report.recoveredRecords, 2);
    assert.deepEqual(
      wal.replay().map((r) => r.payload),
      [
        { seq: 1, legacy: true },
        { seq: 2, legacy: true },
      ],
    );

    // Appends to a v1 file must stay v1-framed so the whole log replays.
    wal.append({ seq: 3, legacy: true });
    wal.close();

    const reopened = new EosDurableWal(file);
    assert.equal(reopened.getRecoveryReport().status, "CLEAN_RECOVERY");
    assert.equal(reopened.getRecoveryReport().recoveredRecords, 3);
    assert.equal(reopened.replay().length, 3);
    reopened.close();
  } finally {
    cleanup(dir);
  }
});

test("BDD-972: unknown WAL versions fail closed instead of replaying blind", () => {
  const { dir, file } = makeTempWal();
  try {
    appendThree(file);
    const fd = fs.openSync(file, "r+");
    const version = Buffer.alloc(2);
    version.writeUInt16BE(99, 0);
    fs.writeSync(fd, version, 0, 2, 4);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    assert.throws(() => new EosDurableWal(file), /Unsupported WAL version 99/);
  } finally {
    cleanup(dir);
  }
});
