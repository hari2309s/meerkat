// ─── save.test.ts ────────────────────────────────────────────────────────────
//
// Tests for the saveVoiceNote pipeline function.
//
// Strategy:
//   • Mock @meerkat/analyzer to return controlled AnalysisResult
//   • Mock @meerkat/crypto's encryptBlob to avoid Web Crypto in tests
//   • Mock @meerkat/local-store's addVoiceMemo to capture calls
//   • Verify the pipeline wires all three together correctly

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAnalyzeVoice, mockEncryptBlob, mockAddVoiceMemo } = vi.hoisted(
  () => ({
    mockAnalyzeVoice: vi.fn(),
    mockEncryptBlob: vi.fn(),
    mockAddVoiceMemo: vi.fn(),
  }),
);

vi.mock("@meerkat/analyzer", () => ({
  analyzeVoice: mockAnalyzeVoice,
}));

vi.mock("@meerkat/crypto", () => ({
  encryptBlob: mockEncryptBlob,
}));

vi.mock("@meerkat/local-store", () => ({
  addVoiceMemo: mockAddVoiceMemo,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { saveVoiceNote } from "../lib/save";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ANALYSIS = {
  transcript: "Feeling good today",
  mood: "happy",
  tone: "energetic",
  valence: 0.8,
  arousal: 0.6,
  confidence: 0.92,
  analysedAt: 1700000000000,
};

const MOCK_ENCRYPTED_BLOB = {
  alg: "AES-GCM-256" as const,
  iv: "abc123==",
  data: "encrypted-bytes==",
};

const MOCK_MEMO = {
  id: "memo-123",
  blobRef: "dens/user-1/audio/blob-456.enc",
  durationSeconds: 42,
  createdAt: Date.now(),
  analysis: MOCK_ANALYSIS,
};

const MOCK_KEY = {} as CryptoKey; // Not exercising real crypto here

function makeMockBlob(size = 100): Blob {
  return new Blob([new Uint8Array(size).fill(7)], { type: "audio/webm" });
}

function makeUploadFn(blobRef = "dens/user-1/audio/blob-456.enc") {
  return vi.fn().mockResolvedValue(blobRef);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("saveVoiceNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyzeVoice.mockResolvedValue(MOCK_ANALYSIS);
    mockEncryptBlob.mockResolvedValue(MOCK_ENCRYPTED_BLOB);
    mockAddVoiceMemo.mockResolvedValue(MOCK_MEMO);
  });

  it("runs the full pipeline: analyse → encrypt → upload → store", async () => {
    const blob = makeMockBlob();
    const uploadFn = makeUploadFn();

    const result = await saveVoiceNote(blob, 42, {
      denId: "user-1",
      encryptionKey: MOCK_KEY,
      uploadEncryptedBlob: uploadFn,
    });

    // Analysis ran
    expect(mockAnalyzeVoice).toHaveBeenCalledWith(blob);

    // Encryption ran with the raw bytes
    expect(mockEncryptBlob).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      MOCK_KEY,
    );

    // Upload was called with the encrypted data + iv
    expect(uploadFn).toHaveBeenCalledWith(
      MOCK_ENCRYPTED_BLOB.data,
      MOCK_ENCRYPTED_BLOB.iv,
    );

    // Store was called with the blobRef and analysis
    expect(mockAddVoiceMemo).toHaveBeenCalledWith(
      "user-1",
      "dens/user-1/audio/blob-456.enc",
      42,
      expect.objectContaining({ mood: "happy", confidence: 0.92 }),
    );

    // Result contains expected fields
    expect(result.memoId).toBe("memo-123");
    expect(result.blobRef).toBe("dens/user-1/audio/blob-456.enc");
    expect(result.analysis?.mood).toBe("happy");
  });

  it("saves without analysis when analyzeVoice fails (allowAnalysisFailure=true)", async () => {
    mockAnalyzeVoice.mockRejectedValue(new Error("Model not loaded"));

    const blob = makeMockBlob();
    const uploadFn = makeUploadFn();
    // Override addVoiceMemo to return a memo without analysis
    mockAddVoiceMemo.mockResolvedValue({ ...MOCK_MEMO, analysis: undefined });

    const result = await saveVoiceNote(blob, 30, {
      denId: "user-1",
      encryptionKey: MOCK_KEY,
      uploadEncryptedBlob: uploadFn,
      allowAnalysisFailure: true,
    });

    // Still encrypted and uploaded
    expect(mockEncryptBlob).toHaveBeenCalled();
    expect(uploadFn).toHaveBeenCalled();

    // Stored without analysis
    expect(mockAddVoiceMemo).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      30,
      undefined,
    );

    // Result has no analysis
    expect(result.analysis).toBeUndefined();
  });

  it("throws when analyzeVoice fails and allowAnalysisFailure=false", async () => {
    mockAnalyzeVoice.mockRejectedValue(new Error("Model not loaded"));

    await expect(
      saveVoiceNote(makeMockBlob(), 10, {
        denId: "user-1",
        encryptionKey: MOCK_KEY,
        uploadEncryptedBlob: makeUploadFn(),
        allowAnalysisFailure: false,
      }),
    ).rejects.toThrow("analyzeVoice failed");

    // Should not have called encrypt or upload
    expect(mockEncryptBlob).not.toHaveBeenCalled();
  });

  it("throws when uploadEncryptedBlob fails", async () => {
    const uploadFn = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(
      saveVoiceNote(makeMockBlob(), 20, {
        denId: "user-1",
        encryptionKey: MOCK_KEY,
        uploadEncryptedBlob: uploadFn,
      }),
    ).rejects.toThrow("Network error");

    // addVoiceMemo should not have been called
    expect(mockAddVoiceMemo).not.toHaveBeenCalled();
  });

  it("throws when addVoiceMemo fails", async () => {
    mockAddVoiceMemo.mockRejectedValue(new Error("IndexedDB write failed"));

    await expect(
      saveVoiceNote(makeMockBlob(), 15, {
        denId: "user-1",
        encryptionKey: MOCK_KEY,
        uploadEncryptedBlob: makeUploadFn(),
      }),
    ).rejects.toThrow("IndexedDB write failed");
  });

  it("rounds durationSeconds to an integer", async () => {
    await saveVoiceNote(makeMockBlob(), 12.7, {
      denId: "user-1",
      encryptionKey: MOCK_KEY,
      uploadEncryptedBlob: makeUploadFn(),
    });

    expect(mockAddVoiceMemo).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      13, // Math.round(12.7)
      expect.anything(),
    );
  });

  it("passes the denId to addVoiceMemo correctly", async () => {
    await saveVoiceNote(makeMockBlob(), 5, {
      denId: "specific-den-id",
      encryptionKey: MOCK_KEY,
      uploadEncryptedBlob: makeUploadFn(),
    });

    expect(mockAddVoiceMemo).toHaveBeenCalledWith(
      "specific-den-id",
      expect.any(String),
      expect.any(Number),
      expect.anything(),
    );
  });
});

