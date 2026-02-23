// ─── keys.test.ts ────────────────────────────────────────────────────────────
//
// Tests for the full DenKey / flower pot lifecycle.
//
// Strategy:
//   • generateKey: pure function — test all presets and custom scope
//   • depositKey / revokeKey / redeemKey: mock @meerkat/crypto's bundle
//     functions and test that the pipeline wires correctly
//   • validateKey: exhaustive edge-case coverage
//   • Integration: end-to-end roundtrip using real crypto (tweetnacl)

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateKey, validateKey } from "../lib/keys";
import { KEY_PRESETS } from "../lib/presets";
import type { DenKey } from "../types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_DEN_ID = "user-abc-123";

// A minimal serialized namespace key set (base64url strings)
const MOCK_NAMESPACE_KEYS = {
  sharedNotes: "c2hhcmVkTm90ZXNLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBd",
  voiceThread: "dm9pY2VUaHJlYWRLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ",
  dropbox: "ZHJvcGJveEtleUJ5dGVzQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ",
  presence: "cHJlc2VuY2VLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ",
};

// ─── generateKey ─────────────────────────────────────────────────────────────

describe("generateKey", () => {
  it("generates a come-over key with correct scope", () => {
    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.keyType).toBe("come-over");
    expect(key.denId).toBe(MOCK_DEN_ID);
    expect(key.label).toBe("Come Over");
    expect(key.scope.namespaces).toContain("sharedNotes");
    expect(key.scope.namespaces).toContain("voiceThread");
    expect(key.scope.namespaces).toContain("presence");
    expect(key.scope.namespaces).not.toContain("dropbox");
    expect(key.scope.read).toBe(true);
    expect(key.scope.write).toBe(true);
    expect(key.scope.offline).toBe(false);
  });

  it("generates a letterbox key with correct scope", () => {
    const key = generateKey({
      keyType: "letterbox",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.scope.namespaces).toEqual(["dropbox"]);
    expect(key.scope.read).toBe(false);
    expect(key.scope.write).toBe(true);
    expect(key.scope.offline).toBe(true);
    expect(key.namespaceKeys.dropbox).toBeDefined();
    expect(key.namespaceKeys.sharedNotes).toBeUndefined();
    expect(key.namespaceKeys.voiceThread).toBeUndefined();
    expect(key.namespaceKeys.presence).toBeUndefined();
  });

  it("generates a house-sit key with all four namespaces", () => {
    const key = generateKey({
      keyType: "house-sit",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.scope.namespaces).toHaveLength(4);
    expect(key.scope.offline).toBe(true);
    expect(key.namespaceKeys.sharedNotes).toBeDefined();
    expect(key.namespaceKeys.voiceThread).toBeDefined();
    expect(key.namespaceKeys.dropbox).toBeDefined();
    expect(key.namespaceKeys.presence).toBeDefined();
  });

  it("generates a peek key that is read-only", () => {
    const key = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.scope.read).toBe(true);
    expect(key.scope.write).toBe(false);
    expect(key.scope.offline).toBe(false);
    expect(key.scope.namespaces).toContain("sharedNotes");
    expect(key.scope.namespaces).toContain("presence");
    expect(key.scope.namespaces).not.toContain("dropbox");
    expect(key.scope.namespaces).not.toContain("voiceThread");
  });

  it("generates a custom key with caller-provided scope", () => {
    const key = generateKey({
      keyType: "custom",
      denId: MOCK_DEN_ID,
      label: "For Alice — voice only",
      scope: {
        namespaces: ["voiceThread", "presence"],
        read: true,
        write: false,
        offline: false,
      },
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.keyType).toBe("custom");
    expect(key.label).toBe("For Alice — voice only");
    expect(key.scope.namespaces).toEqual(["voiceThread", "presence"]);
    expect(key.namespaceKeys.voiceThread).toBeDefined();
    expect(key.namespaceKeys.presence).toBeDefined();
    expect(key.namespaceKeys.dropbox).toBeUndefined();
    expect(key.namespaceKeys.sharedNotes).toBeUndefined();
  });

  it("scopes namespace keys to only the granted namespaces", () => {
    const key = generateKey({
      keyType: "letterbox",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    // Letterbox only grants dropbox — other keys must be absent
    expect(Object.keys(key.namespaceKeys)).toEqual(["dropbox"]);
  });

  it("assigns a unique keyId on each call", () => {
    const k1 = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });
    const k2 = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(k1.keyId).not.toBe(k2.keyId);
  });

  it("sets expiresAt when durationMs is provided", () => {
    const before = Date.now();
    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
      durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    const after = Date.now();

    expect(key.expiresAt).not.toBeNull();
    const expiry = new Date(key.expiresAt!).getTime();
    expect(expiry).toBeGreaterThan(before + 7 * 24 * 60 * 60 * 1000 - 100);
    expect(expiry).toBeLessThan(after + 7 * 24 * 60 * 60 * 1000 + 100);
  });

  it("sets expiresAt to null when no durationMs is provided", () => {
    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.expiresAt).toBeNull();
  });

  it("allows overriding the label for a preset key", () => {
    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      label: "For Mia",
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.label).toBe("For Mia");
  });

  it("records issuedAt as a valid ISO-8601 timestamp", () => {
    const key = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(() => new Date(key.issuedAt)).not.toThrow();
    expect(new Date(key.issuedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ─── validateKey ─────────────────────────────────────────────────────────────

describe("validateKey", () => {
  function makeValidKey(overrides: Partial<DenKey> = {}): DenKey {
    return {
      keyId: "test-key-id",
      denId: MOCK_DEN_ID,
      label: "Test Key",
      keyType: "come-over",
      scope: {
        namespaces: ["sharedNotes", "presence"],
        read: true,
        write: true,
        offline: false,
      },
      expiresAt: null,
      namespaceKeys: {
        sharedNotes: MOCK_NAMESPACE_KEYS.sharedNotes,
        presence: MOCK_NAMESPACE_KEYS.presence,
      },
      issuedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("returns true for a valid key with no expiry", () => {
    expect(validateKey(makeValidKey())).toBe(true);
  });

  it("returns true for a key that expires in the future", () => {
    const key = makeValidKey({
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(validateKey(key)).toBe(true);
  });

  it("returns false for an expired key", () => {
    const key = makeValidKey({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(validateKey(key)).toBe(false);
  });

  it("returns false for a key with empty namespaces", () => {
    const key = makeValidKey({
      scope: { namespaces: [], read: true, write: true, offline: false },
    });
    expect(validateKey(key)).toBe(false);
  });

  it("returns false when a scoped namespace is missing its key material", () => {
    const key = makeValidKey({
      scope: {
        namespaces: ["sharedNotes", "voiceThread"],
        read: true,
        write: true,
        offline: false,
      },
      namespaceKeys: {
        sharedNotes: MOCK_NAMESPACE_KEYS.sharedNotes,
        // voiceThread key is missing!
      },
    });
    expect(validateKey(key)).toBe(false);
  });

  it("returns false when both read and write are false", () => {
    const key = makeValidKey({
      scope: {
        namespaces: ["sharedNotes"],
        read: false,
        write: false,
        offline: false,
      },
    });
    expect(validateKey(key)).toBe(false);
  });

  it("returns true for a write-only letterbox key (read=false, write=true)", () => {
    const key = makeValidKey({
      scope: {
        namespaces: ["dropbox"],
        read: false,
        write: true,
        offline: true,
      },
      namespaceKeys: { dropbox: MOCK_NAMESPACE_KEYS.dropbox },
    });
    expect(validateKey(key)).toBe(true);
  });

  it("returns true for a read-only peek key (read=true, write=false)", () => {
    const key = makeValidKey({
      scope: {
        namespaces: ["sharedNotes"],
        read: true,
        write: false,
        offline: false,
      },
      namespaceKeys: { sharedNotes: MOCK_NAMESPACE_KEYS.sharedNotes },
    });
    expect(validateKey(key)).toBe(true);
  });
});

// ─── KEY_PRESETS ─────────────────────────────────────────────────────────────

describe("KEY_PRESETS", () => {
  it("defines all four presets", () => {
    expect(KEY_PRESETS["come-over"]).toBeDefined();
    expect(KEY_PRESETS["letterbox"]).toBeDefined();
    expect(KEY_PRESETS["house-sit"]).toBeDefined();
    expect(KEY_PRESETS["peek"]).toBeDefined();
  });

  it("come-over is live-only (offline=false)", () => {
    expect(KEY_PRESETS["come-over"].scope.offline).toBe(false);
  });

  it("letterbox supports offline drops", () => {
    expect(KEY_PRESETS["letterbox"].scope.offline).toBe(true);
  });

  it("house-sit supports offline and has all four namespaces", () => {
    expect(KEY_PRESETS["house-sit"].scope.offline).toBe(true);
    expect(KEY_PRESETS["house-sit"].scope.namespaces).toHaveLength(4);
  });

  it("peek is read-only", () => {
    expect(KEY_PRESETS["peek"].scope.read).toBe(true);
    expect(KEY_PRESETS["peek"].scope.write).toBe(false);
  });

  it("letterbox is write-only", () => {
    expect(KEY_PRESETS["letterbox"].scope.read).toBe(false);
    expect(KEY_PRESETS["letterbox"].scope.write).toBe(true);
  });
});

// ─── depositKey / revokeKey / redeemKey (mocked crypto) ──────────────────────

const { mockEncryptBundle, mockDecryptBundle } = vi.hoisted(() => ({
  mockEncryptBundle: vi.fn(),
  mockDecryptBundle: vi.fn(),
}));

vi.mock("@meerkat/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@meerkat/crypto")>();
  return {
    ...actual,
    encryptBundle: mockEncryptBundle,
    decryptBundle: mockDecryptBundle,
  };
});

// Re-import AFTER mock setup
const { depositKey, revokeKey, redeemKey } = await import("../lib/keys");

const MOCK_BUNDLE = {
  alg: "NACL-BOX" as const,
  ephemeralPublicKey: "ephemeral==",
  nonce: "nonce==",
  ciphertext: "cipher==",
};

const MOCK_VISITOR_PUBLIC_KEY = new Uint8Array(32).fill(1);
const MOCK_VISITOR_SECRET_KEY = new Uint8Array(32).fill(2);

describe("depositKey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seals the key with encryptBundle and calls depositOnServer", async () => {
    mockEncryptBundle.mockReturnValue(MOCK_BUNDLE);
    const depositOnServer = vi.fn().mockResolvedValue("tok-abc123");

    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    const token = await depositKey({
      key,
      visitorPublicKey: MOCK_VISITOR_PUBLIC_KEY,
      depositOnServer,
    });

    expect(mockEncryptBundle).toHaveBeenCalledWith(
      key,
      MOCK_VISITOR_PUBLIC_KEY,
    );
    expect(depositOnServer).toHaveBeenCalledWith({
      denId: MOCK_DEN_ID,
      encryptedBundle: JSON.stringify(MOCK_BUNDLE),
      expiresAt: null,
    });
    expect(token).toBe("tok-abc123");
  });

  it("passes the correct expiresAt to the server", async () => {
    mockEncryptBundle.mockReturnValue(MOCK_BUNDLE);
    const depositOnServer = vi.fn().mockResolvedValue("tok-xyz");

    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
      durationMs: 86400000, // 1 day
    });

    await depositKey({
      key,
      visitorPublicKey: MOCK_VISITOR_PUBLIC_KEY,
      depositOnServer,
    });

    const call = depositOnServer.mock.calls[0]![0];
    expect(call.expiresAt).not.toBeNull();
    expect(new Date(call.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("propagates errors from depositOnServer", async () => {
    mockEncryptBundle.mockReturnValue(MOCK_BUNDLE);
    const depositOnServer = vi.fn().mockRejectedValue(new Error("Server down"));

    const key = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    await expect(
      depositKey({
        key,
        visitorPublicKey: MOCK_VISITOR_PUBLIC_KEY,
        depositOnServer,
      }),
    ).rejects.toThrow("Server down");
  });
});

describe("revokeKey", () => {
  it("calls deleteFromServer with the token", async () => {
    const deleteFromServer = vi.fn().mockResolvedValue(undefined);
    await revokeKey({ token: "tok-abc123", deleteFromServer });
    expect(deleteFromServer).toHaveBeenCalledWith("tok-abc123");
  });

  it("propagates errors from deleteFromServer", async () => {
    const deleteFromServer = vi.fn().mockRejectedValue(new Error("Not found"));
    await expect(
      revokeKey({ token: "gone", deleteFromServer }),
    ).rejects.toThrow("Not found");
  });
});

describe("redeemKey", () => {
  beforeEach(() => vi.clearAllMocks());

  const REDEEMED_KEY: DenKey = {
    keyId: "key-redeemed",
    denId: MOCK_DEN_ID,
    label: "Come Over",
    keyType: "come-over",
    scope: {
      namespaces: ["sharedNotes", "voiceThread", "presence"],
      read: true,
      write: true,
      offline: false,
    },
    expiresAt: null,
    namespaceKeys: {
      sharedNotes: MOCK_NAMESPACE_KEYS.sharedNotes,
      voiceThread: MOCK_NAMESPACE_KEYS.voiceThread,
      presence: MOCK_NAMESPACE_KEYS.presence,
    },
    issuedAt: new Date().toISOString(),
  };

  it("fetches the pot, decrypts it, and returns the DenKey", async () => {
    mockDecryptBundle.mockReturnValue(REDEEMED_KEY);
    const fetchFromServer = vi.fn().mockResolvedValue({
      encryptedBundle: JSON.stringify(MOCK_BUNDLE),
    });

    const key = await redeemKey({
      token: "tok-abc123",
      visitorSecretKey: MOCK_VISITOR_SECRET_KEY,
      fetchFromServer,
    });

    expect(fetchFromServer).toHaveBeenCalledWith("tok-abc123");
    expect(mockDecryptBundle).toHaveBeenCalledWith(
      MOCK_BUNDLE,
      MOCK_VISITOR_SECRET_KEY,
    );
    expect(key.keyId).toBe("key-redeemed");
  });

  it("throws when fetchFromServer returns null (token not found)", async () => {
    const fetchFromServer = vi.fn().mockResolvedValue(null);

    await expect(
      redeemKey({
        token: "invalid-token",
        visitorSecretKey: MOCK_VISITOR_SECRET_KEY,
        fetchFromServer,
      }),
    ).rejects.toThrow("Flower pot not found");
  });

  it("throws when the redeemed key is expired", async () => {
    const expiredKey: DenKey = {
      ...REDEEMED_KEY,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    mockDecryptBundle.mockReturnValue(expiredKey);
    const fetchFromServer = vi.fn().mockResolvedValue({
      encryptedBundle: JSON.stringify(MOCK_BUNDLE),
    });

    await expect(
      redeemKey({
        token: "expired-token",
        visitorSecretKey: MOCK_VISITOR_SECRET_KEY,
        fetchFromServer,
      }),
    ).rejects.toThrow("invalid or expired");
  });

  it("throws when the encrypted bundle is malformed JSON", async () => {
    const fetchFromServer = vi.fn().mockResolvedValue({
      encryptedBundle: "not-valid-json{{",
    });

    await expect(
      redeemKey({
        token: "bad-bundle",
        visitorSecretKey: MOCK_VISITOR_SECRET_KEY,
        fetchFromServer,
      }),
    ).rejects.toThrow("Failed to parse encrypted bundle");
  });
});

// ─── Scope isolation ──────────────────────────────────────────────────────────

describe("namespace key scoping", () => {
  it("a letterbox key never contains sharedNotes, voiceThread, or presence keys", () => {
    const key = generateKey({
      keyType: "letterbox",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.namespaceKeys.sharedNotes).toBeUndefined();
    expect(key.namespaceKeys.voiceThread).toBeUndefined();
    expect(key.namespaceKeys.presence).toBeUndefined();
    expect(key.namespaceKeys.dropbox).toBe(MOCK_NAMESPACE_KEYS.dropbox);
  });

  it("a peek key never contains dropbox or voiceThread keys", () => {
    const key = generateKey({
      keyType: "peek",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.namespaceKeys.dropbox).toBeUndefined();
    expect(key.namespaceKeys.voiceThread).toBeUndefined();
  });

  it("come-over key does not include dropbox key", () => {
    const key = generateKey({
      keyType: "come-over",
      denId: MOCK_DEN_ID,
      allNamespaceKeys: MOCK_NAMESPACE_KEYS,
    });

    expect(key.namespaceKeys.dropbox).toBeUndefined();
  });
});

// ─── Server blindness verification ───────────────────────────────────────────

describe("no Supabase direct calls", () => {
  it("@meerkat/keys source files do not import from Supabase", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");

    const srcDir = join(process.cwd(), "src");
    function collectFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...collectFiles(full));
        } else if (
          entry.name.endsWith(".ts") &&
          !entry.name.includes(".test.")
        ) {
          files.push(full);
        }
      }
      return files;
    }

    const files = collectFiles(srcDir);
    const supabasePatterns = ["@supabase", "supabase-js", "createClient"];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of supabasePatterns) {
        expect(
          content,
          `${file} must not import Supabase — server interactions are caller-provided`,
        ).not.toContain(pattern);
      }
    }
  });
});
