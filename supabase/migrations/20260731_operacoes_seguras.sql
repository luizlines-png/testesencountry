drop policy if exists "usuários autenticados consultam produtos" on public.produtos;


-- Habilita a sincronização das telas entre os dispositivos do evento.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'barracas') then
      alter publication supabase_realtime add table public.barracas;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'produtos') then
      alter publication supabase_realtime add table public.produtos;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendas') then
      alter publication supabase_realtime add table public.vendas;
    end if;
  end if;
end;
$$;
drop policy if exists "produtos visíveis conforme perfil" on public.produtos;
create policy "produtos visíveis conforme perfil" on public.produtos for select to authenticated using (
  public.meu_papel() in ('admin', 'caixa')
  or (public.meu_papel() = 'barraca' and barraca_id = public.minha_barraca())
);

drop policy if exists "usuários autenticados consultam vendas" on public.vendas;
drop policy if exists "vendas visíveis conforme perfil" on public.vendas;
create policy "vendas visíveis conforme perfil" on public.vendas for select to authenticated using (
  public.meu_papel() = 'admin'
  or (public.meu_papel() = 'caixa' and origem = 'caixa')
  or (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca())
);

create or replace function public.registrar_venda_barraca(
  p_produto_id text,
  p_venda_id text,
  p_hora timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  produto_atual public.produtos;
  venda_nova public.vendas;
begin
  select * into produto_atual from public.produtos where id = p_produto_id for update;
  if produto_atual.id is null
    or public.meu_papel() not in ('admin', 'barraca')
    or (public.meu_papel() = 'barraca' and produto_atual.barraca_id <> public.minha_barraca()) then
    raise exception 'Produto não encontrado ou acesso negado.';
  end if;
  if produto_atual.esgotado or produto_atual.quantidade <= 0 then
    raise exception 'Produto sem estoque disponível.';
  end if;

  update public.produtos
  set quantidade = quantidade - 1, esgotado = quantidade - 1 <= 0, updated_at = now()
  where id = p_produto_id
  returning * into produto_atual;

  insert into public.vendas (id, barraca_id, origem, tipo, valor, item, itens, hora)
  values (
    p_venda_id, produto_atual.barraca_id, 'barraca', 'produto', produto_atual.preco,
    produto_atual.nome,
    jsonb_build_array(jsonb_build_object('produtoId', produto_atual.id, 'nome', produto_atual.nome, 'quantidade', 1)),
    p_hora
  )
  returning * into venda_nova;

  return jsonb_build_object('produto', to_jsonb(produto_atual), 'venda', to_jsonb(venda_nova));
end;
$$;

create or replace function public.excluir_venda_barraca(p_venda_id text)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
  venda_atual public.vendas;
  produto_id text;
  produto_atual public.produtos;
begin
  select * into venda_atual from public.vendas where id = p_venda_id for update;
  if venda_atual.id is null or venda_atual.origem <> 'barraca'
    or public.meu_papel() not in ('admin', 'barraca')
    or (public.meu_papel() = 'barraca' and venda_atual.barraca_id <> public.minha_barraca()) then
    raise exception 'Venda não encontrada ou acesso negado.';
  end if;

  produto_id := venda_atual.itens->0->>'produtoId';
  if produto_id is not null then
    update public.produtos set quantidade = quantidade + 1, esgotado = false, updated_at = now()
    where id = produto_id and barraca_id = venda_atual.barraca_id
    returning * into produto_atual;
  end if;

  delete from public.vendas where id = p_venda_id;
  return jsonb_build_object('produto', case when produto_atual.id is null then null else to_jsonb(produto_atual) end);
end;
$$;
