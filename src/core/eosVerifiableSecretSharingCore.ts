/**
 * @file eosVerifiableSecretSharingCore.ts
 * @module EosVerifiableSecretSharingCore
 * @description Layer-0 Verifiable Secret Sharing (VSS) engine implementing Feldman VSS
 * and Pedersen VSS with homomorphic commitments, cheater detection, and threshold reconstruction.
 * SPEC-233 / CHANGE-118
 */

import { randomBytes } from "node:crypto";
import type {
  VssScheme,
  VssShare,
  VssCommitmentPackage,
  VssDeal,
  VssVerificationResult,
  VssReconstructionResult,
} from "./eosVerifiableSecretSharingCore.types.js";

/** RFC 3526 MODP Group 15: 3072-bit safe prime (Section 4). */
const VSS_RFC3526_GROUP15_P_HEX = [
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74",
  "020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437",
  "4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED",
  "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05",
  "98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB",
  "9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B",
  "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718",
  "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33",
  "A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7",
  "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864",
  "D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2",
  "08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF",
].join("");

/** RFC 3526 group 15 modulus. */
export const VSS_SAFE_PRIME_P = BigInt("0x" + VSS_RFC3526_GROUP15_P_HEX);
/** Prime order of the quadratic-residue subgroup for the safe-prime group. */
export const VSS_SUBGROUP_ORDER_Q = (VSS_SAFE_PRIME_P - 1n) / 2n;
/** Square of the RFC 3526 group 15 generator, in the order-q subgroup. */
export const VSS_GENERATOR_G = 4n;
/** Secondary subgroup element; its discrete-log relation to G is assumed unknown. */
export const VSS_GENERATOR_H = 9n;
/** Resource cap for a single share split or reconstruction operation. */
export const VSS_MAX_SHARES = 64;
const VSS_MAX_SECRET_BYTES = 383;
const VSS_MAX_GROUP_BITS = VSS_SUBGROUP_ORDER_Q.toString(2).length;

export class EosVerifiableSecretSharingCore {
  public static readonly P: bigint = VSS_SAFE_PRIME_P;
  public static readonly Q: bigint = VSS_SUBGROUP_ORDER_Q;
  public static readonly G: bigint = VSS_GENERATOR_G;
  public static readonly H: bigint = VSS_GENERATOR_H;

  /**
   * Modular exponentiation: (base^exp) mod modulus.
   */
  public static modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    base = ((base % mod) + mod) % mod;
    exp = exp >= 0n ? exp : exp + mod - 1n;

