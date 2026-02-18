-- RPC to atomically update last_active_at and increment total_sessions
CREATE OR REPLACE FUNCTION public.increment_activity(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_active_at = now(),
    total_sessions = COALESCE(total_sessions, 0) + 1
  WHERE id = p_user_id;
END;
$$;
