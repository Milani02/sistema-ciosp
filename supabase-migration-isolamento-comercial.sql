-- ============================================================
-- Migração: trava de verdade (no banco, não só na tela) o acesso
-- às tabelas do Comercial. Antes, qualquer conta logada (de
-- qualquer departamento) conseguia ler/escrever products, customers,
-- orders, order_items — a separação por departamento só existia na
-- interface (menu/rota), não no banco.
--
-- Roda isso no SQL Editor do Supabase (depois de comercial.sql).
--
-- IMPORTANTE — o que isso NÃO resolve: as tabelas da Consultoria
-- Técnica (checkins, sessions, staff, alerts) continuam com RLS
-- aberta (`using (true)`), porque a inscrição pública do visitante
-- (app inscricao) usa a chave anon direto nelas, sem login. Travar
-- isso por departamento exigiria reescrever esse fluxo público pra
-- passar só por função seguras — é uma mudança separada, me avisa
-- se quiser que eu faça.
-- ============================================================

drop policy if exists "equipe autenticada" on products;
drop policy if exists "equipe autenticada" on customers;
drop policy if exists "equipe autenticada" on orders;
drop policy if exists "equipe autenticada" on order_items;

-- ---------- products: comercial lê; só admin comercial escreve ----------
create policy "comercial le produtos" on products for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'));

create policy "admin comercial cadastra produtos" on products for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial' and p.level = 'admin'));

create policy "admin comercial edita produtos" on products for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial' and p.level = 'admin'));

create policy "admin comercial remove produtos" on products for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial' and p.level = 'admin'));

-- ---------- customers/orders/order_items: qualquer comercial autenticado ----------
create policy "comercial acessa clientes" on customers for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'));

create policy "comercial acessa pedidos" on orders for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'));

create policy "comercial acessa itens do pedido" on order_items for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.department = 'comercial'));
