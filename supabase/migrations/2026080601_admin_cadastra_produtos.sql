-- Restringe o cadastro de produtos ao perfil administrador.
-- Barracas continuam autorizadas a ajustar estoque, disponibilidade e excluir
-- produtos vinculados à própria barraca.

drop policy if exists "barraca gerencia próprios produtos" on public.produtos;
drop policy if exists "barraca atualiza próprios produtos" on public.produtos;
drop policy if exists "barraca exclui próprios produtos" on public.produtos;

create policy "barraca atualiza próprios produtos" on public.produtos
  for update to authenticated
  using (
    public.meu_papel() = 'barraca'
    and barraca_id = public.minha_barraca()
  )
  with check (
    public.meu_papel() = 'barraca'
    and barraca_id = public.minha_barraca()
  );

create policy "barraca exclui próprios produtos" on public.produtos
  for delete to authenticated
  using (
    public.meu_papel() = 'barraca'
    and barraca_id = public.minha_barraca()
  );
