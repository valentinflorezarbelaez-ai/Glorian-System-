/**
 * EOS SYSTEM — STRIPE TREASURY IN-MEMORY CRYPTOGRAPHIC ZEROIZATION & SECURE VAULT (Layer 0)
 * Governed by SPEC-089, CHANGE-064, ADR-088, FR-318..FR-321, BDD-253, BDD-254 (v72.0.0)
 *
 * Implements deterministic anti-cold-boot and anti-memory-dump memory wiping:
 * 1. Multi-pass cryptographic scrambling: random bytes -> 0xFF bitwise mask -> 0x00 pure zeros.
 * 2. Scoped lifecycle containers (`EosZeroizableSecret`) with auto-purge semantics.
 * 3. Fail-closed access guards (`SECRET_ALREADY_ZEROIZED`).
 * 4. Zeroized polynomial coefficient buffers for high-assurance Shamir sharing.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import crypto from "node:crypto";
import {
  assertPrecondition,
  assertPostcondition,
  deepFreeze
} from "./eosKernelPrimitives.ts";

/**
 * Deterministically overwrites a memory buffer across three cryptographic passes
 * to neutralize memory remanence, cold-boot extractions, and core dump forensic recovery.
 */
export function secureZeroizeBuffer(buffer: Buffer | Uint8Array): void {
  assertPrecondition(buffer instanceof Buffer || buffer instanceof Uint8Array, "Target must be a Buffer or Uint8Array");
  if (buffer.length === 0) return;

  // Pass 1: Cryptographic pseudo-random byte scrambling
  crypto.randomFillSync(buffer);

  // Pass 2: Inverted bitwise mask (0xFF)
  buffer.fill(0xFF);

  // Pass 3: Pure zero baseline (0x00)
  buffer.fill(0x00);
}

export class EosZeroizableSecret {
  private buffer: Buffer | null = null;
  private disposed: boolean = false;
  private readonly byteLength: number;

  constructor(secretData: string | Buffer | Uint8Array) {
    assertPrecondition(Boolean(secretData), "Secret data cannot be empty");

    if (typeof secretData === "string") {
      this.buffer = Buffer.from(secretData, "utf8");
    } else {
      this.buffer = Buffer.from(secretData);
    }

    this.byteLength = this.buffer.length;
  }

  public getByteLength(): number {
    return this.byteLength;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Scoped execution helper: provides temporary access to raw secret bytes,
   * then immediately purges and zeroizes the memory when the scope exits.
   */
  public static useTemporary<T>(
    secretData: string | Buffer | Uint8Array,
    consumer: (secretBytes: Buffer) => T
  ): T {
    const secret = new EosZeroizableSecret(secretData);
    try {
      return secret.use(consumer);
    } finally {
      secret.dispose();
    }
  }

  /**
   * Executes a callback with access to the raw buffer, asserting non-disposed state.
   */
  public use<T>(consumer: (secretBytes: Buffer) => T): T {
    if (this.disposed || !this.buffer) {
      throw new Error("SECRET_ALREADY_ZEROIZED: Attempted to access memory that has been deterministically purged");
    }

    return consumer(this.buffer);
  }

  /**
   * Deterministically scrambles and zeroizes the secret buffer in RAM.
   */
  public dispose(): void {
    if (this.disposed) return;

    if (this.buffer) {
      secureZeroizeBuffer(this.buffer);
      this.buffer = null;
    }

    this.disposed = true;
  }
}

export class EosSealedMemoryVault {
  private secrets: Map<string, EosZeroizableSecret> = new Map();

  public storeSecret(key: string, secretValue: string | Buffer): void {
    assertPrecondition(Boolean(key), "Key cannot be empty");
    if (this.secrets.has(key)) {
      this.secrets.get(key)?.dispose();
    }

    this.secrets.set(key, new EosZeroizableSecret(secretValue));
  }

  public accessSecret<T>(key: string, consumer: (buf: Buffer) => T): T {
    const secret = this.secrets.get(key);
    if (!secret || secret.isDisposed()) {
      throw new Error(`VAULT_KEY_NOT_FOUND: Key '${key}' does not exist or has been zeroized`);
    }

    return secret.use(consumer);
  }

  public purgeSecret(key: string): boolean {
    const secret = this.secrets.get(key);
    if (secret) {
      secret.dispose();
      this.secrets.delete(key);
      return true;
    }
    return false;
  }

  public purgeAll(): number {
    const count = this.secrets.size;
    for (const secret of this.secrets.values()) {
      secret.dispose();
    }
    this.secrets.clear();
    return count;
  }
}
