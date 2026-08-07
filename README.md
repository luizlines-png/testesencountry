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

### 4. Publicar o gerenciamento de acessos

A tela administrativa cria, edita e remove contas reais do Supabase Auth por
meio da Edge Function `gerenciar-usuarios`. Publique a função antes de usar o
módulo **Acessos**:

```bash
supabase functions deploy gerenciar-usuarios
```

Ela também pode ser criada no painel do Supabase copiando o conteúdo de
`supabase/functions/gerenciar-usuarios/index.ts`. A função recebe a sessão do
usuário logado e confirma no banco que ele possui o papel `admin` antes de usar
as operações administrativas do Auth. Nenhuma chave administrativa é enviada
ao navegador ou à Vercel.

### Atualizar um banco já existente

Para uma instalação que já executou o esquema anteriormente, rode no SQL Editor
as migrações ainda não aplicadas da pasta `supabase/migrations`, respeitando a
ordem dos nomes. A migração mais recente mantém os produtos em modo somente
leitura para operadores de barraca. As migrações anteriores tornam a venda da
barraca transacional, restringem os dados por perfil e habilitam a sincronização
em tempo real. Vendas feitas no caixa continuam sem alterar o estoque.

Depois de executar a migração, abra o sistema em dois navegadores e confirme que
uma venda feita em um deles aparece automaticamente no outro. Se o indicador de
conexão mostrar reconexão por muito tempo, confira se o serviço Realtime está
habilitado no projeto Supabase.

Para habilitar ou corrigir **Histórico**, **Arquivar e resetar** e **Restaurar**
em um banco online existente, execute também
`supabase/migrations/2026080602_corrige_historico_online.sql`. O arquivo pode ser
reaplicado com segurança e preserva os históricos já arquivados.

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
