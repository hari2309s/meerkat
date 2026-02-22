import { describe, it, expect } from "vitest";
import {
  NAMESPACES,
  generateNamespaceKey,
  generateNamespaceKeySet,
  serializeNamespaceKeySet,
  deserializeNamespaceKeySet,
  importNamespaceKey,
  type Namespace,
  type NamespaceKeySet,
} from "../lib/namespace-key.js";
import { encryptBlob, decryptBlob } from "../lib/blob.js";

describe("NAMESPACES", () => {
  it("contains the four expected namespaces from the dev plan", () => {
    expect(NAMESPACES).toContain("sharedNotes");
    expect(NAMESPACES).toContain("voiceThread");
    expect(NAMESPACES).toContain("dropbox");
    expect(NAMESPACES).toContain("presence");
    expect(NAMESPACES).toHaveLength(4);
  });
});

describe("generateNamespaceKey", () => {
  it("returns 32 bytes", async () => {
    const key = await generateNamespaceKey();
    expect(key).toHaveLength(32);
  });

  it("returns different bytes on each call", async () => {
    const a = await generateNamespaceKey();
    const b = await generateNamespaceKey();
    expect(a).not.toEqual(b);
  });
});

describe("generateNamespaceKeySet", () => {
  it("generates all four namespaces by default", async () => {
    const ks = await generateNamespaceKeySet();
    for (const ns of NAMESPACES) {
      expect(ks[ns]).toHaveLength(32);
    }
  });

  it("generates only the requested namespaces", async () => {
    const ks = await generateNamespaceKeySet(["dropbox"]);
    expect(ks.dropbox).toHaveLength(32);
    expect(ks.sharedNotes).toBeUndefined();
    expect(ks.voiceThread).toBeUndefined();
    expect(ks.presence).toBeUndefined();
  });

  it("Letterbox preset — only dropbox key present", async () => {
    const letterboxNamespaces: Namespace[] = ["dropbox"];
    const ks = await generateNamespaceKeySet(letterboxNamespaces);
    expect(Object.keys(ks)).toEqual(["dropbox"]);
  });

  it("Peek preset — sharedNotes and presence only", async () => {
    const peekNamespaces: Namespace[] = ["sharedNotes", "presence"];
    const ks = await generateNamespaceKeySet(peekNamespaces);
    expect(ks.sharedNotes).toBeDefined();
    expect(ks.presence).toBeDefined();
    expect(ks.voiceThread).toBeUndefined();
    expect(ks.dropbox).toBeUndefined();
  });
});

describe("serializeNamespaceKeySet / deserializeNamespaceKeySet", () => {
  it("round-trips a full keyset", async () => {
    const ks = await generateNamespaceKeySet();
    const serialized = serializeNamespaceKeySet(ks);
    const restored = deserializeNamespaceKeySet(serialized);

    for (const ns of NAMESPACES) {
      expect(restored[ns]).toEqual(ks[ns]);
    }
  });

  it("round-trips a partial keyset (Letterbox)", async () => {
    const ks: NamespaceKeySet = {
      dropbox: await generateNamespaceKey(),
    };
    const serialized = serializeNamespaceKeySet(ks);
    const restored = deserializeNamespaceKeySet(serialized);

    expect(restored.dropbox).toEqual(ks.dropbox);
    expect(restored.sharedNotes).toBeUndefined();
    expect(restored.voiceThread).toBeUndefined();
    expect(restored.presence).toBeUndefined();
  });

  it("serialised values are base64url strings (no +/=)", async () => {
    const ks = await generateNamespaceKeySet();
    const serialized = serializeNamespaceKeySet(ks);
    for (const ns of NAMESPACES) {
      const val = serialized[ns];
      expect(val).toBeDefined();
      expect(val).not.toMatch(/[+/=]/);
    }
  });

  it("deserializeNamespaceKeySet ignores unknown namespaces gracefully", () => {
    const withExtra = {
      sharedNotes: "c29tZWtleWJ5dGVz",
      unknownNamespace: "aGVsbG8=",
    };
    // Should not throw — just ignores unknown keys
    const restored = deserializeNamespaceKeySet(
      withExtra as ReturnType<typeof serializeNamespaceKeySet>,
    );
    expect(restored.sharedNotes).toBeDefined();
  });
});

describe("importNamespaceKey", () => {
  it("imports a key that can be used for encrypt/decrypt", async () => {
    const raw = await generateNamespaceKey();
    const cryptoKey = await importNamespaceKey(raw);

    const data = new Uint8Array([10, 20, 30]);
    const blob = await encryptBlob(data, cryptoKey);
    const decrypted = await decryptBlob(blob, cryptoKey);
    expect(decrypted).toEqual(data);
  });

  it("imported key is non-extractable", async () => {
    const raw = await generateNamespaceKey();
    const cryptoKey = await importNamespaceKey(raw);
    expect(cryptoKey.extractable).toBe(false);
  });

  it("two imports of the same key can cross-decrypt", async () => {
    const raw = await generateNamespaceKey();
    const key1 = await importNamespaceKey(raw);
    const key2 = await importNamespaceKey(raw);

    const data = new Uint8Array([5, 6, 7]);
    const blob = await encryptBlob(data, key1);
    const decrypted = await decryptBlob(blob, key2);
    expect(decrypted).toEqual(data);
  });
});
