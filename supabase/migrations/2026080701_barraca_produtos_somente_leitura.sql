-- Mantém produtos em modo somente leitura para operadores de barraca.
-- O administrador continua responsável por cadastrar, alterar e excluir.

drop policy if exists "barraca gerencia próprios produtos" on public.produtos;
drop policy if exists "barraca atualiza próprios produtos" on public.produtos;
drop policy if exists "barraca exclui próprios produtos" on public.produtos;
