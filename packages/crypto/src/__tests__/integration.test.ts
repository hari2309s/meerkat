// ─── Integration tests ───────────────────────────────────────────────────────
//
// These tests exercise realistic end-to-end flows as described in the
// Meerkat development plan, combining multiple functions across modules.

import { describe, it, expect } from "vitest";
import { deriveDeviceKey, randomSalt } from "../lib/device-key.js";
import { encryptBlob, decryptBlob } from "../lib/blob.js";
import {
  generateNamespaceKey,
  generateNamespaceKeySet,
  serializeNamespaceKeySet,
  deserializeNamespaceKeySet,
  importNamespaceKey,
} from "../lib/namespace-key.js";
import {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  encryptBundle,
  decryptBundle,
} from "../lib/bundle.js";
import { toBase64, fromBase64 } from "../lib/encoding.js";

// ─── Scenario 1: private.ydoc at-rest encryption ─────────────────────────────
//
// First launch → derive key → encrypt Yjs bytes → persist
// Subsequent launch → re-derive key from same passphrase+salt → decrypt

describe("Scenario: private.ydoc at-rest encryption", () => {
  it("encrypts and decrypts simulated Yjs document bytes across two sessions", async () => {
    // Simulate a Yjs doc as raw bytes
    const yjsDocBytes = new Uint8Array([
      0x00, 0x01, 0x02, 0xde, 0xad, 0xbe, 0xef,
    ]);

    // Session 1 — first launch
    const passphrase = "hmac(supabase_jwt, device_id)"; // how the app builds this
    const salt = randomSalt();
    const { key: key1 } = await deriveDeviceKey(passphrase, salt);
    const encrypted = await encryptBlob(yjsDocBytes, key1);
    const persistedBlob = JSON.stringify(encrypted);
    const persistedSalt = toBase64(salt);

    // Session 2 — subsequent launch (re-derive from same passphrase + persisted salt)
    const restoredSalt = fromBase64(persistedSalt);
    const { key: key2 } = await deriveDeviceKey(passphrase, restoredSalt);
    const restoredBlob = JSON.parse(persistedBlob);
    const decrypted = await decryptBlob(restoredBlob, key2);

    expect(decrypted).toEqual(yjsDocBytes);
  });
});

// ─── Scenario 2: voice blob encryption before Supabase Storage upload ─────────
//
// Record audio → encrypt with namespace key → upload ciphertext
// Retrieve from Storage → decrypt with namespace key → play audio

describe("Scenario: voice blob encryption for Supabase Storage", () => {
  it("encrypts audio bytes before upload and decrypts after download", async () => {
    // Simulate audio blob bytes (WebM audio)
    const audioBytes = new Uint8Array(1024);
    crypto.getRandomValues(audioBytes);

    // The voiceThread namespace key is stored in private.ydoc settings
    const rawNamespaceKey = await generateNamespaceKey();

    // Before upload: encrypt
    const cryptoKey = await importNamespaceKey(rawNamespaceKey);
    const encryptedAudio = await encryptBlob(audioBytes, cryptoKey);
    // ↑ This is what gets uploaded to Supabase Storage

    // After download: decrypt
    // const downloadedBytes = new Uint8Array(
    //   Object.values(encryptedAudio).join("").length,
    // ); // simulating download
    // Actually re-import the key (simulating a fresh session with the stored key)
    const cryptoKey2 = await importNamespaceKey(rawNamespaceKey);
    const decryptedAudio = await decryptBlob(encryptedAudio, cryptoKey2);

    expect(decryptedAudio).toEqual(audioBytes);
  });
});

// ─── Scenario 3: flower pot full lifecycle ────────────────────────────────────
//
// Host creates a DenKey → encrypts with visitor's public key → deposits on server
// Visitor picks up from server → decrypts with own secret key → holds DenKey

