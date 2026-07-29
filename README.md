# Encountry

Aplicação de operação da festa Encountry, com controle de caixa, barracas,
estoque, vendas e perfis de acesso.

## Banco de dados Supabase

O projeto usa Supabase quando as duas variáveis de ambiente estão configuradas.
Sem elas, mantém o modo local no navegador para facilitar o desenvolvimento.

### 1. Criar e preparar o projeto

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** no painel do projeto.
3. Execute todo o arquivo [`supabase/schema.sql`](supabase/schema.sql).
4. Em **Project Settings > API**, copie a URL do projeto e a chave pública
   (`anon`/`publishable`).

### 2. Configurar o Encountry

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

Nunca coloque a `service_role` no `.env` deste front-end. Ela ignora as regras de
segurança do banco e deve existir somente em um servidor confiável.

### 3. Criar o primeiro administrador

1. No Supabase, abra **Authentication > Users** e crie o usuário.
2. Copie o UUID desse usuário.
3. No **SQL Editor**, execute:

```sql
insert into public.perfis (id, nome, papel)
values ('UUID-DO-USUARIO', 'Administrador', 'admin');
```

Depois disso, faça login no Encountry com o e-mail e a senha criados.

Para outros operadores, crie primeiro a conta em **Authentication > Users** e
depois cadastre o perfil correspondente:

```sql
-- Operador de caixa
insert into public.perfis (id, nome, papel)
values ('UUID-DO-USUARIO', 'Nome do operador', 'caixa');

-- Operador de barraca (a barraca precisa existir)
insert into public.perfis (id, nome, papel, barraca_id)
values ('UUID-DO-USUARIO', 'Nome do operador', 'barraca', 'ID-DA-BARRACA');
```

> A tela de controle de acessos ainda gerencia apenas as contas do modo local.
> Com o Supabase ativo, usuários e perfis devem ser criados pelo painel/SQL do
> Supabase conforme explicado acima.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validações:

```bash
npm run lint
npm run build
```
