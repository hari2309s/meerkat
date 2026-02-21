-- Note: The issue where signing out of one device signed out of all devices
-- was a bug in the Meerkat frontend/API code sending `supabase.auth.signOut()`,
-- which defaults to `scope: "global"` (all devices) if you don't pass `scope: "local"`.
-- We have already fixed that frontend bug.
--
-- However, if there are duplicate or corrupted session rows leftover in your
-- `auth.sessions` table from before the fix, they can cause ghost sessions.
-- This script cleans up any expired/stale rows for hygiene.

DELETE FROM auth.sessions
WHERE not_after IS NOT NULL AND not_after < NOW();
