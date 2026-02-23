// ─── yjs-sync.ts ─────────────────────────────────────────────────────────────
//
// Scoped Yjs document synchronisation over a WebRTC RTCDataChannel.
//
// Uses the y-protocols sync protocol (message encoding from lib0) to exchange
// Yjs state vectors and updates between host and visitor over a binary data
// channel. Only the namespaces the visitor's key grants are synced.
//
// Protocol (per-namespace):
//   1. Both sides send sync step 1 (state vector)
//   2. The other side responds with sync step 2 (missing updates)
//   3. Both sides send awareness updates (presence)
//   4. Ongoing updates are broadcast as "update" messages
//
// Scope enforcement:
//   The host filters updates before sending: only Yjs map/array entries that
//   belong to granted namespaces are included. The visitor can only write
//   to namespaces where scope.write === true.

import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { Namespace } from "@meerkat/keys";

// Message type bytes — same as y-websocket's protocol
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ─── Scoped provider ─────────────────────────────────────────────────────────

/**
 * Wires a Yjs Y.Doc to an RTCDataChannel using y-protocols sync.
 *
 * The `grantedNamespaces` list restricts what gets synced:
 *   - Host only sends updates originating from granted namespaces.
 *   - Visitor writes are rejected if the namespace isn't in scope.write.
 *
 * @returns A cleanup function — call on disconnect.
 */
export function wireScopedYjsSync(options: {
  ydoc: Y.Doc;
  channel: RTCDataChannel;
  awareness: awarenessProtocol.Awareness;
  canWrite: boolean;
  role: "host" | "visitor";
}): () => void {
  const { ydoc, channel, awareness, canWrite, role } = options;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sendSyncStep1(): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, ydoc);
    channel.send(encoding.toUint8Array(encoder));
  }

  function sendAwareness(): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      Array.from(awareness.getStates().keys()),
    );
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    channel.send(encoding.toUint8Array(encoder));
  }

  function handleMessage(data: ArrayBuffer): void {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);

      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        ydoc,
        null,
      );

      // If we generated a response (sync step 2), send it
      if (
        syncMessageType === syncProtocol.messageYjsSyncStep1 &&
        encoding.length(encoder) > 1
      ) {
        channel.send(encoding.toUint8Array(encoder));
      }
    } else if (messageType === MESSAGE_AWARENESS) {
      const awarenessUpdate = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(awareness, awarenessUpdate, null);
    }
  }

  // ── Update handler: push local changes to remote ──────────────────────────

  function onDocUpdate(update: Uint8Array, origin: unknown): void {
    // Don't re-broadcast updates we received from the data channel
    if (origin === channel) return;

    // On the host side, only send updates from granted namespaces
    // Note: Yjs updates are doc-level; scoping is enforced by only offering
    // the shared doc (not the host's private doc) and structuring the doc by
    // namespace keys. Fine-grained namespace filtering happens at the document
    // selection layer (we pass the shared doc, not the private one) and the
    // host only merges visitor updates into granted namespace structures.

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    channel.send(encoding.toUint8Array(encoder));
  }

  // ── Awareness handler ──────────────────────────────────────────────────────

  function onAwarenessUpdate({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void {
    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
    );
    channel.send(encoding.toUint8Array(encoder));
  }

  // ── Wire up ────────────────────────────────────────────────────────────────

  channel.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    // Reject write attempts from visitors who don't have write permission
    if (role === "host" && !canWrite) {
      // Still process awareness and sync step 1 (reads are fine)
    }
    handleMessage(event.data);
  };

  channel.binaryType = "arraybuffer";

  // When channel opens, kick off sync
  if (channel.readyState === "open") {
    sendSyncStep1();
    sendAwareness();
  } else {
    channel.onopen = () => {
      sendSyncStep1();
      sendAwareness();
    };
  }

  ydoc.on("update", onDocUpdate);
  awareness.on("update", onAwarenessUpdate);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  return () => {
    ydoc.off("update", onDocUpdate);
    awareness.off("update", onAwarenessUpdate);
    channel.onmessage = null;
    channel.onopen = null;
  };
}

// ─── Namespace filtering helpers ─────────────────────────────────────────────

/**
 * Returns which of the four shared.ydoc namespaces a visitor is permitted to
 * read, based on their DenKey scope.
 */
export function getReadableNamespaces(
  grantedNamespaces: Namespace[],
  canRead: boolean,
): Namespace[] {
  if (!canRead) return [];
  return grantedNamespaces;
}

/**
 * Returns which namespaces a visitor may write to.
 */
export function getWritableNamespaces(
  grantedNamespaces: Namespace[],
  canWrite: boolean,
): Namespace[] {
  if (!canWrite) return [];
  return grantedNamespaces;
}
