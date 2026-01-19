-- Fix storage delete policy for custom user system
-- This allows users to delete videos based on the file path prefix matching their user ID

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos crt2zx_0" ON storage.objects;

-- Create a new policy that works with our custom user IDs
-- This allows deletion if the file path starts with the user's ID
CREATE POLICY "Allow delete own videos" ON storage.objects 
FOR DELETE TO public 
USING (
  bucket_id = 'chat-videos' 
  AND (
    -- Allow Sr to delete files that start with their ID
    name LIKE '11111111-1111-1111-1111-111111111111/%'
    OR 
    -- Allow Iasm to delete files that start with their ID  
    name LIKE '22222222-2222-2222-2222-222222222222/%'
  )
);

-- Alternative: More flexible policy that checks against users table
-- (Uncomment this if you prefer a more dynamic approach)
/*
CREATE POLICY "Allow users delete own videos" ON storage.objects 
FOR DELETE TO public 
USING (
  bucket_id = 'chat-videos' 
  AND EXISTS (
    SELECT 1 FROM auth.users au
    JOIN public.users u ON au.id::text = u.id
    WHERE split_part(name, '/', 1) = u.id
  )
);
*/