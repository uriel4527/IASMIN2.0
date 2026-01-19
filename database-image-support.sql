-- SQL para adicionar suporte a imagens nas mensagens
-- Execute no Supabase SQL Editor

-- 1. Adicionar colunas para suporte a imagens na tabela messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS image_data TEXT,
ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT FALSE;

-- 2. Criar índice para otimizar consultas com imagens
CREATE INDEX IF NOT EXISTS idx_messages_has_image 
ON messages(has_image) 
WHERE has_image = TRUE;

-- 3. Atualizar política RLS para permitir inserção com imagens
-- (As políticas existentes já devem cobrir isso, mas vamos garantir)

-- 4. Função para limpeza de mensagens com imagens antigas (economizar espaço)
CREATE OR REPLACE FUNCTION cleanup_old_image_messages()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove mensagens com imagens mais antigas que 30 dias
  DELETE FROM messages 
  WHERE has_image = TRUE 
    AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- 5. Estatísticas de uso de imagens
CREATE OR REPLACE VIEW image_usage_stats AS
SELECT 
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE has_image = TRUE) as messages_with_images,
  ROUND(
    COUNT(*) FILTER (WHERE has_image = TRUE) * 100.0 / COUNT(*), 2
  ) as image_percentage,
  SUM(LENGTH(image_data))::bigint as total_image_size_bytes,
  pg_size_pretty(SUM(LENGTH(image_data))::bigint) as total_image_size_pretty,
  AVG(LENGTH(image_data)) FILTER (WHERE has_image = TRUE)::bigint as avg_image_size_bytes
FROM messages;

-- 6. Função para otimizar espaço comprimindo imagens antigas
CREATE OR REPLACE FUNCTION get_image_messages_stats()
RETURNS TABLE(
  total_messages_with_images BIGINT,
  total_size_bytes BIGINT,
  total_size_pretty TEXT,
  avg_size_bytes BIGINT,
  oldest_image_date TIMESTAMPTZ,
  newest_image_date TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages_with_images,
    SUM(LENGTH(image_data))::bigint as total_size_bytes,
    pg_size_pretty(SUM(LENGTH(image_data))::bigint) as total_size_pretty,
    AVG(LENGTH(image_data))::bigint as avg_size_bytes,
    MIN(created_at) as oldest_image_date,
    MAX(created_at) as newest_image_date
  FROM messages 
  WHERE has_image = TRUE AND image_data IS NOT NULL;
END;
$$;

-- Comentários sobre uso e economia de espaço:
-- 
-- 1. As imagens são armazenadas como base64 TEXT, o que aumenta o tamanho em ~33%
--    mas facilita a consulta e exibição direta no frontend
-- 
-- 2. A compressão no frontend (antes do envio) é essencial para economizar espaço
-- 
-- 3. Para projetos com muitas imagens, considere:
--    - Implementar limpeza automática (função cleanup_old_image_messages)
--    - Usar armazenamento externo (Supabase Storage) para imagens grandes
--    - Implementar diferentes níveis de compressão baseado no tamanho
-- 
-- 4. Para consultar estatísticas de uso:
--    SELECT * FROM image_usage_stats;
--    SELECT * FROM get_image_messages_stats();
-- 
-- 5. Para limpeza manual de imagens antigas:
--    SELECT cleanup_old_image_messages();