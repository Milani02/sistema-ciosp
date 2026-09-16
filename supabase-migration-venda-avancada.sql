-- ============================================================
-- Migração: formulário de venda mais completo.
--
-- 1) Cliente ganha data de nascimento, endereço, CEP, cidade, estado
--    (todos opcionais — nem CPF nem CNPJ dependem deles).
-- 2) Produto ganha um código (SKU) opcional, único quando preenchido.
-- 3) Pagamento passa a poder ser dividido em mais de uma forma na
--    mesma venda (ex: parte cartão, parte pix). `orders.payment_method`
--    vira 'misto' nesse caso e o detalhamento (forma + valor exato de
--    cada parte) fica na tabela nova `order_payments`. Se a divisão
--    incluir uma parte em dinheiro, o pedido continua caindo em
--    "aguardando_pagamento" até o Caixa confirmar aquele dinheiro —
--    mesma regra de hoje, só que agora o Caixa vê o valor em dinheiro
--    daquele pedido (não o total), que a tela calcula somando as
--    linhas de order_payments com method='dinheiro'.
--
-- Roda isso no SQL Editor do Supabase (depois de estoque.sql).
-- ============================================================

-- ---------- customers: campos novos, todos opcionais ----------
alter table customers add column if not exists birth_date date;
alter table customers add column if not exists address text;
alter table customers add column if not exists zip_code text;
alter table customers add column if not exists city text;
alter table customers add column if not exists state text;

-- ---------- products: código (SKU) opcional ----------
alter table products add column if not exists code text;
create unique index if not exists products_code_key on products (code) where code is not null;

-- ---------- orders: nova forma de pagamento "misto" ----------
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('dinheiro','cartao','pix','misto'));

-- ---------- detalhamento do pagamento dividido ----------
create table if not exists order_payments (
  id serial primary key,
  order_id int not null references orders(id) on delete cascade,
  method text not null check (method in ('dinheiro','cartao','pix')),
  amount numeric(10,2) not null check (amount > 0)
);

alter table order_payments enable row level security;

create policy "comercial e caixa leem pagamentos" on order_payments for select
  using (has_access('comercial') or has_access('caixa'));
create policy "comercial cria pagamentos" on order_payments for insert
  with check (has_access('comercial'));

grant select, insert on order_payments to authenticated;
alter publication supabase_realtime add table order_payments;
