# Migration Strategy: web vs web-v2

**Date**: 2026-02-24
**Context**: Evaluating whether to create a separate `web-v2` app or migrate the existing `web` app

---

## Current State Analysis

### Existing Web App Architecture

```
apps/web (Current - Phase 2 architecture)
├── Uses Supabase for content storage (not local-first yet)
├── Uses Supabase Realtime for presence
├── Hooks:
│   ├── useDenMessages() → queries Supabase messages table
│   └── useDenPresence() → subscribes to Supabase Realtime presence
└── Components:
    ├── DenPageClient → uses legacy hooks
    ├── ChatArea → renders messages from Supabase
    └── VoiceNoteRecorder → uploads to Supabase Storage
```

**Key Findings**:

- ✅ Already using `@meerkat/ui`, `@meerkat/utils`, `@meerkat/config`
- ❌ **NOT** using `@meerkat/crdt`, `@meerkat/local-store`, or `@meerkat/p2p`
- ❌ Content is stored in **Supabase Postgres**, not IndexedDB
- ❌ Uses **Supabase Realtime** for presence, not P2P WebRTC
- ✅ Auth and Storage infrastructure already in place

### What Needs to Change

| Component           | Current                                 | Target (Local-First)                             |
| ------------------- | --------------------------------------- | ------------------------------------------------ |
| **Content Storage** | Supabase `messages` table               | IndexedDB via `@meerkat/local-store`             |
| **Real-time Sync**  | Supabase Realtime subscriptions         | WebRTC P2P via `@meerkat/p2p`                    |
| **Presence**        | Supabase Presence API                   | Yjs `shared.ydoc.presence` via P2P               |
| **Notes**           | Supabase `messages` (text)              | `private.ydoc.notes` + `shared.ydoc.sharedNotes` |
| **Voice Memos**     | Supabase Storage refs                   | `private.ydoc.voiceMemos` + encrypted blobs      |
| **Den State Hook**  | `useDenMessages()` + `useDenPresence()` | `useDen()` from `@meerkat/crdt`                  |
| **Data Model**      | Server-centric                          | **Local-first** (offline-capable)                |

---

## Strategy Options

### Option 1: In-Place Migration (Recommended ✅)

**Approach**: Migrate the existing `apps/web` incrementally to use the new local-first packages.

#### Migration Path

```
Phase 1: Foundation (1-2 days)
├── Add DenProvider to app/dens/[id]/page.tsx
├── Create new components alongside old ones
└── Feature flag: toggle between old/new implementation

Phase 2: Component Migration (2-3 days)
├── Replace DenPageClient with new DenPageClientV2
├── Replace useDenMessages with useDen from @meerkat/crdt
├── Replace useDenPresence with DenState.visitors
└── Test in parallel with old implementation

Phase 3: Voice Integration (1-2 days)
├── Wire @meerkat/voice into voice recorder
├── Test on-device analysis
└── Verify encrypted upload still works

Phase 4: P2P Activation (1-2 days)
├── Add initP2P() call in app/layout.tsx
├── Create SyncStatusBadge component
├── Create VisitorPresenceList component
└── Test multi-device sync

Phase 5: Data Migration (1-2 days)
├── Write migration script: Supabase → IndexedDB
├── One-time import on first load
└── Deprecate old Supabase tables

Phase 6: Cleanup (1 day)
├── Remove legacy hooks
├── Remove old components
└── Update all imports
```

#### Pros ✅

- **No duplicate code** — single source of truth
- **Gradual migration** — ship incrementally, less risk
- **Preserve git history** — all commits stay in one place
- **No routing complexity** — same URLs, same auth
- **Easier to test** — feature flags allow A/B comparison
- **Simpler deployment** — one Vercel project
- **No user confusion** — no "v1 vs v2" choice

#### Cons ⚠️

- **Coordination overhead** — can't break existing features during migration
- **Temporary code bloat** — both old and new code live side-by-side during migration
- **Rollback complexity** — if something breaks, need feature flags to revert

---

### Option 2: Separate web-v2 App

