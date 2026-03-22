/**
 * @meerkat/utils — test suite
 *
 * Tests pure utility functions from string, time, geo, and jwt modules.
 * No mocks needed — these are deterministic or use fixed timestamps.
 */

import { describe, it, expect } from "vitest";
import { getInitials, getDisplayName, getSenderName } from "../string.js";
import {
  formatDuration,
  formatTime,
  relativeTime,
  formatMessageTime,
  formatFullDate,
} from "../time.js";
import { isPrivateIp, normaliseIp } from "../geo.js";
import { decodeJwtPayload, sessionIdFromJWT } from "../jwt.js";

// ─── string ───────────────────────────────────────────────────────────────────

describe("getInitials", () => {
  it("returns first letter of a single word", () => {
    expect(getInitials("Meera")).toBe("M");
  });

  it("returns first letter of each word (max 2)", () => {
    expect(getInitials("Meera Kat")).toBe("MK");
  });

  it("returns first 2 initials from a 3-word name", () => {
    expect(getInitials("Alice Bob Carol")).toBe("AB");
  });

  it("returns '?' for an empty string", () => {
    expect(getInitials("")).toBe("?");
  });

  it("returns '?' for a whitespace-only string", () => {
    expect(getInitials("   ")).toBe("?");
  });

  it("uppercases the initials", () => {
    expect(getInitials("alice bob")).toBe("AB");
  });

  it("respects custom maxLength", () => {
    expect(getInitials("Alice Bob Carol", 3)).toBe("ABC");
    expect(getInitials("Alice Bob Carol", 1)).toBe("A");
  });
});

describe("getDisplayName", () => {
  it("returns preferred_name when set", () => {
    expect(
      getDisplayName({ preferred_name: "Hari", full_name: "Hariharan S" }),
    ).toBe("Hari");
  });

  it("returns first word of full_name when no preferred_name", () => {
    expect(
      getDisplayName({ preferred_name: null, full_name: "Hariharan S" }),
    ).toBe("Hariharan");
  });

  it("returns full_name unchanged when single word", () => {
    expect(
      getDisplayName({ preferred_name: null, full_name: "Hariharan" }),
    ).toBe("Hariharan");
  });

  it("falls back to email username when no name", () => {
    expect(
      getDisplayName({
        preferred_name: null,
        full_name: null,
        email: "hari@example.com",
      }),
    ).toBe("hari");
  });

  it("returns 'Unknown' when all fields are null/empty", () => {
    expect(
      getDisplayName({ preferred_name: null, full_name: null, email: null }),
    ).toBe("Unknown");
  });

  it("returns 'Unknown' for null sender", () => {
    expect(getDisplayName(null)).toBe("Unknown");
  });

  it("returns 'Unknown' for undefined sender", () => {
    expect(getDisplayName(undefined)).toBe("Unknown");
  });

  it("ignores empty-string preferred_name and falls through to full_name", () => {
    expect(getDisplayName({ preferred_name: "", full_name: "Hariharan" })).toBe(
      "Hariharan",
    );
  });
});

describe("getSenderName", () => {
  it("delegates to getDisplayName", () => {
    expect(getSenderName({ full_name: "Alice" })).toBe("Alice");
    expect(getSenderName(null)).toBe("Unknown");
  });
});

// ─── time ─────────────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats 75 seconds as 01:15", () => {
    expect(formatDuration(75)).toBe("01:15");
  });

  it("formats 3600 seconds as 60:00", () => {
    expect(formatDuration(3600)).toBe("60:00");
  });

  it("pads single-digit seconds", () => {
    expect(formatDuration(61)).toBe("01:01");
  });

  it("formatTime is an alias for formatDuration", () => {
    expect(formatTime).toBe(formatDuration);
  });
});

describe("relativeTime", () => {
  const now = Date.now();

  it("returns 'Just now' for < 1 minute ago", () => {
    expect(relativeTime(new Date(now - 30_000))).toBe("Just now");
  });

  it("returns 'Xm ago' for minutes", () => {
    expect(relativeTime(new Date(now - 5 * 60_000))).toBe("5m ago");
  });

  it("returns 'Xh ago' for hours", () => {
    expect(relativeTime(new Date(now - 3 * 3_600_000))).toBe("3h ago");
  });

  it("returns 'Xd ago' for days", () => {
    expect(relativeTime(new Date(now - 2 * 86_400_000))).toBe("2d ago");
  });

  it("accepts a Unix ms timestamp", () => {
    expect(relativeTime(now - 30_000)).toBe("Just now");
  });

  it("accepts an ISO string", () => {
    expect(relativeTime(new Date(now - 30_000).toISOString())).toBe("Just now");
  });
});

describe("formatMessageTime", () => {
  it("returns a non-empty time string for a valid date", () => {
    const t = formatMessageTime(new Date("2024-06-03T15:04:00Z"));
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(0);
  });
});

describe("formatFullDate", () => {
  it("returns a non-empty date string for a valid date", () => {
    const d = formatFullDate(new Date("2024-06-03"));
    expect(typeof d).toBe("string");
    expect(d.length).toBeGreaterThan(0);
    expect(d).toContain("2024");
  });
});

// ─── geo ──────────────────────────────────────────────────────────────────────

describe("isPrivateIp", () => {
  it("returns true for loopback 127.0.0.1", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("returns true for IPv6 loopback ::1", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("returns true for RFC-1918 192.168.x.x", () => {
    expect(isPrivateIp("192.168.1.100")).toBe(true);
  });

  it("returns true for RFC-1918 10.x.x.x", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
  });

  it("returns true for RFC-1918 172.16-31.x.x", () => {
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("172.15.0.1")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
  });

  it("returns false for public IPs", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
  });

  it("handles Postgres CIDR-suffixed format", () => {
    expect(isPrivateIp("127.0.0.1/32")).toBe(true);
    expect(isPrivateIp("8.8.8.8/32")).toBe(false);
  });

  it("returns true for empty string", () => {
    expect(isPrivateIp("")).toBe(true);
  });
});

describe("normaliseIp", () => {
  it("strips the CIDR prefix", () => {
    expect(normaliseIp("1.2.3.4/32")).toBe("1.2.3.4");
  });

  it("leaves bare IPs unchanged", () => {
    expect(normaliseIp("8.8.8.8")).toBe("8.8.8.8");
  });

  it("returns empty string for empty input", () => {
    expect(normaliseIp("")).toBe("");
  });
});

// ─── jwt ──────────────────────────────────────────────────────────────────────

// A minimal valid JWT with payload { sub: "user-1", session_id: "sess-abc" }
const MOCK_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" + // header
  ".eyJzdWIiOiJ1c2VyLTEiLCJzZXNzaW9uX2lkIjoic2Vzcy1hYmMifQ" + // payload
  ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"; // signature (not validated)

describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const payload = decodeJwtPayload(MOCK_JWT);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-1");
    expect(payload?.session_id).toBe("sess-abc");
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decodeJwtPayload("")).toBeNull();
  });
});

describe("sessionIdFromJWT", () => {
  it("extracts the session_id claim", () => {
    expect(sessionIdFromJWT(MOCK_JWT)).toBe("sess-abc");
  });

  it("returns null when the token has no session_id claim", () => {
    // Build a JWT payload without session_id: { sub: "user-1" }
    const noSessionJWT =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
      ".eyJzdWIiOiJ1c2VyLTEifQ" + // { sub: "user-1" }
      ".sig";
    expect(sessionIdFromJWT(noSessionJWT)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(sessionIdFromJWT("garbage")).toBeNull();
  });
});
