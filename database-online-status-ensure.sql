-- =============================================
-- ONLINE STATUS: Setup/Repair (one-shot)
-- Run this on your NEW project (uxcsfevgygrzrmxhenth)
-- Safe to run multiple times (idempotent)
-- =============================================

-- 1) Core table (users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT false
);

-- 2) Disable RLS so anon key can upsert heartbeat
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3) Realtime configuration
ALTER TABLE public.users REPLICA IDENTITY FULL; -- send full row in updates
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 4) Indices
CREATE INDEX IF NOT EXISTS idx_users_is_online ON public.users(is_online);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen DESC);

-- 5) Cleanup function (marks stale users offline)
DROP FUNCTION IF EXISTS public.cleanup_offline_users();
CREATE OR REPLACE FUNCTION public.cleanup_offline_users()
RETURNS integer AS $$
DECLARE affected_rows integer; BEGIN
  UPDATE public.users
  SET is_online = false
  WHERE is_online = true
    AND last_seen < now() - interval '2 minutes';
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.cleanup_offline_users() TO anon, authenticated;

-- 6) Last seen info function used by the app
DROP FUNCTION IF EXISTS public.get_user_last_seen_info(uuid);
CREATE OR REPLACE FUNCTION public.get_user_last_seen_info(user_id uuid)
RETURNS TABLE(
  id uuid,
  username text,
  is_online boolean,
  last_seen_formatted text,
  last_seen_timestamp timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.is_online,
    CASE 
      WHEN u.is_online THEN 'online'
      WHEN u.last_seen > now() - interval '1 minute' THEN 'há menos de 1 minuto'
      WHEN u.last_seen > now() - interval '1 hour' THEN concat((extract(minute from now() - u.last_seen))::int, ' minutos atrás')
      WHEN u.last_seen > now() - interval '1 day' THEN concat((extract(hour from now() - u.last_seen))::int, ' horas atrás')
      ELSE concat((extract(day from now() - u.last_seen))::int, ' dias atrás')
    END,
    u.last_seen
  FROM public.users u
  WHERE u.id = user_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_user_last_seen_info(uuid) TO anon, authenticated;

-- 7) Seed the two fixed users (used by the app)
INSERT INTO public.users (id, email, username, created_at, last_seen, is_online)
VALUES
  ('11111111-1111-1111-1111-111111111111','sr@chat.com','Sr', now(), now(), false),
  ('22222222-2222-2222-2222-222222222222','sr1@chat.com','Sr1', now(), now(), false)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username;

-- 8) Done
DO $$ BEGIN
  RAISE NOTICE '✅ Online status setup/repair applied.';
  RAISE NOTICE '• users table ready';
  RAISE NOTICE '• RLS disabled';
  RAISE NOTICE '• Realtime enabled (publication + replica identity)';
  RAISE NOTICE '• Functions recreated';
  RAISE NOTICE '• Seeded fixed users';
END $$;