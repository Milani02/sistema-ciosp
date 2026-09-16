-- ============================================================
-- Migração: novo departamento "caixa" — login exclusivo pra quem
-- fica só na função de confirmar pagamento em dinheiro e separar/
-- entregar pedido, sem ver Venda, Produtos nem Histórico.
--
-- Também separa as policies de customers/orders/order_items por
-- ação (antes era um "for all" só): agora o caixa ganha SELECT
-- nas três e UPDATE em orders, mas não INSERT (quem cria pedido
-- é sempre a tela de Venda, do comercial). `products` continua
-- 100% exclusivo do comercial — o caixa não precisa do catálogo.
--
-- Roda isso no SQL Editor do Supabase (depois de
-- fix-realtime-comercial.sql).
-- ============================================================

alter table profiles drop constraint if exists profiles_department_check;
alter table profiles add constraint profiles_department_check
  check (department in ('tecnica', 'comercial', 'caixa'));

-- ---------- customers ----------
drop policy if exists "comercial acessa clientes" on customers;

create policy "comercial e caixa leem clientes" on customers for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial cria clientes" on customers for insert
  with check (has_access('comercial'));
create policy "comercial edita clientes" on customers for update
  using (has_access('comercial')) with check (has_access('comercial'));

-- ---------- orders ----------
drop policy if exists "comercial acessa pedidos" on orders;

create policy "comercial e caixa leem pedidos" on orders for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial cria pedidos" on orders for insert
  with check (has_access('comercial'));
create policy "admin comercial e caixa atualizam pedidos" on orders for update
  using (has_access('comercial', true) or has_access('caixa'))
  with check (has_access('comercial', true) or has_access('caixa'));

-- ---------- order_items ----------
drop policy if exists "comercial acessa itens do pedido" on order_items;

create policy "comercial e caixa leem itens" on order_items for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial cria itens" on order_items for insert
  with check (has_access('comercial'));
