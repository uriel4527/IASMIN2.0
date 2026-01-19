-- ===================================================================
-- CLEAR ALL MESSAGES - VERSÃO COMPATÍVEL COM NOVO BANCO
-- ===================================================================
-- Remove TODAS as mensagens e dados relacionados
-- Use com extrema cautela - ação irreversível!

-- Drop funções antigas se existirem
DROP FUNCTION IF EXISTS get_messages_storage_stats();
DROP FUNCTION IF EXISTS clear_all_messages();

-- Função para obter estatísticas de armazenamento
CREATE FUNCTION get_messages_storage_stats()
RETURNS TABLE (
    total_messages BIGINT,
    text_messages BIGINT,
    image_messages BIGINT,
    audio_messages BIGINT,
    video_messages BIGINT,
    estimated_text_size_kb NUMERIC,
    estimated_image_size_kb NUMERIC,
    estimated_audio_size_kb NUMERIC,
    estimated_video_size_kb NUMERIC,
    total_estimated_size_kb NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_messages,
        COUNT(*) FILTER (WHERE content IS NOT NULL AND content != '')::BIGINT as text_messages,
        COUNT(*) FILTER (WHERE has_image = true)::BIGINT as image_messages,
        COUNT(*) FILTER (WHERE has_audio = true)::BIGINT as audio_messages,
        COUNT(*) FILTER (WHERE has_video = true)::BIGINT as video_messages,
        -- Estimativa de tamanho de texto (média de 100 bytes por mensagem)
        ROUND((COUNT(*) FILTER (WHERE content IS NOT NULL AND content != '') * 0.1)::NUMERIC, 2) as estimated_text_size_kb,
        -- Estimativa de tamanho de imagem (média de 50KB por imagem)
        ROUND((COUNT(*) FILTER (WHERE has_image = true) * 50)::NUMERIC, 2) as estimated_image_size_kb,
        -- Estimativa de tamanho de áudio (média de 100KB por áudio)
        ROUND((COUNT(*) FILTER (WHERE has_audio = true) * 100)::NUMERIC, 2) as estimated_audio_size_kb,
        -- Estimativa de tamanho de vídeo (média de 500KB por vídeo)
        ROUND((COUNT(*) FILTER (WHERE has_video = true) * 500)::NUMERIC, 2) as estimated_video_size_kb,
        -- Tamanho total estimado
        ROUND((
            (COUNT(*) FILTER (WHERE content IS NOT NULL AND content != '') * 0.1) +
            (COUNT(*) FILTER (WHERE has_image = true) * 50) +
            (COUNT(*) FILTER (WHERE has_audio = true) * 100) +
            (COUNT(*) FILTER (WHERE has_video = true) * 500)
        )::NUMERIC, 2) as total_estimated_size_kb
    FROM messages;
END;
$$;

-- Função para limpar todas as mensagens
CREATE FUNCTION clear_all_messages()
RETURNS TABLE (
    deleted_messages_count BIGINT,
    deleted_reactions_count BIGINT,
    cleared_typing_status_count BIGINT,
    estimated_freed_space_kb NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    msg_count BIGINT;
    reaction_count BIGINT;
    typing_count BIGINT;
    freed_space NUMERIC;
BEGIN
    -- Obter contagens antes da deleção
    SELECT COUNT(*) INTO msg_count FROM messages;
    SELECT COUNT(*) INTO typing_count FROM typing_status;
    
    -- Contar reações (se a tabela existir)
    BEGIN
        SELECT COUNT(*) INTO reaction_count FROM message_reactions;
    EXCEPTION WHEN undefined_table THEN
        reaction_count := 0;
    END;
    
    -- Calcular espaço a ser liberado
    SELECT 
        ROUND((
            (COUNT(*) FILTER (WHERE content IS NOT NULL AND content != '') * 0.1) +
            (COUNT(*) FILTER (WHERE has_image = true) * 50) +
            (COUNT(*) FILTER (WHERE has_audio = true) * 100) +
            (COUNT(*) FILTER (WHERE has_video = true) * 500)
        )::NUMERIC, 2)
    INTO freed_space
    FROM messages;
    
    -- Deletar reações primeiro (foreign key para messages)
    BEGIN
        DELETE FROM message_reactions WHERE true;
    EXCEPTION WHEN undefined_table THEN
        NULL; -- Tabela não existe, ignorar
    END;
    
    -- Limpar status de digitação
    DELETE FROM typing_status WHERE true;
    
    -- Deletar todas as mensagens
    DELETE FROM messages WHERE true;
    
    -- Retornar resultados
    RETURN QUERY SELECT msg_count, reaction_count, typing_count, freed_space;
END;
$$;

-- Garantir permissões corretas (sem RLS, permitir a todos)
GRANT EXECUTE ON FUNCTION get_messages_storage_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION clear_all_messages() TO anon, authenticated, service_role;

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Funções de limpeza de mensagens atualizadas com sucesso!';
    RAISE NOTICE '⚠️  Use clear_all_messages() com EXTREMA CAUTELA - ação irreversível!';
END $$;