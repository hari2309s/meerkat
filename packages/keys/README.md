# @meerkat/keys

Capability token system for Meerkat. Owns the full DenKey and flower pot lifecycle.

> **The server never reads key material.** It stores only: `denId` (for routing), `encryptedBundle` (opaque ciphertext), and `expiresAt` (for TTL).

---

## The Concept

A **DenKey** is a small self-contained token encoding:

- Which den it grants access to
- Which namespaces of `shared.ydoc` the visitor may access
- Read/write permissions
- Whether the key works offline (for Letterbox drops)
- An optional expiry

The key is sealed with the visitor's X25519 public key (from `@meerkat/crypto`) into an **EncryptedBundle** and deposited as a **flower pot** on the server. The server stores opaque bytes it cannot decrypt. The visitor redeems it using their secret key.

---

## Key type presets

| Preset      | Namespaces                           | Read | Write | Offline | Use case                      |
| ----------- | ------------------------------------ | ---- | ----- | ------- | ----------------------------- |
| `come-over` | sharedNotes + voiceThread + presence | ✓    | ✓     | ✗       | Partner, real-time collab     |
| `letterbox` | dropbox                              | ✗    | ✓     | ✓       | Leave drops when I'm not home |
| `house-sit` | all four                             | ✓    | ✓     | ✓       | Trusted long-term access      |
| `peek`      | sharedNotes + presence               | ✓    | ✗     | ✗       | Read-only check-in            |
| `custom`    | any                                  | any  | any   | any     | Fine-grained control          |

---

## API

### `generateKey(input)` → `DenKey`

Pure function. No async, no side effects. Creates a DenKey scoped to the granted namespaces. Only the namespace key bytes for the granted namespaces are included.

```ts
import { generateKey } from "@meerkat/keys";

// Named preset
const key = generateKey({
  keyType: "come-over",
  denId: user.id,
  allNamespaceKeys: serializedDenNamespaceKeys, // from generateDenNamespaceKeys()
  durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days, omit for no expiry
});

// Custom scope
const key = generateKey({
  keyType: "custom",
  denId: user.id,
  label: "For Alice — voice thread only",
  scope: {
    namespaces: ["voiceThread", "presence"],
    read: true,
    write: false,
    offline: false,
  },
  allNamespaceKeys: serializedDenNamespaceKeys,
});
```

---

### `depositKey(options)` → `Promise<string>` (token)

Seals the DenKey with the visitor's X25519 public key and deposits it on the server. Returns the shareable token string.

```ts
import { depositKey } from "@meerkat/keys";

const token = await depositKey({
  key,
  visitorPublicKey: visitor.publicKey, // Uint8Array(32) from @meerkat/crypto
  depositOnServer: async ({ denId, encryptedBundle, expiresAt }) => {
    // Your tRPC/API call — server sees only ciphertext
    const { token } = await trpc.keys.createFlowerPot.mutate({
      denId,
      encryptedBundle,
      expiresAt,
    });
    return token;
  },
});

// Share token with visitor via URL: /join/[token]
```

---

### `redeemKey(options)` → `Promise<DenKey>`

Visitor fetches and decrypts the flower pot using their secret key.

```ts
import { redeemKey } from "@meerkat/keys";

const key = await redeemKey({
  token: tokenFromUrl,
  visitorSecretKey: myKeyPair.secretKey,
  fetchFromServer: async (token) => {
    // Returns { encryptedBundle: string } | null
    return trpc.keys.getFlowerPot.query({ token });
  },
});

// Persist key locally for P2P sessions
localStorage.setItem(`meerkat:key:${key.keyId}`, JSON.stringify(key));
```

---

### `revokeKey(options)` → `Promise<void>`

Host deletes a flower pot from the server. The token becomes permanently invalid.

```ts
import { revokeKey } from "@meerkat/keys";

await revokeKey({
  token,
  deleteFromServer: async (token) => {
    await trpc.keys.deleteFlowerPot.mutate({ token });
  },
});
```

---

### `validateKey(key)` → `boolean`

Pure function. Checks:

1. Key has not expired
2. Scope has at least one namespace
3. Every scoped namespace has key material present
4. At least one of `read` or `write` is true

