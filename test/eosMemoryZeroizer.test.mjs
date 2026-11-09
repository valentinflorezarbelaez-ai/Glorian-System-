import test from "node:test";
import assert from "node:assert/strict";

import { secureZeroizeBuffer, EosZeroizableSecret, EosSealedMemoryVault } from "../src/core/eosMemoryZeroizer.ts";

test("BDD-253: Sobreescritura criptográfica determinista de buffers de memoria en RAM (SPEC-089)", () => {
  const secretContent = "TOP_SECRET_TREASURY_QUANTUM_KEY_2026";
  const buffer = Buffer.from(secretContent, "utf8");
  const originalBytes = Buffer.from(buffer);

  assert.equal(buffer.toString("utf8"), secretContent);

  // Execute multi-pass cryptographic zeroization
  secureZeroizeBuffer(buffer);

  // Assert memory is 100% zeroed out
  assert.notEqual(buffer.toString("utf8"), secretContent);
  assert.equal(
    buffer.every((byte) => byte === 0x00),
    true,
  );

  // Check no residue of original bytes
  let matchCount = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === originalBytes[i]) {
      matchCount++;
    }
  }
  assert.equal(matchCount, 0, "Zeroized buffer must retain 0 matching bytes with original secret");
});

test("BDD-254: Garantía de ceroización automática en contenedores de secreto con ciclo de vida (SPEC-089)", () => {
  const rawKey = "STRIPE_TREASURY_ROOT_SEED_HEX_0x99AABB";
  const secret = new EosZeroizableSecret(rawKey);

  assert.equal(secret.isDisposed(), false);
  assert.equal(secret.getByteLength(), Buffer.from(rawKey).length);

  // Use within scoped block
  const derivedHash = secret.use((buf) => {
    return buf.toString("hex").slice(0, 16);
  });
  assert.ok(derivedHash.length === 16);

  // Dispose secret
  secret.dispose();
  assert.equal(secret.isDisposed(), true);

  // Post-disposal access must throw fail-closed
  assert.throws(() => secret.use((buf) => buf.toString("utf8")), /SECRET_ALREADY_ZEROIZED/);

  // Test Vault container
  const vault = new EosSealedMemoryVault();
  vault.storeSecret("master-db-salt", "SUPREME_GNOSIS_SALT_72");

  const saltPreview = vault.accessSecret("master-db-salt", (buf) => buf.toString("utf8").slice(0, 7));
  assert.equal(saltPreview, "SUPREME");

  // Purge specific key
  const purged = vault.purgeSecret("master-db-salt");
  assert.equal(purged, true);

  assert.throws(() => vault.accessSecret("master-db-salt", (buf) => buf.toString("utf8")), /VAULT_KEY_NOT_FOUND/);

  // Purge non-existent key returns false
  assert.equal(vault.purgeSecret("ghost-key"), false);

  // Buffer constructor & useTemporary
  const bufSecret = new EosZeroizableSecret(Buffer.from("buffer-secret-data"));
  assert.equal(bufSecret.getByteLength(), 18);
  bufSecret.dispose();

  const tempVal = EosZeroizableSecret.useTemporary("ephemeral-pass", (b) => b.toString("utf8"));
  assert.equal(tempVal, "ephemeral-pass");

  // Overwriting secret key and purgeAll
  vault.storeSecret("k1", "first-val");
  vault.storeSecret("k1", "second-val"); // disposes first-val
  vault.storeSecret("k2", "other-val");
  assert.equal(
    vault.accessSecret("k1", (b) => b.toString("utf8")),
    "second-val",
  );

  const purgedCount = vault.purgeAll();
  assert.equal(purgedCount, 2);
  assert.throws(() => vault.accessSecret("k1", (b) => b.toString("utf8")), /VAULT_KEY_NOT_FOUND/);
});