// ─── Pipeline order verification ──────────────────────────────────────────────

describe("saveVoiceNote — pipeline ordering", () => {
  it("always calls analysis before encryption", async () => {
    const order: string[] = [];

    mockAnalyzeVoice.mockImplementation(async () => {
      order.push("analyse");
      return MOCK_ANALYSIS;
    });

    mockEncryptBlob.mockImplementation(async () => {
      order.push("encrypt");
      return MOCK_ENCRYPTED_BLOB;
    });

    const uploadFn = vi.fn().mockImplementation(async () => {
      order.push("upload");
      return "ref";
    });

    mockAddVoiceMemo.mockImplementation(async () => {
      order.push("store");
      return MOCK_MEMO;
    });

    await saveVoiceNote(makeMockBlob(), 5, {
      denId: "user-1",
      encryptionKey: MOCK_KEY,
      uploadEncryptedBlob: uploadFn,
    });

    expect(order).toEqual(["analyse", "encrypt", "upload", "store"]);
  });
});

// ─── Supabase removal verification ───────────────────────────────────────────

describe("no Supabase direct calls", () => {
  it("@meerkat/voice source files do not import from Supabase", async () => {
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
          `${file} should not import Supabase directly — use the caller-provided uploadEncryptedBlob`,
        ).not.toContain(pattern);
      }
    }
  });
});
