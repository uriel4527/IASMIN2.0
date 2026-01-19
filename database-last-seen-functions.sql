-- Função para formatar horário de "visto por último" em português
CREATE OR REPLACE FUNCTION format_last_seen_pt(last_seen_time TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
    diff_minutes INTEGER;
    diff_hours INTEGER;
    diff_days INTEGER;
BEGIN
    -- Se last_seen_time for null, retorna string vazia
    IF last_seen_time IS NULL THEN
        RETURN '';
    END IF;
    
    -- Calcular diferença em minutos
    diff_minutes := EXTRACT(EPOCH FROM (NOW() - last_seen_time)) / 60;
    
    -- Menos de 1 minuto
    IF diff_minutes < 1 THEN
        RETURN 'agora mesmo';
    END IF;
    
    -- Menos de 60 minutos
    IF diff_minutes < 60 THEN
        IF diff_minutes = 1 THEN
            RETURN '1 minuto atrás';
        ELSE
            RETURN diff_minutes || ' minutos atrás';
        END IF;
    END IF;
    
    -- Calcular diferença em horas
    diff_hours := diff_minutes / 60;
    
    -- Menos de 24 horas
    IF diff_hours < 24 THEN
        IF diff_hours = 1 THEN
            RETURN '1 hora atrás';
        ELSE
            RETURN diff_hours || ' horas atrás';
        END IF;
    END IF;
    
    -- Calcular diferença em dias
    diff_days := diff_hours / 24;
    
    -- Menos de 7 dias
    IF diff_days < 7 THEN
        IF diff_days = 1 THEN
            RETURN '1 dia atrás';
        ELSE
            RETURN diff_days || ' dias atrás';
        END IF;
    END IF;
    
    -- Mais de 7 dias - mostrar data formatada
    RETURN 'em ' || TO_CHAR(last_seen_time, 'DD/MM/YYYY');
END;
$$ LANGUAGE plpgsql;

-- Função para obter informação de último acesso formatada
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
            ELSE format_last_seen_pt(u.last_seen)
        END as last_seen_formatted,
        u.last_seen
    FROM users u
    WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Conceder permissões para as funções
GRANT EXECUTE ON FUNCTION format_last_seen_pt(TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_last_seen_info(UUID) TO anon, authenticated;