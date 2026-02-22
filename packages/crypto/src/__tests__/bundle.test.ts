import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  encryptBundle,
  decryptBundle,
} from "../lib/bundle.js";
import type { EncryptedBundle } from "../types.js";

// A realistic DenKey shape for testing — matches what @meerkat/keys will produce
interface MockDenKey {
  denId: string;
  scope: {
    namespaces: string[];
    read: boolean;
    write: boolean;
    offline: boolean;
  };
  expiresAt: string | null;
  namespaceKeys: Record<string, string>;
}

const mockDenKey: MockDenKey = {
  denId: "den-abc-123",
  scope: {
    namespaces: ["sharedNotes", "voiceThread"],
    read: true,
    write: true,
    offline: false,
  },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  namespaceKeys: {
    sharedNotes: "c2hhcmVkTm90ZXNLZXlCeXRlcw",
    voiceThread: "dm9pY2VUaHJlYWRLZXlCeXRlcw",
  },
};

describe("generateKeyPair", () => {
  it("returns 32-byte publicKey and secretKey", () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toHaveLength(32);
    expect(kp.secretKey).toHaveLength(32);
  });

  it("generates different keypairs on each call", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
    expect(kp1.secretKey).not.toEqual(kp2.secretKey);
  });
});

describe("serializeKeyPair / deserializeKeyPair", () => {
  it("round-trips a keypair through base64url serialisation", () => {
    const kp = generateKeyPair();
    const serialized = serializeKeyPair(kp);
    const restored = deserializeKeyPair(serialized);
    expect(restored.publicKey).toEqual(kp.publicKey);
    expect(restored.secretKey).toEqual(kp.secretKey);
  });

  it("serialised values are base64url strings (no +/=)", () => {
    const { publicKey, secretKey } = serializeKeyPair(generateKeyPair());
    expect(publicKey).not.toMatch(/[+/=]/);
    expect(secretKey).not.toMatch(/[+/=]/);
  });

  it("serialised public key is 43 characters (32 bytes in base64url, no padding)", () => {
    // 32 bytes → ceil(32 * 4/3) = 43 chars (no padding)
    const { publicKey } = serializeKeyPair(generateKeyPair());
    expect(publicKey).toHaveLength(43);
  });
});

describe("encryptBundle / decryptBundle", () => {
  it("round-trips a DenKey object", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle(mockDenKey, kp.publicKey);
    const result = decryptBundle<MockDenKey>(bundle, kp.secretKey);
    expect(result).toEqual(mockDenKey);
  });

  it("round-trips a plain string", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle("hello world", kp.publicKey);
    expect(decryptBundle<string>(bundle, kp.secretKey)).toBe("hello world");
  });

  it("round-trips null", () => {
    const kp = generateKeyPair();
    expect(
      decryptBundle(encryptBundle(null, kp.publicKey), kp.secretKey),
    ).toBeNull();
  });

  it("round-trips a nested object", () => {
    const kp = generateKeyPair();
    const nested = { a: { b: { c: [1, 2, 3] } } };
    expect(
      decryptBundle(encryptBundle(nested, kp.publicKey), kp.secretKey),
    ).toEqual(nested);
  });

  it("produces a different ciphertext every call (fresh ephemeral key + nonce)", () => {
    const kp = generateKeyPair();
    const b1 = encryptBundle(mockDenKey, kp.publicKey);
    const b2 = encryptBundle(mockDenKey, kp.publicKey);
    expect(b1.ciphertext).not.toBe(b2.ciphertext);
    expect(b1.nonce).not.toBe(b2.nonce);
    expect(b1.ephemeralPublicKey).not.toBe(b2.ephemeralPublicKey);
  });

  it("bundle has the correct algorithm tag", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle({}, kp.publicKey);
    expect(bundle.alg).toBe("NACL-BOX");
  });

  it("throws when decrypting with the wrong secret key", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const bundle = encryptBundle(mockDenKey, kp1.publicKey);
    expect(() => decryptBundle(bundle, kp2.secretKey)).toThrow(
      "decryption failed",
    );
  });

  it("throws when ciphertext is tampered", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle(mockDenKey, kp.publicKey);
    const tampered: EncryptedBundle = {
      ...bundle,
      ciphertext:
        bundle.ciphertext.slice(0, -2) +
        (bundle.ciphertext.endsWith("A") ? "B" : "A"),
    };
    expect(() => decryptBundle(tampered, kp.secretKey)).toThrow(
      "decryption failed",
    );
  });

  it("throws when nonce is tampered", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle(mockDenKey, kp.publicKey);
    const tampered: EncryptedBundle = {
      ...bundle,
      // Change a character in the middle of the base64 string to ensure the length
      // remains the same (avoiding 'bad nonce size') but the bytes are different.
      nonce: bundle.nonce.substring(0, 10) + "X" + bundle.nonce.substring(11),
    };
    expect(() => decryptBundle(tampered, kp.secretKey)).toThrow(
      "decryption failed",
    );

  });

  it("throws on unrecognised algorithm tag", () => {
    const kp = generateKeyPair();
    const bad = {
      alg: "RSA-OAEP",
      ephemeralPublicKey: "",
      nonce: "",
      ciphertext: "",
    } as unknown as EncryptedBundle;
    expect(() => decryptBundle(bad, kp.secretKey)).toThrow(
      'unsupported algorithm "RSA-OAEP"',
    );
  });

  it("throws when publicKey is not 32 bytes", () => {
    const shortKey = new Uint8Array(16);
    expect(() => encryptBundle({}, shortKey)).toThrow(
      "publicKey must be 32 bytes",
    );
  });

  it("throws when secretKey is not 32 bytes", () => {
    const kp = generateKeyPair();
    const bundle = encryptBundle({}, kp.publicKey);
    expect(() => decryptBundle(bundle, new Uint8Array(16))).toThrow(
      "secretKey must be 32 bytes",
    );
  });

  it("host encrypts for visitor — visitor decrypts correctly (real scenario)", () => {
    // Visitor generates their identity keypair
    const visitorKp = generateKeyPair();
    // Host stores visitor's public key (from the visitor's profile or invite flow)
    const hostSideBundle = encryptBundle(mockDenKey, visitorKp.publicKey);
    // Visitor receives the bundle from the server and decrypts with their secret key
    const recovered = decryptBundle<MockDenKey>(
      hostSideBundle,
      visitorKp.secretKey,
    );
    expect(recovered.denId).toBe("den-abc-123");
    expect(recovered.scope.namespaces).toContain("sharedNotes");
  });
});
