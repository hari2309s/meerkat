import { describe, it, expect } from "vitest";
import {
  deriveDeviceKey,
  randomSalt,
  generateAesKey,
  exportAesKey,
  importAesKey,
} from "../lib/device-key.js";

describe("randomSalt", () => {
  it("returns 16 bytes", () => {
    expect(randomSalt()).toHaveLength(16);
  });

  it("returns different values on each call", () => {
    expect(randomSalt()).not.toEqual(randomSalt());
  });
});

describe("deriveDeviceKey", () => {
  it("returns a CryptoKey and the same salt", async () => {
    const salt = randomSalt();
    const { key, salt: returnedSalt } = await deriveDeviceKey(
      "test-passphrase",
      salt,
    );
    expect(key).toBeInstanceOf(CryptoKey);
    expect(returnedSalt).toEqual(salt);
  });

  it("produces the same key from the same passphrase + salt (deterministic)", async () => {
    const salt = randomSalt();
    const { key: key1 } = await deriveDeviceKey("same-passphrase", salt);
    const { key: key2 } = await deriveDeviceKey("same-passphrase", salt);

    // Keys are non-extractable so we verify equality by encrypting with one
    // and decrypting with the other.
    const iv = new Uint8Array(12);
    const data = new TextEncoder().encode("determinism check");

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key1,
      data,
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key2,
      encrypted,
    );

    expect(new Uint8Array(decrypted)).toEqual(data);
  });

  it("produces a different key from a different passphrase", async () => {
    const salt = randomSalt();
    const { key: key1 } = await deriveDeviceKey("passphrase-A", salt);
    const { key: key2 } = await deriveDeviceKey("passphrase-B", salt);

    const iv = new Uint8Array(12);
    const data = new TextEncoder().encode("different keys test");

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key1,
      data,
    );

    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, key2, encrypted),
    ).rejects.toThrow();
  });

  it("produces a different key from a different salt", async () => {
    const { key: key1 } = await deriveDeviceKey("passphrase", randomSalt());
    const { key: key2 } = await deriveDeviceKey("passphrase", randomSalt());

    const iv = new Uint8Array(12);
    const data = new TextEncoder().encode("salt matters");
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key1,
      data,
    );

    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv }, key2, encrypted),
    ).rejects.toThrow();
  });

  it("throws if salt is fewer than 16 bytes", async () => {
    const shortSalt = new Uint8Array(8);
    await expect(deriveDeviceKey("passphrase", shortSalt)).rejects.toThrow(
      "salt must be ≥16 bytes",
    );
  });

  it("derived key is non-extractable", async () => {
    const { key } = await deriveDeviceKey("test", randomSalt());
    expect(key.extractable).toBe(false);
  });
});

describe("generateAesKey / exportAesKey / importAesKey", () => {
  it("generates an extractable 256-bit AES-GCM key", async () => {
    const key = await generateAesKey();
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(true);
  });

  it("exportAesKey returns 32 bytes", async () => {
    const key = await generateAesKey();
    const raw = await exportAesKey(key);
    expect(raw).toHaveLength(32);
  });

  it("round-trips through export and import", async () => {
    const original = await generateAesKey();
    const raw = await exportAesKey(original);
    const reimported = await importAesKey(raw);

    const iv = new Uint8Array(12);
    const data = new TextEncoder().encode("round-trip");
    const enc = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      original,
      data,
    );
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      reimported,
      enc,
    );
    expect(new Uint8Array(dec)).toEqual(data);
  });

  it("importAesKey defaults to non-extractable", async () => {
    const raw = await exportAesKey(await generateAesKey());
    const key = await importAesKey(raw);
    expect(key.extractable).toBe(false);
  });

  it("importAesKey can be made extractable", async () => {
    const raw = await exportAesKey(await generateAesKey());
    const key = await importAesKey(raw, true);
    expect(key.extractable).toBe(true);
  });

  it("importAesKey throws on wrong key length", async () => {
    await expect(importAesKey(new Uint8Array(16))).rejects.toThrow(
      "expected 32 bytes",
    );
  });
});
