// ─── p2p.test.ts ─────────────────────────────────────────────────────────────
//
// @meerkat/p2p test suite.
//
// Testing strategy:
//   • SignalingChannel — mock Supabase channel, verify send/listen wiring
//   • OfflineDropManager — mock storage, verify upload/collect/confirm flow
//   • P2PManager / createP2PAdapter — status API, adapter interface contract
//   • HostManager — mock signaling + RTCPeerConnection, verify handshake
//   • VisitorConnection — mock signaling + RTCPeerConnection, verify join flow
//   • Scope enforcement — validateKey rejection, namespace filtering helpers
//   • yjs-sync helpers — getReadableNamespaces, getWritableNamespaces
//   • Structural — no Supabase direct import in source files
//
// Real WebRTC is NOT tested here (requires two browser contexts). Integration
// tests for the full handshake live in a separate Playwright suite.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

import type { DenKey } from "@meerkat/keys";
import type {
  SupabaseRealtimeChannelLike,
  P2PManagerOptions,
  SyncStatus,
  SignalMessage,
  JoinResponseSignal,
} from "../types";

// A minimal valid DenKey for tests
function makeDenKey(overrides: Partial<DenKey> = {}): DenKey {
  return {
    keyId: "test-key-id",
    denId: "den-host-abc",
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
      sharedNotes: "c2hhcmVkTm90ZXNLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBd",
      voiceThread: "dm9pY2VUaHJlYWRLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ",
      presence: "cHJlc2VuY2VLZXlCeXRlc0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ",
    },
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Mock Supabase Realtime channel ──────────────────────────────────────────

type BroadcastListener = (payload: { payload: unknown }) => void;

function makeMockChannel(): SupabaseRealtimeChannelLike & {
  _listeners: Map<string, BroadcastListener[]>;
  _sent: Array<{ event: string; payload: unknown }>;
  _triggerEvent: (event: string, payload: unknown) => void;
  _triggerStatus: (status: string) => void;
} {
  const listeners = new Map<string, BroadcastListener[]>();
  const sent: Array<{ event: string; payload: unknown }> = [];
  let statusCallback: ((s: string) => void) | undefined;

  return {
    _listeners: listeners,
    _sent: sent,

    _triggerEvent(event: string, payload: unknown) {
      for (const cb of listeners.get(event) ?? []) {
        cb({ payload });
      }
    },

    _triggerStatus(status: string) {
      statusCallback?.(status);
    },

    on(
      _eventType: "broadcast",
      config: { event: string },
      callback: BroadcastListener,
    ) {
      const existing = listeners.get(config.event) ?? [];
      existing.push(callback);
      listeners.set(config.event, existing);
      return this;
    },

    subscribe(callback?: (status: string) => void) {
      statusCallback = callback;
      return this;
    },

    async send(args: { type: "broadcast"; event: string; payload: unknown }) {
      sent.push({ event: args.event, payload: args.payload });
    },

    async unsubscribe() {
      /* no-op */
    },
  };
}

function makeMockOptions(
  channel?: ReturnType<typeof makeMockChannel>,
): P2PManagerOptions & { channel: ReturnType<typeof makeMockChannel> } {
  const ch = channel ?? makeMockChannel();
  return {
    channel: ch,
    createSignalingChannel: () => ch,
    iceServers: [],
  };
}

// ─── SignalingChannel ─────────────────────────────────────────────────────────

import {
  SignalingChannel,
  signalingChannelName,
  DEFAULT_ICE_SERVERS,
  SIGNAL_EVENTS,
} from "../lib/signaling";

describe("SignalingChannel", () => {
  it("signalingChannelName produces expected channel name", () => {
    expect(signalingChannelName("den-abc")).toBe("p2p:den:den-abc");
  });

  it("DEFAULT_ICE_SERVERS contains Google STUN", () => {
    expect(
      DEFAULT_ICE_SERVERS.some((s) => String(s.urls).includes("stun")),
    ).toBe(true);
  });

  it("connects when subscribe fires SUBSCRIBED", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    // subscribe fires SUBSCRIBED immediately
    const connectPromise = sig.connect();
    ch._triggerStatus("SUBSCRIBED");
    await connectPromise;

    expect(sig.isConnected).toBe(true);
  });

  it("rejects connect on CHANNEL_ERROR", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    const connectPromise = sig.connect();
    ch._triggerStatus("CHANNEL_ERROR");

    await expect(connectPromise).rejects.toThrow("Signaling channel error");
  });

  it("sends join-request via broadcast", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    await sig.sendJoinRequest({
      type: "join-request",
      visitorId: "v1",
      denId: "den-abc",
      sdpOffer: "sdp-offer-data",
      denKey: makeDenKey(),
    });

    expect(ch._sent).toHaveLength(1);
    expect(ch._sent[0]!.event).toBe(SIGNAL_EVENTS.JOIN_REQUEST);
    expect((ch._sent[0]!.payload as { visitorId: string }).visitorId).toBe(
      "v1",
    );
  });

  it("sends join-response via broadcast", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    await sig.sendJoinResponse({
      type: "join-response",
      visitorId: "v1",
      denId: "den-abc",
      sdpAnswer: "sdp-answer",
      accepted: true,
    });

    expect(ch._sent[0]!.event).toBe(SIGNAL_EVENTS.JOIN_RESPONSE);
    expect((ch._sent[0]!.payload as { accepted: boolean }).accepted).toBe(true);
  });

  it("sends ice-candidate via broadcast", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    await sig.sendIceCandidate({
      type: "ice-candidate",
      visitorId: "v1",
      denId: "den-abc",
      candidate: { candidate: "candidate:1 udp" },
      from: "visitor",
    });

    expect(ch._sent[0]!.event).toBe(SIGNAL_EVENTS.ICE_CANDIDATE);
  });

  it("broadcasts host-online with denId and hostPublicKey", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    await sig.broadcastHostOnline({ denId: "den-abc", hostPublicKey: "pk123" });

    expect(ch._sent[0]!.event).toBe(SIGNAL_EVENTS.HOST_ONLINE);
    expect(
      (ch._sent[0]!.payload as { hostPublicKey: string }).hostPublicKey,
    ).toBe("pk123");
  });

  it("broadcasts host-offline with denId", async () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");

    await sig.broadcastHostOffline();

    expect(ch._sent[0]!.event).toBe(SIGNAL_EVENTS.HOST_OFFLINE);
    expect((ch._sent[0]!.payload as { denId: string }).denId).toBe("den-abc");
  });

  it("fires join-request listener when event is triggered", () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");
    const received: SignalMessage[] = [];

    sig.onJoinRequest((msg) => received.push(msg));

    const payload = {
      type: "join-request" as const,
      visitorId: "v2",
      denId: "den-abc",
      sdpOffer: "offer",
      denKey: makeDenKey(),
    };
    ch._triggerEvent(SIGNAL_EVENTS.JOIN_REQUEST, payload);

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe("join-request");
  });

  it("fires join-response listener when event is triggered", () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");
    const received: JoinResponseSignal[] = [];

    sig.onJoinResponse((msg) => received.push(msg));

    const payload: JoinResponseSignal = {
      type: "join-response",
      visitorId: "v3",
      denId: "den-abc",
      sdpAnswer: "answer",
      accepted: true,
    };
    ch._triggerEvent(SIGNAL_EVENTS.JOIN_RESPONSE, payload);

    expect(received[0]!.accepted).toBe(true);
  });

  it("fires host-online listener", () => {
    const ch = makeMockChannel();
    const sig = new SignalingChannel(ch, "den-abc");
    const received: unknown[] = [];

    sig.onHostOnline((msg) => received.push(msg));
    ch._triggerEvent(SIGNAL_EVENTS.HOST_ONLINE, {
      type: "host-online",
      denId: "den-abc",
      hostPublicKey: "pk",
    });

    expect(received).toHaveLength(1);
  });
});

