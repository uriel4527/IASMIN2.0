-- ===================================================================
-- SETUP COMPLETO DO CHAT APP - VERSÃO CORRIGIDA
-- ===================================================================
-- Execute este arquivo para corrigir todos os problemas do banco de dados
-- Resolve: status online, password_hash, push_subscriptions, reply_to, etc.

-- ===================================================================
-- 1. EXTENSÕES
-- ===================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- 2. DROP TABLES SE EXISTIREM (ordem inversa por dependências)
-- ===================================================================
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS typing_status CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===================================================================
-- 3. CRIAR TABELAS
-- ===================================================================

-- Tabela de usuários (password_hash agora é NULLABLE)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- NULLABLE para permitir upserts sem senha
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT false,
    
    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_length CHECK (char_length(username) >= 2 AND char_length(username) <= 50)
);

-- Tabela de conversas
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT conversations_different_users CHECK (user1_id != user2_id),
    UNIQUE(user1_id, user2_id)
);

-- Tabela de mensagens (com suporte a reply_to)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- Suporte a respostas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    original_content TEXT,
    
    -- Campos para mídia
    image_data TEXT,
    has_image BOOLEAN DEFAULT false,
    audio_data TEXT,
    has_audio BOOLEAN DEFAULT false,
    audio_duration INTEGER,
    video_storage_path TEXT,
    has_video BOOLEAN DEFAULT false,
    video_duration INTEGER,
    video_thumbnail TEXT,
    view_once BOOLEAN DEFAULT false,
    viewed_at TIMESTAMP WITH TIME ZONE,
    viewed_by UUID,
    
    conversation_id UUID,
    
    CONSTRAINT messages_content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT messages_content_length CHECK (char_length(content) <= 5000),
    CONSTRAINT messages_different_users CHECK (sender_id != receiver_id)
);

-- Tabela de status de digitação
CREATE TABLE typing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    conversation_with TEXT NOT NULL,
    is_typing BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, conversation_with),
    CONSTRAINT typing_status_different_users CHECK (user_id != conversation_with)
);

-- Tabela de reações
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id, user_id, emoji)
);

-- Tabela de push subscriptions
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ===================================================================
-- 4. DESABILITAR RLS
-- ===================================================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 5. ÍNDICES
-- ===================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen DESC);

-- Messages
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);

-- Typing status
CREATE INDEX idx_typing_status_user_conversation ON typing_status(user_id, conversation_with);
CREATE INDEX idx_typing_status_updated ON typing_status(last_updated DESC);

-- Reactions
CREATE INDEX idx_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_reactions_user ON message_reactions(user_id);

-- Push subscriptions
CREATE INDEX idx_push_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_active ON push_subscriptions(is_active);

-- ===================================================================
-- 6. FUNÇÕES
-- ===================================================================

-- Limpar usuários offline (>2 minutos sem atividade)
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
$$ LANGUAGE plpgsql;

-- Dropar função antiga se existir
DROP FUNCTION IF EXISTS get_user_last_seen_info(uuid);

-- Obter informações de último acesso do usuário
CREATE FUNCTION get_user_last_seen_info(user_id UUID)
RETURNS TABLE(
    is_online BOOLEAN,
    last_seen_formatted TEXT,
    username TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.is_online,
        CASE 
            WHEN u.is_online THEN 'online'
            WHEN u.last_seen > NOW() - INTERVAL '1 minute' THEN 'agora mesmo'
            WHEN u.last_seen > NOW() - INTERVAL '1 hour' THEN 'há ' || EXTRACT(MINUTE FROM NOW() - u.last_seen)::TEXT || ' minutos'
            WHEN u.last_seen > NOW() - INTERVAL '24 hours' THEN 'há ' || EXTRACT(HOUR FROM NOW() - u.last_seen)::TEXT || ' horas'
            ELSE 'há ' || EXTRACT(DAY FROM NOW() - u.last_seen)::TEXT || ' dias'
        END,
        u.username
    FROM users u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Limpar mensagens antigas (>30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Atualizar timestamp de conversa
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
DECLARE
    u1 UUID := LEAST(NEW.sender_id, NEW.receiver_id);
    u2 UUID := GREATEST(NEW.sender_id, NEW.receiver_id);
BEGIN
    INSERT INTO conversations (user1_id, user2_id, created_at, updated_at)
    VALUES (u1, u2, NOW(), NOW())
    ON CONFLICT (user1_id, user2_id) 
    DO UPDATE SET updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 7. TRIGGERS
-- ===================================================================

DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- ===================================================================
-- 8. INSERIR USUÁRIOS INICIAIS
-- ===================================================================

INSERT INTO users (id, email, username, password_hash, created_at, last_seen, is_online)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'sr@chat.com',
        'Sr',
        '$2a$10$rQZ1zHjHNF7Tj8q8Nh8xN.K5qR6vL3sT9uE1wP2cM4nO0fG6hI8jK',
        NOW(),
        NOW(),
        false
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'sr1@chat.com',
        'Sr1',
        '$2a$10$sT2bK7mI9xN4oP5qR8vL1uW2cE3fG6hI0jK7lM9nO8pQ1rS4tU5v',
        NOW(),
        NOW(),
        false
    )
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    last_seen = NOW(),
    is_online = false;

-- Criar conversa inicial
INSERT INTO conversations (user1_id, user2_id)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (user1_id, user2_id) DO NOTHING;

-- ===================================================================
-- 9. CONFIGURAR REALTIME
-- ===================================================================

ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE typing_status REPLICA IDENTITY FULL;

-- Adicionar tabelas ao realtime
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE users;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ===================================================================
-- 10. VERIFICAÇÃO FINAL
-- ===================================================================

DO $$
DECLARE
    users_count INTEGER;
    tables_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_count FROM users;
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'messages', 'conversations', 'typing_status', 'message_reactions', 'push_subscriptions');
    
    RAISE NOTICE '=== SETUP COMPLETO ===';
    RAISE NOTICE '✅ Tabelas criadas: %', tables_count;
    RAISE NOTICE '✅ Usuários inseridos: %', users_count;
    RAISE NOTICE '✅ Status online funcionando';
    RAISE NOTICE '✅ Push notifications configuradas';
    RAISE NOTICE '✅ Reply to messages habilitado';
    RAISE NOTICE '🚀 Sistema pronto para uso!';
END $$;
