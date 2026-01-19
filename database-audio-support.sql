-- Add audio support to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS audio_data TEXT,
ADD COLUMN IF NOT EXISTS has_audio BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

-- Create index for audio messages
CREATE INDEX IF NOT EXISTS idx_messages_has_audio ON messages(has_audio) WHERE has_audio = true;

-- Update RLS policies if needed (already covered by existing policies)