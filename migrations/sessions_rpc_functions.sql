-- Functions to safely expose auth.sessions data without direct schema access
-- These run as SECURITY DEFINER so the service_role key can call them via RPC

-- List all sessions for a given user
CREATE OR REPLACE FUNCTION public.get_user_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text,
  not_after timestamptz
)
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE sql
AS $$
  SELECT
    s.id,
    s.created_at,
    s.updated_at,
    s.user_agent,
    s.ip::text,
    s.not_after
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
    AND (s.not_after IS NULL OR s.not_after > NOW())
  ORDER BY s.updated_at DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_user_sessions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_sessions TO service_role;

-- Delete a specific session (scoped to owner so a user can only revoke their own)
CREATE OR REPLACE FUNCTION public.delete_user_session(p_session_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE sql
AS $$
  DELETE FROM auth.sessions
  WHERE id = p_session_id AND user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.delete_user_session FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_session TO service_role;
