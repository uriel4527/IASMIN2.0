-- Database setup for ChatApp
-- Two users chat system: "Sr" and "Sr1"

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

-- Insert the two fixed users
-- Note: In a real app, passwords should be properly hashed
-- These are example passwords: "123456" for both users
INSERT INTO users (id, email, username, password_hash, created_at, last_seen, is_online) VALUES
('11111111-1111-1111-1111-111111111111', 'sr@chat.com', 'Sr', '$2b$10$example.hash.for.password.123456', NOW(), NOW(), FALSE),
('22222222-2222-2222-2222-222222222222', 'sr1@chat.com', 'Sr1', '$2b$10$example.hash.for.password.123456', NOW(), NOW(), FALSE)
ON CONFLICT (email) DO NOTHING;

-- Create the conversation between the two users
INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', NOW(), NOW())
ON CONFLICT (user1_id, user2_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (
    id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
);

-- RLS Policies for messages table  
CREATE POLICY "Users can view messages for fixed users" ON messages FOR SELECT USING (
    sender_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    AND receiver_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
);
CREATE POLICY "Users can insert messages for fixed users" ON messages FOR INSERT WITH CHECK (
    sender_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    AND receiver_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    AND sender_id != receiver_id
);

-- RLS Policies for conversations table
CREATE POLICY "Users can view conversations for fixed users" ON conversations FOR SELECT USING (
    user1_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    AND user2_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
);
CREATE POLICY "Users can update conversations for fixed users" ON conversations FOR UPDATE USING (
    user1_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
    AND user2_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
);

-- Create a function to update conversation timestamp when new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NEW.created_at
    WHERE (user1_id = NEW.sender_id AND user2_id = NEW.receiver_id)
       OR (user1_id = NEW.receiver_id AND user2_id = NEW.sender_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update conversation timestamp
CREATE TRIGGER update_conversation_timestamp_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Create function to clean up old messages (messages older than 1 day)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE created_at < NOW() - INTERVAL '1 day';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    RAISE NOTICE 'Cleaned up % old messages', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up messages at end of day (after 23:59)
CREATE OR REPLACE FUNCTION daily_message_cleanup()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Only run if it's after 23:59 (end of day)
    IF EXTRACT(HOUR FROM NOW()) >= 23 AND EXTRACT(MINUTE FROM NOW()) >= 59 THEN
        SELECT cleanup_old_messages() INTO deleted_count;
        RETURN deleted_count;
    END IF;
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;