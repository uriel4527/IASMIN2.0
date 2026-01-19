-- Disable Row Level Security (RLS) and open access (no security)
-- Run this in Supabase SQL editor

-- 1) Disable RLS on core tables
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS typing_status DISABLE ROW LEVEL SECURITY;

-- 2) Grant open privileges to anon & authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 3) Ensure realtime works
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS users;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS typing_status;

-- 4) Optional: Drop existing policies (harmless when RLS is disabled)
DO $$
DECLARE r record; BEGIN
  FOR r IN SELECT polname, tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.polname, r.tablename);
  END LOOP;
END $$;