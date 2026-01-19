-- ===================================================================
-- LIMPEZA COMPLETA DO PROJETO CHAT APP
-- ===================================================================
-- Este arquivo remove TUDO relacionado ao projeto chat
-- Execute este SQL para começar do zero

-- ===================================================================
-- 1. REMOVER TODOS OS TRIGGERS
-- ===================================================================
DROP TRIGGER IF EXISTS cleanup_typing_trigger ON typing_status;
DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
DROP TRIGGER IF EXISTS cleanup_messages_trigger ON messages;

-- ===================================================================
-- 2. REMOVER TODAS AS FUNÇÕES
-- ===================================================================
DROP FUNCTION IF EXISTS cleanup_old_typing_status();
DROP FUNCTION IF EXISTS cleanup_old_messages();
DROP FUNCTION IF EXISTS update_conversation_timestamp();
DROP FUNCTION IF EXISTS trigger_cleanup_typing();
DROP FUNCTION IF EXISTS trigger_cleanup_messages();

-- ===================================================================
-- 3. REMOVER TODAS AS POLÍTICAS RLS
-- ===================================================================
-- Typing status policies
DROP POLICY IF EXISTS "Users can read typing status in their conversations" ON typing_status;
DROP POLICY IF EXISTS "Users can manage their own typing status" ON typing_status;
DROP POLICY IF EXISTS "Users can insert typing status" ON typing_status;
DROP POLICY IF EXISTS "Users can update typing status" ON typing_status;
DROP POLICY IF EXISTS "Users can delete typing status" ON typing_status;

-- Messages policies  
DROP POLICY IF EXISTS "Users can read messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Users policies
DROP POLICY IF EXISTS "Users can read their own profile and others they chat with" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;

-- Conversations policies
DROP POLICY IF EXISTS "Users can see conversations they are part of" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they are part of" ON conversations;

-- ===================================================================
-- 4. REMOVER TODOS OS ÍNDICES CUSTOMIZADOS
-- ===================================================================
-- Users indices
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_is_online;
DROP INDEX IF EXISTS idx_users_last_seen;
DROP INDEX IF EXISTS idx_users_created_at;

-- Messages indices
DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_messages_receiver;
DROP INDEX IF EXISTS idx_messages_created;
DROP INDEX IF EXISTS idx_messages_conversation;
DROP INDEX IF EXISTS idx_messages_is_read;
DROP INDEX IF EXISTS idx_messages_sender_receiver;
DROP INDEX IF EXISTS idx_messages_timestamp;

-- Conversations indices
DROP INDEX IF EXISTS idx_conversations_user1;
DROP INDEX IF EXISTS idx_conversations_user2;
DROP INDEX IF EXISTS idx_conversations_updated;
DROP INDEX IF EXISTS idx_conversations_created;
DROP INDEX IF EXISTS idx_conversations_users;

-- Typing status indices
DROP INDEX IF EXISTS idx_typing_status_user_conversation;
DROP INDEX IF EXISTS idx_typing_status_updated;
DROP INDEX IF EXISTS idx_typing_status_is_typing;
DROP INDEX IF EXISTS idx_typing_status_user;
DROP INDEX IF EXISTS idx_typing_status_conversation;

-- ===================================================================
-- 5. REMOVER TODAS AS TABELAS
-- ===================================================================
-- Remover na ordem correta (respeitando foreign keys se existirem)
DROP TABLE IF EXISTS typing_status CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===================================================================
-- 6. REMOVER TIPOS CUSTOMIZADOS (se existirem)
-- ===================================================================
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS message_status CASCADE;

-- ===================================================================
-- 7. REMOVER EXTENSIONS DESNECESSÁRIAS (CUIDADO!)
-- ===================================================================
-- Comentado para evitar problemas - descomente apenas se necessário
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";

-- ===================================================================
-- 8. LIMPAR SCHEMAS CUSTOMIZADOS (se existirem)
-- ===================================================================
-- DROP SCHEMA IF EXISTS chat CASCADE;

-- ===================================================================
-- 9. VERIFICAÇÃO FINAL
-- ===================================================================
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
    trigger_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Contar tabelas relacionadas ao chat
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'messages', 'conversations', 'typing_status');
    
    -- Contar funções relacionadas ao chat
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE '%typing%' OR routine_name LIKE '%message%' OR routine_name LIKE '%conversation%';
    
    -- Contar triggers relacionados ao chat
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public' 
    AND (trigger_name LIKE '%typing%' OR trigger_name LIKE '%message%' OR trigger_name LIKE '%conversation%');
    
    -- Contar políticas RLS relacionadas ao chat
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('users', 'messages', 'conversations', 'typing_status');
    
    -- Relatório final
    RAISE NOTICE '=== RELATÓRIO DE LIMPEZA ===';
    RAISE NOTICE 'Tabelas restantes relacionadas ao chat: %', table_count;
    RAISE NOTICE 'Funções restantes relacionadas ao chat: %', function_count;
    RAISE NOTICE 'Triggers restantes relacionados ao chat: %', trigger_count;
    RAISE NOTICE 'Políticas RLS restantes relacionadas ao chat: %', policy_count;
    
    IF table_count = 0 AND function_count = 0 AND trigger_count = 0 AND policy_count = 0 THEN
        RAISE NOTICE '✅ LIMPEZA COMPLETA REALIZADA COM SUCESSO!';
        RAISE NOTICE '🎯 O banco está limpo e pronto para o setup completo.';
    ELSE
        RAISE NOTICE '⚠️  Alguns itens podem não ter sido removidos.';
        RAISE NOTICE '💡 Verifique manualmente se necessário.';
    END IF;
    
    RAISE NOTICE '=== FIM DO RELATÓRIO ===';
END $$;

-- ===================================================================
-- MENSAGEM FINAL
-- ===================================================================
-- Após executar este script, execute o database-full-setup.sql
-- para recriar tudo do zero de forma limpa e organizada.