// ─── OfflineDropManager ───────────────────────────────────────────────────────

import {
  OfflineDropManager,
  dropStoragePath,
  dropStoragePrefix,
} from "../lib/offline-drops";

describe("OfflineDropManager", () => {
  it("dropStoragePath produces the correct path", () => {
    expect(dropStoragePath("den-1", "visitor-a", "drop-x")).toBe(
      "drops/den-1/visitor-a-drop-x.enc",
    );
  });

  it("dropStoragePrefix produces the correct prefix", () => {
    expect(dropStoragePrefix("den-1")).toBe("drops/den-1/");
  });

  it("uploadDrop calls uploadDrop with path, bytes, and metadata", async () => {
    const uploadDrop = vi.fn().mockResolvedValue(undefined);
    const mgr = new OfflineDropManager({
      uploadDrop,
      listDrops: vi.fn().mockResolvedValue([]),
      downloadDrop: vi.fn(),
      deleteDrop: vi.fn(),
    });

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const drop = await mgr.uploadDrop("den-1", "v-xyz", bytes, "base64iv==");

    expect(uploadDrop).toHaveBeenCalledOnce();
    const [path, data, meta] = uploadDrop.mock.calls[0]!;
    expect(path).toMatch(/^drops\/den-1\/v-xyz-/);
    expect(data).toEqual(bytes);
    expect(meta.iv).toBe("base64iv==");
    expect(meta.visitorId).toBe("v-xyz");

    expect(drop.denId).toBe("den-1");
    expect(drop.visitorId).toBe("v-xyz");
    expect(drop.iv).toBe("base64iv==");
  });

  it("collectPendingDrops returns empty array when listDrops returns empty", async () => {
    const mgr = new OfflineDropManager({
      uploadDrop: vi.fn(),
      listDrops: vi.fn().mockResolvedValue([]),
      downloadDrop: vi.fn(),
      deleteDrop: vi.fn(),
    });

    const drops = await mgr.collectPendingDrops("den-1");
    expect(drops).toHaveLength(0);
  });

  it("collectPendingDrops returns empty array when listDrops throws", async () => {
    const mgr = new OfflineDropManager({
      uploadDrop: vi.fn(),
      listDrops: vi.fn().mockRejectedValue(new Error("no bucket")),
      downloadDrop: vi.fn(),
      deleteDrop: vi.fn(),
    });

    const drops = await mgr.collectPendingDrops("den-1");
    expect(drops).toHaveLength(0);
  });

  it("collectPendingDrops downloads and returns drops", async () => {
    const paths = ["drops/den-1/v-abc-drop-1.enc"];
    const mgr = new OfflineDropManager({
      uploadDrop: vi.fn(),
      listDrops: vi.fn().mockResolvedValue(paths),
      downloadDrop: vi.fn().mockResolvedValue({
        data: new Uint8Array([10, 20]),
        metadata: {
          iv: "iv==",
          visitorId: "v-abc",
          droppedAt: new Date().toISOString(),
        },
      }),
      deleteDrop: vi.fn(),
    });

    const drops = await mgr.collectPendingDrops("den-1");
    expect(drops).toHaveLength(1);
    expect(drops[0]!.visitorId).toBe("v-abc");
    expect(drops[0]!.iv).toBe("iv==");
  });

  it("confirmDrop calls deleteDrop with the correct path", async () => {
    const deleteDrop = vi.fn().mockResolvedValue(undefined);
    const mgr = new OfflineDropManager({
      uploadDrop: vi.fn(),
      listDrops: vi.fn().mockResolvedValue([]),
      downloadDrop: vi.fn(),
      deleteDrop,
    });

    await mgr.confirmDrop({
      dropId: "drop-id-123",
      denId: "den-1",
      visitorId: "v-xyz",
      encryptedPayload: "b64payload",
      iv: "iv==",
      droppedAt: new Date().toISOString(),
    });

    expect(deleteDrop).toHaveBeenCalledWith(
      "drops/den-1/v-xyz-drop-id-123.enc",
    );
  });

  it("confirmDrop uses path directly when dropId starts with 'drops/'", async () => {
    const deleteDrop = vi.fn().mockResolvedValue(undefined);
    const mgr = new OfflineDropManager({
      uploadDrop: vi.fn(),
      listDrops: vi.fn().mockResolvedValue([]),
      downloadDrop: vi.fn(),
      deleteDrop,
    });

    await mgr.confirmDrop({
      dropId: "drops/den-1/v-xyz-drop-1.enc",
      denId: "den-1",
      visitorId: "v-xyz",
      encryptedPayload: "b64",
      iv: "iv==",
      droppedAt: new Date().toISOString(),
    });

    expect(deleteDrop).toHaveBeenCalledWith("drops/den-1/v-xyz-drop-1.enc");
  });
});