**Approach**: Create a new `apps/web-v2` app from scratch with the local-first architecture.

#### Structure

```
apps/
├── web/          # Old app (Phase 1-2 architecture)
│   ├── Supabase-centric
│   └── Stable, no changes
│
└── web-v2/       # New app (Phase 4 architecture)
    ├── @meerkat/crdt
    ├── @meerkat/p2p
    └── Local-first from day 1
```

#### Deployment Options

**Option 2A: Separate Domains**

- `meerkat.app` → old web app
- `v2.meerkat.app` or `beta.meerkat.app` → new app
- Users manually opt-in to beta

**Option 2B: Single Domain with Routing**

- `meerkat.app` → old app (default)
- `meerkat.app?beta=true` → new app
- Middleware routes based on query param or cookie

#### Pros ✅

- **Clean slate** — no legacy code to navigate
- **Parallel development** — both apps evolve independently
- **Easy rollback** — just point DNS back to old app
- **Testing isolation** — can break v2 without affecting v1
- **Learning opportunity** — rebuild with best practices from scratch
- **Beta program** — invite users to try new version

#### Cons ❌

- **Code duplication** — auth, settings, layouts duplicated
- **Maintenance burden** — fix bugs in two places during transition
- **Data migration complexity** — users need to export/import between apps
- **User confusion** — "Which version should I use?"
- **Split testing** — harder to compare metrics across versions
- **Double deployment** — two Vercel projects, two domains
- **Authentication complexity** — share session or separate login?
- **Wasted effort** — eventually delete `web` entirely, throwaway work

---

## Recommendation: **Option 1 (In-Place Migration)** ✅

### Why In-Place is Better

1. **Your current web app is small** (14 routes, ~10 components)
   - Migration is manageable, not overwhelming
   - Less code to migrate = lower risk

2. **No production users yet**
   - No risk of breaking existing workflows
   - Can afford brief downtime during migration
   - Feature flags work great for internal testing

3. **Architecture is already set up**
   - Supabase auth ✅
   - Supabase Storage ✅
   - Next.js 14 ✅
   - TailwindCSS ✅
   - Just need to swap data layer

4. **The packages are ready**
   - `@meerkat/crdt` ✅
   - `@meerkat/p2p` ✅
   - `@meerkat/voice` ✅
   - `@meerkat/analyzer` ✅
   - Just need to wire them into UI

5. **git history is valuable**
   - All your design decisions are documented
   - Issues/bugs already tracked in same repo
   - Contributors know the codebase

6. **Simpler for users**
   - No "v1 vs v2" confusion
   - Same URLs, same bookmarks
   - Seamless transition

### When web-v2 Makes Sense

You'd want a separate app if:

- ❌ Existing app has 100k+ users (not your case)
- ❌ Codebase is 100k+ lines (not your case)
- ❌ Migration would take 6+ months (not your case)
- ❌ Major architectural differences like framework change React → Svelte (not your case)
- ❌ Need to support both versions long-term (not your case)

**None of these apply to Meerkat.**

---

## Implementation Plan (Recommended)

### Phase 0: Preparation (Day 1)

```bash
# 1. Create a feature branch
git checkout -b feat/local-first-migration

# 2. Add feature flag system
# Create lib/feature-flags.ts:

export const FLAGS = {
  USE_LOCAL_FIRST: process.env.NEXT_PUBLIC_USE_LOCAL_FIRST === 'true',
} as const;

# 3. Add to .env.local:
NEXT_PUBLIC_USE_LOCAL_FIRST=true  # toggle on/off
```

### Phase 1: Parallel Implementation (Days 2-3)

**Goal**: New components work alongside old ones

```typescript
// app/dens/[id]/page.tsx (Server Component - no changes)
import { FLAGS } from '@/lib/feature-flags';
import { DenPageClient } from '@/components/den-page-client';
import { DenPageClientV2 } from '@/components/den-page-client-v2';  // NEW

export default async function DenPage({ params }: DenPageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Old path: fetch den from Supabase
  const { data: den } = await supabase
    .from('dens')
    .select('*')
    .eq('id', params.id)
    .single();

  // Render based on feature flag
  if (FLAGS.USE_LOCAL_FIRST) {
    return <DenPageClientV2 denId={params.id} userId={user.id} />;
  }

  return <DenPageClient den={den} currentUserId={user.id} ... />;
}
```

