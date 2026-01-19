-- SQL para monitoramento do banco de dados Supabase
-- Execute estas queries para obter informações detalhadas sobre o uso do banco

-- 1. Estatísticas básicas das tabelas principais
SELECT 
  schemaname,
  relname as tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 2. Tamanho das tabelas em bytes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Informações detalhadas sobre colunas e tipos de dados
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4. Contagem de registros por tabela
SELECT 
  'users' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('users')) as table_size
FROM users
UNION ALL
SELECT 
  'messages' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('messages')) as table_size
FROM messages
UNION ALL
SELECT 
  'typing_status' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('typing_status')) as table_size
FROM typing_status;

-- 5. Atividade recente (últimas 24 horas)
SELECT 
  'users' as table_name,
  COUNT(*) as recent_records
FROM users 
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'messages' as table_name,
  COUNT(*) as recent_records
FROM messages 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 6. Função para limpeza automática e otimização
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
  stat_name TEXT,
  stat_value TEXT,
  description TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_size'::TEXT,
    pg_size_pretty(pg_database_size(current_database()))::TEXT,
    'Tamanho total do banco de dados'::TEXT
  UNION ALL
  SELECT 
    'users_count'::TEXT,
    (SELECT COUNT(*)::TEXT FROM users),
    'Total de usuários'::TEXT
  UNION ALL
  SELECT 
    'messages_count'::TEXT,
    (SELECT COUNT(*)::TEXT FROM messages),
    'Total de mensagens'::TEXT
  UNION ALL
  SELECT 
    'active_users_today'::TEXT,
    (SELECT COUNT(DISTINCT sender_id)::TEXT FROM messages WHERE created_at > CURRENT_DATE),
    'Usuários ativos hoje'::TEXT;
END;
$$;

-- 7. View para monitoramento contínuo
CREATE OR REPLACE VIEW database_monitoring AS
SELECT 
  t.table_name,
  t.row_count,
  t.table_size_bytes,
  pg_size_pretty(t.table_size_bytes) as table_size_pretty,
  ROUND((t.table_size_bytes::NUMERIC / (SELECT SUM(table_size_bytes) FROM (
    SELECT pg_total_relation_size('users') as table_size_bytes
    UNION ALL 
    SELECT pg_total_relation_size('messages') as table_size_bytes
    UNION ALL 
    SELECT pg_total_relation_size('typing_status') as table_size_bytes
  ) total) * 100), 2) as percentage_of_total
FROM (
  SELECT 
    'users' as table_name,
    (SELECT COUNT(*) FROM users) as row_count,
    pg_total_relation_size('users') as table_size_bytes
  UNION ALL
  SELECT 
    'messages' as table_name,
    (SELECT COUNT(*) FROM messages) as row_count,
    pg_total_relation_size('messages') as table_size_bytes
  UNION ALL
  SELECT 
    'typing_status' as table_name,
    (SELECT COUNT(*) FROM typing_status) as row_count,
    pg_total_relation_size('typing_status') as table_size_bytes
) t
ORDER BY t.table_size_bytes DESC;

-- Para usar as consultas de monitoramento:
-- SELECT * FROM get_database_stats();
-- SELECT * FROM database_monitoring;