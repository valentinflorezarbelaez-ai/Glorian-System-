/**
 * EOS Layer-0 FROST Threshold Schnorr Signatures (RFC 9591) Core (SPEC-219)
 * Strict Zero Runtime Dependencies (EOS Law V), Node 24 Strip-Only TypeScript.
 * Enforces IEEE 830 EARS FR-1114..FR-1118 and ISO/IEC/IEEE 29148 BDD-1114..BDD-1118.
 */

import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { type AffinePoint, type SecpPoint } from "./eosVerifiableRandomFunctionCore.types.ts";
import {
  SECP256K1_G,
  SECP256K1_Q,
  SECP256K1_P,
  pointAdd,
  pointMultiply,
  isOnCurve,
  serializePoint,
  modInverse,
} from "./eosVerifiableRandomFunctionCore.ts";
import {
  type FrostKeyShare,
  type FrostGroupKey,
  type FrostNoncePair,
  type FrostCommitmentShare,
  type FrostSignatureShare,
  type FrostSignature,
  type FrostSigningResult,
  type FrostVerificationResult,
  type FrostReceipt,
  type FrostOperationType,
} from "./eosFrostThresholdSignatureCore.types.ts";

/* -------------------------------------------------------------------------- */
/* Design by Contract (DbC) Helpers                                          */
/* -------------------------------------------------------------------------- */

function assertPrecondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PRECONDITION_FAILED] ${message}`);
  }
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function pureSha256(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function modQ(a: bigint): bigint {
  const res = a % SECP256K1_Q;
  return res >= 0n ? res : res + SECP256K1_Q;
}

/* -------------------------------------------------------------------------- */
/* Lagrange Interpolation Coefficients over Z_q (FR-1114)                     */
/* -------------------------------------------------------------------------- */

export function computeLagrangeCoefficient(participantId: number, selectedSignerIds: readonly number[]): bigint {
  assertPrecondition(
    selectedSignerIds.includes(participantId),
    `Participant ${participantId} must be in signing subset`,
  );

  let num = 1n;
  let den = 1n;
  const iBig = BigInt(participantId);

  for (const j of selectedSignerIds) {
    if (j === participantId) continue;
    const jBig = BigInt(j);
    num = modQ(num * jBig);
    den = modQ(den * (jBig - iBig));
  }

  const denInv = modInverse(den, SECP256K1_Q);
  return modQ(num * denInv);
}

/* -------------------------------------------------------------------------- */
/* Layer-0 FROST Threshold Signature Engine Class (RFC 9591)                  */
/* -------------------------------------------------------------------------- */

export class EosFrostThresholdSignatureCore {
  /**
   * Sets up a (t, n) Shamir polynomial key distribution (FR-1114).
   */
  public static setup(
    threshold: number,
    totalSigners: number,
    seed?: string,
  ): {
    groupKey: FrostGroupKey;
    keyShares: readonly FrostKeyShare[];
  } {
    assertPrecondition(threshold >= 2, "Threshold must be >= 2");
    assertPrecondition(totalSigners >= threshold, "Total signers must be >= threshold");

    // Master secret polynomial coefficients: f(x) = a0 + a1*x + ... + a_{t-1}*x^{t-1} mod q
    const coeffs: bigint[] = [];
    for (let d = 0; d < threshold; d++) {
      const entropy = seed ? pureSha256(`eos-frost-setup:${seed}:${d}`) : crypto.randomBytes(32).toString("hex");
      coeffs.push(modQ(BigInt(`0x${entropy}`) + 1n));
    }

    const groupSecret = coeffs[0];
    const groupPubPoint = pointMultiply(groupSecret, SECP256K1_G);
    assertPrecondition(groupPubPoint !== null, "Group public key cannot be at infinity");

    const keyShares: FrostKeyShare[] = [];
    const participantVerificationKeys: { participantId: number; publicKeyHex: string }[] = [];

    for (let id = 1; id <= totalSigners; id++) {
      let share = 0n;
      let xPower = 1n;
      const xBig = BigInt(id);

      for (let d = 0; d < threshold; d++) {
        share = modQ(share + coeffs[d] * xPower);
        xPower = modQ(xPower * xBig);
      }

      const verifPoint = pointMultiply(share, SECP256K1_G);
      assertPrecondition(verifPoint !== null, "Verification key cannot be at infinity");

      const verifHex = serializePoint(verifPoint);

      keyShares.push({
        participantId: id,
        secretShare: share,
        secretShareHex: share.toString(16).padStart(64, "0"),
        verificationKey: verifPoint,
        verificationKeyHex: verifHex,
      });

      participantVerificationKeys.push({
        participantId: id,
        publicKeyHex: verifHex,
      });
    }

    const groupKey: FrostGroupKey = {
      threshold,
      totalSigners,
      groupPublicKey: groupPubPoint,
      groupPublicKeyHex: serializePoint(groupPubPoint),
      participantVerificationKeys,
    };

    return deepFreeze({
      groupKey,
      keyShares,
    });
  }

  /**
   * Generates Round 1 hiding and binding nonces and commitments (FR-1115).
   */
  public static generateNonces(participantId: number, seed?: string): FrostNoncePair {
    const entropyD = seed ? pureSha256(`eos-frost-d:${seed}:${participantId}`) : crypto.randomBytes(32).toString("hex");
    const entropyE = seed ? pureSha256(`eos-frost-e:${seed}:${participantId}`) : crypto.randomBytes(32).toString("hex");

    const d = modQ(BigInt(`0x${entropyD}`) + 1n);
    const e = modQ(BigInt(`0x${entropyE}`) + 1n);

    const D = pointMultiply(d, SECP256K1_G);
    const E = pointMultiply(e, SECP256K1_G);
    assertPrecondition(D !== null && E !== null, "Commitments cannot be at infinity");

    return deepFreeze({
      participantId,
      hidingNonce: d,
      bindingNonce: e,
      hidingCommitment: D,
      bindingCommitment: E,
      hidingCommitmentHex: serializePoint(D),
      bindingCommitmentHex: serializePoint(E),
    });
  }

  /**
   * Computes anti-ROS binding factors rho_i for each active signer (FR-1115).
   */
  public static computeBindingFactors(
    message: string,
    commitments: readonly FrostCommitmentShare[],
  ): Map<number, bigint> {
    const commitmentStr = commitments
      .map((c) => `${c.participantId}:${c.hidingCommitmentHex}:${c.bindingCommitmentHex}`)
      .join("|");

    const bindingFactors = new Map<number, bigint>();
    for (const c of commitments) {
      const rhoDigest = pureSha256(`eos-frost-rho:${c.participantId}:${message}:${commitmentStr}`);
      const rho = modQ(BigInt(`0x${rhoDigest}`) + 1n);
      bindingFactors.set(c.participantId, rho);
    }

    return bindingFactors;
  }

  /**
   * Signs a partial share in Round 2 (FR-1117).
   */
  public static signShare(
    keyShare: FrostKeyShare,
    nonces: FrostNoncePair,
    groupCommitmentR: AffinePoint,
    groupPublicKey: AffinePoint,
    message: string,
    bindingFactorRho: bigint,
    lagrangeLambda: bigint,
  ): FrostSignatureShare {
    const cDigest = pureSha256(
      `eos-frost-challenge:${serializePoint(groupCommitmentR)}:${serializePoint(groupPublicKey)}:${message}`,
    );
    const c = modQ(BigInt(`0x${cDigest}`));

    // z_i = d_i + (e_i * rho_i) + (lambda_i * s_i * c) mod q
    const zPart1 = modQ(nonces.hidingNonce + nonces.bindingNonce * bindingFactorRho);
    const zPart2 = modQ(lagrangeLambda * keyShare.secretShare * c);
    const z_i = modQ(zPart1 + zPart2);

    return deepFreeze({
      participantId: keyShare.participantId,
      responseScalar: z_i,
      responseScalarHex: z_i.toString(16).padStart(64, "0"),
    });
  }

  /**
   * Coordinates the complete threshold signing protocol over active signers S (FR-1116, FR-1117).
   */
  public sign(
    groupKey: FrostGroupKey,
    selectedKeyShares: readonly FrostKeyShare[],
    message: string,
    sessionSeed?: string,
  ): FrostSigningResult {
    assertPrecondition(
      selectedKeyShares.length >= groupKey.threshold,
      `Active signers ${selectedKeyShares.length} must satisfy threshold >= ${groupKey.threshold}`,
    );

    const activeIds = selectedKeyShares.map((s) => s.participantId);

    // 1. Round 1: Nonces & commitments
    const noncesList: FrostNoncePair[] = [];
    const commitmentShares: FrostCommitmentShare[] = [];

    for (const share of selectedKeyShares) {
      const nonces = EosFrostThresholdSignatureCore.generateNonces(
        share.participantId,
        sessionSeed ? `${sessionSeed}:${share.participantId}` : undefined,
      );
      noncesList.push(nonces);
      commitmentShares.push({
        participantId: share.participantId,
        hidingCommitmentHex: nonces.hidingCommitmentHex,
        bindingCommitmentHex: nonces.bindingCommitmentHex,
      });
    }

    // 2. Binding factors rho_i
    const bindingFactors = EosFrostThresholdSignatureCore.computeBindingFactors(message, commitmentShares);

    // 3. Group commitment R = sum(D_i + rho_i * E_i)
    let groupR: SecpPoint = null;
    for (const nonces of noncesList) {
      const rho = bindingFactors.get(nonces.participantId)!;
      const rhoE = pointMultiply(rho, nonces.bindingCommitment);
      const combined = pointAdd(nonces.hidingCommitment, rhoE);
      groupR = pointAdd(groupR, combined);
    }

    assertPrecondition(groupR !== null, "Group commitment point R cannot be at infinity");

    // 4. Round 2: Partial signature shares
    const sigShares: FrostSignatureShare[] = [];
    for (let i = 0; i < selectedKeyShares.length; i++) {
      const share = selectedKeyShares[i];
      const nonces = noncesList[i];
      const rho = bindingFactors.get(share.participantId)!;
      const lambda = computeLagrangeCoefficient(share.participantId, activeIds);

      const sigShare = EosFrostThresholdSignatureCore.signShare(
        share,
        nonces,
        groupR,
        groupKey.groupPublicKey,
        message,
        rho,
        lambda,
      );
      sigShares.push(sigShare);
    }

    // 5. Aggregate responses into z = sum(z_i) mod q
    let z = 0n;
    for (const s of sigShares) {
      z = modQ(z + s.responseScalar);
    }

    const rHex = serializePoint(groupR);
    const zHex = z.toString(16).padStart(64, "0");

    const signature: FrostSignature = {
      rHex,
      zHex,
      rPoint: groupR,
      z,
    };

    const signatureHex = `${rHex}${zHex}`;
    const receipt = this._createReceipt("sign", signatureHex, message);

    return deepFreeze({
      signature,
      signatureHex,
      groupPublicKeyHex: groupKey.groupPublicKeyHex,
      message,
      receipt,
    });
  }

  /**
   * Verifies a standard Schnorr signature against group public key (FR-1118).
   * z * G == R + c * PK
   */
  public verify(groupPublicKey: AffinePoint, message: string, signature: FrostSignature): FrostVerificationResult {
    const startTime = performance.now();

    if (!isOnCurve(groupPublicKey) || !isOnCurve(signature.rPoint)) {
      const elapsedMs = performance.now() - startTime;
      return deepFreeze({
        valid: false,
        verificationTimeMs: elapsedMs,
        receipt: this._createReceipt("verify", "INVALID_POINT", "INVALID"),
      });
    }

    // Challenge c = H(R || PK || m)
    const cDigest = pureSha256(
      `eos-frost-challenge:${serializePoint(signature.rPoint)}:${serializePoint(groupPublicKey)}:${message}`,
    );
    const c = modQ(BigInt(`0x${cDigest}`));

    // LHS = z * G
    const lhs = pointMultiply(signature.z, SECP256K1_G);

    // RHS = R + c * PK
    const cPK = pointMultiply(c, groupPublicKey);
    const rhs = pointAdd(signature.rPoint, cPK);

    const valid = lhs !== null && rhs !== null && lhs.x === rhs.x && lhs.y === rhs.y;

    const elapsedMs = performance.now() - startTime;
    const receipt = this._createReceipt(
      "verify",
      `${serializePoint(signature.rPoint)}${signature.z.toString(16)}`,
      valid ? "SIGNATURE_VALID" : "SIGNATURE_REJECTED",
    );

    return deepFreeze({
      valid,
      verificationTimeMs: elapsedMs,
      receipt,
    });
  }

  private _createReceipt(operation: FrostOperationType, digest: string, tag?: string): FrostReceipt {
    const timestamp = new Date().toISOString();
    const receiptId = `eos-frost-${operation}-${pureSha256(`${digest}:${timestamp}`).slice(0, 16)}`;
    const outputTag = tag ?? digest;
    const receiptSha256 = pureSha256(`${receiptId}:${digest}:${outputTag}:${timestamp}`);
    return deepFreeze({
      receiptId,
      operation,
      timestamp,
      digest,
      receiptSha256,
    });
  }
}
