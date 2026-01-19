-- Ensure reply_to relationship exists for PostgREST embedding
-- This migration is idempotent and safe to run multiple times

-- 1) Ensure column exists
ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- 2) Ensure the foreign key constraint name PostgREST expects exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_reply_to_id_fkey'
  ) THEN
    -- Add the constraint with the canonical name
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_reply_to_id_fkey
      FOREIGN KEY (reply_to_id)
      REFERENCES public.messages(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3) Helpful index for reply lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
