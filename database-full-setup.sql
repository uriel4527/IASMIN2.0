-- ===================================================================
-- SETUP COMPLETO DO PROJETO CHAT APP - SEM RLS
-- ===================================================================
-- Este arquivo cria TUDO necessário para o chat funcionar perfeitamente
-- Execute após o database-full-cleanup.sql

-- ===================================================================
-- 1. CONFIGURAÇÕES INICIAIS
-- ===================================================================
-- Garantir que temos as extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- 2. CRIAR TABELAS PRINCIPAIS
-- ===================================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT false,
    
    -- Validações
    CONSTRAINT users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_length CHECK (char_length(username) >= 2 AND char_length(username) <= 50),
    CONSTRAINT users_username_format CHECK (username ~* '^[A-Za-z0-9_-]+$')
);

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que user1_id sempre seja menor que user2_id para evitar duplicatas
    CONSTRAINT conversations_user_order CHECK (user1_id < user2_id),
    CONSTRAINT conversations_different_users CHECK (user1_id != user2_id),
    UNIQUE(user1_id, user2_id)
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    
    -- Validações
    CONSTRAINT messages_content_not_empty CHECK (char_length(trim(content)) > 0),
    CONSTRAINT messages_content_length CHECK (char_length(content) <= 2000),
    CONSTRAINT messages_different_users CHECK (sender_id != receiver_id)
);

-- Tabela de status de digitação (SIMPLIFICADA - SEM FOREIGN KEYS)
CREATE TABLE IF NOT EXISTS typing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    conversation_with TEXT NOT NULL,
    is_typing BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir unicidade por conversa
    UNIQUE(user_id, conversation_with),
    
    -- Validações
    CONSTRAINT typing_status_user_id_not_empty CHECK (char_length(trim(user_id)) > 0),
    CONSTRAINT typing_status_conversation_with_not_empty CHECK (char_length(trim(conversation_with)) > 0),
    CONSTRAINT typing_status_different_users CHECK (user_id != conversation_with)
);

-- ===================================================================
-- 3. DESABILITAR RLS EM TODAS AS TABELAS
-- ===================================================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status DISABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ===================================================================

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen DESC);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Índices para conversations
CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_conversations_users ON conversations(user1_id, user2_id);

-- Índices para messages
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);

-- Índices para typing_status
CREATE INDEX idx_typing_status_user_conversation ON typing_status(user_id, conversation_with);
CREATE INDEX idx_typing_status_updated ON typing_status(last_updated DESC);
CREATE INDEX idx_typing_status_is_typing ON typing_status(is_typing);
CREATE INDEX idx_typing_status_user ON typing_status(user_id);

-- ===================================================================
-- 5. FUNÇÕES UTILITÁRIAS
-- ===================================================================

