-- Encountry: banco central, perfis de acesso e dados operacionais.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create type public.papel_usuario as enum ('admin', 'caixa', 'barraca');

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

create policy "usuários autenticados consultam barracas" on public.barracas for select to authenticated using (true);
create policy "admin gerencia barracas" on public.barracas for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "usuário consulta próprio perfil" on public.perfis for select to authenticated using (id = auth.uid() or public.meu_papel() = 'admin');
create policy "admin gerencia perfis" on public.perfis for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

create policy "usuários autenticados consultam produtos" on public.produtos for select to authenticated using (true);
create policy "admin gerencia produtos" on public.produtos for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');
create policy "barraca gerencia próprios produtos" on public.produtos for all to authenticated using (public.meu_papel() = 'barraca' and barraca_id = public.minha_barraca()) with check (public.meu_papel() = 'barraca' and barraca_id = public.minha_barraca());

create policy "usuários autenticados consultam vendas" on public.vendas for select to authenticated using (true);
create policy "admin gerencia vendas" on public.vendas for all to authenticated using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');
create policy "caixa registra próprias vendas" on public.vendas for insert to authenticated with check (public.meu_papel() = 'caixa' and origem = 'caixa');
create policy "caixa remove próprias vendas" on public.vendas for delete to authenticated using (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid());
create policy "caixa atualiza próprias vendas" on public.vendas for update to authenticated using (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid()) with check (public.meu_papel() = 'caixa' and origem = 'caixa' and created_by = auth.uid());
create policy "barraca gerencia próprias vendas" on public.vendas for all to authenticated using (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca()) with check (public.meu_papel() = 'barraca' and origem = 'barraca' and barraca_id = public.minha_barraca());

create or replace function public.registrar_autor_da_venda()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.created_by = auth.uid(); return new; end; $$;

create trigger vendas_autor before insert on public.vendas for each row execute function public.registrar_autor_da_venda();

-- Crie o primeiro usuário pelo menu Authentication > Users e depois promova-o:
-- insert into public.perfis (id, nome, papel) values ('UUID-DO-USUARIO', 'Administrador', 'admin');
