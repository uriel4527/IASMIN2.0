-- IMPORTANT: This SQL cannot be run directly in SQL Editor due to permission restrictions
-- The storage.objects table is owned by Supabase system, not the project owner
--
-- SOLUTION: Create these policies via Supabase Dashboard instead:
-- 1. Go to Storage > Policies in your Supabase Dashboard
-- 2. Create these 3 policies manually using the UI:

/*
ALTERNATIVE 1: Use Supabase Dashboard
==================================
1. Go to: Storage > Policies in your Supabase Dashboard
2. Click "Create Policy" and add these 3 policies:

Policy 1: "Users can upload videos"
- Operation: INSERT
- Target roles: authenticated
- Condition: bucket_id = 'chat-videos'

Policy 2: "Public video access" 
- Operation: SELECT
- Target roles: public
- Condition: bucket_id = 'chat-videos'

Policy 3: "Users can delete own videos"
- Operation: DELETE
- Target roles: authenticated  
- Condition: bucket_id = 'chat-videos' AND name LIKE auth.uid()::text || '/%'

ALTERNATIVE 2: Use these specific SQL commands that work with current permissions
===============================================================================
*/

-- First ensure the bucket exists (this should work)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-videos', 'chat-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policies with proper syntax for Supabase (may work depending on your setup)
DO $$
BEGIN
  -- Policy 1: Allow authenticated users to upload videos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''chat-videos'')';
  END IF;

  -- Policy 2: Allow public read access to videos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public video access'
  ) THEN
    EXECUTE 'CREATE POLICY "Public video access" ON storage.objects FOR SELECT TO public USING (bucket_id = ''chat-videos'')';
  END IF;

  -- Policy 3: Allow users to delete their own videos (FIXED)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete own videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''chat-videos'' AND name LIKE auth.uid()::text || ''/%'')';
  END IF;
END $$;