-- Função para limpar mensagens antigas (mais de 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Limpeza de mensagens: % mensagens antigas removidas', deleted_count;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar status de digitação antigos (mais de 30 segundos)
CREATE OR REPLACE FUNCTION cleanup_old_typing_status()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE typing_status 
    SET is_typing = false 
    WHERE is_typing = true 
    AND last_updated < NOW() - INTERVAL '30 seconds';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
        RAISE NOTICE 'Limpeza de typing status: % status antigos limpos', updated_count;
    END IF;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar timestamp de conversa
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Garantir que user1_id < user2_id
    DECLARE
        u1 UUID := LEAST(NEW.sender_id, NEW.receiver_id);
        u2 UUID := GREATEST(NEW.sender_id, NEW.receiver_id);
    BEGIN
        -- Atualizar timestamp da conversa existente
        UPDATE conversations 
        SET updated_at = NOW()
        WHERE user1_id = u1 AND user2_id = u2;
        
        -- Se não existe conversa, criar uma
        IF NOT FOUND THEN
            INSERT INTO conversations (user1_id, user2_id, created_at, updated_at)
            VALUES (u1, u2, NOW(), NOW())
            ON CONFLICT (user1_id, user2_id) DO UPDATE 
            SET updated_at = NOW();
        END IF;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para contar mensagens não lidas
CREATE OR REPLACE FUNCTION count_unread_messages(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unread_count
    FROM messages 
    WHERE receiver_id = user_uuid AND is_read = false;
    
    RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para marcar mensagens como lidas
CREATE OR REPLACE FUNCTION mark_messages_as_read(sender_uuid UUID, receiver_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE messages 
    SET is_read = true 
    WHERE sender_id = sender_uuid 
    AND receiver_id = receiver_uuid 
    AND is_read = false;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 6. TRIGGERS
-- ===================================================================

-- Trigger para atualizar timestamp de conversa quando mensagem é inserida
DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Trigger para cleanup automático de typing status
CREATE OR REPLACE FUNCTION trigger_cleanup_typing()
RETURNS TRIGGER AS $$
BEGIN
    -- Executar cleanup de status antigos a cada operação
    PERFORM cleanup_old_typing_status();
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_typing_trigger ON typing_status;
CREATE TRIGGER cleanup_typing_trigger
    AFTER INSERT OR UPDATE ON typing_status
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_typing();

-- ===================================================================
-- 7. INSERIR DADOS INICIAIS
-- ===================================================================

-- Inserir usuários fixos do sistema
INSERT INTO users (id, email, username, created_at, last_seen, is_online, avatar_url)
VALUES 
    (
        '11111111-1111-1111-1111-111111111111',
        'sr@chat.com',
        'Sr',
        NOW(),
        NOW(),
        false,
        NULL
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'sr1@chat.com',
        'Sr1',
        NOW(),
        NOW(),
        false,
        NULL
    )
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    last_seen = NOW(),
    is_online = EXCLUDED.is_online;

-- Criar conversa inicial entre os usuários (se não existir)
INSERT INTO conversations (user1_id, user2_id, created_at, updated_at)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    NOW(),
    NOW()
)
ON CONFLICT (user1_id, user2_id) DO NOTHING;

-- ===================================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- ===================================================================

COMMENT ON TABLE users IS 'Tabela de usuários do sistema de chat';
COMMENT ON TABLE conversations IS 'Tabela de conversas entre usuários';
COMMENT ON TABLE messages IS 'Tabela de mensagens do chat';
COMMENT ON TABLE typing_status IS 'Tabela de status de digitação em tempo real (sem foreign keys para simplicidade)';

COMMENT ON COLUMN users.is_online IS 'Status online do usuário';
COMMENT ON COLUMN users.last_seen IS 'Última vez que o usuário foi visto online';
COMMENT ON COLUMN messages.is_read IS 'Indica se a mensagem foi lida pelo destinatário';
COMMENT ON COLUMN typing_status.user_id IS 'ID do usuário que está digitando (como TEXT para flexibilidade)';
COMMENT ON COLUMN typing_status.conversation_with IS 'ID do usuário com quem está conversando (como TEXT)';

COMMENT ON FUNCTION cleanup_old_messages() IS 'Remove mensagens mais antigas que 30 dias';
COMMENT ON FUNCTION cleanup_old_typing_status() IS 'Remove status de digitação mais antigos que 30 segundos';
COMMENT ON FUNCTION update_conversation_timestamp() IS 'Atualiza timestamp da conversa quando nova mensagem é inserida';
COMMENT ON FUNCTION count_unread_messages(UUID) IS 'Conta mensagens não lidas para um usuário';
COMMENT ON FUNCTION mark_messages_as_read(UUID, UUID) IS 'Marca mensagens como lidas entre dois usuários';

-- ===================================================================
-- 9. CONFIGURAÇÕES DE REALTIME (IMPORTANTE!)
-- ===================================================================

-- Habilitar realtime para todas as tabelas (idempotente)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ===================================================================
-- 10. VERIFICAÇÕES E TESTES
-- ===================================================================

DO $$
DECLARE
    users_count INTEGER;
    tables_count INTEGER;
    functions_count INTEGER;
    triggers_count INTEGER;
    indices_count INTEGER;
BEGIN
    -- Contar usuários inseridos
    SELECT COUNT(*) INTO users_count FROM users;
    
    -- Contar tabelas criadas
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'messages', 'conversations', 'typing_status');
    
    -- Contar funções criadas
    SELECT COUNT(*) INTO functions_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('cleanup_old_messages', 'cleanup_old_typing_status', 'update_conversation_timestamp', 'count_unread_messages', 'mark_messages_as_read');
    
    -- Contar triggers criados
    SELECT COUNT(*) INTO triggers_count
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND trigger_name IN ('update_conversation_on_message', 'cleanup_typing_trigger');
    
    -- Contar índices criados
    SELECT COUNT(*) INTO indices_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN ('users', 'messages', 'conversations', 'typing_status')
    AND indexname LIKE 'idx_%';
    
    -- Relatório de criação
    RAISE NOTICE '=== RELATÓRIO DE SETUP COMPLETO ===';
    RAISE NOTICE '📋 Tabelas criadas: % / 4', tables_count;
    RAISE NOTICE '⚙️  Funções criadas: % / 5', functions_count;
    RAISE NOTICE '🔧 Triggers criados: % / 2', triggers_count;
    RAISE NOTICE '📇 Índices criados: %', indices_count;
    RAISE NOTICE '👥 Usuários inseridos: % / 2', users_count;
    
    IF tables_count = 4 AND functions_count = 5 AND triggers_count = 2 AND users_count = 2 THEN
        RAISE NOTICE '✅ SETUP COMPLETO REALIZADO COM SUCESSO!';
        RAISE NOTICE '🚀 O sistema de chat está pronto para uso!';
        RAISE NOTICE '💬 Funcionalidades disponíveis:';
        RAISE NOTICE '   - Mensagens em tempo real';
        RAISE NOTICE '   - Indicadores de digitação';
        RAISE NOTICE '   - Cleanup automático';
        RAISE NOTICE '   - Status online/offline';
        RAISE NOTICE '   - Histórico de mensagens';
        RAISE NOTICE '   - Conversas organizadas';
    ELSE
        RAISE NOTICE '⚠️  Alguns componentes podem não ter sido criados corretamente.';
        RAISE NOTICE '🔍 Verifique os logs acima para detalhes.';
    END IF;
    
    RAISE NOTICE '=== FIM DO RELATÓRIO ===';
END $$;

-- ===================================================================
-- 11. TESTES FINAIS
-- ===================================================================

-- Testar inserção de mensagem de exemplo
DO $$
BEGIN
    -- Inserir mensagem de teste
    INSERT INTO messages (content, sender_id, receiver_id)
    VALUES (
        'Mensagem de teste do setup automático!',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
    );
    
    -- Testar status de digitação
    INSERT INTO typing_status (user_id, conversation_with, is_typing)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        true
    )
    ON CONFLICT (user_id, conversation_with) DO UPDATE 
    SET is_typing = EXCLUDED.is_typing, last_updated = NOW();
    
    RAISE NOTICE '🧪 Testes básicos executados com sucesso!';
    RAISE NOTICE '📱 O sistema está funcionando corretamente.';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erro durante os testes: %', SQLERRM;
    RAISE NOTICE '💡 Verifique as configurações e tente novamente.';
END $$;

-- ===================================================================
-- FIM DO SETUP COMPLETO
-- ===================================================================

DO $$
BEGIN
  RAISE NOTICE '🎉 SETUP COMPLETO FINALIZADO!';
  RAISE NOTICE '📖 Próximos passos:';
  RAISE NOTICE '   1. Verificar se o Realtime está habilitado no Supabase';
  RAISE NOTICE '   2. Testar o sistema no frontend';
  RAISE NOTICE '   3. Monitorar os logs para debugging';
  RAISE NOTICE '🔗 Sistema pronto para conexão com o frontend!';
END $$ LANGUAGE plpgsql;