    while (exp > 0n) {
      if (exp & 1n) {
        res = (res * base) % mod;
      }
      base = (base * base) % mod;
      exp >>= 1n;
    }
    return res;
  }

  /**
   * Modular inverse using Extended Euclidean Algorithm: (a^-1) mod m.
   */
  public static modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [((a % m) + m) % m, m];
    let [old_s, s] = [1n, 0n];

    while (r !== 0n) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
    }

    if (old_r !== 1n) {
      throw new Error(`modInverse: values not coprime (${a}, ${m})`);
    }

    return ((old_s % m) + m) % m;
  }

  /**
   * Samples a uniform non-zero scalar in [1, q - 1] by rejection sampling.
   */
  public static randomScalar(q: bigint = VSS_SUBGROUP_ORDER_Q): bigint {
    if (q <= 1n) throw new RangeError("Scalar order must be greater than 1.");
    const bitLength = q.toString(2).length;
    if (bitLength > VSS_MAX_GROUP_BITS) {
      throw new RangeError("Scalar order exceeds the supported group size.");
    }

    const byteLength = Math.ceil(bitLength / 8);
    const mask = (1n << BigInt(bitLength)) - 1n;
    while (true) {
      const bytes = randomBytes(byteLength);
      const value = BigInt("0x" + bytes.toString("hex")) & mask;
      if (value > 0n && value < q) return value;
    }
  }

  /**
   * Converts a bounded secret input into a non-zero scalar smaller than q.
   * Byte inputs are interpreted as unsigned big-endian values.
   */
  public static secretToScalar(secret: string | Buffer | bigint): bigint {
    if (typeof secret === "bigint") {
      if (secret <= 0n || secret >= VSS_SUBGROUP_ORDER_Q) {
        throw new RangeError("Secret scalar must be in the range [1, q - 1].");
      }
      return secret;
    }

    if (typeof secret !== "string" && !Buffer.isBuffer(secret)) {
      throw new TypeError("Secret must be a string, Buffer, or bigint.");
    }

    const buf = typeof secret === "string" ? Buffer.from(secret, "utf8") : secret;
    if (buf.length === 0 || buf.length > VSS_MAX_SECRET_BYTES) {
      throw new RangeError("Secret must contain between 1 and " + VSS_MAX_SECRET_BYTES + " bytes.");
    }

    const val = BigInt("0x" + buf.toString("hex"));
    if (val === 0n || val >= VSS_SUBGROUP_ORDER_Q) {
      throw new RangeError("Secret bytes must encode a scalar in the range [1, q - 1].");
    }
    return val;
  }

  /**
   * Converts a scalar back into a UTF-8 string if printable.
   */
  public static scalarToString(scalar: bigint): string | undefined {
    let hex = scalar.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    try {
      const buf = Buffer.from(hex, "hex");
      const str = buf.toString("utf-8");
      // Basic check if printable ASCII
      if (/^[\x20-\x7E]+$/.test(str)) {
        return str;
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  /**
   * Splits a secret into n verifiable shares with threshold k.
   * Supports Feldman VSS and Pedersen VSS schemes.
   */
  public static splitSecret(
    secret: string | Buffer | bigint,
    k: number,
    n: number,
    scheme: VssScheme = "pedersen",
  ): VssDeal {
    this.assertVssConfig(k, n);
    if (scheme !== "feldman" && scheme !== "pedersen") {
      throw new TypeError("Unsupported VSS scheme.");
    }

    const s = this.secretToScalar(secret);
    const p = VSS_SAFE_PRIME_P;
    const q = VSS_SUBGROUP_ORDER_Q;
    const g = VSS_GENERATOR_G;
    const h = VSS_GENERATOR_H;

    // Secret polynomial coefficients: f(x) = s + a1*x + a2*x^2 + ... + a_{k-1}*x^{k-1}
    const aCoeffs: bigint[] = [s];
    for (let j = 1; j < k; j++) {
      aCoeffs.push(this.randomScalar(q));
    }

    // Blinding polynomial coefficients for Pedersen VSS: b(x) = b0 + b1*x + ...
    const bCoeffs: bigint[] = [];
    if (scheme === "pedersen") {
      for (let j = 0; j < k; j++) {
        bCoeffs.push(this.randomScalar(q));
      }
    }

    // Compute commitments:
    // Feldman: C_j = g^{a_j} mod p
    // Pedersen: C_j = (g^{a_j} * h^{b_j}) mod p
    const commitmentsHex: string[] = [];
    for (let j = 0; j < k; j++) {
      let C_j: bigint;
      if (scheme === "feldman") {
        C_j = this.modPow(g, aCoeffs[j], p);
      } else {
        const termG = this.modPow(g, aCoeffs[j], p);
        const termH = this.modPow(h, bCoeffs[j], p);
        C_j = (termG * termH) % p;
      }
      commitmentsHex.push(C_j.toString(16));
    }

    // Evaluate polynomials for each participant i in [1..n]
    const shares: VssShare[] = [];
    for (let i = 1; i <= n; i++) {
      const iBig = BigInt(i);

      // Evaluate f(i) mod q
      let f_i = 0n;
      let iPower = 1n;
      for (let j = 0; j < k; j++) {
        f_i = (f_i + aCoeffs[j] * iPower) % q;
        iPower = (iPower * iBig) % q;
      }

      const share: VssShare = {
        id: i,
        valueHex: f_i.toString(16),
      };

      if (scheme === "pedersen") {
        // Evaluate b(i) mod q
        let b_i = 0n;
        let iPowerB = 1n;
        for (let j = 0; j < k; j++) {
          b_i = (b_i + bCoeffs[j] * iPowerB) % q;
          iPowerB = (iPowerB * iBig) % q;
        }
        share.blindingHex = b_i.toString(16);
      }

      shares.push(share);
    }

    const commitmentPackage: VssCommitmentPackage = {
      scheme,
      k,
      n,
      commitmentsHex,
      generatorGHex: g.toString(16),
      generatorHHex: scheme === "pedersen" ? h.toString(16) : undefined,
      primePHex: p.toString(16),
      orderQHex: q.toString(16),
    };

    return {
      scheme,
      k,
      n,
      shares,
      commitments: commitmentPackage,
    };
  }

  /**
   * Verifies an individual share against public commitments.
   * Returns verification result with detailed diagnostics.
   */
  public static verifyShare(share: VssShare, commitments: VssCommitmentPackage): VssVerificationResult {
    const participantId = Number.isSafeInteger(share?.id) ? share.id : -1;
    try {
      const params = this.assertCommitmentPackage(commitments);
      return this.verifyShareWithParams(share, commitments, params);
    } catch (error) {
      return {
        valid: false,
        participantId,
        reason: error instanceof Error ? error.message : "Invalid share or commitment package.",
      };
    }
  }

  /**
   * Reconstructs the secret from a set of shares using Lagrange interpolation.
   * If commitments are supplied, automatically verifies all shares and excludes cheaters.
   */
  public static reconstruct(
    shares: VssShare[],
    k: number,
    commitments?: VssCommitmentPackage,
  ): VssReconstructionResult {
    if (!Number.isSafeInteger(k) || k < 2 || k > VSS_MAX_SHARES) {
      throw new RangeError("Threshold k must be an integer from 2 to " + VSS_MAX_SHARES + ".");
    }
    if (!Array.isArray(shares) || shares.length > VSS_MAX_SHARES) {
      throw new RangeError("Shares must be an array with at most " + VSS_MAX_SHARES + " entries.");
    }
    const commitmentParams = commitments ? this.assertCommitmentPackage(commitments) : undefined;
    if (commitments) {
      if (k !== commitments.k) {
        throw new RangeError("Reconstruction threshold must match the commitment package.");
      }
    }

    const cheaters: number[] = [];
    const validShares: VssShare[] = [];
    if (commitments) {
      for (const share of shares) {
        const check = this.verifyShareWithParams(share, commitments, commitmentParams!);
        if (check.valid) validShares.push(share);
        else cheaters.push(check.participantId);
      }
    } else {
      validShares.push(...shares);
    }

    const uniqueMap = new Map<number, VssShare>();
    for (const share of validShares) {
      if (!Number.isSafeInteger(share?.id) || share.id < 1 || share.id >= Number(VSS_SUBGROUP_ORDER_Q)) {
        throw new RangeError("Share participant ids must be positive safe integers.");
      }
      if (uniqueMap.has(share.id)) {
        throw new Error("Duplicate participant share id: " + share.id + ".");
      }
      const value = this.parseScalar(share.valueHex, "share value", VSS_SUBGROUP_ORDER_Q);
      if (commitments?.scheme === "pedersen") {
        this.parseScalar(share.blindingHex, "share blinding", VSS_SUBGROUP_ORDER_Q);
      }
      uniqueMap.set(share.id, { ...share, valueHex: value.toString(16) });
    }
    const distinctShares = Array.from(uniqueMap.values());

    if (distinctShares.length < k) {
      throw new Error(
        "Insufficient valid shares to reconstruct secret: need " +
          k +
          ", but only have " +
          distinctShares.length +
          " (cheaters: " +
          (cheaters.join(", ") || "none") +
          ").",
      );
    }

    const subset = distinctShares.slice(0, k);
    const q = VSS_SUBGROUP_ORDER_Q;
    let secretScalar = 0n;

    for (const share of subset) {
      const iBig = BigInt(share.id);
      const s_i = BigInt("0x" + share.valueHex);
      let num = 1n;
      let den = 1n;

      for (const other of subset) {
        if (other.id === share.id) continue;
        const jBig = BigInt(other.id);
        num = (num * ((q - (jBig % q)) % q)) % q;
        let diff = (iBig - jBig) % q;
        if (diff < 0n) diff += q;
        den = (den * diff) % q;
      }

      const l_i = (num * this.modInverse(den, q)) % q;
      secretScalar = (secretScalar + s_i * l_i) % q;
    }

    return {
      secretHex: secretScalar.toString(16),
      secretString: this.scalarToString(secretScalar),
      cheatersIdentified: cheaters,
      validShareCount: distinctShares.length,
    };
  }

  /**
   * Serializes the full dealer-side deal. This includes every private share;
   * never broadcast this archive to participants.
   */
  public static serialize(deal: VssDeal): string {
    return JSON.stringify(deal);
  }

  /**
   * Creates a participant-specific transport package with exactly one private
   * share and the public commitments needed to verify it.
   */
  public static serializeForParticipant(deal: VssDeal, participantId: number): string {
    this.assertVssConfig(deal?.k, deal?.n);
    this.assertCommitmentPackage(deal?.commitments);
    if (deal.scheme !== deal.commitments.scheme || deal.k !== deal.commitments.k || deal.n !== deal.commitments.n) {
      throw new TypeError("Dealer deal and commitment package parameters must match.");
    }
    if (!Array.isArray(deal?.shares) || deal.shares.length !== deal.n) {
      throw new TypeError("Dealer deal must contain exactly n shares.");
    }
    if (!Number.isSafeInteger(participantId) || participantId < 1 || participantId > deal.n) {
      throw new RangeError("Participant id is outside the declared share range.");
    }
    const share = deal.shares.find((item) => item?.id === participantId);
    if (!share || !this.verifyShare(share, deal.commitments).valid) {
      throw new Error("No valid share exists for participant " + participantId + ".");
    }
    return JSON.stringify({
      scheme: deal.scheme,
      k: deal.k,
      n: deal.n,
      share,
      commitments: deal.commitments,
    });
  }

  /**
   * Deserializes and validates a full dealer-side archive. It is still sensitive
   * because it contains all private shares.
   */
  public static deserialize(jsonString: string): VssDeal {
    if (typeof jsonString !== "string" || Buffer.byteLength(jsonString, "utf8") > 1024 * 1024) {
      throw new RangeError("Serialized VSS deal must be a string no larger than 1 MiB.");
    }
    const parsed: unknown = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Invalid VssDeal JSON object.");
    }
    const deal = parsed as Partial<VssDeal>;
    this.assertVssConfig(deal.k, deal.n);
    if (deal.scheme !== "feldman" && deal.scheme !== "pedersen") {
      throw new TypeError("Invalid VSS scheme.");
    }
    if (deal.scheme !== deal.commitments?.scheme || !Array.isArray(deal.shares) || deal.shares.length !== deal.n) {
      throw new TypeError("Serialized VSS deal fields are inconsistent.");
    }
    this.assertCommitmentPackage(deal.commitments);
    const seen = new Set<number>();
    for (const share of deal.shares) {
      if (!share || !Number.isSafeInteger(share.id) || share.id < 1 || share.id > deal.n || seen.has(share.id)) {
        throw new TypeError("Serialized VSS deal contains an invalid or duplicate participant id.");
      }
      seen.add(share.id);
      this.parseScalar(share.valueHex, "share value", VSS_SUBGROUP_ORDER_Q);
      if (deal.scheme === "pedersen") {
        this.parseScalar(share.blindingHex, "share blinding", VSS_SUBGROUP_ORDER_Q);
      } else if (share.blindingHex !== undefined) {
        throw new TypeError("Feldman shares cannot contain a blinding scalar.");
      }
    }
    return deal as VssDeal;
  }

  private static assertVssConfig(k: unknown, n: unknown): asserts k is number {
    if (!Number.isSafeInteger(k) || !Number.isSafeInteger(n)) {
      throw new TypeError("Threshold and share count must be safe integers.");
    }
    if ((k as number) < 2 || (n as number) < (k as number)) {
      throw new RangeError("Require 2 <= k <= n.");
    }
    if ((n as number) > VSS_MAX_SHARES) {
      throw new RangeError("Share count exceeds the configured limit of " + VSS_MAX_SHARES + ".");
    }
  }

  private static parseHexInteger(value: unknown, label: string): bigint {
    if (typeof value !== "string" || !/^[0-9a-f]{1,768}$/i.test(value)) {
      throw new TypeError(label + " must be a bounded hexadecimal string.");
    }
    return BigInt("0x" + value);
  }

  private static parseScalar(value: unknown, label: string, q: bigint): bigint {
    const scalar = this.parseHexInteger(value, label);
    if (scalar < 0n || scalar >= q) {
      throw new RangeError(label + " must be in [0, q - 1].");
    }
    return scalar;
  }

  private static parseGroupElement(value: unknown, p: bigint): bigint {
    const element = this.parseHexInteger(value, "Commitment");
    if (element < 1n || element >= p) {
      throw new RangeError("Commitment is outside the multiplicative group.");
    }
    return element;
  }

  private static verifyShareWithParams(
    share: VssShare,
    commitments: VssCommitmentPackage,
    params: { p: bigint; q: bigint; g: bigint; h: bigint },
  ): VssVerificationResult {
    const participantId = Number.isSafeInteger(share?.id) ? share.id : -1;
    try {
      const { p, q, g, h } = params;
      if (!share || typeof share !== "object") throw new TypeError("Share must be an object.");
      if (!Number.isSafeInteger(share.id) || share.id < 1 || share.id > commitments.n) {
        throw new RangeError("Participant id is outside the declared share range.");
      }

      const s_i = this.parseScalar(share.valueHex, "share value", q);
      const iBig = BigInt(share.id);
      let lhs: bigint;

      if (commitments.scheme === "feldman") {
        lhs = this.modPow(g, s_i, p);
      } else {
        if (typeof share.blindingHex !== "string") {
          throw new TypeError("Pedersen share is missing its blinding scalar.");
        }
        const t_i = this.parseScalar(share.blindingHex, "share blinding", q);
        lhs = (this.modPow(g, s_i, p) * this.modPow(h, t_i, p)) % p;
      }

      let rhs = 1n;
      let iPower = 1n;
      for (const commitmentHex of commitments.commitmentsHex) {
        const commitment = this.parseGroupElement(commitmentHex, p);
        rhs = (rhs * this.modPow(commitment, iPower, p)) % p;
        iPower = (iPower * iBig) % q;
      }

      const valid = lhs === rhs;
      return {
        valid,
        participantId: share.id,
        reason: valid ? undefined : "Homomorphic commitment check failed",
      };
    } catch (error) {
      return {
        valid: false,
        participantId,
        reason: error instanceof Error ? error.message : "Invalid share or commitment package.",
      };
    }
  }

  private static assertCommitmentPackage(commitments: VssCommitmentPackage | undefined): {
    p: bigint;
    q: bigint;
    g: bigint;
    h: bigint;
  } {
    if (!commitments || typeof commitments !== "object") {
      throw new TypeError("Commitment package must be an object.");
    }
    this.assertVssConfig(commitments.k, commitments.n);
    if (commitments.scheme !== "feldman" && commitments.scheme !== "pedersen") {
      throw new TypeError("Unsupported commitment scheme.");
    }
    if (!Array.isArray(commitments.commitmentsHex) || commitments.commitmentsHex.length !== commitments.k) {
      throw new RangeError("Commitment count must equal the declared threshold.");
    }

    const p = this.parseHexInteger(commitments.primePHex, "Group prime");
    const q = this.parseHexInteger(commitments.orderQHex, "Subgroup order");
    const g = this.parseHexInteger(commitments.generatorGHex, "Generator g");
    if (p !== VSS_SAFE_PRIME_P || q !== VSS_SUBGROUP_ORDER_Q || g !== VSS_GENERATOR_G) {
      throw new RangeError("Commitment package uses an unsupported cryptographic group.");
    }

    let h = VSS_GENERATOR_H;
    if (commitments.scheme === "pedersen") {
      h = this.parseHexInteger(commitments.generatorHHex, "Generator h");
      if (h !== VSS_GENERATOR_H) {
        throw new RangeError("Commitment package uses an unsupported Pedersen generator.");
      }
    } else if (commitments.generatorHHex !== undefined) {
      throw new TypeError("Feldman package cannot declare generator h.");
    }

    for (const value of commitments.commitmentsHex) {
      const element = this.parseGroupElement(value, p);
      if (this.modPow(element, q, p) !== 1n) {
        throw new RangeError("Commitment is not in the configured prime-order subgroup.");
      }
    }
    return { p, q, g, h };
  }
}
