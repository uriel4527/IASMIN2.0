-- Tabela para armazenar as subscriptions de push notifications dos usuários
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT push_subscriptions_endpoint_unique UNIQUE(endpoint)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created ON push_subscriptions(created_at DESC);

-- Desabilitar RLS para permitir acesso da Edge Function
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Comentário da tabela
COMMENT ON TABLE push_subscriptions IS 'Armazena as subscriptions de push notifications dos usuários';
