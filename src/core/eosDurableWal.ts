/**
 * EOS SYSTEM — CRYPTOGRAPHIC BINARY WRITE-AHEAD LOG (WAL) (Layer 0)
 * Governed by ADR-037, SPEC-030, FR-081, FR-082, BDD-070
 *
 * Provides physical hardware-grade durability for bitemporal transactions:
 * - Binary frame format: [Len: uint32][txId: uint64][tsNs: uint64][crc32: uint32][payloadBytes]
 * - Magic header: "EOSW" (0x454F5357) with version uint16
 * - v2 frames checksum the full frame (len + txId + tsNs + payload); v1 files
 *   (payload-only CRC) remain readable and keep their original format on append
 * - Hardware flush via fs.fsyncSync(fd) to prevent torn writes upon crash
 * - Crash recovery: linear forward replay with torn-tail detection and auto-truncation
 * - IEEE 802.3 CRC32 checksum verification with 0 external dependencies
 *
 * Invariant: 100% Layer-0 purity with zero external npm dependencies.
 */

import fs from "node:fs";
import path from "node:path";

// IEEE 802.3 CRC32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32Update(crc: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc;
}

export function computeCrc32(buffer: Uint8Array): number {
  return (crc32Update(0xffffffff, buffer) ^ 0xffffffff) >>> 0;
}

// v1 checksums only the payload; v2 also covers len, txId and tsNs so header
// bit-rot cannot replay a valid payload under a corrupted transaction identity.
function computeFrameCrc(buf: Uint8Array, offset: number, frameLen: number, version: number): number {
  if (version === 1) {
    return computeCrc32(buf.subarray(offset + FRAME_HEADER_SIZE, offset + frameLen));
  }
  let crc = crc32Update(0xffffffff, buf.subarray(offset, offset + 20));
  crc = crc32Update(crc, buf.subarray(offset + FRAME_HEADER_SIZE, offset + frameLen));
  return (crc ^ 0xffffffff) >>> 0;
}

export interface WalRecord<T = any> {
  txId: bigint;
  timestampNs: bigint;
  payload: T;
  rawBytesLength: number;
}

export interface WalRecoveryReport {
  recoveredRecords: number;
  lastTxId: bigint;
  tornTailBytesTruncated: number;
  totalFileBytes: number;
  status: "CLEAN_RECOVERY" | "TORN_WRITE_RECOVERED" | "INITIALIZED_NEW";
}

const WAL_MAGIC = Buffer.from([0x45, 0x4f, 0x53, 0x57]); // "EOSW"
const WAL_VERSION = 2;
const HEADER_SIZE = 6; // 4 bytes magic + 2 bytes version
const FRAME_HEADER_SIZE = 24; // 4 len + 8 txId + 8 tsNs + 4 crc32

export class EosDurableWal<T = any> {
  public readonly filePath: string;
  private fd: number = -1;
  private walVersion: number = WAL_VERSION;
  private currentTxId: bigint = 0n;
  private recordsCount: number = 0;
  private totalBytesWritten: number = 0;
  private lastRecoveryReport: WalRecoveryReport | null = null;

