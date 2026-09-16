-- ============================================================
-- Migração: tenta destravar o tempo real do Comercial.
--
-- Diagnóstico: cadastrar um produto salva certinho no banco, mas
-- a lista só atualiza depois de dar F5 — o evento de tempo real
-- nunca chega. A única diferença entre as tabelas que já funcionam
-- em tempo real (Técnica, política "using (true)") e as que não
-- funcionam (Comercial, política com "exists (select ... from
-- profiles ...)") é justamente essa subconsulta pra outra tabela.
-- O Realtime do Supabase é conhecido por descartar o evento
-- silenciosamente (sem erro) quando a política de RLS depende de
-- outra tabela com RLS própria.
--
-- Fix: em vez de fazer a subconsulta direto na policy, empacota
-- num a função "security definer" — ela mesma ignora o RLS de
-- profiles internamente, então vira uma checagem simples (sem
-- subconsulta aninhada) do ponto de vista de quem avalia a policy.
--
-- Roda isso no SQL Editor do Supabase.
-- ============================================================

create or replace function has_access(dept text, admin_only boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and department = dept
      and (not admin_only or level = 'admin')
  );
$$;

grant execute on function has_access(text, boolean) to authenticated;

drop policy if exists "comercial le produtos" on products;
drop policy if exists "admin comercial cadastra produtos" on products;
drop policy if exists "admin comercial edita produtos" on products;
drop policy if exists "admin comercial remove produtos" on products;
drop policy if exists "comercial acessa clientes" on customers;
drop policy if exists "comercial acessa pedidos" on orders;
drop policy if exists "comercial acessa itens do pedido" on order_items;

create policy "comercial le produtos" on products for select using (has_access('comercial'));
create policy "admin comercial cadastra produtos" on products for insert with check (has_access('comercial', true));
create policy "admin comercial edita produtos" on products for update using (has_access('comercial', true));
create policy "admin comercial remove produtos" on products for delete using (has_access('comercial', true));

create policy "comercial acessa clientes" on customers for all
  using (has_access('comercial')) with check (has_access('comercial'));
create policy "comercial acessa pedidos" on orders for all
  using (has_access('comercial')) with check (has_access('comercial'));
create policy "comercial acessa itens do pedido" on order_items for all
  using (has_access('comercial')) with check (has_access('comercial'));
