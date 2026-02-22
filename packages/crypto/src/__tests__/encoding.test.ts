import { describe, it, expect } from "vitest";
import {
  toBase64,
  fromBase64,
  bufferToBase64,
  base64ToBuffer,
  encodeText,
  decodeText,
  randomBytes,
  constantTimeEqual,
} from "../lib/encoding.js";

describe("toBase64 / fromBase64", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    expect(fromBase64(toBase64(original))).toEqual(original);
  });

  it("produces URL-safe output (no +, /, or = characters)", () => {
    // Run many random buffers to hit all base64 characters
    for (let i = 0; i < 100; i++) {
      const b64 = toBase64(randomBytes(32));
      expect(b64).not.toMatch(/[+/=]/);
    }
  });

  it("handles empty bytes", () => {
    const empty = new Uint8Array(0);
    expect(toBase64(empty)).toBe("");
    expect(fromBase64("")).toEqual(empty);
  });

  it("handles single byte", () => {
    const single = new Uint8Array([42]);
    expect(fromBase64(toBase64(single))).toEqual(single);
  });

  it("accepts standard base64 with padding", () => {
    // fromBase64 must handle padded input from external sources
    const original = new Uint8Array([1, 2, 3]);
    const standard = btoa(String.fromCharCode(...original)); // has padding
    expect(fromBase64(standard)).toEqual(original);
  });
});

describe("bufferToBase64 / base64ToBuffer", () => {
  it("round-trips an ArrayBuffer", () => {
    const buf = new Uint8Array([10, 20, 30, 40]).buffer;
    const b64 = bufferToBase64(buf);
    const result = base64ToBuffer(b64);
    expect(new Uint8Array(result)).toEqual(new Uint8Array(buf));
  });
});

describe("encodeText / decodeText", () => {
  it("round-trips ASCII", () => {
    const text = "hello meerkat";
    expect(decodeText(encodeText(text))).toBe(text);
  });

  it("round-trips Unicode including emoji", () => {
    const text = "🦦 your den. your device.";
    expect(decodeText(encodeText(text))).toBe(text);
  });

  it("round-trips empty string", () => {
    expect(decodeText(encodeText(""))).toBe("");
  });
});

describe("randomBytes", () => {
  it("returns the requested length", () => {
    expect(randomBytes(0)).toHaveLength(0);
    expect(randomBytes(1)).toHaveLength(1);
    expect(randomBytes(32)).toHaveLength(32);
    expect(randomBytes(64)).toHaveLength(64);
  });

  it("returns different values on each call", () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    // Probability of collision is 2^-256 — effectively impossible
    expect(a).not.toEqual(b);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(true);
  });

  it("returns false for different content", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("returns false for different lengths", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("returns true for two empty arrays", () => {
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });
});
