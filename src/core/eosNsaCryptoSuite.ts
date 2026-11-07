/**
 * EOS SYSTEM — NSA CNSA 2.0 CRYPTOGRAPHIC SUITE
 * Governed by ADR-040, SPEC-034, FR-094, FR-095, BDD-086, BDD-087
 *
 * Implements:
 * 1. Military-grade AES-256-GCM authenticated encryption with 96-bit random IVs and 128-bit tags.
 * 2. Associated Authenticated Data (AAD) binding security classifications & compartment labels.
 * 3. SHA-384 / SHA-512 cryptographic invariant attestation digests.
 * 4. Constant-time timing-channel resistant verification (timingSafeEqual).
 * 5. DoD 5220.22-M / NSA 4-pass in-place memory zeroization.
 *
 * 100% Layer-0 Purity with zero runtime npm dependencies.
 */

import crypto from "node:crypto";

export interface NsaEncryptedEnvelope {
  readonly iv: string; // Hex-encoded 96-bit (12-byte) IV
  readonly ciphertext: string; // Hex-encoded ciphertext
  readonly authTag: string; // Hex-encoded 128-bit (16-byte) auth tag
  readonly aad?: string; // Associated Authenticated Data (classification, compartment)
  readonly sha384Digest: string; // Cryptographic fingerprint of the ciphertext
  readonly algorithm: "AES-256-GCM";
}

export class EosNsaCryptoSuite {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH_BYTES = 12; // 96 bits standard for GCM
  private static readonly TAG_LENGTH_BYTES = 16; // 128 bits
  private static readonly KEY_LENGTH_BYTES = 32; // 256 bits

  /**
   * Generates a cryptographically strong 256-bit symmetric key.
   */
  public static generateKey256(): Buffer {
    return crypto.randomBytes(this.KEY_LENGTH_BYTES);
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a synthetic/random 96-bit IV
   * and binds Associated Authenticated Data (AAD) such as classification tags.
   */
  public static encryptAesGcm256(plaintext: Buffer | string, key: Buffer, aad?: string | Buffer): NsaEncryptedEnvelope {
    if (!Buffer.isBuffer(key) || key.length !== this.KEY_LENGTH_BYTES) {
      throw new Error(`NSA Cryptographic Failure: Key must be exactly ${this.KEY_LENGTH_BYTES} bytes`);
    }

    const ptBuffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8");
    const iv = crypto.randomBytes(this.IV_LENGTH_BYTES);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let aadString: string | undefined;
    if (aad) {
      const aadBuf = Buffer.isBuffer(aad) ? aad : Buffer.from(aad, "utf8");
      cipher.setAAD(aadBuf);
      aadString = aadBuf.toString("utf8");
    }

    const ciphertext = Buffer.concat([cipher.update(ptBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const sha384Digest = crypto.createHash("sha384").update(ciphertext).digest("hex");

    return {
      iv: iv.toString("hex"),
      ciphertext: ciphertext.toString("hex"),
      authTag: authTag.toString("hex"),
      aad: aadString,
      sha384Digest,
      algorithm: "AES-256-GCM",
    };
  }

  /**
   * Decrypts an AES-256-GCM envelope, verifying the 128-bit authentication tag
   * and matching Associated Authenticated Data (AAD).
   * Throws in a fail-closed manner if tag verification fails or tampering is detected.
   */
  public static decryptAesGcm256(
    envelope: { iv: string; ciphertext: string; authTag: string; aad?: string },
    key: Buffer,
  ): Buffer {
    if (!Buffer.isBuffer(key) || key.length !== this.KEY_LENGTH_BYTES) {
      throw new Error(`NSA Cryptographic Failure: Key must be exactly ${this.KEY_LENGTH_BYTES} bytes`);
    }

    const iv = Buffer.from(envelope.iv, "hex");
    const authTag = Buffer.from(envelope.authTag, "hex");
    const ciphertext = Buffer.from(envelope.ciphertext, "hex");

    if (iv.length !== this.IV_LENGTH_BYTES) {
      throw new Error("NSA Cryptographic Failure: Invalid IV length");
    }
    if (authTag.length !== this.TAG_LENGTH_BYTES) {
      throw new Error("NSA Cryptographic Failure: Invalid AuthTag length");
    }

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    if (envelope.aad) {
      decipher.setAAD(Buffer.from(envelope.aad, "utf8"));
    }

    try {
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext;
    } catch {
      throw new Error(
        "NSA Integrity Failure: AES-GCM AuthTag validation failed. Potential ciphertext tampering or AAD mismatch.",
      );
    }
  }

  /**
   * Computes SHA-384 cryptographic digest.
   */
  public static computeSha384(data: Buffer | string): string {
    return crypto.createHash("sha384").update(data).digest("hex");
  }

  /**
   * Computes SHA-512 cryptographic digest.
   */
  public static computeSha512(data: Buffer | string): string {
    return crypto.createHash("sha512").update(data).digest("hex");
  }

  /**
   * Constant-time comparison resistant to timing side-channel attacks.
   * Compares two buffers or strings in strictly constant time.
   */
  public static constantTimeCompare(a: Buffer | string, b: Buffer | string): boolean {
    const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a, "utf8");
    const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b, "utf8");

    if (bufA.length !== bufB.length) {
      // Execute dummy constant-time comparison to mask timing
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * In-place memory zeroization conforming to DoD 5220.22-M / NSA protocols:
   * Pass 1: Overwrite with alternating bit pattern 0xAA (10101010)
   * Pass 2: Overwrite with complementary bit pattern 0x55 (01010101)
   * Pass 3: Overwrite with crypto-secure pseudo-random white noise
   * Pass 4: Final overwrite with zero bytes 0x00
   */
  public static zeroizeBuffer(buf: Buffer | Uint8Array): void {
    if (!buf || buf.length === 0) return;

    const len = buf.length;

    // Pass 1: 0xAA
    buf.fill(0xaa);

    // Pass 2: 0x55
    buf.fill(0x55);

    // Pass 3: Random white noise
    const noise = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      buf[i] = noise[i];
    }

    // Pass 4: Final 0x00 zeroization
    buf.fill(0x00);
  }

  /**
   * Verifies that a buffer has been completely zeroized (all bytes === 0x00).
   */
  public static isZeroized(buf: Buffer | Uint8Array): boolean {
    if (!buf || buf.length === 0) return true;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] !== 0x00) return false;
    }
    return true;
  }
}
