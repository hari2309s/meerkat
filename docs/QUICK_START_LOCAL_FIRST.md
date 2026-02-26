# Quick Start: Local-First Architecture

**5-Minute Guide to Testing the New Architecture**

---

## 🚀 Enable Local-First Mode

### Option 1: Environment Variables (Recommended)

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_FF_LOCAL_FIRST=true
NEXT_PUBLIC_FF_P2P_SYNC=true
NEXT_PUBLIC_FF_NEW_UI=true
NEXT_PUBLIC_FF_VOICE_ANALYSIS=true
```

Restart dev server:

```bash
pnpm dev
```

### Option 2: Browser Console (Quick Test)

1. Open the app in your browser
2. Open DevTools Console (F12)
3. Run:

```javascript
localStorage.setItem(
  "meerkat:feature-flags",
  JSON.stringify({
    localFirstStorage: true,
    p2pSync: true,
    newUI: true,
    voiceAnalysis: true,
    encryption: true,
  }),
);
location.reload();
```

---

## 🧪 Test the New Features

### 1. Verify Feature Flags Are Active

Open browser console and check:

```javascript
localStorage.getItem("meerkat:feature-flags");
// Should show: {"localFirstStorage":true,"p2pSync":true,...}
```

### 2. Test Local-First Storage

1. Navigate to a den
2. Create a note
3. Open DevTools → Application → IndexedDB
4. Look for database: `meerkat-den-{denId}`
5. Verify your note is stored locally

### 3. Test Offline Mode

1. Open a den
2. Open DevTools → Network tab
3. Set throttling to "Offline"
4. Try creating/editing notes - should still work!
5. Changes are saved to IndexedDB
6. Go back online - changes will sync

### 4. Test New UI Components

In a den, you should see:

**Sync Status Badge** (in den header):

- 🔴 Offline
- 🟡 Connecting
- 🟢 Synced
- 🔵 Hosting (+ visitor count)

**Visitor Presence List** (below header):

- Shows connected P2P visitors
- Displays connection time
- Shows read/write permissions

### 5. Test P2P Sync (Requires Two Devices/Windows)

**Device 1 (Host)**:

1. Open a den
2. Look for sync status badge showing "Hosting"
3. Share the den link

**Device 2 (Visitor)**:

1. Open the shared link
2. Should show "Connecting" → "Synced"
3. Try editing - changes should appear on both devices in real-time

---

## 🔍 Verify It's Working

### Check IndexedDB

```javascript
// Open console in den page
indexedDB.databases().then((dbs) => console.log(dbs));
// Should show: meerkat-den-{denId}
```

### Check CRDT Context

```javascript
// In den page, check React DevTools
// Look for: DenContext.Provider
// Should have: notes, voiceMemos, syncStatus, visitors
```

### Check Sync Status

```javascript
// In den page console
window.__DEBUG_SYNC_STATUS__;
// Should show: "offline" | "connecting" | "synced" | "hosting"
```

---

## 🐛 Troubleshooting

### Feature Flags Not Working

**Problem**: Changes not taking effect

**Solution**:

```javascript
// Clear and reset
localStorage.clear();
location.reload();
// Then set flags again
```

### IndexedDB Not Creating

**Problem**: No database in DevTools → Application → IndexedDB

**Solution**:

1. Check `localFirstStorage` flag is `true`
2. Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
3. Check browser console for errors
4. Try incognito mode (no extensions interfering)

### Sync Status Always "Offline"

**Problem**: Badge shows offline even when online

**Possible Causes**:

1. `p2pSync` flag not enabled
2. P2P adapter not initialized
3. WebRTC not supported in browser

**Solution**:

1. Enable `p2pSync` flag
2. Check console for P2P initialization messages
3. Try in Chrome/Edge (best WebRTC support)

### Notes Not Persisting

**Problem**: Notes disappear on refresh

**Solution**:

1. Verify `localFirstStorage: true`
2. Check IndexedDB permissions
3. Check browser storage quota
4. Try different browser/incognito

---

## 🔄 Switch Back to Legacy Mode

To disable and return to legacy architecture:

### Method 1: Environment

Remove/comment out from `.env.local`:

```bash
# NEXT_PUBLIC_FF_LOCAL_FIRST=true
```

### Method 2: Browser

```javascript
localStorage.removeItem("meerkat:feature-flags");
location.reload();
```

---

## 📊 Compare Modes

| Feature     | Legacy Mode              | Local-First Mode        |
| ----------- | ------------------------ | ----------------------- |
| **Storage** | Supabase Postgres        | IndexedDB + Yjs         |
| **Offline** | ❌ Requires connection   | ✅ Full offline support |
| **Sync**    | Supabase Realtime        | P2P WebRTC              |
| **Latency** | ~100-500ms               | ~10-50ms                |
| **Privacy** | Server sees data         | Device-only storage     |
| **Network** | Every action hits server | Only sync when needed   |

---

## 📝 Quick Commands

```bash
# Start dev server
pnpm dev

# Build all packages
pnpm build

# Type-check
pnpm type-check

# Run tests
pnpm test

# Clear all data (fresh start)
# In browser console:
indexedDB.deleteDatabase('meerkat-den-*');
localStorage.clear();
location.reload();
```

---

## 🎯 Key Differences to Notice

### Startup Time

- **Legacy**: Loads den data from server (~200-500ms)
- **Local-First**: Loads instantly from IndexedDB (~10-50ms)

### Offline Behavior

- **Legacy**: Shows error, blocks actions
- **Local-First**: Works normally, syncs when back online

### Real-Time Updates

- **Legacy**: Via Supabase Realtime (WebSocket to server)
- **Local-First**: Via P2P WebRTC (direct peer connection)

### UI Indicators

- **Legacy**: Loading spinners during actions
- **Local-First**: Instant updates, sync status badge

---

## ✅ Success Checklist

- [ ] Feature flags enabled
- [ ] Den opens and loads data
- [ ] IndexedDB database exists
- [ ] Notes created and persisted
- [ ] Offline mode works
- [ ] Sync status badge visible
- [ ] Visitor list appears (when visitors connect)
- [ ] No console errors
- [ ] Can switch back to legacy mode

---

## 🆘 Need Help?

1. Check [WEB_MIGRATION_COMPLETE.md](WEB_MIGRATION_COMPLETE.md) for full details
2. Review browser console for errors
3. Check React DevTools for component state
4. Inspect IndexedDB in DevTools → Application
5. Test in incognito mode (isolate extension issues)

---

## 🎉 You're Ready!

Once you've verified everything works:

1. Test thoroughly in development
2. Enable for internal team (dogfooding)
3. Gradual rollout to users
4. Monitor performance and feedback
5. Iterate and improve

**Happy testing!** 🚀
