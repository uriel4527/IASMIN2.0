# ChatApp - Sistema de Mensagens para Dois Usuários

## Descrição
Sistema de chat simplificado para comunicação entre dois usuários específicos: "Sr" e "Sr1".

## Configuração do Banco de Dados

Execute o arquivo `database.sql` no seu Supabase para criar as tabelas necessárias:

```sql
-- Execute este arquivo no seu painel Supabase SQL Editor
-- O arquivo database.sql contém toda a estrutura necessária
```

## Usuários Pré-configurados

- **Sr**: Primeiro usuário (ID: 11111111-1111-1111-1111-111111111111)
- **Sr1**: Segundo usuário (ID: 22222222-2222-2222-2222-222222222222)

## Estrutura do Banco

### Tabelas
- `users`: Informações dos usuários
- `messages`: Mensagens trocadas
- `conversations`: Conversas entre usuários

### Recursos
- ✅ Mensagens em tempo real
- ✅ Status online/offline
- ✅ Interface moderna e responsiva
- ✅ Autenticação simplificada
- ✅ Integração com Supabase

## Como usar

1. Execute o script `database.sql` no Supabase
2. Acesse a aplicação
3. Escolha entre os usuários "Sr" ou "Sr1"
4. Comece a conversar!

## Configuração

O sistema utiliza a seguinte configuração do Supabase:
- URL: https://wnxsnfvjtuumswlbsali.supabase.co
- Chave: Configurada no código

## Tecnologias

- React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (banco de dados e tempo real)
- Vite (build)