describe("Scenario: flower pot full lifecycle", () => {
  it("host seals a Come Over DenKey and visitor redeems it", async () => {
    // ── Setup: visitor generates their identity keypair ──
    const visitorKp = generateKeyPair();
    // Visitor's public key is registered on their profile / shared via invite
    const visitorPublicKey = visitorKp.publicKey;

    // ── Host: generate all namespace keys for the den ──
    const allNamespaceKeys = await generateNamespaceKeySet();
    const serializedKeys = serializeNamespaceKeySet(allNamespaceKeys);

    // ── Host: build a Come Over DenKey (sharedNotes + voiceThread + presence) ──
    const denKey = {
      denId: "den-xyz-789",
      keyType: "come-over",
      scope: {
        namespaces: ["sharedNotes", "voiceThread", "presence"],
        read: true,
        write: true,
        offline: false,
      },
      expiresAt: null, // open-ended
      namespaceKeys: {
        sharedNotes: serializedKeys.sharedNotes,
        voiceThread: serializedKeys.voiceThread,
        presence: serializedKeys.presence,
      },
    };

    // ── Host: seal the bundle with visitor's public key ──
    const bundle = encryptBundle(denKey, visitorPublicKey);
    // ↑ This gets deposited on the server as the flower pot

    // ── Visitor: redeem from server ──
    const recovered = decryptBundle<typeof denKey>(bundle, visitorKp.secretKey);

    // Verify the key contents survived the round-trip
    expect(recovered.denId).toBe("den-xyz-789");
    expect(recovered.keyType).toBe("come-over");
    expect(recovered.scope.namespaces).toContain("sharedNotes");
    expect(recovered.scope.namespaces).toContain("voiceThread");
    expect(recovered.scope.namespaces).not.toContain("dropbox");
    expect(recovered.scope.offline).toBe(false);

    // Visitor can now use the namespace keys to encrypt/decrypt shared content
    const recoveredKeys = deserializeNamespaceKeySet(
      recovered.namespaceKeys as ReturnType<typeof serializeNamespaceKeySet>,
    );
    const sharedNotesCryptoKey = await importNamespaceKey(
      recoveredKeys.sharedNotes!,
    );
    const testNote = new TextEncoder().encode("my shared note content");
    const encryptedNote = await encryptBlob(testNote, sharedNotesCryptoKey);

    // Host can also decrypt (they have the same raw key)
    const hostCryptoKey = await importNamespaceKey(
      allNamespaceKeys.sharedNotes!,
    );
    const decryptedNote = await decryptBlob(encryptedNote, hostCryptoKey);
    expect(decryptedNote).toEqual(testNote);
  });

  it("host seals a Letterbox DenKey — only dropbox key included", async () => {
    const visitorKp = generateKeyPair();
    const allKeys = await generateNamespaceKeySet();
    const serializedKeys = serializeNamespaceKeySet(allKeys);

    const letterboxKey = {
      denId: "den-xyz-789",
      keyType: "letterbox",
      scope: {
        namespaces: ["dropbox"],
        read: false,
        write: true,
        offline: true,
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      namespaceKeys: {
        dropbox: serializedKeys.dropbox,
        // no sharedNotes, no voiceThread, no presence
      },
    };

    const bundle = encryptBundle(letterboxKey, visitorKp.publicKey);
    const recovered = decryptBundle<typeof letterboxKey>(
      bundle,
      visitorKp.secretKey,
    );

    expect(recovered.scope.namespaces).toEqual(["dropbox"]);
    expect(recovered.scope.offline).toBe(true);
    expect(recovered.namespaceKeys.dropbox).toBeDefined();
    // Verify no access to other namespaces
    expect(
      (recovered.namespaceKeys as Record<string, unknown>).sharedNotes,
    ).toBeUndefined();
  });
});

// ─── Scenario 4: keypair serialisation for cross-session persistence ──────────

describe("Scenario: keypair persistence across sessions", () => {
  it("serialises and restores a keypair correctly, still able to decrypt", () => {
    const kp = generateKeyPair();
    const serialized = serializeKeyPair(kp);

    // Persist to localStorage-equivalent (JSON string)
    const stored = JSON.stringify(serialized);

    // Restore
    const parsed = JSON.parse(stored);
    const restored = deserializeKeyPair(parsed);

    // Should still decrypt a bundle sealed with the original public key
    const bundle = encryptBundle({ test: true }, kp.publicKey);
    const result = decryptBundle<{ test: boolean }>(bundle, restored.secretKey);
    expect(result.test).toBe(true);
  });
});

// ─── Scenario 5: wrong-key isolation between namespaces ──────────────────────
//
// A Letterbox visitor (dropbox key only) must NOT be able to decrypt
// content encrypted with the sharedNotes namespace key.

describe("Scenario: namespace key isolation", () => {
  it("a visitor with only the dropbox key cannot decrypt sharedNotes content", async () => {
    const allKeys = await generateNamespaceKeySet();

    // Host encrypts a shared note with the sharedNotes namespace key
    const sharedNoteKey = await importNamespaceKey(allKeys.sharedNotes!);
    const secretNote = new TextEncoder().encode("super private note");
    const encryptedNote = await encryptBlob(secretNote, sharedNoteKey);

    // Letterbox visitor only has the dropbox key
    const dropboxKey = await importNamespaceKey(allKeys.dropbox!);

    // Attempting to decrypt sharedNotes content with dropbox key must fail
    await expect(decryptBlob(encryptedNote, dropboxKey)).rejects.toThrow();
  });
});
