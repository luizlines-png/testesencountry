-- Habilita e corrige o histórico no banco online existente.
-- Esta migração é idempotente e não remove históricos já arquivados.

create table if not exists public.historico_eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados jsonb not null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table public.historico_eventos enable row level security;

drop policy if exists "admin consulta historico" on public.historico_eventos;
create policy "admin consulta historico" on public.historico_eventos
  for select to authenticated
  using (public.meu_papel() = 'admin');

revoke all on table public.historico_eventos from anon;
grant select on table public.historico_eventos to authenticated;

create or replace function public.arquivar_e_resetar_evento(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if public.meu_papel() is distinct from 'admin'::public.papel_usuario then
    raise exception 'Somente administradores podem resetar o evento.';
  end if;
  if nullif(trim(p_nome), '') is null then
    raise exception 'Informe um nome para o histórico.';
  end if;

  perform pg_advisory_xact_lock(hashtext('encountry-historico-evento'));

  insert into public.historico_eventos (nome, dados, criado_por)
  values (
    trim(p_nome),
    jsonb_build_object(
      'barracas', coalesce((select jsonb_agg(to_jsonb(b)) from public.barracas b), '[]'::jsonb),
      'produtos', coalesce((select jsonb_agg(to_jsonb(p)) from public.produtos p), '[]'::jsonb),
      'vendas', coalesce((select jsonb_agg(to_jsonb(v)) from public.vendas v), '[]'::jsonb),
      'entradas', coalesce((select jsonb_agg(to_jsonb(e)) from public.entradas e), '[]'::jsonb)
    ),
    auth.uid()
  ) returning id into v_id;

  delete from public.entradas;
  delete from public.vendas;
  delete from public.produtos;

  return v_id;
end;
$$;

create or replace function public.restaurar_evento(p_historico_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dados jsonb;
begin
  if public.meu_papel() is distinct from 'admin'::public.papel_usuario then
    raise exception 'Somente administradores podem restaurar o evento.';
  end if;

  perform pg_advisory_xact_lock(hashtext('encountry-historico-evento'));

  select dados into v_dados
  from public.historico_eventos
  where id = p_historico_id;

  if v_dados is null then
    raise exception 'Histórico não encontrado.';
  end if;

  delete from public.entradas;
  delete from public.vendas;
  delete from public.produtos;

  insert into public.barracas (id, nome, created_at)
  select id, nome, created_at
  from jsonb_populate_recordset(null::public.barracas, v_dados->'barracas')
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

notify pgrst, 'reload schema';
