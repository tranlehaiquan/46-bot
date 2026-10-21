import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKey,
  encryptSetting,
  decryptSetting,
  isEncryptedSetting,
  ENCRYPTION_PREFIX,
} from "./encryption.js";

describe("crypto/encryption", () => {
  const secret = "super-secret-admin-password-123!";
  const samplePlaintext = "AIzaSyD-sample-google-api-key-test-value";

  it("derives deterministic 32-byte key from secret", () => {
    const key1 = deriveKey(secret);
    const key2 = deriveKey(secret);
    assert.equal(key1.length, 32);
    assert.deepEqual(key1, key2);

    const otherKey = deriveKey("different-password");
    assert.notDeepEqual(key1, otherKey);
  });

  it("throws when deriving key with empty secret", () => {
    assert.throws(() => deriveKey(""), /Cannot derive key from empty secret/);
  });

  it("encrypts and decrypts string correctly", () => {
    const encrypted = encryptSetting(samplePlaintext, secret);
    assert.ok(encrypted.startsWith(ENCRYPTION_PREFIX));
    assert.ok(isEncryptedSetting(encrypted));
    assert.notEqual(encrypted, samplePlaintext);

    const decrypted = decryptSetting(encrypted, secret);
    assert.equal(decrypted, samplePlaintext);
  });

  it("produces distinct ciphertexts for same plaintext due to random IV", () => {
    const enc1 = encryptSetting(samplePlaintext, secret);
    const enc2 = encryptSetting(samplePlaintext, secret);
    assert.notEqual(enc1, enc2);
    assert.equal(decryptSetting(enc1, secret), samplePlaintext);
    assert.equal(decryptSetting(enc2, secret), samplePlaintext);
  });

  it("returns unencrypted plaintext as-is for backward compatibility", () => {
    const legacyKey = "legacy-plaintext-api-key-not-encrypted";
    assert.equal(isEncryptedSetting(legacyKey), false);
    assert.equal(decryptSetting(legacyKey, secret), legacyKey);
  });

  it("handles empty plaintext gracefully", () => {
    assert.equal(encryptSetting("", secret), "");
    assert.equal(decryptSetting("", secret), "");
  });

  it("fails to decrypt with wrong secret", () => {
    const encrypted = encryptSetting(samplePlaintext, secret);
    assert.throws(() => {
      decryptSetting(encrypted, "wrong-password");
    }, /Failed to decrypt setting/);
  });

  it("fails to decrypt tampered ciphertext or auth tag", () => {
    const encrypted = encryptSetting(samplePlaintext, secret);
    const parts = encrypted.slice(ENCRYPTION_PREFIX.length).split(":");
    // Tamper with ciphertext
    const tampered = `${ENCRYPTION_PREFIX}${parts[0]}:${parts[1]}:${parts[2]}tampered`;
    assert.throws(() => {
      decryptSetting(tampered, secret);
    }, /Failed to decrypt setting/);
  });

  it("throws on invalid formatted encrypted payload", () => {
    assert.throws(() => {
      decryptSetting(`${ENCRYPTION_PREFIX}onlyonepart`, secret);
    }, /Invalid encrypted setting format/);
  });
});
