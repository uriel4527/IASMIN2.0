-- ===================================================================
-- CHAT APP DATABASE SETUP - SEM RLS (Para usar sem integração nativa)
-- ===================================================================

-- Criar tabela de usuários (sem RLS)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT false
);

-- Criar tabela de conversas (sem RLS)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que não há conversas duplicadas
  UNIQUE(user1_id, user2_id)
);

-- Criar tabela de mensagens (sem RLS)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false
);

-- Criar tabela de status de digitação (SEM RLS - SIMPLIFICADA)
CREATE TABLE IF NOT EXISTS typing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Usar TEXT em vez de UUID para simplicidade
  conversation_with TEXT NOT NULL, -- Usar TEXT em vez de UUID
  is_typing BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que só existe um registro por conversa entre dois usuários
  UNIQUE(user_id, conversation_with)
);

-- ===================================================================
-- DESABILITAR RLS EM TODAS AS TABELAS
-- ===================================================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE typing_status DISABLE ROW LEVEL SECURITY;

-- ===================================================================
-- ÍNDICES PARA PERFORMANCE
-- ===================================================================

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Índices para typing_status
CREATE INDEX IF NOT EXISTS idx_typing_status_user_conversation ON typing_status(user_id, conversation_with);
CREATE INDEX IF NOT EXISTS idx_typing_status_updated ON typing_status(last_updated);
CREATE INDEX IF NOT EXISTS idx_typing_status_is_typing ON typing_status(is_typing);

-- ===================================================================
-- FUNÇÕES PARA CLEANUP AUTOMÁTICO
-- ===================================================================

-- Função para limpar mensagens antigas (mais de 7 dias)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM messages 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
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
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar timestamp de conversa
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar timestamp da conversa quando nova mensagem é inserida
  UPDATE conversations 
  SET updated_at = NOW()
  WHERE (user1_id = NEW.sender_id AND user2_id = NEW.receiver_id)
     OR (user1_id = NEW.receiver_id AND user2_id = NEW.sender_id);
  
  -- Se não existe conversa, criar uma
  IF NOT FOUND THEN
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (
      LEAST(NEW.sender_id::text, NEW.receiver_id::text)::uuid,
      GREATEST(NEW.sender_id::text, NEW.receiver_id::text)::uuid
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- TRIGGERS
-- ===================================================================

-- Trigger para atualizar timestamp de conversa quando mensagem é inserida
DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Trigger para cleanup automático de typing status a cada update
CREATE OR REPLACE FUNCTION trigger_cleanup_typing()
RETURNS TRIGGER AS $$
BEGIN
  -- Executar cleanup de status antigos
  PERFORM cleanup_old_typing_status();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_typing_trigger ON typing_status;
CREATE TRIGGER cleanup_typing_trigger
  AFTER INSERT OR UPDATE ON typing_status
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_typing();

-- ===================================================================
-- INSERIR DADOS INICIAIS (USUÁRIOS FIXOS)
-- ===================================================================

-- Inserir usuários fixos se não existirem
INSERT INTO users (id, email, username, created_at, last_seen, is_online)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'sr@chat.com',
    'Sr',
    NOW(),
    NOW(),
    false
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'sr1@chat.com',
    'Sr1',
    NOW(),
    NOW(),
    false
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  last_seen = NOW();

-- ===================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ===================================================================

COMMENT ON TABLE users IS 'Tabela de usuários do chat (sem RLS para simplicidade)';
COMMENT ON TABLE conversations IS 'Tabela de conversas entre usuários';
COMMENT ON TABLE messages IS 'Tabela de mensagens do chat';
COMMENT ON TABLE typing_status IS 'Tabela de status de digitação (simplificada sem foreign keys)';

COMMENT ON FUNCTION cleanup_old_messages() IS 'Remove mensagens mais antigas que 7 dias';
COMMENT ON FUNCTION cleanup_old_typing_status() IS 'Remove status de digitação mais antigos que 30 segundos';
COMMENT ON FUNCTION update_conversation_timestamp() IS 'Atualiza timestamp da conversa quando nova mensagem é inserida';

-- ===================================================================
-- VERIFICAÇÕES FINAIS
-- ===================================================================

-- Verificar se as tabelas foram criadas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE NOTICE 'Tabela users criada com sucesso';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    RAISE NOTICE 'Tabela messages criada com sucesso';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'typing_status') THEN
    RAISE NOTICE 'Tabela typing_status criada com sucesso';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    RAISE NOTICE 'Tabela conversations criada com sucesso';
  END IF;
END $$;

-- ===================================================================
-- FIM DO SETUP
-- ===================================================================