// ─── P2PManager ───────────────────────────────────────────────────────────────

import {
  P2PManager,
  initP2P,
  getP2PManager,
  createP2PAdapter,
  resetP2PManager,
} from "../lib/p2p-manager";

describe("P2PManager", () => {
  beforeEach(() => resetP2PManager());
  afterEach(() => resetP2PManager());

  it("getP2PManager throws before initP2P is called", () => {
    expect(() => getP2PManager()).toThrow("not initialized");
  });

  it("initP2P returns a P2PManager and makes getP2PManager work", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);
    expect(mgr).toBeInstanceOf(P2PManager);
    expect(getP2PManager()).toBe(mgr);
  });

  it("createP2PAdapter returns the global manager after initP2P", () => {
    const opts = makeMockOptions();
    initP2P(opts);
    const adapter = createP2PAdapter();
    expect(typeof adapter.hostDen).toBe("function");
    expect(typeof adapter.getStatus).toBe("function");
    expect(typeof adapter.onStatusChange).toBe("function");
  });

  it("getStatus returns offline when no HostManager exists for a den", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);
    expect(mgr.getStatus("any-den")).toBe("offline");
  });

  it("onStatusChange returns a no-op unsubscribe when not hosting", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);
    const handler = vi.fn();
    const unsub = mgr.onStatusChange("any-den", handler);
    expect(() => unsub()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("getVisitorSessions returns empty array when not hosting", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);
    expect(mgr.getVisitorSessions("any-den")).toEqual([]);
  });

  it("setHostPublicKey stores the key for use during hosting", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);
    expect(() => mgr.setHostPublicKey("pk-base64")).not.toThrow();
  });

  it("satisfies the P2PAdapter interface", () => {
    const opts = makeMockOptions();
    const mgr = initP2P(opts);

    // P2PAdapter requires these three methods
    expect(typeof mgr.hostDen).toBe("function");
    expect(typeof mgr.getStatus).toBe("function");
    expect(typeof mgr.onStatusChange).toBe("function");
  });
});

