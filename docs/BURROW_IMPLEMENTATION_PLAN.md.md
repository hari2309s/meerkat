Burrow & Editor Implementation Plan
## Overview
Add block-based editor and burrow (page) system to Meerkat, integrating with existing P2P sync and local-first architecture.
---
## Terminology
- **Den** = Workspace (existing ✅)
- **Burrow** = Page/Document (NEW)
- **Tunnel** = Content block (optional term for blocks)
---
## Package Structure
```
packages/
├── burrow-editor/ # NEW - Block-based content editor
├── burrows/ # NEW - Burrow (page) management
├── crypto/ # EXISTING ✅
├── local-store/ # EXISTING ✅
├── crdt/ # EXISTING ✅ (minor updates needed)
├── voice/ # EXISTING ✅
├── types/ # EXISTING ✅ (add burrow types)
└── ui/ # EXISTING ✅
```
---
## Week 1: Build Editor Package
### Goal
Create collaborative block-based editor using Tiptap + Yjs
### Steps
1.
**Setup package structure**
- Create
`
packages/burrow-editor/` directory
- Initialize with `
pnpm init`
- Create folders:
`
src/{extensions,components,hooks,types}`
2.
**Install dependencies**
- Tiptap core and extensions:
collaboration-cursor
`
`@tiptap/react`
,
`@tiptap/starter-kit`
,
`@tiptap/extension-collaboration
`
,
`@tiptap/extension-
- Additional:
`@tiptap/extension-image
`
,
`@tiptap/extension-placeholder
`
,
- Utilities:
`
yjs
`
,
`tippy.js
`
`@tiptap/suggestion
`
3.
**Create base editor component**
- Main
`BurrowEditor
`
component that wraps Tiptap
- Configure Yjs collaboration
- Add collaboration cursors (show other users)
- Add placeholder text
- Handle auto-save on updates
4.
**Build custom block extensions**
- **VoiceBlock**: Custom Tiptap node for voice messages
- Attributes: audioUrl, duration, mood, moodScore, transcript
- ReactNodeView wrapper
- Reuse existing
`@meerkat/voice
`
player component
- **ImageBlock**: Custom Tiptap node for images
- Attributes: src, alt, caption
- ReactNodeView wrapper
- Integrate with existing image upload
5.
**Add slash commands**
- Create
`SlashCommands
`
extension using Tiptap Suggestion
- Menu items: Heading 1-3, Bullet List, Numbered List, Voice Note, Image
- Render floating menu with Tippy.js
- Handle keyboard navigation (arrow keys, enter)
6.
**Export package**
- Main exports:
`BurrowEditor
`
,
`VoiceBlock`
,
`ImageBlock`
,
- Configure
`
package.json
`
with proper dependencies
`SlashCommands
`
---
## Week 2: Build Burrows Package
### Goal
Create burrow (page) management with CRUD operations
### Steps
1.
**Setup package structure**
- Create
`
packages/burrows/` directory
- Initialize with `
pnpm init`
- Create folders:
`
src/{hooks,store,types}`
2.
**Install dependencies**
- State management:
`
zustand`
- Utilities:
`
uuid` for ID generation
- CRDT:
`
yjs
`
with `immer
`
middleware
3.
-
-
**Define TypeScript types**
`Burrow
` interface: id, denId, title, icon, yjsDocId, timestamps, createdBy, archived, collaborators
`BurrowMetadata
` interface: wordCount, lastEditedBy, hasVoiceNotes, hasImages
4.
**Create Zustand store**
- Store structure: Map of burrows, currentBurrowId
- Actions:
-
`
addBurrow
`
: Add new burrow to map
-
-
-
`
updateBurrow
`
: Update burrow properties
`deleteBurrow
`
: Remove from map
`
archiveBurrow
`
: Soft delete
-
`
setCurrentBurrow
`
: Track active burrow
`
-
getBurrowsByDen
`
: Filter by den ID
`
-
getBurrow
`
: Get single burrow
- Use
`
persist`
middleware to save to localStorage
- Use
`immer
` for immutable updates
5.
-
-
-
-
**Create React hooks**
`
useBurrows(denId)`
: Get all burrows for a den
`
useBurrow(burrowId)`
: Get single burrow
`
useCreateBurrow()`
: Create new burrow
- Generate UUID
- Create Yjs document
- Save to IndexedDB (integrate with existing
- Add to Zustand store
`
useBurrowDoc(yjsDocId)`
: Load Yjs document
- Load from IndexedDB
- Set up auto-save listener
- Return doc and loading state
`@meerkat/local-store
`)
6.
**Export package**
- Export all types, store, and hooks
- Configure
`
package.json
`
---
## Week 3: Web App Integration
### Goal
Add UI pages and integrate with existing infrastructure
### Steps
1.
**Update workspace config**
- Add new packages to
`
pnpm-workspace.yaml`
- Install packages in web app:
`
pnpm add @meerkat/burrow-editor @meerkat/burrows
`
2.
**Create Den Interior page**
- Route:
`
apps/web/app/(authenticated)/dens/[denId]/page.tsx
`
- Features:
- List all burrows in den
-
"Dig new burrow" button
- Empty state with meerkat illustration
- Burrow cards showing: title, icon, last updated, word count
- Click card to open burrow editor
3.
**Create Burrow Editor page**
- Route:
`
apps/web/app/(authenticated)/dens/[denId]/burrows/[burrowId]/page.tsx
`
- Features:
- Editable title input at top
- Integration with `BurrowEditor
`
component
- Pass Yjs doc from
`
useBurrowDoc
` hook
- Pass P2P provider from existing
`@meerkat/sync
`
- Auto-save indicator
- Back button to den
- Collaboration UI (show online users)
4.
**Integrate P2P sync**
- Connect editor to existing P2P provider
- Pass provider to Tiptap CollaborationCursor extension
- Ensure Yjs updates sync via existing WebRTC/TURN infrastructure
5.
**Integrate voice/image uploads**
- Listen for slash command events
- Trigger existing voice recorder modal
- Trigger existing image picker
- Insert blocks into editor after upload
- Reuse existing
`@meerkat/voice
`
and upload logic
6.
**Polish UI**
- Loading skeletons while doc loads
- Error boundaries
- Empty states
- Animations and transitions
- Mobile responsiveness
- Dark mode styling (match existing theme)
---
## Integration Points with Existing Code
### 1. Local Storage (`@meerkat/local-store
`)
- Burrows package calls existing
`
saveYjsDoc()`
- No changes needed to local-store package
- Just ensure API is exposed globally or via proper imports
and `loadYjsDoc()` functions
### 2. P2P Sync (`@meerkat/sync
`
or existing P2P code)
- Pass existing P2P provider to editor
- Provider handles WebRTC connections and TURN fallback
- No changes needed to sync infrastructure
- Yjs automatically syncs through provider
### 3. Voice Recording (`@meerkat/voice
`)
- Slash command triggers existing voice recorder
- After recording, insert VoiceBlock with audioUrl
- VoiceBlock component wraps existing voice player
- No changes to voice package needed
### 4. Image/File Upload (existing upload logic)
- Slash command triggers existing image picker
- After upload, insert ImageBlock with URL
- Use existing upload/encryption flow
- No changes to upload logic needed
### 5. Auth (existing auth system)
- Get current user ID from existing auth context
- Use for
`
createdBy
` field in burrows
- Use for collaboration cursor name/color
---
## Testing Checklist
### Week 1 Testing
- [ ] Editor renders correctly
- [ ] Can type text
- [ ] Bold, italic, headings work
- [ ] Slash commands appear
- [ ] Can insert voice block
- [ ] Can insert image block
- [ ] Yjs sync works between two tabs
### Week 2 Testing
- [ ] Can create burrow
- [ ] Burrow saves to store
- [ ] Yjs doc saves to IndexedDB
- [ ] Can load existing burrow
- [ ] Can update burrow title
- [ ] Can delete/archive burrow
### Week 3 Testing
- [ ] Den page shows burrows list
- [ ] Create button works
- [ ] Editor page loads
- [ ] Title editing works
- [ ] Content saves automatically
- [ ] P2P sync works with other users
- [ ] Voice recording inserts correctly
- [ ] Image upload inserts correctly
- [ ] Back navigation works
- [ ] Works oﬄine (queues sync)
---
## Success Criteria
By end of Week 3, users should be able to:
1. ✅ Click into a den
2. ✅ See list of burrows (or empty state)
3. ✅ Create a new burrow
4. ✅ Edit burrow title
5. ✅ Type text content
6. ✅ Use slash commands to add headings, lists
7. ✅ Record and insert voice notes
8. ✅ Upload and insert images
9. ✅ See other users editing in real-time (if P2P connected)
10. ✅ Have content auto-save locally
11. ✅ Navigate back to den list
12. ✅ See burrows persist across sessions
---
## Timeline Summary
- **Week 1**: Editor package (5 days)
- **Week 2**: Burrows package (5 days)
- **Week 3**: Web integration + polish (5 days)
- **Total**: 3 weeks to functional implementation
---
## Next Steps After Implementation
Once core editor/burrows are working:
1. Add search within burrows
2. Add burrow templates
3. Add export (PDF, Markdown)
4. Add burrow sharing/permissions
5. Add version history
6. Improve oﬄine queue handling
7. Add burrow analytics (word count, read time)
8. Add burrow tags/categories