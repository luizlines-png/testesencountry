-- Adiciona o perfil exclusivo da portaria e ajusta suas permissões.
alter type public.papel_usuario add value if not exists 'portaria';

drop policy if exists "admin e caixa consultam entradas" on public.entradas;
drop policy if exists "admin e caixa registram entradas" on public.entradas;
drop policy if exists "admin e portaria consultam entradas" on public.entradas;
drop policy if exists "admin e portaria registram entradas" on public.entradas;

create policy "admin e portaria consultam entradas" on public.entradas
  for select to authenticated
  using (public.meu_papel()::text in ('admin', 'portaria'));

create policy "admin e portaria registram entradas" on public.entradas
  for insert to authenticated
  with check (public.meu_papel()::text in ('admin', 'portaria'));
