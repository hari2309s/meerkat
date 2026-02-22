import { describe, it, expect } from "vitest";
import { generateAesKey } from "../lib/device-key.js";
import {
  encryptBlob,
  decryptBlob,
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
} from "../lib/blob.js";
import type { EncryptedBlob } from "../types.js";

// Helper — fresh key for each test
async function freshKey(): Promise<CryptoKey> {
  return generateAesKey();
}

describe("encryptBlob / decryptBlob", () => {
  it("round-trips arbitrary binary data", async () => {
    const key = await freshKey();
    const plaintext = new Uint8Array([0, 1, 2, 3, 255, 128, 64]);
    const blob = await encryptBlob(plaintext, key);
    const result = await decryptBlob(blob, key);
    expect(result).toEqual(plaintext);
  });

  it("round-trips empty bytes", async () => {
    const key = await freshKey();
    const empty = new Uint8Array(0);
    const blob = await encryptBlob(empty, key);
    expect(await decryptBlob(blob, key)).toEqual(empty);
  });

  it("round-trips large data (1 MB)", async () => {
    const key = await freshKey();
    const large = new Uint8Array(1024 * 1024);
    // getRandomValues has a 64KB limit per call in some environments
    const CHUNK_SIZE = 64 * 1024;
    for (let i = 0; i < large.length; i += CHUNK_SIZE) {
      crypto.getRandomValues(large.subarray(i, i + CHUNK_SIZE));
    }

    const blob = await encryptBlob(large, key);
    expect(await decryptBlob(blob, key)).toEqual(large);
  });

  it("produces different ciphertexts for the same plaintext (fresh IV each time)", async () => {
    const key = await freshKey();
    const data = new Uint8Array([1, 2, 3, 4]);
    const blob1 = await encryptBlob(data, key);
    const blob2 = await encryptBlob(data, key);
    // IVs must differ
    expect(blob1.iv).not.toBe(blob2.iv);
    // Ciphertexts must differ
    expect(blob1.data).not.toBe(blob2.data);
  });

  it("blob has the correct algorithm tag", async () => {
    const key = await freshKey();
    const blob = await encryptBlob(new Uint8Array([1]), key);
    expect(blob.alg).toBe("AES-GCM-256");
  });

  it("throws when decrypting with the wrong key", async () => {
    const key1 = await freshKey();
    const key2 = await freshKey();
    const blob = await encryptBlob(new Uint8Array([1, 2, 3]), key1);
    await expect(decryptBlob(blob, key2)).rejects.toThrow();
  });

  it("throws when ciphertext is tampered", async () => {
    const key = await freshKey();
    const blob = await encryptBlob(new Uint8Array([1, 2, 3]), key);

    // Flip the last byte of the base64-encoded ciphertext
    const corrupted: EncryptedBlob = {
      ...blob,
      data: blob.data.slice(0, -2) + (blob.data.endsWith("A") ? "B" : "A"),
    };
    await expect(decryptBlob(corrupted, key)).rejects.toThrow();
  });

  it("throws on unrecognised algorithm tag", async () => {
    const key = await freshKey();
    const bad = {
      alg: "AES-CBC-256",
      iv: "aaa",
      data: "bbb",
    } as unknown as EncryptedBlob;
    await expect(decryptBlob(bad, key)).rejects.toThrow(
      'unsupported algorithm "AES-CBC-256"',
    );
  });
});

describe("encryptString / decryptString", () => {
  it("round-trips a plain ASCII string", async () => {
    const key = await freshKey();
    const text = "hello from meerkat";
    expect(await decryptString(await encryptString(text, key), key)).toBe(text);
  });

  it("round-trips Unicode and emoji", async () => {
    const key = await freshKey();
    const text = "🦦 your den, your rules 🔑";
    expect(await decryptString(await encryptString(text, key), key)).toBe(text);
  });

  it("round-trips an empty string", async () => {
    const key = await freshKey();
    expect(await decryptString(await encryptString("", key), key)).toBe("");
  });
});

describe("encryptJson / decryptJson", () => {
  it("round-trips a plain object", async () => {
    const key = await freshKey();
    const obj = {
      denId: "den-123",
      scope: { namespaces: ["dropbox"] },
      offline: true,
    };
    expect(await decryptJson(await encryptJson(obj, key), key)).toEqual(obj);
  });

  it("round-trips an array", async () => {
    const key = await freshKey();
    const arr = [1, "two", { three: 3 }];
    expect(await decryptJson(await encryptJson(arr, key), key)).toEqual(arr);
  });

  it("round-trips null", async () => {
    const key = await freshKey();
    expect(await decryptJson(await encryptJson(null, key), key)).toBeNull();
  });

  it("round-trips a number", async () => {
    const key = await freshKey();
    expect(await decryptJson(await encryptJson(42, key), key)).toBe(42);
  });
});
