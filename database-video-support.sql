-- Add video support to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS video_storage_path TEXT,
ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS video_duration INTEGER,
ADD COLUMN IF NOT EXISTS video_thumbnail TEXT,
ADD COLUMN IF NOT EXISTS view_once BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS viewed_by UUID REFERENCES users(id);

-- Create indexes for video messages and view_once functionality
CREATE INDEX IF NOT EXISTS idx_messages_has_video ON messages(has_video) WHERE has_video = true;
CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(view_once) WHERE view_once = true;
CREATE INDEX IF NOT EXISTS idx_messages_viewed_at ON messages(viewed_at);

-- Create storage bucket for videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-videos', 'chat-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Function to mark video as viewed (for view_once functionality)
CREATE OR REPLACE FUNCTION mark_video_as_viewed(message_id UUID, user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET viewed_at = NOW(), viewed_by = user_id 
  WHERE id = message_id AND view_once = true AND viewed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old videos (optional - can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_old_videos()
RETURNS void AS $$
DECLARE
  video_record RECORD;
BEGIN
  -- Delete videos older than 30 days
  FOR video_record IN 
    SELECT video_storage_path 
    FROM messages 
    WHERE has_video = true 
    AND created_at < NOW() - INTERVAL '30 days'
    AND video_storage_path IS NOT NULL
  LOOP
    -- Delete from storage
    PERFORM storage.delete_object('chat-videos', video_record.video_storage_path);
    
    -- Clear the path from messages table
    UPDATE messages 
    SET video_storage_path = NULL 
    WHERE video_storage_path = video_record.video_storage_path;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION mark_video_as_viewed(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_videos() TO authenticated;