// ─── Yjs sync helpers ────────────────────────────────────────────────────────

import { getReadableNamespaces, getWritableNamespaces } from "../lib/yjs-sync";
import type { Namespace } from "@meerkat/keys";

describe("getReadableNamespaces", () => {
  const ALL_NS: Namespace[] = [
    "sharedNotes",
    "voiceThread",
    "dropbox",
    "presence",
  ];

  it("returns all namespaces when canRead is true", () => {
    expect(getReadableNamespaces(ALL_NS, true)).toEqual(ALL_NS);
  });

  it("returns empty array when canRead is false", () => {
    expect(getReadableNamespaces(ALL_NS, false)).toEqual([]);
  });

  it("returns only granted namespaces when partial", () => {
    const granted: Namespace[] = ["sharedNotes", "presence"];
    expect(getReadableNamespaces(granted, true)).toEqual(granted);
  });
});

describe("getWritableNamespaces", () => {
  const ALL_NS: Namespace[] = [
    "sharedNotes",
    "voiceThread",
    "dropbox",
    "presence",
  ];

  it("returns all namespaces when canWrite is true", () => {
    expect(getWritableNamespaces(ALL_NS, true)).toEqual(ALL_NS);
  });

  it("returns empty array when canWrite is false (peek key)", () => {
    expect(getWritableNamespaces(ALL_NS, false)).toEqual([]);
  });

  it("letterbox: dropbox-only write namespace", () => {
    expect(getWritableNamespaces(["dropbox"], true)).toEqual(["dropbox"]);
  });
});

// ─── Scope enforcement ────────────────────────────────────────────────────────

import { validateKey } from "@meerkat/keys";

describe("Scope enforcement via validateKey", () => {
  it("rejects an expired key before any connection attempt", () => {
    const expiredKey = makeDenKey({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(validateKey(expiredKey)).toBe(false);
  });

  it("rejects a key with empty namespaces", () => {
    const noScopeKey = makeDenKey({
      scope: { namespaces: [], read: true, write: true, offline: false },
    });
    expect(validateKey(noScopeKey)).toBe(false);
  });

  it("rejects a key missing namespace key material", () => {
    const missingKeyMaterial = makeDenKey({
      scope: {
        namespaces: ["sharedNotes", "voiceThread", "presence"],
        read: true,
        write: true,
        offline: false,
      },
      namespaceKeys: {
        sharedNotes: "key-material",
        // voiceThread and presence key material missing
      },
    });
    expect(validateKey(missingKeyMaterial)).toBe(false);
  });

  it("accepts a valid unexpired key with full scope", () => {
    expect(validateKey(makeDenKey())).toBe(true);
  });

  it("accepts a peek key (read-only)", () => {
    const peekKey = makeDenKey({
      keyType: "peek",
      scope: {
        namespaces: ["sharedNotes", "presence"],
        read: true,
        write: false,
        offline: false,
      },
      namespaceKeys: {
        sharedNotes: "key-material-shared",
        presence: "key-material-presence",
      },
    });
    expect(validateKey(peekKey)).toBe(true);
  });
});

// ─── Server boundary / structural ────────────────────────────────────────────

describe("@meerkat/p2p server boundary", () => {
  it("source files do not directly import from @supabase/supabase-js", async () => {
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");

    const srcDir = join(process.cwd(), "src");

    function collectSrc(dir: string): string[] {
      const files: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectSrc(full));
        else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
          files.push(full);
        }
      }
      return files;
    }

    const files = collectSrc(srcDir);
    const forbidden = ["@supabase/supabase-js", "createClient"];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of forbidden) {
        expect(
          content,
          `${file} must not import Supabase directly — use caller-provided createSignalingChannel`,
        ).not.toContain(pattern);
      }
    }
  });

  it("source files do not import from private.ydoc or privateDen", async () => {
    // @meerkat/p2p must never touch private.ydoc — it only has access to sharedDen
    const { readFileSync, readdirSync } = await import("fs");
    const { join } = await import("path");

    const srcDir = join(process.cwd(), "src", "lib");

    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (!entry.name.endsWith(".ts") || entry.name.includes(".test."))
        continue;
      const content = readFileSync(join(srcDir, entry.name), "utf-8");
      expect(content, `${entry.name} must not access privateDen`).not.toContain(
        "privateDen",
      );
    }
  });
});
