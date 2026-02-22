# @meerkat/crypto

All encryption and decryption for Meerkat. **Nothing in plaintext leaves the device without passing through here.**

This package is the foundation of Meerkat's privacy model. Every other package that handles sensitive data depends on it.

---

## What it does

| Use case | Functions |
|---|---|
| `private.ydoc` at-rest | `deriveDeviceKey` → `encryptBlob` |
| Shared doc namespace keys | `generateNamespaceKey` → `encryptBlob` |
| Voice blobs (before Storage upload) | `generateNamespaceKey` → `encryptBlob` |
| Flower pot bundles (DenKey sealing) | `generateKeyPair` + `encryptBundle` |
| Visitor redeeming a flower pot | `decryptBundle` |

---

## Algorithms

| Operation | Algorithm | Why |
|---|---|---|
| At-rest blob encryption | AES-GCM-256 | Authenticated, natively in Web Crypto, hardware-accelerated |
| Device key derivation | PBKDF2-SHA-256 (310k iterations) | OWASP 2023 recommendation |
| Flower pot bundle sealing | NaCl box (X25519 + XSalsa20-Poly1305) | Compact 32-byte keys, one-call API, battle-tested |

---

## Quick start

```ts
import {
  deriveDeviceKey, randomSalt,
  encryptBlob, decryptBlob,
  generateNamespaceKey, generateNamespaceKeySet,
  generateKeyPair, encryptBundle, decryptBundle,
  toBase64, fromBase64,
} from "@meerkat/crypto"
```

### Encrypt private.ydoc at rest

```ts
// First launch — generate and persist salt
const salt = randomSalt()
localStorage.setItem("den:salt", toBase64(salt))

// Derive key from a stable passphrase (not a raw user password)
const { key } = await deriveDeviceKey(buildPassphrase(user, deviceId), salt)

// Encrypt the Yjs doc bytes before writing to IndexedDB
const yjsBytes = Y.encodeStateAsUpdate(privateDoc)
const encrypted = await encryptBlob(yjsBytes, key)
await idb.put("private.ydoc", JSON.stringify(encrypted))

// On next launch — re-derive and decrypt
const storedSalt = fromBase64(localStorage.getItem("den:salt")!)
const { key: sameKey } = await deriveDeviceKey(buildPassphrase(user, deviceId), storedSalt)
const raw = JSON.parse(await idb.get("private.ydoc"))
const restored = await decryptBlob(raw, sameKey)
Y.applyUpdate(privateDoc, restored)
```

### Encrypt a voice blob before upload

```ts
// One namespace key per den, stored in private.ydoc settings
const rawKey = await generateNamespaceKey()
const cryptoKey = await importNamespaceKey(rawKey)

// Encrypt before upload
const encryptedAudio = await encryptBlob(audioUint8Array, cryptoKey)
const uploadPayload = JSON.stringify(encryptedAudio) // or Uint8Array if you prefer
```

### Seal a DenKey as a flower pot (host side)

```ts
// Visitor shares their X25519 public key (from their profile)
const bundle = encryptBundle(denKey, visitorPublicKey)
// Server stores bundle — cannot read it
await server.depositFlowerPot({ token, bundle: JSON.stringify(bundle) })
```

### Redeem a flower pot (visitor side)

```ts
const raw = await server.getFlowerPot(token)
const bundle = JSON.parse(raw)
const denKey = decryptBundle<DenKey>(bundle, mySecretKey)
```

---

## Namespace key scoping

The shared.ydoc has four namespaces. Each gets its own key so visitors can be
granted access to only the namespaces their key includes.

```ts
// Host: generate all namespace keys for a new den
const allKeys = await generateNamespaceKeySet()
// → { sharedNotes: Uint8Array(32), voiceThread: Uint8Array(32), dropbox: Uint8Array(32), presence: Uint8Array(32) }

// Build a Letterbox key bundle (dropbox write-only)
const letterboxBundle = {
  dropbox: allKeys.dropbox,
  // no sharedNotes, voiceThread or presence — visitor cannot access them
}

// Serialise for inclusion in the DenKey JSON before sealing
const serialized = serializeNamespaceKeySet(letterboxBundle)
```

---

## Key types from the dev plan

| Key type | Namespaces granted |
|---|---|
| Come Over | sharedNotes + voiceThread + presence |
| Letterbox | dropbox only |
| House-sit | sharedNotes + voiceThread + dropbox + presence |
| Peek | sharedNotes + presence (read-only enforced in @meerkat/p2p) |

---

## Security properties

- **Non-extractable device key** — derived via PBKDF2, imported as non-extractable into Web Crypto. The raw key bytes cannot be read back from the JS runtime.
- **Fresh IV per encryption** — `encryptBlob` generates a new 12-byte random IV per call. Reuse is impossible by design.
- **Authenticated encryption** — AES-GCM's auth tag detects any tampering. Decryption throws on any modification.
- **Forward secrecy per bundle** — `encryptBundle` generates a fresh ephemeral keypair per call. Compromising one visitor's secret key does not compromise other bundles.
- **Constant-time comparison** — `constantTimeEqual` prevents timing attacks when comparing tokens.
- **Server blindness** — `EncryptedBundle` (flower pots) can only be decrypted by the holder of the recipient's secret key. The server stores opaque bytes.

---

## Development

```bash
pnpm test          # run tests once
pnpm test:watch    # run in watch mode
pnpm test:coverage # coverage report
pnpm type-check    # TypeScript only
pnpm build         # emit to dist/
```

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `tweetnacl` | ^1.0.3 | NaCl box for flower pot bundle encryption |
| `tweetnacl-util` | ^0.15.1 | Base64/UTF-8 helpers (used internally) |
| Web Crypto API | browser-native | AES-GCM, PBKDF2 — no install needed |
