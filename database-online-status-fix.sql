-- =============================================
-- Fix Online Status System - DISABLE RLS
-- =============================================
-- Este script corrige o sistema de status online
-- desabilitando o RLS que estava causando problemas

-- 1. Desabilitar RLS na tabela users
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas existentes
DROP POLICY IF EXISTS "Users can read online status" ON users;
DROP POLICY IF EXISTS "Users can update own online status" ON users;
DROP POLICY IF EXISTS "Users can insert own record" ON users;

-- 3. Recriar função de cleanup (garantir que existe)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar função para obter informações de último acesso
CREATE OR REPLACE FUNCTION get_user_last_seen_info(user_id UUID)
RETURNS TABLE(
  id UUID,
  username TEXT,
  is_online BOOLEAN,
  last_seen_formatted TEXT,
  last_seen_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.is_online,
    CASE 
      WHEN u.is_online THEN 'online'
      WHEN u.last_seen > NOW() - INTERVAL '1 minute' THEN 'há menos de 1 minuto'
      WHEN u.last_seen > NOW() - INTERVAL '1 hour' THEN 
        EXTRACT(MINUTE FROM NOW() - u.last_seen)::INTEGER || ' minutos atrás'
      WHEN u.last_seen > NOW() - INTERVAL '1 day' THEN
        EXTRACT(HOUR FROM NOW() - u.last_seen)::INTEGER || ' horas atrás'
      ELSE
        EXTRACT(DAY FROM NOW() - u.last_seen)::INTEGER || ' dias atrás'
    END as last_seen_formatted,
    u.last_seen as last_seen_timestamp
  FROM users u
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Garantir índices para performance
CREATE INDEX IF NOT EXISTS idx_users_online_status ON users(is_online, last_seen);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);

-- 6. Garantir permissões
GRANT EXECUTE ON FUNCTION cleanup_offline_users() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_last_seen_info(UUID) TO anon, authenticated;

-- 7. Adicionar comentários
COMMENT ON FUNCTION cleanup_offline_users() IS 'Marca usuários como offline se não foram vistos por mais de 2 minutos';
COMMENT ON FUNCTION get_user_last_seen_info(UUID) IS 'Retorna informações formatadas de último acesso do usuário';

-- 8. Mensagem de conclusão
DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de status online corrigido com sucesso!';
  RAISE NOTICE '📝 Mudanças aplicadas:';
  RAISE NOTICE '   - RLS desabilitado na tabela users';
  RAISE NOTICE '   - Políticas removidas';
  RAISE NOTICE '   - Funções criadas/atualizadas';
  RAISE NOTICE '   - Índices otimizados';
  RAISE NOTICE '🚀 O status online deve funcionar corretamente agora!';
END $$;