```ts
import { validateKey } from "@meerkat/keys";

if (!validateKey(storedKey)) {
  // Key is expired or invalid — prompt visitor to get a new one
}
```

---

### `generateDenNamespaceKeys()` → `Promise<SerializedNamespaceKeySet>`

One-time setup when creating a den. Generates all four namespace keys and returns them serialized (base64url). Store the result in `private.ydoc` settings (encrypted with the device key).

```ts
import { generateDenNamespaceKeys } from "@meerkat/keys";

// Called once when the user's den is first created
const allKeys = await generateDenNamespaceKeys();
// Persist in private.ydoc settings under 'namespaceKeys'
```

---

## React hooks

### `useGenerateKey()`

```tsx
import { useGenerateKey } from "@meerkat/keys";

function KeyModal({ denId, allNamespaceKeys }) {
  const { generate, isGenerating, error } = useGenerateKey();
  const [token, setToken] = useState<string | null>(null);

  const handleCreate = async () => {
    const { token } = await generate(
      { keyType: "come-over", denId, allNamespaceKeys },
      {
        visitorPublicKey: visitor.publicKey,
        depositOnServer: (pot) => trpc.keys.createFlowerPot.mutate(pot),
      },
    );
    setToken(token);
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isGenerating}>
        {isGenerating ? "Creating…" : "Generate key"}
      </button>
      {token && <p>Share: /join/{token}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### `useRedeemKey()`

```tsx
import { useRedeemKey } from "@meerkat/keys";

function JoinPage({ token }) {
  const { redeem, isRedeeming, redeemedKey, error } = useRedeemKey();

  const handleRedeem = () =>
    redeem({
      token,
      visitorSecretKey: myKeyPair.secretKey,
      fetchFromServer: (t) => trpc.keys.getFlowerPot.query({ token: t }),
    });

  if (redeemedKey) return <p>You're in! Connecting to den…</p>;

  return (
    <button onClick={handleRedeem} disabled={isRedeeming}>
      {isRedeeming ? "Redeeming…" : "Enter den"}
    </button>
  );
}
```

### `useStoredKeys()`

```tsx
import { useStoredKeys } from "@meerkat/keys";

function VisitorKeyList() {
  const { validKeys, expiredKeys, removeKey } = useStoredKeys();

  return (
    <ul>
      {validKeys.map(({ key, token }) => (
        <li key={key.keyId}>
          {key.label} — {key.denId}
          <button onClick={() => removeKey(key.keyId)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## Architecture

```
@meerkat/keys
├── generateKey()               ← pure, no I/O
├── depositKey()                ← seals + calls caller's uploadFn
├── revokeKey()                 ← calls caller's deleteFn
├── redeemKey()                 ← calls caller's fetchFn + decrypts
├── validateKey()               ← pure, no I/O
├── generateDenNamespaceKeys()  ← one-time den setup
│
├── lib/
│   ├── keys.ts     ← all above functions
│   └── presets.ts  ← KEY_PRESETS constant + defaultLabel()
│
├── hooks.ts        ← useGenerateKey, useRevokeKey, useRedeemKey,
│                      useStoredKeys, useValidateKey
│
└── types.ts        ← KeyType, KeyScope, DenKey, StoredDenKey, ...
```

### Dependencies

| Package           | Used for                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| `@meerkat/crypto` | `encryptBundle()` + `decryptBundle()` (NaCl box), `generateNamespaceKeySet()` |
| `@meerkat/types`  | Shared domain types                                                           |

**No Supabase dependency.** All server interactions are caller-provided functions — this keeps the package testable and the server boundary explicit.

---

## Security properties

- **Server blindness** — The server stores `encryptedBundle` as opaque bytes. Without the visitor's secret key, it cannot read the DenKey, scope, or namespace key material.
- **Namespace isolation** — Each key only includes bytes for its granted namespaces. A Letterbox visitor physically cannot decrypt `sharedNotes` content because they don't have the key.
- **Per-message forward secrecy** — `encryptBundle` in `@meerkat/crypto` generates a fresh ephemeral keypair per seal. Compromising one visitor's secret key doesn't expose other bundles.
- **Expiry enforcement** — `validateKey()` is checked on both sides: at redemption time and at P2P session initiation (Phase 4).
