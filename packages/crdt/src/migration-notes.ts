/**
 * @meerkat/crdt — migration notes
 *
 * This file documents what was in the OLD @meerkat/crdt package and exactly
 * what replaced each piece. It is not compiled — it's a reference for the
 * team during Phase 1.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REMOVED: Supabase Realtime subscriptions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD (den-page-client.tsx or old crdt package):
 *
 *   const channel = supabase
 *     .channel(`den:${denId}`)
 *     .on('postgres_changes', {
 *       event: '*',
 *       schema: 'public',
 *       table: 'messages',
 *       filter: `den_id=eq.${denId}`,
 *     }, (payload) => {
 *       // update state from Supabase row...
 *     })
 *     .subscribe();
 *
 *   return () => supabase.removeChannel(channel);
 *
 * NEW: Zero Supabase Realtime calls for content.
 * Content is read from Yjs (IndexedDB) via Yjs observers:
 *
 *   privateDen.notes.observe(readNotes);
 *   sharedDen.sharedNotes.observe(readShared);
 *   // etc.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REMOVED: useDenMessages() Supabase query hook
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD (use-den-messages.ts):
 *
 *   export function useDenMessages(denId: string) {
 *     return useQuery({
 *       queryKey: ['den-messages', denId],
 *       queryFn: () =>
 *         supabase
 *           .from('messages')
 *           .select('*')
 *           .eq('den_id', denId)
 *           .order('created_at', { ascending: false }),
 *     });
 *   }
 *
 * NEW: Notes come from useDen().notes, which is a live NoteData[] from Yjs.
 * Zero network calls for reads. Works offline.
 *
 *   const { notes } = useDen(denId);  // ← from @meerkat/crdt
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REMOVED: useDenPresence() Supabase Presence hook
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD (use-den-presence.ts):
 *
 *   export function useDenPresence(denId: string) {
 *     const [presences, setPresences] = useState([]);
 *     useEffect(() => {
 *       const channel = supabase.channel(`presence:${denId}`)
 *         .on('presence', { event: 'sync' }, () => {
 *           setPresences(Object.values(channel.presenceState()));
 *         })
 *         .subscribe(async (status) => {
 *           if (status === 'SUBSCRIBED') {
 *             await channel.track({ user_id: userId, ... });
 *           }
 *         });
 *       return () => supabase.removeChannel(channel);
 *     }, [denId]);
 *     return presences;
 *   }
 *
 * NEW: Visitor presence comes from useDen().visitors, which reads the
 * ephemeral presence namespace in shared.ydoc. This namespace is written by
 * @meerkat/p2p when visitors connect over WebRTC.
 *
 *   const { visitors } = useDen(denId);  // ← from @meerkat/crdt
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REMOVED: Old thin Yjs wrapper in crdt package
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD: @meerkat/crdt exported a useYDoc() hook that returned a single
 * undifferentiated Y.Doc and left the consumer to manage namespaces.
 *
 * NEW: @meerkat/crdt exports useDen() which returns fully-typed, hydrated
 * content arrays (NoteData[], VoiceMemoData[], etc.) — no Y.Doc handling
 * in components.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRATION: den-page-client.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD den-page-client.tsx:
 *
 *   import { useDenMessages } from '~/hooks/use-den-messages';
 *   import { useDenPresence } from '~/hooks/use-den-presence';
 *
 *   export function DenPageClient({ denId }) {
 *     const { data: messages } = useDenMessages(denId);
 *     const presences = useDenPresence(denId);
 *     // ...render...
 *   }
 *
 * NEW den-page-client.tsx:
 *
 *   import { DenProvider, useDenContext } from '@meerkat/crdt';
 *
 *   // Option A — context pattern (recommended for page-level):
 *   export function DenPageClient({ denId }) {
 *     return (
 *       <DenProvider denId={denId}>
 *         <DenPageInner />
 *       </DenProvider>
 *     );
 *   }
 *
 *   function DenPageInner() {
 *     const { notes, visitors, syncStatus, actions } = useDenContext();
 *     // notes is NoteData[], visitors is PresenceInfo[]
 *   }
 *
 *   // Option B — hook-only (for simpler components):
 *   export function DenPageClient({ denId }) {
 *     const { notes, visitors, syncStatus, actions } = useDen(denId);
 *     // works identically to Option A
 *   }
 */

export {}; // Make this a module so it doesn't pollute the global namespace
