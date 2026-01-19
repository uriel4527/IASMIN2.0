-- Fix message_reactions table for apps without Supabase Auth
-- This script ensures the table works with public.users instead of auth.users

-- Drop existing table if it has wrong foreign key
DROP TABLE IF EXISTS message_reactions CASCADE;

-- Recreate table with correct foreign key to public.users
CREATE TABLE message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Reference public.users, not auth.users
  emoji VARCHAR(10) NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😲', '😥', '🙏', '😉')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

-- Disable RLS since this app doesn't use Supabase Auth
ALTER TABLE message_reactions DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE message_reactions TO anon, authenticated;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;