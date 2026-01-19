-- =============================================
-- Online Status System Setup
-- =============================================

-- Create function to cleanup offline users (users who haven't been seen for more than 2 minutes)
CREATE OR REPLACE FUNCTION cleanup_offline_users()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE users 
  SET is_online = false 
  WHERE is_online = true 
    AND last_seen < NOW() - INTERVAL '2 minutes';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get online users count
CREATE OR REPLACE FUNCTION get_online_users_count()
RETURNS INTEGER AS $$
BEGIN
  -- First cleanup offline users
  PERFORM cleanup_offline_users();
  
  -- Return count of online users
  RETURN (SELECT COUNT(*) FROM users WHERE is_online = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get online users list
CREATE OR REPLACE FUNCTION get_online_users()
RETURNS TABLE(id UUID, username TEXT, last_seen TIMESTAMPTZ) AS $$
BEGIN
  -- First cleanup offline users
  PERFORM cleanup_offline_users();
  
  -- Return online users
  RETURN QUERY 
  SELECT u.id, u.username, u.last_seen 
  FROM users u 
  WHERE u.is_online = true 
  ORDER BY u.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for better performance on online status queries
CREATE INDEX IF NOT EXISTS idx_users_online_status ON users(is_online, last_seen);

-- Enable RLS (Row Level Security) policies for online status if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can read online status" ON users;
DROP POLICY IF EXISTS "Users can update own online status" ON users;
DROP POLICY IF EXISTS "Users can insert own record" ON users;

-- Policy to allow users to read all users' online status
CREATE POLICY "Users can read online status" ON users
  FOR SELECT USING (true);

-- Policy to allow users to update their own online status
CREATE POLICY "Users can update own online status" ON users
  FOR UPDATE USING (auth.uid()::text = id::text OR id::text IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ));

-- Policy to allow inserting user records (upsert)
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = id::text OR id::text IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  ));

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_offline_users() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_online_users_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_online_users() TO anon, authenticated;

-- Optional: Create a scheduled job to cleanup offline users every minute
-- Note: This requires pg_cron extension which may not be available in all Supabase instances
-- You can run this manually or set up a cron job externally if needed
/*
SELECT cron.schedule(
  'cleanup-offline-users',
  '* * * * *', -- Every minute
  'SELECT cleanup_offline_users();'
);
*/

COMMENT ON FUNCTION cleanup_offline_users() IS 'Marks users as offline if they haven''t been seen for more than 2 minutes';
COMMENT ON FUNCTION get_online_users_count() IS 'Returns the count of currently online users after cleanup';
COMMENT ON FUNCTION get_online_users() IS 'Returns list of currently online users after cleanup';