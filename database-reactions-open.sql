-- Fix RLS/permissions for message_reactions to work without Supabase Auth
-- Run this in Supabase SQL editor

-- 1) Ensure table exists (no-op if already created)
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 2) Disable RLS so anon role can insert/delete (this app não usa Supabase Auth)
ALTER TABLE IF EXISTS message_reactions DISABLE ROW LEVEL SECURITY;

-- 3) Explicit grants for anon/authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE message_reactions TO anon, authenticated;

-- 4) Realtime: ensure table is part of supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF EXISTS message_reactions;