**Create new component** (`components/den-page-client-v2.tsx`):

```typescript
'use client';

import { DenProvider, useDenContext } from '@meerkat/crdt';
import { initP2P } from '@meerkat/p2p';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

// Initialize P2P once
initP2P({
  createSignalingChannel: (name) => createClient().channel(name),
});

export function DenPageClientV2({ denId, userId }: { denId: string; userId: string }) {
  return (
    <DenProvider denId={denId}>
      <DenPageInner userId={userId} />
    </DenProvider>
  );
}

function DenPageInner({ userId }: { userId: string }) {
  const { notes, voiceMemos, shared, visitors, syncStatus, actions } = useDenContext();

  return (
    <div>
      <SyncStatusBadge status={syncStatus} />
      {syncStatus === 'hosting' && <VisitorList visitors={visitors} />}
      <ChatArea notes={notes} voiceMemos={voiceMemos} />
      <Fab onCreate={() => actions.createNote({ content: '', tags: [] })} />
    </div>
  );
}
```

### Phase 2: Voice Integration (Day 4)

**Update VoiceNoteRecorder** to use `@meerkat/voice`:

```typescript
import { useVoiceRecorder } from "@meerkat/voice";
import { useDenContext } from "@meerkat/crdt";

export function VoiceNoteRecorder() {
  const { actions } = useDenContext();
  const { phase, seconds, audioUrl, start, stop, save } = useVoiceRecorder();

  const handleSave = async () => {
    await save(denId, encryptionKey, async (data, iv) => {
      // Upload encrypted blob to Supabase Storage
      const { blobRef } = await trpc.voice.upload.mutate({ data, iv });
      return blobRef;
    });
  };

  // ... rest of component
}
```

### Phase 3: Data Migration (Days 5-6)

**Write migration hook** (`hooks/use-migration.ts`):

```typescript
export function useMigration(userId: string) {
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    const key = `meerkat:migrated:${userId}`;
    if (localStorage.getItem(key)) {
      setMigrated(true);
      return;
    }

    async function migrate() {
      // 1. Fetch all messages from Supabase
      const messages = await fetchAllMessages(userId);

      // 2. Write to IndexedDB via @meerkat/local-store
      for (const msg of messages) {
        if (msg.type === "text") {
          await createNote(userId, {
            content: msg.content,
            createdAt: msg.created_at,
          });
        } else if (msg.type === "voice") {
          await addVoiceMemo(userId, msg.voice_url, msg.voice_duration);
        }
      }

      // 3. Mark as migrated
      localStorage.setItem(key, "true");
      setMigrated(true);
    }

    migrate();
  }, [userId]);

  return { migrated };
}
```

### Phase 4: Cleanup (Day 7)

```bash
# 1. Remove old components
rm apps/web/components/den-page-client.tsx
rm apps/web/hooks/use-den-messages.ts
rm apps/web/hooks/use-den-presence.ts

# 2. Rename V2 components to canonical names
mv components/den-page-client-v2.tsx components/den-page-client.tsx

# 3. Remove feature flags
# Delete lib/feature-flags.ts
# Remove all FLAGS checks

# 4. Update imports everywhere
# Search/replace: DenPageClientV2 → DenPageClient

# 5. Ship it!
git commit -m "feat: migrate to local-first architecture"
git push origin feat/local-first-migration
# Create PR, merge to main, deploy
```

---

## Testing Strategy

### Unit Tests

```bash
# Test new components in isolation
pnpm --filter @meerkat/web test components/den-page-client-v2.test.tsx
```

### Integration Tests

