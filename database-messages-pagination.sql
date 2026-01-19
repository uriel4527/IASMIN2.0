-- Optimize messages pagination and conversation queries
-- This migration is idempotent and safe to run multiple times

-- Composite indexes to speed up lookups between two participants in both directions
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver_created_at
  ON public.messages (sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_created_at
  ON public.messages (receiver_id, sender_id, created_at DESC);

-- Global index to help with generic time-ordered pagination
CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages (created_at DESC);

-- Note: reply_to_id foreign key and related indexes are created in database-context-menu.sql
