-- Encountry: banco central, perfis de acesso e dados operacionais.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create type public.papel_usuario as enum ('admin', 'caixa', 'barraca', 'portaria');

create table public.barracas (
  id text primary key,
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel public.papel_usuario not null,
  barraca_id text references public.barracas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint barraca_obrigatoria check ((papel <> 'barraca') or barraca_id is not null)
);

create table public.produtos (
  id text primary key,
  barraca_id text not null references public.barracas(id) on delete cascade,
  nome text not null,
  preco numeric(12,2) not null check (preco > 0),
  quantidade integer not null default 0 check (quantidade >= 0),
  esgotado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendas (
  id text primary key,
  barraca_id text references public.barracas(id) on delete set null,
  origem text not null check (origem in ('caixa', 'barraca')),
  tipo text not null default 'avulsa',
  valor numeric(12,2) not null check (valor > 0),
  item text,
  itens jsonb,
  hora timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index vendas_origem_hora_idx on public.vendas (origem, hora desc);
create table public.entradas (
  id text primary key,
  faixa text not null check (faixa in ('adulto', 'crianca')),
  vinculo text not null check (vinculo in ('visitante', 'membro')),
  hora timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  operador_nome text,
  created_at timestamptz not null default now()
);

create index entradas_hora_idx on public.entradas (hora desc);
create index vendas_barraca_hora_idx on public.vendas (barraca_id, hora desc);
create index produtos_barraca_idx on public.produtos (barraca_id);

create or replace function public.meu_papel()
returns public.papel_usuario
language sql stable security definer set search_path = public
as $$ select papel from public.perfis where id = auth.uid() $$;

create or replace function public.minha_barraca()
returns text
language sql stable security definer set search_path = public
as $$ select barraca_id from public.perfis where id = auth.uid() $$;

alter table public.barracas enable row level security;
alter table public.perfis enable row level security;
alter table public.produtos enable row level security;
alter table public.vendas enable row level security;
alter table public.entradas enable row level security;

create policy "usuários autenticados consultam barracas" on public.barracas for select to authenticated using (true);
create policy "admin gerencia barracas" on public.barracas for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "usuário consulta próprio perfil" on public.perfis for select to authenticated using (id = auth.uid() or public.meu_papel() = 'admin');
create policy "admin gerencia perfis" on public.perfis for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "produtos visíveis conforme perfil" on public.produtos for select to authenticated using (
  public.meu_papel() in ('admin', 'caixa')
  or (public.meu_papel() = 'barraca' and barraca_id = public.minha_barraca())
);
create policy "admin gerencia produtos" on public.produtos for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "vendas visíveis conforme perfil" on public.vendas for select to authenticated using (
  public.meu_papel() = 'admin'
  or (public.meu_papel() = 'caixa' and origem = 'caixa')
  or (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca())
);
create policy "admin gerencia vendas" on public.vendas for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');
create policy "caixa registra próprias vendas" on public.vendas for insert to authenticated with check (public.meu_papel() = 'caixa' and origem = 'caixa');
create policy "caixa remove próprias vendas" on public.vendas for delete to authenticated using (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid());
create policy "caixa atualiza próprias vendas" on public.vendas for update to authenticated using (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid()) with check (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid());
create policy "barraca gerencia próprias vendas" on public.vendas for all to authenticated using (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca()) with check (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca());

create policy "admin e portaria consultam entradas" on public.entradas for select to authenticated using (public.meu_papel() in ('admin', 'portaria'));
create policy "admin e portaria registram entradas" on public.entradas for insert to authenticated with check (public.meu_papel() in ('admin', 'portaria'));
create policy "operador desfaz própria entrada" on public.entradas for delete to authenticated using (public.meu_papel() = 'admin' or created_by = auth.uid());

create or replace function public.registrar_autor_da_venda()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.created_by = auth.uid(); return new; end; $$;

create trigger vendas_autor before insert on public.vendas for each row execute function public.registrar_autor_da_venda();

create or replace function public.registrar_autor_da_entrada()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.created_by = auth.uid(); return new; end; $$;

create trigger entradas_autor before insert on public.entradas for each row execute function public.registrar_autor_da_entrada();

-- Histórico administrativo e reset atômico do evento.
create table public.historico_eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados jsonb not null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table public.historico_eventos enable row level security;
create policy "admin consulta historico" on public.historico_eventos
  for select to authenticated using (public.meu_papel() = 'admin');
revoke all on table public.historico_eventos from anon;
grant select on table public.historico_eventos to authenticated;

create or replace function public.arquivar_e_resetar_evento(p_nome text)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if public.meu_papel() is distinct from 'admin'::public.papel_usuario then
    raise exception 'Somente administradores podem resetar o evento.';
  end if;
  if nullif(trim(p_nome), '') is null then raise exception 'Informe um nome para o histórico.'; end if;
  perform pg_advisory_xact_lock(hashtext('encountry-historico-evento'));
  insert into public.historico_eventos (nome, dados, criado_por)
  values (
    trim(p_nome),
    jsonb_build_object(
      'barracas', coalesce((select jsonb_agg(to_jsonb(b)) from public.barracas b), '[]'::jsonb),
      'produtos', coalesce((select jsonb_agg(to_jsonb(p)) from public.produtos p), '[]'::jsonb),
      'vendas', coalesce((select jsonb_agg(to_jsonb(v)) from public.vendas v), '[]'::jsonb),
      'entradas', coalesce((select jsonb_agg(to_jsonb(e)) from public.entradas e), '[]'::jsonb)
    ), auth.uid()
  ) returning id into v_id;
  delete from public.entradas where true;
  delete from public.vendas where true;
  delete from public.produtos where true;
  return v_id;
end;
$$;

create or replace function public.restaurar_evento(p_historico_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_dados jsonb;
begin
  if public.meu_papel() is distinct from 'admin'::public.papel_usuario then
    raise exception 'Somente administradores podem restaurar o evento.';
  end if;
  perform pg_advisory_xact_lock(hashtext('encountry-historico-evento'));
  select dados into v_dados from public.historico_eventos where id = p_historico_id;
  if v_dados is null then raise exception 'Histórico não encontrado.'; end if;
  delete from public.entradas where true;
  delete from public.vendas where true;
  delete from public.produtos where true;
  insert into public.barracas (id, nome, created_at)
    select id, nome, created_at from jsonb_populate_recordset(null::public.barracas, v_dados->'barracas')
    on conflict (id) do update set nome = excluded.nome;
  insert into public.produtos (id, barraca_id, nome, preco, quantidade, esgotado, created_at, updated_at)
    select id, barraca_id, nome, preco, quantidade, esgotado, created_at, updated_at
    from jsonb_populate_recordset(null::public.produtos, v_dados->'produtos');
  insert into public.vendas (id, barraca_id, origem, tipo, valor, item, itens, hora, created_by, created_at)
    select id, barraca_id, origem, tipo, valor, item, itens, hora, created_by, created_at
    from jsonb_populate_recordset(null::public.vendas, v_dados->'vendas');
  insert into public.entradas (id, faixa, vinculo, hora, created_by, operador_nome, created_at)
    select id, faixa, vinculo, hora, created_by, operador_nome, created_at
    from jsonb_populate_recordset(null::public.entradas, v_dados->'entradas');
end;
$$;

revoke all on function public.arquivar_e_resetar_evento(text) from public, anon;
revoke all on function public.restaurar_evento(uuid) from public, anon;
grant execute on function public.arquivar_e_resetar_evento(text) to authenticated;
grant execute on function public.restaurar_evento(uuid) to authenticated;


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
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entradas') then
      alter publication supabase_realtime add table public.entradas;
    end if;
  end if;
end;
$$;
-- Registra a venda e baixa uma unidade em uma única transação. Esta função
-- é exclusiva da barraca; vendas do caixa nunca alteram o estoque.
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
  select * into produto_atual
  from public.produtos
  where id = p_produto_id
  for update;

  if produto_atual.id is null
    or public.meu_papel() not in ('admin', 'barraca')
    or (public.meu_papel() = 'barraca' and produto_atual.barraca_id <> public.minha_barraca()) then
    raise exception 'Produto não encontrado ou acesso negado.';
  end if;
  if produto_atual.esgotado or produto_atual.quantidade <= 0 then
    raise exception 'Produto sem estoque disponível.';
  end if;

  update public.produtos
  set quantidade = quantidade - 1,
      esgotado = quantidade - 1 <= 0,
      updated_at = now()
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

-- Crie o primeiro usuário pelo menu Authentication > Users e depois promova-o:
-- insert into public.perfis (id, nome, papel) values ('UUID-DO-USUARIO', 'Administrador', 'admin');
