/**
 * EOS SYSTEM — PROTOBUF WIRE-FORMAT AGENT CONTRACT ENCODER (Layer 0)
 * Governed by SPEC-144 (Horizon-2 Binary Inter-Agent Contracts)
 *
 * Implements Protocol Buffers wire format (proto3 encoding) natively using
 * only `node:buffer` and `node:crypto`. Enables strict binary contracts between
 * swarm agents, BFT consensus nodes, and the Hrana replication stream without
 * any external npm dependency.
 *
 * Wire types (per protobuf spec):
 *   0 = Varint  (int32, int64, uint32, uint64, sint32, sint64, bool, enum)
 *   1 = 64-bit  (fixed64, sfixed64, double)
 *   2 = Length-delimited (string, bytes, embedded messages, repeated fields)
 *   5 = 32-bit  (fixed32, sfixed32, float)
 *
 * Zero external npm runtime dependencies (Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Field Descriptor & Schema Types
// ---------------------------------------------------------------------------

export type WireType = 0 | 1 | 2 | 5;

export interface FieldDef {
  readonly tag: number;
  readonly name: string;
  readonly wireType: WireType;
  readonly type:
    | "int32"
    | "int64"
    | "uint32"
    | "uint64"
    | "sint32"
    | "sint64"
    | "bool"
    | "double"
    | "float"
    | "string"
    | "bytes"
    | "message"
    | "fixed32"
    | "sfixed32"
    | "fixed64"
    | "sfixed64"
    | "enum";
  readonly repeated?: boolean;
}

export interface ContractSchema {
  readonly name: string;
  readonly fields: readonly FieldDef[];
}

export interface EncodedContract {
  readonly schemaName: string;
  readonly payload: Uint8Array;
  readonly byteSize: number;
  readonly sha256Digest: string;
}

// ---------------------------------------------------------------------------
// Varint Encoding / Decoding (protobuf base-128 varint)
// ---------------------------------------------------------------------------

function encodeVarint(value: number | bigint): number[] {
  const bytes: number[] = [];
  let v = typeof value === "bigint" ? value : BigInt(value);
  if (v < 0n) v = (1n << 64n) + v; // Two's complement for negative
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (v > 0n);
  return bytes;
}

function encodeVarint32(value: number): number[] {
  // Encode only 32 bits (max 5 bytes); handles negatives via >>>
  const bytes: number[] = [];
  let v = value >>> 0; // Unsigned 32-bit view
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return bytes;
}

function decodeVarint(buf: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    if (shift >= 63) {
      // Overflow protection: stop accumulating
      pos++;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      continue;
    }
    result += (byte & 0x7f) * Math.pow(2, shift);
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, next: pos };
}

// ---------------------------------------------------------------------------
// ZigZag encoding for sint32/sint64
// ---------------------------------------------------------------------------

function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

function zigzagDecode(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

// ---------------------------------------------------------------------------
// Field Key (tag + wire type combined)
// ---------------------------------------------------------------------------

function makeFieldKey(tag: number, wireType: WireType): number[] {
  return encodeVarint((tag << 3) | wireType);
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

export class EosProtobufContractEngine {
  private readonly schemas: Map<string, ContractSchema> = new Map();

  /**
   * Registers a contract schema for binary encode/decode.
   */
  registerSchema(schema: ContractSchema): void {
    assertPrecondition(
      schema.fields.every((f) => f.tag >= 1 && f.tag <= 536870911),
      "All field tags must be 1..536870911",
    );
    this.schemas.set(schema.name, deepFreeze(schema));
  }

  /**
   * Encodes a plain object into protobuf wire-format bytes.
   */
  encode(schemaName: string, data: Record<string, unknown>): EncodedContract {
    const schema = this.schemas.get(schemaName);
    assertPrecondition(schema !== undefined, `Unknown schema: ${schemaName}`);
    const s = schema as ContractSchema;

    const bytes: number[] = [];

    for (const field of s.fields) {
      const value = data[field.name];
      if (value === undefined || value === null) continue;

      const values = field.repeated && Array.isArray(value) ? value : [value];

      for (const v of values) {
        const key = makeFieldKey(field.tag, field.wireType);
        bytes.push(...key);
        this.encodeValue(bytes, field, v);
      }
    }

    const payload = new Uint8Array(bytes);
    return deepFreeze({
      schemaName,
      payload,
      byteSize: payload.length,
      sha256Digest: pureSha256(Buffer.from(payload).toString("hex")),
    });
  }

  /**
   * Decodes protobuf wire-format bytes back into a plain object.
   */
  decode(schemaName: string, payload: Uint8Array): Record<string, unknown> {
    const schema = this.schemas.get(schemaName);
    assertPrecondition(schema !== undefined, `Unknown schema: ${schemaName}`);
    const s = schema as ContractSchema;

    const result: Record<string, unknown> = {};
    let pos = 0;

    while (pos < payload.length) {
      const { value: key, next } = decodeVarint(payload, pos);
      pos = next;
      const tag = key >>> 3;
      const wireType = (key & 0x7) as WireType;

      const field = s.fields.find((f) => f.tag === tag);
      if (!field) {
        // Skip unknown fields
        pos = this.skipField(payload, pos, wireType);
        continue;
      }

      const { value, next: nextPos } = this.decodeValue(payload, pos, field);
      pos = nextPos;

      if (field.repeated) {
        if (!Array.isArray(result[field.name])) result[field.name] = [];
        (result[field.name] as unknown[]).push(value);
      } else {
        result[field.name] = value;
      }
    }

    return result;
  }

  /**
   * Lists all registered schemas.
   */
  listSchemas(): readonly string[] {
    return Array.from(this.schemas.keys()).sort();
  }

  /**
   * Computes a deterministic schema fingerprint for versioning.
   */
  schemaFingerprint(schemaName: string): string {
    const schema = this.schemas.get(schemaName);
    assertPrecondition(schema !== undefined, `Unknown schema: ${schemaName}`);
    const s = schema as ContractSchema;
    const canonical = s.fields.map((f) => `${f.tag}:${f.name}:${f.wireType}:${f.type}`).join(",");
    return pureSha256(canonical).slice(0, 16);
  }

  // -------------------------------------------------------------------------
  // Private: Value Encoding
  // -------------------------------------------------------------------------

  private encodeValue(bytes: number[], field: FieldDef, value: unknown): void {
    switch (field.type) {
      case "int32":
      case "uint32":
      case "enum":
        bytes.push(...encodeVarint32(Number(value)));
        break;
      case "int64":
      case "uint64":
        bytes.push(...encodeVarint(Number(value)));
        break;
      case "sint32":
      case "sint64":
        bytes.push(...encodeVarint(zigzagEncode(Number(value))));
        break;
      case "bool":
        bytes.push(...encodeVarint(value ? 1 : 0));
        break;
      case "fixed32":
      case "sfixed32":
      case "float": {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, Number(value), true);
        if (field.type === "sfixed32") new DataView(buf).setInt32(0, Number(value), true);
        else if (field.type === "fixed32") new DataView(buf).setUint32(0, Number(value), true);
        bytes.push(...new Uint8Array(buf));
        break;
      }
      case "fixed64":
      case "sfixed64":
      case "double": {
        const buf = new ArrayBuffer(8);
        if (field.type === "double") new DataView(buf).setFloat64(0, Number(value), true);
        else new DataView(buf).setBigUint64(0, BigInt(value as number), true);
        bytes.push(...new Uint8Array(buf));
        break;
      }
      case "string": {
        const str = String(value);
        const encoded = new TextEncoder().encode(str);
        bytes.push(...encodeVarint(encoded.length));
        bytes.push(...encoded);
        break;
      }
      case "bytes": {
        const arr = value instanceof Uint8Array ? value : new Uint8Array(value as number[]);
        bytes.push(...encodeVarint(arr.length));
        bytes.push(...arr);
        break;
      }
      case "message": {
        // Embedded message: serialize length-delimited
        const nested = value instanceof Uint8Array ? value : new Uint8Array(0);
        bytes.push(...encodeVarint(nested.length));
        bytes.push(...nested);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private: Value Decoding
  // -------------------------------------------------------------------------

  private decodeValue(buf: Uint8Array, pos: number, field: FieldDef): { value: unknown; next: number } {
    switch (field.type) {
      case "int32":
      case "int64":
      case "uint32":
      case "uint64":
      case "enum": {
        const r = decodeVarint(buf, pos);
        return field.type === "int32" ? { value: r.value | 0, next: r.next } : { value: r.value, next: r.next };
      }
      case "sint32":
      case "sint64": {
        const r = decodeVarint(buf, pos);
        return { value: zigzagDecode(r.value), next: r.next };
      }
      case "bool": {
        const r = decodeVarint(buf, pos);
        return { value: r.value !== 0, next: r.next };
      }
      case "fixed32": {
        const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getUint32(0, true);
        return { value: v, next: pos + 4 };
      }
      case "sfixed32": {
        const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getInt32(0, true);
        return { value: v, next: pos + 4 };
      }
      case "float": {
        const v = new DataView(buf.buffer, buf.byteOffset + pos, 4).getFloat32(0, true);
        return { value: v, next: pos + 4 };
      }
      case "double": {
        const v = new DataView(buf.buffer, buf.byteOffset + pos, 8).getFloat64(0, true);
        return { value: v, next: pos + 8 };
      }
      case "fixed64":
      case "sfixed64": {
        const v = Number(new DataView(buf.buffer, buf.byteOffset + pos, 8).getBigUint64(0, true));
        return { value: v, next: pos + 8 };
      }
      case "string": {
        const len = decodeVarint(buf, pos);
        const str = new TextDecoder().decode(buf.slice(len.next, len.next + len.value));
        return { value: str, next: len.next + len.value };
      }
      case "bytes": {
        const len = decodeVarint(buf, pos);
        return { value: buf.slice(len.next, len.next + len.value), next: len.next + len.value };
      }
      case "message": {
        const len = decodeVarint(buf, pos);
        return { value: buf.slice(len.next, len.next + len.value), next: len.next + len.value };
      }
    }
    return { value: null, next: pos };
  }

  private skipField(buf: Uint8Array, pos: number, wireType: WireType): number {
    switch (wireType) {
      case 0:
        return decodeVarint(buf, pos).next;
      case 1:
        return pos + 8;
      case 2: {
        const { value, next } = decodeVarint(buf, pos);
        return next + value;
      }
      case 5:
        return pos + 4;
      default:
        return buf.length;
    }
  }
}
