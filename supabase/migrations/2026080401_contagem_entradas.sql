-- Contagem de público da portaria, sincronizada entre os operadores.
create table if not exists public.entradas (
  id text primary key,
  faixa text not null check (faixa in ('adulto', 'crianca')),
  vinculo text not null check (vinculo in ('visitante', 'membro')),
  hora timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  operador_nome text,
  created_at timestamptz not null default now()
);

create index if not exists entradas_hora_idx on public.entradas (hora desc);
alter table public.entradas enable row level security;

create policy "admin e portaria consultam entradas" on public.entradas
  for select to authenticated using (public.meu_papel()::text in ('admin', 'portaria'));
create policy "admin e portaria registram entradas" on public.entradas
  for insert to authenticated with check (public.meu_papel()::text in ('admin', 'portaria'));
create policy "operador desfaz própria entrada" on public.entradas
  for delete to authenticated using (public.meu_papel() = 'admin' or created_by = auth.uid());

create or replace function public.registrar_autor_da_entrada()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.created_by = auth.uid(); return new; end; $$;

drop trigger if exists entradas_autor on public.entradas;
create trigger entradas_autor before insert on public.entradas
  for each row execute function public.registrar_autor_da_entrada();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entradas') then
    alter publication supabase_realtime add table public.entradas;
  end if;
end;
$$;