  constructor(filePath: string, autoOpen = true) {
    this.filePath = path.resolve(filePath);
    const parentDir = path.dirname(this.filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (autoOpen) {
      this.open();
    }
  }

  /**
   * Initializes or re-opens the WAL, running crash recovery.
   */
  public open(): WalRecoveryReport {
    const fileExists = fs.existsSync(this.filePath);

    if (!fileExists) {
      this.fd = fs.openSync(this.filePath, "w+");
      this.walVersion = WAL_VERSION;
      const header = Buffer.alloc(HEADER_SIZE);
      WAL_MAGIC.copy(header, 0);
      header.writeUInt16BE(WAL_VERSION, 4);
      fs.writeSync(this.fd, header, 0, HEADER_SIZE, 0);
      fs.fsyncSync(this.fd);
      this.totalBytesWritten = HEADER_SIZE;
      this.lastRecoveryReport = {
        recoveredRecords: 0,
        lastTxId: 0n,
        tornTailBytesTruncated: 0,
        totalFileBytes: HEADER_SIZE,
        status: "INITIALIZED_NEW",
      };
      return this.lastRecoveryReport;
    }

    this.fd = fs.openSync(this.filePath, "r+");
    const stat = fs.fstatSync(this.fd);
    this.totalBytesWritten = stat.size;

    this.lastRecoveryReport = this.recoverAndReplay(stat.size);
    return this.lastRecoveryReport;
  }

  /**
   * Appends a transactional record to disk with optional hardware fsync.
   */
  public append(payload: T, sync = true): WalRecord<T> {
    if (this.fd === -1) {
      throw new Error(`WAL is not open. Call open() first.`);
    }

    this.currentTxId += 1n;
    const txId = this.currentTxId;
    const timestampNs = process.hrtime.bigint();

    const payloadJson = Buffer.from(JSON.stringify(payload), "utf8");
    const totalFrameLen = FRAME_HEADER_SIZE + payloadJson.length;

    const frame = Buffer.alloc(totalFrameLen);
    frame.writeUInt32BE(totalFrameLen, 0);
    frame.writeBigUInt64BE(txId, 4);
    frame.writeBigUInt64BE(timestampNs, 12);
    payloadJson.copy(frame, FRAME_HEADER_SIZE);

    const crc = computeFrameCrc(frame, 0, totalFrameLen, this.walVersion);
    frame.writeUInt32BE(crc, 20);

    fs.writeSync(this.fd, frame, 0, totalFrameLen, this.totalBytesWritten);
    if (sync) {
      fs.fsyncSync(this.fd);
    }

    this.totalBytesWritten += totalFrameLen;
    this.recordsCount++;

    return {
      txId,
      timestampNs,
      payload,
      rawBytesLength: totalFrameLen,
    };
  }

  /**
   * Reads all valid committed records from the WAL.
   */
  public readAll(): WalRecord<T>[] {
    if (this.fd === -1) {
      throw new Error(`WAL is not open.`);
    }

    const records: WalRecord<T>[] = [];
    const stat = fs.fstatSync(this.fd);
    if (stat.size < HEADER_SIZE) return records;

    const buf = Buffer.alloc(stat.size);
    fs.readSync(this.fd, buf, 0, stat.size, 0);

    let offset = HEADER_SIZE;
    while (offset + FRAME_HEADER_SIZE <= stat.size) {
      const frameLen = buf.readUInt32BE(offset);
      if (frameLen < FRAME_HEADER_SIZE || offset + frameLen > stat.size) {
        break; // Reached end or torn write
      }

      const txId = buf.readBigUInt64BE(offset + 4);
      const timestampNs = buf.readBigUInt64BE(offset + 12);
      const storedCrc = buf.readUInt32BE(offset + 20);

      const payloadSlice = buf.subarray(offset + FRAME_HEADER_SIZE, offset + frameLen);
      const computedCrc = computeFrameCrc(buf, offset, frameLen, this.walVersion);

      if (storedCrc === computedCrc) {
        try {
          const payload = JSON.parse(payloadSlice.toString("utf8"));
          records.push({ txId, timestampNs, payload, rawBytesLength: frameLen });
        } catch {
          break;
        }
      } else {
        break;
      }

      offset += frameLen;
    }

    return records;
  }

  /**
   * Replays WAL log, detects torn tail frames, and truncates safely.
   */
  private recoverAndReplay(fileSize: number): WalRecoveryReport {
    if (fileSize < HEADER_SIZE) {
      fs.ftruncateSync(this.fd, 0);
      this.walVersion = WAL_VERSION;
      const header = Buffer.alloc(HEADER_SIZE);
      WAL_MAGIC.copy(header, 0);
      header.writeUInt16BE(WAL_VERSION, 4);
      fs.writeSync(this.fd, header, 0, HEADER_SIZE, 0);
      fs.fsyncSync(this.fd);
      return {
        recoveredRecords: 0,
        lastTxId: 0n,
        tornTailBytesTruncated: fileSize,
        totalFileBytes: HEADER_SIZE,
        status: "TORN_WRITE_RECOVERED",
      };
    }

    const fullBuffer = Buffer.alloc(fileSize);
    fs.readSync(this.fd, fullBuffer, 0, fileSize, 0);

    // Verify magic signature
    if (!fullBuffer.subarray(0, 4).equals(WAL_MAGIC)) {
      throw new Error(`Invalid WAL header magic. File is corrupted or not an EOS WAL.`);
    }

    const version = fullBuffer.readUInt16BE(4);
    if (version !== 1 && version !== 2) {
      throw new Error(`Unsupported WAL version ${version}. Refusing fail-open recovery.`);
    }
    this.walVersion = version;

    let offset = HEADER_SIZE;
    let lastValidOffset = HEADER_SIZE;
    let recovered = 0;
    let lastTx = 0n;

    while (offset + FRAME_HEADER_SIZE <= fileSize) {
      const frameLen = fullBuffer.readUInt32BE(offset);
      if (frameLen < FRAME_HEADER_SIZE || offset + frameLen > fileSize) {
        break; // Incomplete or torn frame
      }

      const txId = fullBuffer.readBigUInt64BE(offset + 4);
      const storedCrc = fullBuffer.readUInt32BE(offset + 20);

      if (computeFrameCrc(fullBuffer, offset, frameLen, version) === storedCrc) {
        recovered++;
        lastTx = txId;
        offset += frameLen;
        lastValidOffset = offset;
      } else {
        break; // Checksum mismatch (corrupted frame)
      }
    }

    let tornBytes = fileSize - lastValidOffset;
    if (tornBytes > 0) {
      fs.ftruncateSync(this.fd, lastValidOffset);
      fs.fsyncSync(this.fd);
      this.totalBytesWritten = lastValidOffset;
    }

    this.currentTxId = lastTx;
    this.recordsCount = recovered;

    // Reposition write pointer to end of last valid frame
    return {
      recoveredRecords: recovered,
      lastTxId: lastTx,
      tornTailBytesTruncated: tornBytes,
      totalFileBytes: lastValidOffset,
      status: tornBytes > 0 ? "TORN_WRITE_RECOVERED" : "CLEAN_RECOVERY",
    };
  }

  public getStats(): {
    currentTxId: string;
    recordsCount: number;
    totalBytesWritten: number;
    filePath: string;
  } {
    return {
      currentTxId: this.currentTxId.toString(),
      recordsCount: this.recordsCount,
      totalBytesWritten: this.totalBytesWritten,
      filePath: this.filePath,
    };
  }

  public getStatistics(): {
    currentTxId: bigint;
    recordsCount: number;
    totalBytesWritten: number;
    filePath: string;
  } {
    return {
      currentTxId: this.currentTxId,
      recordsCount: this.recordsCount,
      totalBytesWritten: this.totalBytesWritten,
      filePath: this.filePath,
    };
  }

  public getRecoveryReport(): WalRecoveryReport {
    if (!this.lastRecoveryReport) {
      return this.open();
    }
    return this.lastRecoveryReport;
  }

  public replay(): WalRecord<T>[] {
    return this.readAll();
  }

  public close(): void {
    if (this.fd !== -1) {
      try {
        fs.fsyncSync(this.fd);
        fs.closeSync(this.fd);
      } catch {
        // Safe ignored
      }
      this.fd = -1;
    }
  }
}
