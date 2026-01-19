-- ===================================================================
-- LIMPEZA TOTAL - REMOVER TODAS AS POLÍTICAS RLS E RECRIAR TABELAS
-- ===================================================================

-- Dropar todas as políticas RLS existentes
DROP POLICY IF EXISTS "Users can read typing status in their conversations" ON typing_status;
DROP POLICY IF EXISTS "Users can manage their own typing status" ON typing_status;
DROP POLICY IF EXISTS "Users can read messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can read their own profile and others they chat with" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can see conversations they are part of" ON conversations;

-- Desabilitar RLS completamente
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS typing_status DISABLE ROW LEVEL SECURITY;

-- Recriar tabela typing_status com estrutura simplificada
DROP TABLE IF EXISTS typing_status;
CREATE TABLE typing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversation_with TEXT NOT NULL,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, conversation_with)
);

-- Garantir que não há RLS
ALTER TABLE typing_status DISABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_typing_status_user_conversation ON typing_status(user_id, conversation_with);
CREATE INDEX IF NOT EXISTS idx_typing_status_updated ON typing_status(last_updated);
CREATE INDEX IF NOT EXISTS idx_typing_status_is_typing ON typing_status(is_typing);

-- Função de cleanup simplificada
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

-- Trigger para cleanup automático
CREATE OR REPLACE FUNCTION trigger_cleanup_typing()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_old_typing_status();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_typing_trigger ON typing_status;
CREATE TRIGGER cleanup_typing_trigger
  AFTER INSERT OR UPDATE ON typing_status
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_typing();

-- Verificar se funcionou
DO $$
BEGIN
  RAISE NOTICE 'Limpeza concluída! Tabelas sem RLS:';
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'typing_status'
  ) THEN
    RAISE NOTICE '✓ typing_status: SEM políticas RLS';
  ELSE
    RAISE NOTICE '✗ typing_status: AINDA TEM políticas RLS';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages'
  ) THEN
    RAISE NOTICE '✓ messages: SEM políticas RLS';
  ELSE
    RAISE NOTICE '✗ messages: AINDA TEM políticas RLS';
  END IF;
END $$;