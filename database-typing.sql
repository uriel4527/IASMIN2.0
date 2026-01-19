-- Criar tabela para status de digitação
CREATE TABLE IF NOT EXISTS typing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_with UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir que só existe um registro por conversa entre dois usuários
  UNIQUE(user_id, conversation_with)
);

-- Habilitar RLS
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Política para leitura: usuário pode ver status de quem está conversando com ele
CREATE POLICY "Users can read typing status in their conversations" ON typing_status
FOR SELECT USING (
  auth.uid()::text = user_id::text OR auth.uid()::text = conversation_with::text
);

-- Política para inserção/atualização: usuário só pode controlar seu próprio status
CREATE POLICY "Users can manage their own typing status" ON typing_status
FOR ALL USING (auth.uid()::text = user_id::text);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_typing_status_user_conversation 
ON typing_status(user_id, conversation_with);

CREATE INDEX IF NOT EXISTS idx_typing_status_updated 
ON typing_status(last_updated);

-- Função para limpar status antigos (mais de 10 segundos)
CREATE OR REPLACE FUNCTION cleanup_old_typing_status()
RETURNS void AS $$
BEGIN
  UPDATE typing_status 
  SET is_typing = false 
  WHERE is_typing = true 
  AND last_updated < NOW() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpeza automática
CREATE OR REPLACE FUNCTION trigger_cleanup_typing()
RETURNS trigger AS $$
BEGIN
  PERFORM cleanup_old_typing_status();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Executar limpeza a cada inserção/update
CREATE TRIGGER cleanup_typing_trigger
  AFTER INSERT OR UPDATE ON typing_status
  EXECUTE FUNCTION trigger_cleanup_typing();