```typescript
// Test old vs new side-by-side
describe('Feature flag migration', () => {
  it('renders DenPageClient when USE_LOCAL_FIRST=false', () => {
    process.env.NEXT_PUBLIC_USE_LOCAL_FIRST = 'false';
    render(<DenPage params={{ id: 'test' }} />);
    expect(screen.getByTestId('den-page-client')).toBeInTheDocument();
  });

  it('renders DenPageClientV2 when USE_LOCAL_FIRST=true', () => {
    process.env.NEXT_PUBLIC_USE_LOCAL_FIRST = 'true';
    render(<DenPage params={{ id: 'test' }} />);
    expect(screen.getByTestId('den-page-client-v2')).toBeInTheDocument();
  });
});
```

### Manual Testing Checklist

- [ ] Create a note in old UI → see it in new UI
- [ ] Record voice memo in new UI → verify on-device analysis works
- [ ] Open den on two devices → verify P2P sync works
- [ ] Go offline → verify app still works (read cached content)
- [ ] Toggle feature flag → both UIs work without errors

---

## Rollback Plan

If something goes wrong:

```bash
# Option 1: Feature flag (instant)
# Set .env.local:
NEXT_PUBLIC_USE_LOCAL_FIRST=false

# Option 2: Git revert (5 minutes)
git revert <commit-hash>
git push origin main
vercel --prod  # redeploy

# Option 3: Vercel rollback (instant)
# Go to Vercel dashboard → Deployments → Rollback to previous
```

---

## Risk Assessment

| Risk                       | Likelihood | Impact | Mitigation                                                    |
| -------------------------- | ---------- | ------ | ------------------------------------------------------------- |
| Data loss during migration | Low        | High   | Backup Supabase before migrating; keep old tables for 30 days |
| P2P connection failures    | Medium     | Medium | Graceful fallback to offline mode; TURN server for NAT        |
| Performance regression     | Low        | Medium | IndexedDB faster than network; Yjs observers efficient        |
| User confusion             | Low        | Low    | No UI changes during migration; same flows                    |
| Bugs in new components     | Medium     | Medium | Feature flags allow instant rollback                          |

**Overall Risk**: **Low-Medium** ✅
**Migration Complexity**: **Medium** (7 days)
**Maintenance Burden**: **Low** (single codebase)

---

## Alternative: Hybrid Approach (Not Recommended)

You could do a **partial migration**:

- Keep Supabase for non-real-time data (settings, account)
- Use local-first only for notes and voice memos
- Use P2P only when both users are online, fallback to Supabase

**Why not?**

- Complexity: now you have THREE data sources (Supabase, IndexedDB, P2P)
- Sync conflicts: which is source of truth?
- User confusion: "Why does it work offline sometimes but not always?"
- More code: need to manage fallbacks, retries, etc.

**Better**: Go full local-first. It's simpler and more robust.

---

## Timeline Estimate

| Phase                   | Duration     | Blockers                                       |
| ----------------------- | ------------ | ---------------------------------------------- |
| Preparation             | 1 day        | None                                           |
| Parallel Implementation | 2 days       | Need to understand current component structure |
| Voice Integration       | 1 day        | None (@meerkat/voice ready)                    |
| P2P Activation          | 1 day        | Test with real WebRTC on different networks    |
| Data Migration          | 2 days       | Write migration script, test thoroughly        |
| Cleanup                 | 1 day        | None                                           |
| **Total**               | **7-8 days** | -                                              |

**Estimated completion**: **1-2 weeks** (with testing and polish)

---

## Conclusion

**Recommendation**: **Option 1 (In-Place Migration)** ✅

### Why?

1. ✅ Your app is small enough to migrate in 1-2 weeks
2. ✅ No production users to disrupt
3. ✅ Feature flags make it safe and reversible
4. ✅ Avoids all the complexity of maintaining two apps
5. ✅ Simpler for users, simpler for you

### Next Steps

1. **Create feature flag system** (30 minutes)
2. **Add `initP2P()` to layout.tsx** (5 minutes)
3. **Create DenPageClientV2** (2 hours)
4. **Test side-by-side with feature flag** (1 day)
5. **Migrate component by component** (1 week)
6. **Remove old code** (1 day)
7. **Ship to production** 🚀

**Start with**: `git checkout -b feat/local-first-migration`

---

**Generated with Claude Code** 🤖
