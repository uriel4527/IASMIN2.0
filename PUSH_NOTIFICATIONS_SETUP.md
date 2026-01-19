# Setup de Push Notifications

## Passos para configurar:

### 1. Executar SQLs no Supabase (na ordem):
```bash
# 1. Habilitar extensão pg_net
database-pgnet-enable.sql

# 2. Criar tabela de subscriptions
database-push-subscriptions.sql

# 3. IMPORTANTE: Executar novamente o trigger corrigido
database-push-trigger.sql
```

**ATENÇÃO**: Se você já executou o trigger anteriormente e o chat parou de funcionar, execute novamente o `database-push-trigger.sql` corrigido para resolver o problema.

### 2. Gerar VAPID Keys:
```bash
npx web-push generate-vapid-keys
```

### 3. Configurar Secrets no Supabase:
No painel do Supabase, vá em Edge Functions > Settings > Secrets e adicione:
- `VAPID_PUBLIC_KEY`: Sua chave pública gerada
- `VAPID_PRIVATE_KEY`: Sua chave privada gerada
- `VAPID_EMAIL`: Seu email (ex: mailto:seu@email.com)

### 4. Atualizar código:
- Edite `src/components/chat/SimpleChatInterface.tsx` linha 813
- Substitua `'SUA_CHAVE_PUBLICA_VAPID_AQUI'` pela sua chave pública real

### 5. Testar:
- Acesse `/push-debug` para uma página de debug completa com diagnóstico
- Permita notificações quando solicitado
- Verifique todos os status e troubleshooting
- Envie uma notificação de teste

Ou acesse `/test-push-notification` para um teste rápido

## Troubleshooting:
- Verifique os logs da Edge Function no Supabase
- Certifique-se de que o Service Worker está registrado
- Teste em HTTPS (localhost funciona também)
